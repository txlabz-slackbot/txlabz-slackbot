import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth-options";
import { connectToDatabase } from "../../../../lib/db";
import { calculateFirstOccurrence, pktLocalStringToUtcDate } from "../../../../lib/time";
import Reminder from "../../../../models/Reminder";

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  // FIX: Destructure id from params before the try block
  const { id } = params;

  try {
    await connectToDatabase();
    const body = await req.json();
    
    // Fetch existing reminder to compare changes
    const existing = await Reminder.findById(id);
    if (!existing) {
      return new Response("Reminder not found", { status: 404 });
    }
    
    const merged = { ...existing.toObject(), ...body };
    let scheduleChanged = false;
    let frequencyChanged = body.frequency && body.frequency !== existing.frequency;
    const timeChanged = body.time && body.time !== existing.time;
    const dayChanged = body.dayOfWeek && body.dayOfWeek !== existing.dayOfWeek;
    const schedulePayload = { ...body };

    if (merged.frequency === "once") {
      if (body.scheduleAt) {
        const parsed = pktLocalStringToUtcDate(body.scheduleAt);
        schedulePayload.scheduleAt = parsed;
        scheduleChanged = parsed.getTime() !== existing.scheduleAt.getTime();
      }
    } else if (merged.frequency === "daily" || merged.frequency === "weekly") {
      if (body.scheduleAt) {
        const parsed = pktLocalStringToUtcDate(body.scheduleAt);
        schedulePayload.scheduleAt = parsed;
        scheduleChanged = parsed.getTime() !== existing.scheduleAt.getTime();
      } else if (frequencyChanged || timeChanged || dayChanged) {
        schedulePayload.scheduleAt = calculateFirstOccurrence(merged, new Date());
        scheduleChanged = true;
      }
    }

    // If schedule or frequency changed, reset sent flag to allow rescheduling
    // This ensures edited reminders are picked up by the scheduler at the new time
    if (scheduleChanged || frequencyChanged) {
      schedulePayload.sent = false;
    }
    
    // Use the destructured id variable here
    const updated = await Reminder.findByIdAndUpdate(id, schedulePayload, { new: true });
    
    return Response.json({ item: updated });
  } catch (error) {
    console.error("Failed to update reminder:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  // FIX: Destructure id from params before the try block
  const { id } = params;

  try {
    await connectToDatabase();
    // Use the destructured id variable here
    const deletedReminder = await Reminder.findByIdAndDelete(id);

    if (!deletedReminder) {
      return new Response("Reminder not found", { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete reminder:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
