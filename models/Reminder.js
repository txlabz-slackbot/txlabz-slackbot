import mongoose from "mongoose";

const DeliverySchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
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
  },
  { timestamps: true }
);

// Ensure schema updates take effect during dev hot-reload
if (mongoose.models.Reminder) {
  delete mongoose.models.Reminder;
}
export default mongoose.model("Reminder", ReminderSchema);