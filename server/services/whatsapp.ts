// WhatsApp Cloud API: inbound webhook capture (FR-NOTIF-006) and template sending (FR-NOTIF-005).
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { normalisePhone } from "@/lib/phone";
import { makeReference } from "@/lib/reference";

export function verifyWhatsAppSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

interface InboundPayload {
  entry?: { changes?: { value?: { contacts?: { profile?: { name?: string } }[]; messages?: { from: string; id: string; type: string; text?: { body?: string } }[] } }[] }[];
}

const STOP = /^(stop|unsubscribe|cancel|end|quit)$/i;

export async function handleWhatsAppInbound(payload: InboundPayload): Promise<number> {
  let handled = 0;
  for (const e of payload.entry ?? []) {
    for (const c of e.changes ?? []) {
      const name = c.value?.contacts?.[0]?.profile?.name;
      for (const m of c.value?.messages ?? []) {
        const phone = normalisePhone(`+${m.from}`);
        if (!phone) continue;
        const text = (m.type === "text" ? m.text?.body ?? "" : `[${m.type} message]`).slice(0, 2000);
        let lead = await db.lead.findFirst({ where: { phoneE164: phone }, orderBy: { createdAt: "desc" } });
        if (!lead) {
          lead = await db.lead.create({
            data: { reference: makeReference("ZN", new Date().getFullYear(), crypto.randomInt(1, 99999)), name: name?.slice(0, 80) || "WhatsApp contact", phoneE164: phone, source: "whatsapp", note: text, whatsappOptIn: true },
          });
        }
        if (STOP.test(text.trim())) {
          await db.lead.update({ where: { id: lead.id }, data: { whatsappOptIn: false } });
          await db.leadActivity.create({ data: { leadId: lead.id, type: "opt-out", payload: { channel: "whatsapp" } } });
        } else {
          await db.leadActivity.create({ data: { leadId: lead.id, type: "whatsapp-in", payload: { text, messageId: m.id } } });
          await db.lead.update({ where: { id: lead.id }, data: { readAt: null } });
        }
        handled++;
      }
    }
  }
  return handled;
}

/** Template message via the Cloud API. Used by the notification transport when configured. */
export async function sendWhatsAppTemplate(to: string, template: string, params: string[]) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return; // not configured: recorded only
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: { name: template, language: { code: "en" }, components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p })) }] },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`WhatsApp responded ${res.status}`);
}
