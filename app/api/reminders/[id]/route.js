import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth-options";
import { connectToDatabase } from "../../../../lib/db";
import Reminder from "../../../../models/Reminder";

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  // FIX: Destructure id from params before the try block
  const { id } = params;

  try {
    await connectToDatabase();
    const body = await req.json();
    // Use the destructured id variable here
    const updated = await Reminder.findByIdAndUpdate(id, body, { new: true });
    
    if (!updated) {
      return new Response("Reminder not found", { status: 404 });
    }
    
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