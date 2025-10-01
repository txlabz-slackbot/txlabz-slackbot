import { runDueReminders } from "@/lib/scheduler";

export async function POST() {

  try {
    const results = await runDueReminders(new Date());
    return Response.json({ ok: true, count: results.length, results });
  } catch (e) {
    return new Response("Cron failed", { status: 500 });
  }
}