import { NextResponse } from "next/server";
import { getTeamProfile } from "../../../../lib/slack";

export async function GET(request) {
  // Secure the endpoint so only you can access it
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const profileFields = await getTeamProfile();

    // We only need the ID and label for this
    const fieldInfo = profileFields.map(field => ({
      id: field.id,
      label: field.label
    }));

    return NextResponse.json({ fields: fieldInfo });

  } catch (e) {
    console.error("Failed to get team profile fields:", e);
    return new Response("Failed to get team profile fields", { status: 500 });
  }
}
