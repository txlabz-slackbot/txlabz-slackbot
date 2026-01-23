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
  const startTime = Date.now();
  const VERCEL_TIMEOUT_MS = 300000; // 300 seconds
  const SAFE_EXIT_THRESHOLD_MS = 20000; // Exit 20s before timeout
  const BATCH_SIZE = 50;

  console.log(`[Cron] Starting runDueReminders at ${now.toISOString()}`);
  
  await connectToDatabase();
  
  // 1. Fetch a limited batch of reminders to process
  // We exclude reminders that are currently being processed by another instance
  // (lock expires after 10 minutes)
  const lockingThreshold = new Date(Date.now() - 10 * 60 * 1000);
  const reminders = await Reminder.find({ 
    isPaused: false, 
    sent: false, 
    scheduleAt: { $lte: now },
    $or: [
      { processingStartedAt: { $exists: false } },
      { processingStartedAt: { $lt: lockingThreshold } }
    ]
  })
  .sort({ scheduleAt: 1 })
  .limit(BATCH_SIZE)
  .lean();

  console.log(`[Cron] Found ${reminders.length} due reminders (Batch size: ${BATCH_SIZE})`);

  if (reminders.length === 0) {
    return [];
  }

  // 2. Lock the reminders immediately
  const reminderIds = reminders.map(r => r._id);
  await Reminder.updateMany(
    { _id: { $in: reminderIds } },
    { $set: { processingStartedAt: new Date() } }
  );

  const results = [];

  // 3. Process reminders sequentially
  for (const r of reminders) {
    // 4. Early Exit Check
    const elapsed = Date.now() - startTime;
    if (elapsed > (VERCEL_TIMEOUT_MS - SAFE_EXIT_THRESHOLD_MS)) {
      console.warn(`[Cron] Approaching timeout (${elapsed}ms elapsed). Stopping batch early.`);
      break;
    }

    try {
      console.log(`[Cron] Processing reminder ${r._id} to channel ${r.channelId}`);
      
      // Send the message to Slack
      if (r.targetSlackUserId) {
        try {
          await postEphemeralWithRetry({
            channel: r.channelId,
            user: r.targetSlackUserId,
            text: r.message,
          });
        } catch (err) {
          const code = err?.data?.error || err?.code;
          if (code === "not_in_channel" || code === "user_not_in_channel" || code === "channel_not_found") {
            console.log(`[Cron] Ephemeral failed (${code}), falling back to public message`);
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
        $unset: { processingStartedAt: "" } // Unlock
      };
      
      if (isRecurring) {
        const nextOccurrence = calculateNextOccurrence(r, now);
        updateFields.$set = { scheduleAt: nextOccurrence };
      } else {
        updateFields.$set = { sent: true };
      }
      
      // Update the reminder in the database
      await Reminder.updateOne({ _id: r._id }, updateFields);
      
      results.push({ 
        id: r._id.toString(), 
        sent: true, 
        channelId: r.channelId,
        frequency: r.frequency,
        nextOccurrence: isRecurring ? updateFields.$set.scheduleAt : null
      });
    } catch (err) {
      console.error(`[Cron] Failed to process reminder ${r._id}:`, err);
      
      await Reminder.updateOne(
        { _id: r._id },
        { 
          $push: { deliveries: { at: now, ok: false, error: err?.message || "Unknown error" } },
          $unset: { processingStartedAt: "" } // Unlock for retry
        }
      );
      
      results.push({ id: r._id.toString(), sent: false, error: err?.message });
    }
  }

  // 5. Cleanup: If we exited early, unlock the remaining reminders in this batch
  const processedIds = results.map(res => res.id);
  const remainingIds = reminderIds.filter(id => !processedIds.includes(id.toString()));
  
  if (remainingIds.length > 0) {
    console.log(`[Cron] Unlocking ${remainingIds.length} unprocessed reminders`);
    await Reminder.updateMany(
      { _id: { $in: remainingIds } },
      { $unset: { processingStartedAt: "" } }
    );
  }

  const totalElapsed = Date.now() - startTime;
  console.log(`[Cron] Completed run. Processed ${results.length}/${reminders.length} reminders in ${totalElapsed}ms`);
  
  return results;
}
