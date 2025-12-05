import { runDueReminders } from "../../../../lib/scheduler";
import { NextResponse } from "next/server";

// Shared logic for both GET and POST
async function handleCronRequest(request) {
  // Vercel Cron sends the secret in the Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const results = await runDueReminders(new Date());
    return NextResponse.json({ ok: true, count: results.length, results });
  } catch (e) {
    console.error("Cron job failed:", e);
    return new Response("Cron job failed", { status: 500 });
  }
}

// Support GET method (Vercel Cron uses GET by default)
export async function GET(request) {
  return handleCronRequest(request);
}

// Support POST method (for manual testing)
export async function POST(request) {
  return handleCronRequest(request);
}