import { runDueReminders } from "../../../../lib/scheduler";
import { NextResponse } from "next/server";

export async function POST(request) {
  
  // This ensures that only requests with the correct secret can run the job.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Focused Logic (Prevents Timeouts)
  // The function now only does what's necessary: running due reminders.
  try {
    const results = await runDueReminders(new Date());
    return NextResponse.json({ ok: true, count: results.length, results });
  } catch (e) {
    console.error("Cron job failed:", e);
    // Use NextResponse for consistent error handling
    return new Response("Cron job failed", { status: 500 });
  }
}