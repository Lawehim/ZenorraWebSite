// Buyer support requests against a plot (FR-PORT-008).
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { makeReference } from "@/lib/reference";
import { enqueue } from "./notifications";
import { audit } from "./audit";
import type { Actor } from "./actor";

export async function createTicket(buyerId: string, input: { purchaseId?: string; subject: string; body: string }) {
  const subject = input.subject.trim().slice(0, 140);
  const body = input.body.trim().slice(0, 4000);
  if (!subject || !body) throw new Error("Add a subject and a message.");
  if (input.purchaseId && !(await db.purchase.findFirst({ where: { id: input.purchaseId, buyerId } }))) throw new Error("That plot isn't on your account.");
  const t = await db.supportTicket.create({ data: { reference: makeReference("ST", new Date().getFullYear(), crypto.randomInt(1, 99999)), buyerId, purchaseId: input.purchaseId ?? null, subject, body } });
  const admins = await db.user.findMany({ where: { role: { in: ["ADMINISTRATOR", "SUPER_ADMIN"] }, status: "ACTIVE" }, select: { email: true } });
  for (const a of admins) await enqueue({ channel: "email", to: a.email, template: "ticket.new", payload: { reference: t.reference, subject } });
  return t;
}

export async function replyTicket(actor: Actor, ticketId: string, reply: string) {
  assertCan(actor.role, "buyers.view");
  const text = reply.trim().slice(0, 4000);
  if (!text) return;
  const t = await db.supportTicket.update({ where: { id: ticketId }, data: { reply: text, status: "ANSWERED" }, include: { buyer: true } });
  await audit(actor, "ticket.reply", "SupportTicket", ticketId);
  const to = t.buyer.email ?? t.buyer.phoneE164;
  if (to) await enqueue({ channel: t.buyer.email ? "email" : "sms", to, template: "ticket.reply", payload: { reference: t.reference, subject: t.subject, reply: text } });
}

export async function closeTicket(actor: Actor, ticketId: string) {
  assertCan(actor.role, "buyers.view");
  await db.supportTicket.update({ where: { id: ticketId }, data: { status: "CLOSED" } });
}
