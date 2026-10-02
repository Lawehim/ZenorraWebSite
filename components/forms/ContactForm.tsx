"use client";
import { useState } from "react";
import type { ContentOf } from "@/lib/content/registry";
import { ENQUIRY_TYPES } from "@/lib/validation/public";
import { validateContactStep } from "@/lib/leads/wizard";
import { formContext } from "@/lib/attribution";
import { Field } from "@/components/ui/Field";
import { postJson } from "./types";

const MAX = 2000;

export function ContactForm({ copy }: { copy: ContentOf<"contact.form"> }) {
  const [v, setV] = useState({ name: "", phone: "", email: "", enquiryType: "property", message: "", callbackWindow: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateContactStep(v);
    if (!check.ok) {
      setErrors({ [check.field]: check.message });
      document.getElementById(`ct-${check.field}`)?.focus();
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      const r = await postJson("/api/contact", { ...v, marketingConsent: consent, ...formContext() });
      if (r.ok) setDone(r.reference);
      else if (r.field) {
        setErrors(r.errors ?? { [r.field]: r.message });
        document.getElementById(`ct-${r.field}`)?.focus();
      } else setFailure(r.message);
    } catch {
      setFailure("We couldn't send your message — check your connection. Your message is still here.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="panel brackets" role="status">
        <div className="done">
          <div className="seal" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 12.5l5.2 5.2L20 7" />
            </svg>
          </div>
          <h3>{copy.successTitle}</h3>
          <p>{copy.successBody}</p>
          <p className="mono" style={{ fontSize: ".75rem", letterSpacing: ".14em", color: "var(--ink-3)", marginTop: "1rem" }}>
            REFERENCE {done}
          </p>
        </div>
      </div>
    );
  }

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value.slice(0, k === "message" ? MAX : 200) });
  return (
    <form onSubmit={submit} noValidate aria-label="Contact form">
      <noscript>
        <p className="form-alert">This form needs JavaScript. You can call or email us using the details alongside.</p>
      </noscript>
      {failure && (
        <div className="form-alert" role="alert">
          <span>{failure}</span>
          <button type="submit" className="btn btn-line btn-sm">
            Try again
          </button>
        </div>
      )}
      <div className="two-up">
        <Field label="Full name" id="ct-name" error={errors.name}>
          {(p) => <input {...p} className="inp" autoComplete="name" value={v.name} onChange={set("name")} />}
        </Field>
        <Field label="Phone / WhatsApp" id="ct-phone" error={errors.phone}>
          {(p) => <input {...p} className="inp" type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={set("phone")} />}
        </Field>
      </div>
      <Field label="Email" id="ct-email" error={errors.email} help="Phone or email — at least one.">
        {(p) => <input {...p} className="inp" type="email" autoComplete="email" value={v.email} onChange={set("email")} />}
      </Field>
      <Field label="What is this about?" id="ct-enquiryType" error={errors.enquiryType}>
        {(p) => (
          <select {...p} className="inp" value={v.enquiryType} onChange={set("enquiryType")}>
            {ENQUIRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Best time to call back" id="ct-callbackWindow" help="Requests outside office hours are queued for the next working morning.">
        {(p) => (
          <select {...p} className="inp" value={v.callbackWindow} onChange={set("callbackWindow")}>
            <option value="">Any time</option>
            <option>Morning (9–12)</option>
            <option>Afternoon (12–4)</option>
            <option>Evening (4–7)</option>
            <option>Weekend</option>
          </select>
        )}
      </Field>
      <Field label="Your message" id="ct-message" error={errors.message}>
        {(p) => <textarea {...p} className="inp" value={v.message} onChange={set("message")} placeholder="Tell us what you are trying to achieve." />}
      </Field>
      <p className="counter" aria-live="polite">
        {v.message.length} / {MAX}
      </p>
      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Send me Zenorra market notes and new-estate alerts. I can unsubscribe at any time.</span>
      </label>
      <div className="hp" aria-hidden="true">
        <input tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} />
      </div>
      <button className="btn btn-gold" type="submit" disabled={busy}>
        {busy ? "Sending…" : copy.submitLabel}
      </button>
    </form>
  );
}
