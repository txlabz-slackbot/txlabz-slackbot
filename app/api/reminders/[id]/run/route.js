import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth-options"; // Corrected Path
import { connectToDatabase } from "../../../../../lib/db";
import Reminder from "../../../../../models/Reminder";
import { postMessageWithRetry } from "../../../../../lib/slack";

// ...

export async function POST(_req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  await connectToDatabase();
  const r = await Reminder.findById(params.id);
  if (!r) return new Response("Not found", { status: 404 });

  try {
    await postMessageWithRetry({ channel: r.channelId, text: r.message });
    const now = new Date();
    r.sent = true;
    r.deliveries.push({ at: now, ok: true });
    await r.save();
    return Response.json({ ok: true, id: r._id.toString(), lastRunAt: now });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}