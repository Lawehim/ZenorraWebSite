"use client";
import { useState } from "react";
import type { ContentOf } from "@/lib/content/registry";
import { formContext } from "@/lib/attribution";
import { normalisePhone } from "@/lib/phone";
import { Field } from "@/components/ui/Field";
import type { SubmitOutcome } from "./types";

export interface BookingFormProps {
  copy: ContentOf<"site.booking">;
  properties: { slug: string; name: string }[];
  departurePoints: string[];
  dates: string[]; // upcoming operating days only (FR-LEAD-008)
  initialProperty?: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<SubmitOutcome>;
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function BookingForm({ copy, properties, departurePoints, dates, initialProperty, onSubmit }: BookingFormProps) {
  const [v, setV] = useState({ propertySlug: initialProperty ?? "", date: dates[0] ?? "", departurePoint: departurePoints[0] ?? "", name: "", phone: "", seats: "1", website: "" });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const errs: Record<string, string> = {};
    if (!v.name.trim()) errs.name = "Enter your full name.";
    if (!normalisePhone(v.phone)) errs.phone = v.phone.trim() ? "Enter a full phone number, e.g. 0803 992 1140." : "Enter a phone or WhatsApp number.";
    if (!v.date) errs.date = "Choose an inspection date.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`bk-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const r = await onSubmit({ ...v, seats: Number(v.seats), marketingConsent: consent, ...formContext() });
      if (r.ok) setDone(r.reference);
      else if (r.field) {
        setErrors(r.errors ?? { [r.field]: r.message });
        document.getElementById(`bk-${r.field}`)?.focus();
      } else setFailure(r.message);
    } catch {
      setFailure("We couldn't reserve your seat — check your connection. Your details are still here.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="done" role="status">
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
    );
  }

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form onSubmit={submit} noValidate>
      {failure && (
        <div className="form-alert" role="alert">
          <span>{failure}</span>
          <button type="submit" className="btn btn-line btn-sm">
            Try again
          </button>
        </div>
      )}
      <Field label="Estate to inspect" id="bk-propertySlug">
        {(p) => (
          <select {...p} className="inp" value={v.propertySlug} onChange={set("propertySlug")}>
            {properties.map((pr) => (
              <option key={pr.slug} value={pr.slug}>
                {pr.name}
              </option>
            ))}
            <option value="">Not sure yet — advise me</option>
          </select>
        )}
      </Field>
      <div className="two-up">
        <Field label="Inspection date" id="bk-date" error={errors.date} help="Inspections run on the listed days.">
          {(p) => (
            <select {...p} className="inp" value={v.date} onChange={set("date")}>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {DATE_FMT.format(new Date(`${d}T00:00:00Z`))}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Departure" id="bk-departurePoint">
          {(p) => (
            <select {...p} className="inp" value={v.departurePoint} onChange={set("departurePoint")}>
              {departurePoints.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <div className="two-up">
        <Field label="Full name" id="bk-name" error={errors.name}>
          {(p) => <input {...p} className="inp" autoComplete="name" value={v.name} onChange={set("name")} />}
        </Field>
        <Field label="Phone / WhatsApp" id="bk-phone" error={errors.phone}>
          {(p) => <input {...p} className="inp" type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={set("phone")} />}
        </Field>
      </div>
      <Field label="Seats needed" id="bk-seats" error={errors.seats}>
        {(p) => (
          <select {...p} className="inp" value={v.seats} onChange={set("seats")}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
      </Field>
      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Send me new-estate alerts and market notes. I can unsubscribe any time.</span>
      </label>
      <div className="hp" aria-hidden="true">
        <input tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} />
      </div>
      <div className="modal-foot" style={{ padding: "1.2rem 0 0", borderTop: 0 }}>
        <span className="mono" style={{ fontSize: ".66rem", letterSpacing: ".14em", color: "var(--ink-3)", textTransform: "uppercase" }}>
          {copy.footnote}
        </span>
        <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>
          {busy ? "Reserving…" : "Reserve my seat"}
        </button>
      </div>
    </form>
  );
}
