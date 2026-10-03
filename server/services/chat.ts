// Built-in live chat (FR-CHAT-001..005). Visitors hold an opaque token; staff reply from the admin inbox.
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { normalisePhone } from "@/lib/phone";
import { normaliseEmail } from "@/lib/email";
import { makeReference } from "@/lib/reference";
import type { Actor } from "./actor";

const MAX_BODY = 2000;

function parseContact(contact: string | undefined) {
  const c = (contact ?? "").trim();
  return { phone: normalisePhone(c), email: normaliseEmail(c) };
}

async function findLead(contact: string | undefined) {
  const { phone, email } = parseContact(contact);
  if (!phone && !email) return null;
  return db.lead.findFirst({ where: { OR: [...(phone ? [{ phoneE164: phone }] : []), ...(email ? [{ email }] : [])] }, orderBy: { createdAt: "desc" } });
}

export async function startChat(input: { name?: string; contact?: string; pagePath?: string }) {
  const token = crypto.randomBytes(24).toString("base64url");
  const lead = await findLead(input.contact);
  const t = await db.chatThread.create({
    data: { visitorToken: token, name: input.name?.trim().slice(0, 80) || null, contact: input.contact?.trim().slice(0, 120) || null, pagePath: input.pagePath?.slice(0, 300) || null, leadId: lead?.id ?? null },
  });
  return { token, threadId: t.id };
}

async function openThread(token: string) {
  const t = await db.chatThread.findUnique({ where: { visitorToken: token } });
  if (!t) throw new Error("Chat not found");
  if (t.status !== "OPEN") throw new Error("This chat has been closed. Start a new one.");
  return t;
}

/** Visitor message. Outside office hours with contact details, the chat becomes a lead (FR-CHAT-002). */
export async function postVisitorMessage(token: string, body: string, opts: { offline?: boolean } = {}) {
  const text = body.trim().slice(0, MAX_BODY);
  if (!text) throw new Error("Empty message");
  const t = await openThread(token);
  await db.$transaction([
    db.chatMessage.create({ data: { threadId: t.id, sender: "VISITOR", body: text } }),
    db.chatThread.update({ where: { id: t.id }, data: { lastMessageAt: new Date(), unreadByStaff: { increment: 1 } } }),
  ]);
  if (opts.offline && !t.leadId) {
    const { phone, email } = parseContact(t.contact ?? undefined);
    if (phone || email) {
      const lead = await db.lead.create({
        data: { reference: makeReference("ZN", new Date().getFullYear(), crypto.randomInt(1, 99999)), name: t.name || "Chat visitor", phoneE164: phone, email, note: text, source: "chat", pagePath: t.pagePath },
      });
      await db.leadActivity.create({ data: { leadId: lead.id, type: "enquiry", payload: { source: "chat", note: text } } });
      await db.chatThread.update({ where: { id: t.id }, data: { leadId: lead.id } });
    }
  } else if (t.leadId) {
    await db.leadActivity.create({ data: { leadId: t.leadId, type: "chat", payload: { text } } });
  }
}

export async function chatTranscript(token: string, since?: Date) {
  const t = await db.chatThread.findUnique({ where: { visitorToken: token } });
  if (!t) throw new Error("Chat not found");
  return db.chatMessage.findMany({ where: { threadId: t.id, ...(since ? { createdAt: { gt: since } } : {}) }, orderBy: { createdAt: "asc" }, select: { id: true, sender: true, body: true, createdAt: true } });
}

export async function staffReply(actor: Actor, threadId: string, body: string) {
  assertCan(actor.role, "leads.edit");
  const text = body.trim().slice(0, MAX_BODY);
  if (!text) return;
  await db.$transaction([
    db.chatMessage.create({ data: { threadId, sender: "STAFF", authorId: actor.id, body: text } }),
    db.chatThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date(), unreadByStaff: 0 } }),
  ]);
}

export async function closeChat(actor: Actor, threadId: string) {
  assertCan(actor.role, "leads.edit");
  await db.chatThread.update({ where: { id: threadId }, data: { status: "CLOSED" } });
}

export async function linkChatToLead(actor: Actor, threadId: string, leadId: string) {
  assertCan(actor.role, "leads.edit");
  await db.chatThread.update({ where: { id: threadId }, data: { leadId } });
}
