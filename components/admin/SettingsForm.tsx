"use client";
import { useState, useTransition } from "react";
import type { SiteSettings } from "@/lib/settings/schema";
import { saveSettingsAction } from "@/server/actions/content";
import { Field } from "@/components/ui/Field";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [s, setS] = useState(initial);
  const [points, setPoints] = useState(initial.departurePoints.join("\n"));
  const [currencies, setCurrencies] = useState(initial.currencies.join(", "));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const text = (k: keyof SiteSettings, label: string, help?: string) => (
    <Field label={label} error={errors[k]} help={help}>
      {(p) => <input {...p} className="inp" value={String(s[k])} onChange={(e) => setS({ ...s, [k]: e.target.value })} />}
    </Field>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSettingsAction({
            ...s,
            departurePoints: points.split("\n").map((x) => x.trim()).filter(Boolean),
            currencies: currencies.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean),
          });
          if (r.ok) {
            setErrors({});
            setMsg("Settings saved. The live site updates within a minute.");
          } else {
            setErrors(r.errors);
            setMsg("Fix the highlighted fields and save again.");
          }
        });
      }}
    >
      <div className="editor-grid">
        <div>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Company &amp; contact</h2>
            {text("companyName", "Company name")}
            <div className="two-up">
              {text("phone", "Phone")}
              {text("whatsappNumber", "WhatsApp number", "Used for every WhatsApp button on the site.")}
            </div>
            {text("email", "Email")}
            {text("address", "Head office address")}
            {text("hours", "Opening hours")}
            {text("registration", "CAC registration number", "e.g. RC 1234567 — leave empty to hide.")}
          </section>
          <section className="card">
            <h2>Social &amp; reviews</h2>
            <Field label="Google reviews link" error={errors.googleReviewsUrl}>
              {(p) => <input {...p} className="inp" value={s.googleReviewsUrl} onChange={(e) => setS({ ...s, googleReviewsUrl: e.target.value })} />}
            </Field>
            {(["instagram", "facebook", "tiktok", "linkedin", "x"] as const).map((k) => (
              <Field key={k} label={k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1)} help="Full https:// link, or leave empty to hide the icon." error={errors.social}>
                {(p) => <input {...p} className="inp" value={s.social[k]} onChange={(e) => setS({ ...s, social: { ...s.social, [k]: e.target.value } })} />}
              </Field>
            ))}
          </section>
        </div>
        <aside>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Inspections</h2>
            <fieldset style={{ border: 0, padding: 0, margin: "0 0 1rem" }}>
              <legend className="label" style={{ marginBottom: ".5rem" }}>
                Inspection days
              </legend>
              {DAYS.map((d, i) => (
                <label key={d} className="consent" style={{ margin: ".2rem 0" }}>
                  <input type="checkbox" checked={s.inspectionDays.includes(i)} onChange={(e) => setS({ ...s, inspectionDays: e.target.checked ? [...s.inspectionDays, i].sort() : s.inspectionDays.filter((x) => x !== i) })} />
                  {d}
                </label>
              ))}
              {errors.inspectionDays && <p className="err">{errors.inspectionDays}</p>}
            </fieldset>
            <Field label="Departure points" help="One per line, e.g. “7:30 AM — Surulere head office”." error={errors.departurePoints}>
              {(p) => <textarea {...p} className="inp" rows={5} value={points} onChange={(e) => setPoints(e.target.value)} />}
            </Field>
            <Field label="Currencies accepted (default for new properties)">{(p) => <input {...p} className="inp" value={currencies} onChange={(e) => setCurrencies(e.target.value)} />}</Field>
          </section>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Lead routing</h2>
            <p className="muted" style={{ fontSize: ".82rem", marginBottom: ".8rem" }}>
              New-lead emails go to these addresses by enquiry type.
            </p>
            {(["property", "diaspora", "solar", "agency"] as const).map((k) => (
              <Field key={k} label={{ property: "Property enquiries", diaspora: "Diaspora buyers", solar: "Solar enquiries", agency: "Marketing & agency briefs" }[k]} error={errors.advisorEmails}>
                {(p) => <input {...p} className="inp" type="email" value={s.advisorEmails[k]} onChange={(e) => setS({ ...s, advisorEmails: { ...s.advisorEmails, [k]: e.target.value } })} />}
              </Field>
            ))}
          </section>
          <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </button>
          <p role="status" aria-live="polite" style={{ fontSize: ".84rem", marginTop: ".8rem", color: Object.keys(errors).length ? "var(--warn)" : "var(--ok)" }}>
            {msg}
          </p>
        </aside>
      </div>
    </form>
  );
}
