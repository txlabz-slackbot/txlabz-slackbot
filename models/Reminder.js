import mongoose from "mongoose";

const DeliverySchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    // Scheduled slot the delivery was intended for
    scheduledFor: { type: Date },
    // When the attempt started / completed
    attemptedAt: { type: Date },
    deliveredAt: { type: Date },
    ok: { type: Boolean, required: true },
    error: { type: String },
  },
  { _id: false }
);

const ReminderSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    channelId: { type: String, required: true },
    channelName: { type: String },
    // Optional: target Slack user in the selected channel for ephemeral notifications.
    // When null/undefined, reminder behaves as a normal channel message.
    targetSlackUserId: { type: String, default: null },
    scheduleAt: { type: Date, required: true },
    isPaused: { type: Boolean, default: false },
    // Flag for one-time reminders
    sent: { type: Boolean, default: false }, 
    // New fields for recurring reminders
    frequency: { type: String, enum: ['once', 'daily', 'weekly'], default: 'once' },
    time: { type: String }, // e.g., "09:00"
    dayOfWeek: { type: String }, // e.g., "1" for Monday
    
    deliveries: { type: [DeliverySchema], default: [] },
    createdBy: { type: String },
    // Field to lock the reminder during processing to prevent duplicate runs
    processingStartedAt: { type: Date },
    // New lock fields for safe, idempotent processing
    lockId: { type: String },
    lockUntil: { type: Date },
    // Retry scheduling + audit
    retryAt: { type: Date },
    lastAttemptAt: { type: Date },
    lastDeliveredAt: { type: Date },
    // Track failures to prevent "poison pill" reminders from blocking the queue
    failureCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Ensure schema updates take effect during dev hot-reload
if (mongoose.models.Reminder) {
  delete mongoose.models.Reminder;
}
export default mongoose.model("Reminder", ReminderSchema);
