import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getChannelMembers } from "@/lib/slack";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    return Response.json({ error: "channelId is required" }, { status: 400 });
  }

  try {
    const members = await getChannelMembers(channelId);
    return Response.json({ members });
  } catch (e) {
    console.error("Failed to fetch channel members:", e);
    return Response.json(
      { error: e?.message || "Failed to fetch channel members" },
      { status: 500 }
    );
  }
}

