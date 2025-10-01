import { connectToDatabase } from "./db";
import Reminder from "../models/Reminder";
import { postMessageWithRetry } from "./slack";

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
      
      // Update the reminder in the database to mark it as sent
      await Reminder.updateOne(
        { _id: r._id },
        {
          $set: { sent: true },
          $push: { deliveries: { at: now, ok: true } },
        }
      );
      
      return { id: r._id.toString(), sent: true, channelId: r.channelId };
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