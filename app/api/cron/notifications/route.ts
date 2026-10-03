// Called every few minutes by the platform scheduler (Vercel Cron). Protected by CRON_SECRET.
// Delivers queued messages and runs the time-based jobs; each job is idempotent.
import { processQueue, logTransport } from "@/server/services/notifications";
import { resolveTransport } from "@/server/services/transports";
import { purgeUnconfirmed } from "@/server/services/subscribers";
import { escalateOverdueLeads } from "@/server/services/assignment";
import { sendInspectionReminders, sendDailyDigest } from "@/server/services/scheduled";
import { sendPaymentReminders } from "@/server/services/payments";
import { json } from "@/server/http";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return json({ ok: false }, 401);
  const now = new Date();
  const lagosHour = new Date(now.getTime() + 3600_000).getUTCHours();
  const jobs = {
    escalated: await escalateOverdueLeads(now),
    // Customer-facing reminders go out in daytime only (09:00–19:59 WAT).
    inspectionReminders: lagosHour >= 9 && lagosHour < 20 ? await sendInspectionReminders(now) : 0,
    paymentReminders: lagosHour >= 9 && lagosHour < 20 ? await sendPaymentReminders(now) : 0,
    digest: await sendDailyDigest(now),
    purged: (await purgeUnconfirmed(now)).count,
  };
  const delivery = await processQueue(resolveTransport() ?? logTransport, now);
  return json({ ok: true, ...jobs, ...delivery });
}
