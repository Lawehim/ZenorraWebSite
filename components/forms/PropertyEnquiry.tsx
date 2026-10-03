"use client";
// Property-specific enquiry: the property is pre-filled and the location step is skipped (FR-LEAD-016).
import { useState } from "react";
import { validateContactStep } from "@/lib/leads/wizard";
import { formContext } from "@/lib/attribution";
import { Field } from "@/components/ui/Field";
import { postJson } from "./types";

export function PropertyEnquiry({ slug, name, corridor }: { slug: string; name: string; corridor: string }) {
  const [v, setV] = useState({ name: "", phone: "", email: "", note: "", callbackWindow: "", website: "" });
  const [whatsapp, setWhatsapp] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateContactStep(v);
    if (!check.ok) {
      setErrors({ [check.field]: check.message });
      document.getElementById(`pe-${check.field}`)?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const r = await postJson("/api/leads", { source: "property", ...v, corridors: [corridor], propertySlug: slug, whatsappOptIn: whatsapp, marketingConsent: consent, ...formContext() });
      setMsg(r.ok ? { ok: true, text: `Thank you — an advisor will contact you about ${name}. Reference ${r.reference}.` } : { ok: false, text: r.message });
      if (!r.ok && r.errors) setErrors(r.errors);
    } catch {
      setMsg({ ok: false, text: "Couldn't send — check your connection. Your details are still here." });
    } finally {
      setBusy(false);
    }
  }

  if (msg?.ok) return <p className="form-ok" role="status">{msg.text}</p>;
  return (
    <form onSubmit={submit} noValidate aria-label={`Enquire about ${name}`}>
      {msg && (
        <p className="form-alert" role="alert">
          {msg.text}
        </p>
      )}
      <div className="two-up">
        <Field label="Full name" id="pe-name" error={errors.name}>
          {(p) => <input {...p} className="inp" autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
        </Field>
        <Field label="Phone / WhatsApp" id="pe-phone" error={errors.phone}>
          {(p) => <input {...p} className="inp" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />}
        </Field>
      </div>
      <div className="two-up">
        <Field label="Email (optional)" id="pe-email" error={errors.email}>
          {(p) => <input {...p} className="inp" type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />}
        </Field>
        <Field label="Best time to call" id="pe-callbackWindow">
          {(p) => (
            <select {...p} className="inp" value={v.callbackWindow} onChange={(e) => setV({ ...v, callbackWindow: e.target.value })}>
              <option value="">Any time</option>
              <option>Morning (9–12)</option>
              <option>Afternoon (12–4)</option>
              <option>Evening (4–7)</option>
              <option>Weekend</option>
            </select>
          )}
        </Field>
      </div>
      <Field label="Question (optional)" id="pe-note">
        {(p) => <textarea {...p} className="inp" rows={3} maxLength={2000} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder={`e.g. Is a corner plot available at ${name}?`} />}
      </Field>
      <label className="consent">
        <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} />
        <span>Send booking confirmations and reminders on WhatsApp.</span>
      </label>
      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Send me market notes and new-estate alerts. I can unsubscribe any time.</span>
      </label>
      <div className="hp" aria-hidden="true">
        <input tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} />
      </div>
      <button className="btn btn-gold" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
