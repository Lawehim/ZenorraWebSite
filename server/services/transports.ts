// Provider adapters (SRS §7.11). Each activates only when its credentials are configured;
// otherwise messages are recorded by the log transport and visible in Admin → Notifications.
import type { Transport } from "./notifications";
import { renderMessage } from "./templates";
import { sendWhatsAppTemplate } from "./whatsapp";

const RESEND = "https://api.resend.com/emails";
const TERMII = "https://api.ng.termii.com/api/sms/send";

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
}

export function resolveTransport(): Transport | null {
  const resendKey = process.env.RESEND_API_KEY;
  const termiiKey = process.env.TERMII_API_KEY;
  const waToken = process.env.WHATSAPP_TOKEN;
  if (!resendKey && !termiiKey && !waToken) return null;
  return {
    async send(n) {
      const payload = n.payload as Record<string, unknown>;
      if (n.channel === "whatsapp") {
        // Template messages (pre-approved by Meta); params are positional {{1}}, {{2}}…
        await sendWhatsAppTemplate(n.to, n.template, ((payload.params as string[]) ?? []).map(String));
        return;
      }
      const msg = renderMessage(n.template, payload);
      if (n.channel === "email") {
        if (!resendKey) return;
        await postJson(RESEND, { from: process.env.MAIL_FROM ?? "Zenorra <no-reply@zenorra.ng>", to: n.to, subject: msg.subject, html: msg.html, text: msg.text }, { Authorization: `Bearer ${resendKey}` });
      } else if (n.channel === "sms") {
        if (!termiiKey) return;
        await postJson(TERMII, { api_key: termiiKey, to: n.to.replace(/^\+/, ""), from: process.env.TERMII_SENDER_ID ?? "Zenorra", sms: msg.text.slice(0, 160), type: "plain", channel: "generic" });
      }
    },
  };
}
