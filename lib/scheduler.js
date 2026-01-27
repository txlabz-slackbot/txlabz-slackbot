import crypto from "crypto";
import { connectToDatabase } from "./db";
import Reminder from "../models/Reminder";
import { postEphemeralWithRetry, postMessageWithRetry } from "./slack";
import { calculateNextOccurrence } from "./time";


export async function runDueReminders(now = new Date()) {
  const startTime = Date.now();
  const VERCEL_TIMEOUT_MS = 300000; // 300 seconds
  const SAFE_EXIT_THRESHOLD_MS = 30000; // Exit 30s before timeout
  const HARD_DEADLINE_MS = startTime + (VERCEL_TIMEOUT_MS - SAFE_EXIT_THRESHOLD_MS);
  const BATCH_SIZE = 50;
  const CHUNK_SIZE = 5; // Process 5 reminders in parallel
  const LOCK_TTL_MS = 5 * 60 * 1000;

  console.log(`[Cron] Starting runDueReminders at ${now.toISOString()}`);
  
  await connectToDatabase();
  
  // 1. Fetch candidate reminders (don't lock yet)
  const lockingThreshold = new Date(Date.now() - 10 * 60 * 1000);
  
  // Pick reminders due now, not locked, and not paused. Use retryAt for backoff.
  const query = { 
    isPaused: false, 
    sent: false, 
    scheduleAt: { $lte: now },
    $and: [
      {
        $or: [
          { retryAt: { $exists: false } },
          { retryAt: { $lte: now } }
        ]
      },
      {
        $or: [
          { lockUntil: { $exists: false } },
          { lockUntil: { $lte: now } }
        ]
      },
      // Legacy lock fallback for existing documents
      {
        $or: [
          { processingStartedAt: { $exists: false } },
          { processingStartedAt: { $lt: lockingThreshold } }
        ]
      }
    ],
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
    const lockId = crypto.randomUUID();
    const r = await Reminder.findOneAndUpdate(
      { 
        _id: candidate._id,
        isPaused: false,
        sent: false,
        scheduleAt: { $lte: now },
        $or: [
          { lockUntil: { $exists: false } },
          { lockUntil: { $lte: now } }
        ],
        $and: [
          {
            $or: [
              { retryAt: { $exists: false } },
              { retryAt: { $lte: now } }
            ]
          },
          {
            $or: [
              { processingStartedAt: { $exists: false } },
              { processingStartedAt: { $lt: lockingThreshold } }
            ]
          }
        ]
      },
      { $set: { processingStartedAt: new Date(), lockId, lockUntil: new Date(Date.now() + LOCK_TTL_MS) } },
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
          }, { deadlineMs: HARD_DEADLINE_MS });
        } catch (err) {
          const code = err?.data?.error || err?.code;
          if (code === "not_in_channel" || code === "user_not_in_channel" || code === "channel_not_found") {
            console.log(`[Cron] Ephemeral failed (${code}), falling back to public message`);
            await postMessageWithRetry({ channel: r.channelId, text: r.message }, { deadlineMs: HARD_DEADLINE_MS });
          } else {
            throw err;
          }
        }
      } else {
        await postMessageWithRetry({ channel: r.channelId, text: r.message }, { deadlineMs: HARD_DEADLINE_MS });
      }
      
      const isRecurring = r.frequency === 'daily' || r.frequency === 'weekly';
      
      let updateFields = {
        $push: { deliveries: { at: now, scheduledFor: r.scheduleAt, attemptedAt: now, deliveredAt: new Date(), ok: true } },
        $unset: { processingStartedAt: "", lockId: "", lockUntil: "", retryAt: "" }, // Unlock + clear retry
        $set: { failureCount: 0, lastAttemptAt: now, lastDeliveredAt: new Date() } // Reset failure count on success
      };
      
      if (isRecurring) {
        const nextOccurrence = calculateNextOccurrence(r, r.scheduleAt);
        updateFields.$set.scheduleAt = nextOccurrence;
      } else {
        updateFields.$set.sent = true;
      }
      
      await Reminder.updateOne({ _id: r._id, lockId }, updateFields);
      
      results.push({ 
        id: r._id.toString(), 
        sent: true, 
        channelId: r.channelId,
        frequency: r.frequency,
        nextOccurrence: isRecurring ? updateFields.$set.scheduleAt : null
      });
    } catch (err) {
      console.error(`[Cron] Failed to process reminder ${r._id}:`, err);
      
      const failureCount = (r.failureCount || 0) + 1;
      const backoffMs = Math.min(60 * 60 * 1000, Math.max(30 * 1000, Math.pow(2, failureCount) * 1000));
      const retryAt = new Date(Date.now() + backoffMs);

      await Reminder.updateOne(
        { _id: r._id, lockId },
        { 
          $push: { deliveries: { at: now, scheduledFor: r.scheduleAt, attemptedAt: now, ok: false, error: err?.message || "Unknown error" } },
          $unset: { processingStartedAt: "", lockId: "", lockUntil: "" }, // Unlock
          $set: { retryAt, lastAttemptAt: now },
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
