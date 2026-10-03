// Data subject requests under the NDPA (FR-ADM-053, NFR-LEG-006): find, export, erase.
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { normalisePhone } from "@/lib/phone";
import { normaliseEmail } from "@/lib/email";
import { audit } from "./audit";
import type { Actor } from "./actor";

function identify(identifier: string) {
  return { phone: normalisePhone(identifier), email: normaliseEmail(identifier) };
}

async function locate(identifier: string) {
  const { phone, email } = identify(identifier);
  if (!phone && !email) return { leads: [], subscribers: [], buyers: [], chats: [] };
  const or = [...(phone ? [{ phoneE164: phone }] : []), ...(email ? [{ email }] : [])];
  const [leads, subscribers, buyers] = await Promise.all([
    db.lead.findMany({ where: { OR: or }, include: { activities: true, consents: true, bookings: true } }),
    email ? db.subscriber.findMany({ where: { email } }) : Promise.resolve([]),
    db.buyer.findMany({ where: { OR: or } }),
  ]);
  const leadIds = leads.map((l) => l.id);
  const chats = await db.chatThread.findMany({ where: { OR: [{ leadId: { in: leadIds } }, ...(phone || email ? [{ contact: { contains: (email ?? phone)! } }] : [])] }, include: { messages: true } });
  return { leads, subscribers, buyers, chats };
}

export async function findPersonalData(actor: Actor, identifier: string) {
  assertCan(actor.role, "leads.export");
  const r = await locate(identifier);
  await audit(actor, "dsr.search", "Person", hash(identifier), { after: { leads: r.leads.length, subscribers: r.subscribers.length, buyers: r.buyers.length, chats: r.chats.length } });
  return r;
}

export async function exportPersonalData(actor: Actor, identifier: string) {
  assertCan(actor.role, "leads.export");
  const r = await locate(identifier);
  await audit(actor, "dsr.export", "Person", hash(identifier));
  return JSON.parse(JSON.stringify({ exportedAt: new Date().toISOString(), ...r, buyers: r.buyers.map(({ passwordHash: _p, inviteToken: _t, ...b }) => b) }, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

function hash(identifier: string) {
  return crypto.createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex").slice(0, 16);
}

/** Erase personal data but keep anonymised records so aggregate counts survive. */
export async function erasePersonalData(actor: Actor, identifier: string) {
  assertCan(actor.role, "dsr.erase");
  const r = await locate(identifier);
  await db.$transaction(async (tx) => {
    for (const l of r.leads) {
      await tx.lead.update({ where: { id: l.id }, data: { name: "Erased", phoneE164: null, email: null, note: null, utm: undefined, referrer: null, landingPath: null, pagePath: null, callbackWindow: null, marketingConsent: false, whatsappOptIn: false } });
      await tx.consent.updateMany({ where: { leadId: l.id }, data: { ip: null, userAgent: null } });
      await tx.leadActivity.updateMany({ where: { leadId: l.id, type: { in: ["note", "chat", "whatsapp-in"] } }, data: { payload: { erased: true } } });
    }
    for (const s of r.subscribers) await tx.subscriber.delete({ where: { id: s.id } });
    for (const c of r.chats) {
      await tx.chatMessage.updateMany({ where: { threadId: c.id }, data: { body: "[erased]" } });
      await tx.chatThread.update({ where: { id: c.id }, data: { name: null, contact: null } });
    }
    for (const b of r.buyers) {
      await tx.buyer.update({ where: { id: b.id }, data: { name: "Erased", phoneE164: null, email: null, passwordHash: null, status: "SUSPENDED" } });
      await tx.buyerSession.updateMany({ where: { buyerId: b.id }, data: { revokedAt: new Date() } });
    }
  });
  await audit(actor, "dsr.erase", "Person", hash(identifier), { after: { leads: r.leads.length, subscribers: r.subscribers.length, buyers: r.buyers.length, chats: r.chats.length } });
  return { leads: r.leads.length, subscribers: r.subscribers.length, buyers: r.buyers.length, chats: r.chats.length };
}
