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
  const SAFE_EXIT_THRESHOLD_MS = 30000; // Exit 30s before timeout
  const BATCH_SIZE = 50;
  const CHUNK_SIZE = 5; // Process 5 reminders in parallel

  console.log(`[Cron] Starting runDueReminders at ${now.toISOString()}`);
  
  await connectToDatabase();
  
  // 1. Fetch candidate reminders (don't lock yet)
  const lockingThreshold = new Date(Date.now() - 10 * 60 * 1000);
  
  // We need to pick up documents that EITHER have failureCount < 5 
  // OR don't have the failureCount field yet (legacy reminders)
  const query = { 
    isPaused: false, 
    sent: false, 
    scheduleAt: { $lte: now },
    $and: [
      {
        $or: [
          { failureCount: { $exists: false } },
          { failureCount: { $lt: 5 } }
        ]
      },
      {
        $or: [
          { processingStartedAt: { $exists: false } },
          { processingStartedAt: { $lt: lockingThreshold } }
        ]
      }
    ]
  };

  const candidates = await Reminder.find(query)
    .sort({ scheduleAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  if (candidates.length > 0) {
    console.log(`[Cron] Found ${candidates.length} candidates out of BATCH_SIZE ${BATCH_SIZE}`);
  } else {
    // Add a check to see if there are ANY overdue reminders at all to help debug
    const totalOverdue = await Reminder.countDocuments({ 
      isPaused: false, 
      sent: false, 
      scheduleAt: { $lte: now } 
    });
    if (totalOverdue > 0) {
      console.log(`[Cron] 0 candidates found for current settings, but ${totalOverdue} total overdue reminders exist. They might be locked or exceeded failureCount.`);
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  const results = [];

  // Helper to process a single reminder
  const processReminder = async (candidate) => {
    // 2. Atomic Lock: Try to claim this specific reminder
    const r = await Reminder.findOneAndUpdate(
      { 
        _id: candidate._id,
        $or: [
          { processingStartedAt: { $exists: false } },
          { processingStartedAt: { $lt: lockingThreshold } }
        ]
      },
      { $set: { processingStartedAt: new Date() } },
      { new: true }
    );

    if (!r) {
      console.log(`[Cron] Reminder ${candidate._id} already claimed or locked. Skipping.`);
      return;
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
      
      const isRecurring = r.frequency === 'daily' || r.frequency === 'weekly';
      
      let updateFields = {
        $push: { deliveries: { at: now, ok: true } },
        $unset: { processingStartedAt: "" }, // Unlock
        $set: { failureCount: 0 } // Reset failure count on success
      };
      
      if (isRecurring) {
        const nextOccurrence = calculateNextOccurrence(r, now);
        updateFields.$set.scheduleAt = nextOccurrence;
      } else {
        updateFields.$set.sent = true;
      }
      
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
          $unset: { processingStartedAt: "" }, // Unlock
          $inc: { failureCount: 1 } // Increment failure count
        }
      );
      
      results.push({ id: r._id.toString(), sent: false, error: err?.message });
    }
  };

  // 3. Process in parallel chunks to maximize throughput and safety
  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    // 4. Early Exit Check
    const elapsed = Date.now() - startTime;
    if (elapsed > (VERCEL_TIMEOUT_MS - SAFE_EXIT_THRESHOLD_MS)) {
      console.warn(`[Cron] Approaching timeout (${elapsed}ms elapsed). Stopping early.`);
      break;
    }

    const chunk = candidates.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(c => processReminder(c)));
  }

  const totalElapsed = Date.now() - startTime;
  console.log(`[Cron] Completed run. Processed ${results.length}/${candidates.length} candidates in ${totalElapsed}ms`);
  
  return results;
}
