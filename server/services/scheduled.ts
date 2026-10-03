// Jobs run by the cron endpoint (Vercel Cron in production): reminders and the daily digest.
import { db } from "@/lib/db";
import { lagosDateString } from "@/lib/bookings/dates";
import { getSettings } from "./settings";
import { enqueue } from "./notifications";

/** 24h-before SMS (and WhatsApp when opted in) for every live booking tomorrow (FR-NOTIF-004/005). */
export async function sendInspectionReminders(now: Date = new Date()): Promise<number> {
  const tomorrow = lagosDateString(new Date(now.getTime() + 86400_000));
  const settings = await getSettings();
  const bookings = await db.booking.findMany({
    where: { date: new Date(`${tomorrow}T00:00:00Z`), status: { in: ["PENDING", "CONFIRMED"] }, reminderSentAt: null },
    include: { lead: true, property: true },
  });
  let sent = 0;
  for (const b of bookings) {
    if (!b.lead.phoneE164) continue;
    const text = `Zenorra: reminder — your inspection of ${b.property?.name ?? "the estate"} is tomorrow. Departure ${b.departurePoint}. Ref ${b.reference}. Reply STOP to opt out.`.slice(0, 160);
    await enqueue({ channel: "sms", to: b.lead.phoneE164, template: "booking.reminder", payload: { text, reference: b.reference }, leadId: b.leadId });
    if (settings.whatsappMessaging.enabled && b.lead.whatsappOptIn) {
      await enqueue({ channel: "whatsapp", to: b.lead.phoneE164, template: "booking_reminder", payload: { params: [b.lead.name.split(" ")[0], b.property?.name ?? "the estate", b.departurePoint, b.reference] }, leadId: b.leadId });
    }
    await db.booking.update({ where: { id: b.id }, data: { reminderSentAt: now } });
    sent++;
  }
  return sent;
}

const DIGEST_KEY = "digest.lastSent";

/** Once a day after the configured hour (WAT): new leads, bookings and outcomes (FR-NOTIF-010). */
export async function sendDailyDigest(now: Date = new Date()): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.digest.enabled || !settings.digest.recipients.length) return false;
  const lagosHour = new Date(now.getTime() + 3600_000).getUTCHours();
  const today = lagosDateString(now);
  if (lagosHour < settings.digest.hour) return false;
  const last = await db.setting.findUnique({ where: { key: DIGEST_KEY } });
  if (last?.value === today) return false;
  const since = new Date(now.getTime() - 86400_000);
  const [leads, bookings, won, overdue, bySource] = await Promise.all([
    db.lead.count({ where: { createdAt: { gte: since } } }),
    db.booking.count({ where: { createdAt: { gte: since } } }),
    db.lead.count({ where: { status: "CLOSED_WON", updatedAt: { gte: since } } }),
    db.lead.count({ where: { status: "NEW", escalatedAt: { not: null } } }),
    db.lead.groupBy({ by: ["source"], _count: { _all: true }, where: { createdAt: { gte: since } } }),
  ]);
  for (const to of settings.digest.recipients) {
    await enqueue({ channel: "email", to, template: "digest.daily", payload: { date: today, leads, bookings, won, overdue, bySource: bySource.map((s) => `${s.source}: ${s._count._all}`).join(", ") } });
  }
  await db.setting.upsert({ where: { key: DIGEST_KEY }, create: { key: DIGEST_KEY, value: today }, update: { value: today } });
  return true;
}
