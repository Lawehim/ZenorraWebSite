// Outbox pattern (NFR-AVAIL-005): callers enqueue inside or after the lead write;
// a worker delivers with exponential backoff (FR-NOTIF-009). Providers plug in
// behind `Transport`; without credentials the log transport records the message.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient | typeof db;
export type Channel = "email" | "sms" | "whatsapp";

export interface OutboundMessage {
  channel: Channel;
  to: string;
  template: string;
  payload: Record<string, unknown>;
  leadId?: string;
}

export async function enqueue(msg: OutboundMessage, tx: Tx = db) {
  await tx.notification.create({
    data: { channel: msg.channel, to: msg.to, template: msg.template, payload: msg.payload as Prisma.InputJsonValue, leadId: msg.leadId },
  });
}

export interface Transport {
  send(n: { channel: string; to: string; template: string; payload: unknown }): Promise<void>;
}

/** Development transport: the message is considered delivered and stays visible in Admin → Notifications. */
export const logTransport: Transport = {
  async send(n) {
    if (process.env.NOTIFY_DEBUG) console.log(`[notify:${n.channel}] → ${n.to} (${n.template})`);
  },
};

export const MAX_ATTEMPTS = 3;
const BACKOFF_MINUTES = [2, 8, 20]; // three retries over ~30 minutes

export async function processQueue(transport: Transport = logTransport, now: Date = new Date(), batch = 25) {
  const due = await db.notification.findMany({
    where: { status: "QUEUED", nextAttemptAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: batch,
  });
  let sent = 0;
  let failed = 0;
  for (const n of due) {
    try {
      await transport.send(n);
      await db.notification.update({ where: { id: n.id }, data: { status: "SENT", sentAt: now, attempts: n.attempts + 1, lastError: null } });
      sent++;
    } catch (e) {
      const attempts = n.attempts + 1;
      const final = attempts >= MAX_ATTEMPTS;
      await db.notification.update({
        where: { id: n.id },
        data: {
          attempts,
          lastError: e instanceof Error ? e.message.slice(0, 500) : "Unknown error",
          status: final ? "FAILED" : "QUEUED",
          nextAttemptAt: new Date(now.getTime() + BACKOFF_MINUTES[Math.min(attempts - 1, 2)] * 60_000),
        },
      });
      if (final && n.leadId) {
        await db.leadActivity.create({ data: { leadId: n.leadId, type: "delivery-failed", payload: { channel: n.channel, to: n.to } } });
      }
      failed++;
    }
  }
  return { sent, failed };
}
