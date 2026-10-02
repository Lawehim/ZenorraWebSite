// Plain, branded transactional messages. Every value is escaped for HTML.
import { escapeHtml } from "@/lib/richtext/sanitize";

const APP_URL = () => process.env.APP_URL ?? "http://localhost:3000";

export interface Rendered {
  subject: string;
  text: string;
  html: string;
}

type P = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

function wrap(title: string, rows: string[], footer = "You're receiving this because you contacted Zenorra Limited. Reply STOP or use the unsubscribe link in marketing emails to opt out of marketing."): string {
  return `<!doctype html><html><body style="margin:0;background:#0E0D0B;font-family:Helvetica,Arial,sans-serif;color:#F4EFE4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#191612;border:1px solid #3a3020">
<tr><td style="padding:24px 28px;border-bottom:1px solid #3a3020;font-size:12px;letter-spacing:3px;color:#E4B04A">ZENORRA LIMITED</td></tr>
<tr><td style="padding:28px"><h1 style="font-weight:400;font-size:22px;margin:0 0 16px">${escapeHtml(title)}</h1>${rows.join("")}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #3a3020;font-size:11px;color:#9A917F">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

const para = (t: string) => `<p style="font-size:15px;line-height:1.6;color:#D9D2C3;margin:0 0 14px">${escapeHtml(t)}</p>`;
const row = (k: string, v: string) => (v ? `<tr><td style="padding:6px 12px 6px 0;color:#9A917F;font-size:13px;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;font-size:14px">${escapeHtml(v)}</td></tr>` : "");

const BRIEF_FIELDS: [string, string][] = [
  ["Reference", "reference"],
  ["Name", "name"],
  ["Phone", "phone"],
  ["Email", "email"],
  ["Objective", "objective"],
  ["Locations", "locations"],
  ["Budget", "budget"],
  ["Timeline", "timeline"],
  ["Buying from", "residency"],
  ["Enquiry type", "enquiryType"],
  ["Note", "note"],
  ["Page", "page"],
  ["Source", "source"],
];

const TEMPLATES: Record<string, (p: P) => Rendered> = {
  "lead.received": (p) => {
    const first = s(p.name).split(/\s+/)[0] || "there";
    const lines = [`Hello ${first},`, `Thank you for contacting Zenorra Limited. Your reference is ${s(p.reference)}.`, "An advisor will call you within one business day. If you need us sooner, reply to this email or WhatsApp +234 703 234 5179.", "We will only use your details to respond to this enquiry unless you opted in to market notes. You can unsubscribe at any time."];
    return { subject: `We've received your enquiry — ${s(p.reference)}`, text: lines.join("\n\n"), html: wrap("We've received your enquiry", lines.map(para)) };
  },
  "lead.internal": (p) => {
    const text = BRIEF_FIELDS.map(([k, f]) => (s(p[f]) ? `${k}: ${s(p[f])}` : "")).filter(Boolean).join("\n");
    const tag = s(p.residency).toLowerCase().includes("diaspora") ? "Diaspora " : "";
    return {
      subject: `${p.merged ? "Repeat" : "New"} ${tag}lead ${s(p.reference)} — ${s(p.name)}`,
      text: `${text}\n\nOpen in the portal: ${APP_URL()}/admin/leads`,
      html: wrap(`${p.merged ? "Repeat enquiry" : "New lead"}: ${s(p.name)}`, [`<table role="presentation">${BRIEF_FIELDS.map(([k, f]) => row(k, s(p[f]))).join("")}</table>`, para(`Open in the portal: ${APP_URL()}/admin/leads`)], "Internal notification — contains personal data. Do not forward."),
    };
  },
  "booking.sms": (p) => ({ subject: "Inspection booked", text: s(p.text), html: para(s(p.text)) }),
  "newsletter.confirm": (p) => {
    const link = `${APP_URL()}/api/subscribe/confirm?token=${encodeURIComponent(s(p.token))}`;
    const lines = ["Please confirm you'd like Zenorra's monthly market notes.", `Confirm here: ${link}`, "This link expires in 7 days. If you didn't sign up, ignore this email and nothing will happen."];
    return { subject: "Confirm your Zenorra subscription", text: lines.join("\n\n"), html: wrap("Confirm your subscription", lines.map(para)) };
  },
  "auth.locked": (p) => {
    const lines = [`Hello ${s(p.name)},`, "Your Zenorra admin account was locked after 10 failed sign-in attempts. It unlocks automatically after 15 minutes, or a Super Admin can unlock it now.", "If this wasn't you, tell your administrator straight away."];
    return { subject: "Your Zenorra admin account was locked", text: lines.join("\n\n"), html: wrap("Account locked", lines.map(para), "Security notification") };
  },
  "auth.invite": (p) => {
    const link = `${APP_URL()}/admin/accept-invite?token=${encodeURIComponent(s(p.token))}`;
    const lines = [`Hello ${s(p.name)},`, `You've been invited to the Zenorra admin portal${p.invitedBy ? ` by ${s(p.invitedBy)}` : ""}.`, `Set your password here (valid for 72 hours): ${link}`];
    return { subject: "Your invitation to the Zenorra admin portal", text: lines.join("\n\n"), html: wrap("You're invited", lines.map(para), "Security notification") };
  },
};

export function renderMessage(template: string, payload: P): Rendered {
  const t = TEMPLATES[template];
  if (t) return t(payload);
  return { subject: "Message from Zenorra", text: JSON.stringify(payload), html: wrap("Message from Zenorra", [para(JSON.stringify(payload))]) };
}
