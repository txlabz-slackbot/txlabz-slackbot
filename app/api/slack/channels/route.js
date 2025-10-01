import { listChannels } from "@/lib/slack";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options.js";
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  try {
    const channels = await listChannels();
    const simplified = channels.map((c) => ({ id: c.id, name: c.name, isPrivate: c.is_private }));
    return Response.json({ channels: simplified });
  } catch (e) {
    return Response.json({ error: e?.message || "Failed to list channels" }, { status: 500 });
  }
}