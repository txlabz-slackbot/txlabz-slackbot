import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth-options";
import { connectToDatabase } from "../../../lib/db";
import Reminder from "../../../models/Reminder";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  try {
    await connectToDatabase();
    const items = await Reminder.find().sort({ createdAt: -1 }).lean();
    return Response.json({ items });
  } catch (error) {
    console.error("Failed to fetch reminders:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  try {
    await connectToDatabase();
    const body = await req.json();

    // Explicitly check if the message is missing or empty
    if (!body.message || body.message.trim() === "") {
      return new Response(JSON.stringify({ error: "Message field is required." }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = { ...body };
    if (payload.scheduleAt && typeof payload.scheduleAt === "string") {
      payload.scheduleAt = new Date(payload.scheduleAt);
    }

    const doc = await Reminder.create({ ...payload, createdBy: session.user?.email || "admin" });
    return Response.json({ item: doc });
  } catch (error) {
    console.error("Failed to create reminder:", error);
    // Return a more specific error if it's a Mongoose validation error
    if (error.name === 'ValidationError') {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}