import { connectToDatabase } from "./db";
import Reminder from "../models/Reminder";
import { postEphemeralWithRetry, postMessageWithRetry } from "./slack";

/**
 * Calculate the next occurrence for a recurring reminder
 * @param {Object} reminder - The reminder object
 * @param {Date} currentTime - The current time (in UTC)
 * @returns {Date} - The next scheduled occurrence (in UTC)
 */
function calculateNextOccurrence(reminder, currentTime) {
  // PKT is UTC+5
  const PKT_OFFSET_MS = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
  
  // Convert current UTC time to PKT for day-of-week calculations
  const currentUTC = new Date(currentTime);
  const currentPKTTimestamp = currentUTC.getTime() + PKT_OFFSET_MS;
  const currentPKT = new Date(currentPKTTimestamp);
  
  if (reminder.frequency === 'daily') {
    // For daily reminders (Monday-Friday only), find the next weekday
    let nextOccurrence = new Date(currentPKTTimestamp);
    nextOccurrence.setDate(nextOccurrence.getDate() + 1);
    
    // Set the time if specified
    if (reminder.time) {
      const [hours, minutes] = reminder.time.split(':').map(Number);
      nextOccurrence.setHours(hours, minutes, 0, 0);
    }
    
    // Skip weekends: if next day is Saturday (6) or Sunday (0), move to Monday
    let dayOfWeek = nextOccurrence.getDay();
    
    if (dayOfWeek === 6) {
      // Saturday -> add 2 days to get to Monday
      nextOccurrence.setDate(nextOccurrence.getDate() + 2);
    } else if (dayOfWeek === 0) {
      // Sunday -> add 1 day to get to Monday
      nextOccurrence.setDate(nextOccurrence.getDate() + 1);
    }
    
    // Convert back to UTC for storage
    const nextUTC = new Date(nextOccurrence.getTime() - PKT_OFFSET_MS);
    return nextUTC;
    
  } else if (reminder.frequency === 'weekly') {
    // For weekly reminders, add 7 days
    let nextOccurrence = new Date(currentPKTTimestamp);
    nextOccurrence.setDate(nextOccurrence.getDate() + 7);
    
    // Set the time if specified
    if (reminder.time) {
      const [hours, minutes] = reminder.time.split(':').map(Number);
      nextOccurrence.setHours(hours, minutes, 0, 0);
    }
    
    // Convert back to UTC for storage
    const nextUTC = new Date(nextOccurrence.getTime() - PKT_OFFSET_MS);
    return nextUTC;
  }
  
  // Fallback: return current time (shouldn't happen)
  return currentUTC;
}


export async function runDueReminders(now = new Date()) {
  await connectToDatabase();
  
  const reminders = await Reminder.find({ 
    isPaused: false, 
    sent: false, 
    scheduleAt: { $lte: now } 
  }).lean();

  if (reminders.length === 0) {
    return []; // No reminders to process
  }

  // Process all reminders in parallel to be more efficient
  const processingPromises = reminders.map(async (r) => {
    try {
      // Send the message to Slack
      if (r.targetSlackUserId) {
        try {
          await postEphemeralWithRetry({
            channel: r.channelId,
            user: r.targetSlackUserId,
            text: r.message,
          });
        } catch (err) {
          // Safe fallback: if ephemeral fails due to membership/channel issues,
          // fall back to a normal channel message to avoid losing the reminder.
          const code = err?.data?.error || err?.code;
          if (code === "not_in_channel" || code === "user_not_in_channel" || code === "channel_not_found") {
            await postMessageWithRetry({ channel: r.channelId, text: r.message });
          } else {
            throw err;
          }
        }
      } else {
        await postMessageWithRetry({ channel: r.channelId, text: r.message });
      }
      
      // Determine if this is a recurring reminder
      const isRecurring = r.frequency === 'daily' || r.frequency === 'weekly';
      
      let updateFields = {
        $push: { deliveries: { at: now, ok: true } },
      };
      
      if (isRecurring) {
        // For recurring reminders, calculate the next occurrence
        const nextOccurrence = calculateNextOccurrence(r, now);
        updateFields.$set = { scheduleAt: nextOccurrence };
        // Keep sent: false so it triggers again
      } else {
        // For one-time reminders, mark as sent
        updateFields.$set = { sent: true };
      }
      
      // Update the reminder in the database
      await Reminder.updateOne({ _id: r._id }, updateFields);
      
      return { 
        id: r._id.toString(), 
        sent: true, 
        channelId: r.channelId,
        frequency: r.frequency,
        nextOccurrence: isRecurring ? updateFields.$set.scheduleAt : null
      };
    } catch (err) {
      // If sending fails, record the error in the database
      await Reminder.updateOne(
        { _id: r._id },
        { $push: { deliveries: { at: now, ok: false, error: err?.message || "Unknown error" } } }
      );
      
      return { id: r._id.toString(), sent: false, error: err?.message };
    }
  });

  // Wait for all the reminder processing to complete
  const results = await Promise.all(processingPromises);
  
  return results;
}