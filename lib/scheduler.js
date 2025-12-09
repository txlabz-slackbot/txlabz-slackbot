import { connectToDatabase } from "./db";
import Reminder from "../models/Reminder";
import { postMessageWithRetry } from "./slack";

/**
 * Calculate the next occurrence for a recurring reminder
 * @param {Object} reminder - The reminder object
 * @param {Date} currentTime - The current time
 * @returns {Date} - The next scheduled occurrence
 */
function calculateNextOccurrence(reminder, currentTime) {
  const current = new Date(currentTime);
  
  if (reminder.frequency === 'daily') {
    // For daily reminders, add 1 day
    current.setDate(current.getDate() + 1);
    
    // If time is specified, set it
    if (reminder.time) {
      const [hours, minutes] = reminder.time.split(':').map(Number);
      current.setHours(hours, minutes, 0, 0);
    }
    
    return current;
  } else if (reminder.frequency === 'weekly') {
    // For weekly reminders, add 7 days
    current.setDate(current.getDate() + 7);
    
    // If time is specified, set it
    if (reminder.time) {
      const [hours, minutes] = reminder.time.split(':').map(Number);
      current.setHours(hours, minutes, 0, 0);
    }
    
    return current;
  }
  
  // Fallback: return current time (shouldn't happen)
  return current;
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
      await postMessageWithRetry({ channel: r.channelId, text: r.message });
      
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