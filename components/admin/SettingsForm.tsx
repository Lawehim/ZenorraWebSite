"use client";
import { useState, useTransition } from "react";
import type { SiteSettings } from "@/lib/settings/schema";
import { saveSettingsAction } from "@/server/actions/content";
import { Field } from "@/components/ui/Field";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SOCIAL_LABELS = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube", x: "X (Twitter)" } as const;

export function SettingsForm({ initial, keys = { paystack: false, flutterwave: false } }: { initial: SiteSettings; keys?: { paystack: boolean; flutterwave: boolean } }) {
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
            {(["instagram", "facebook", "tiktok", "linkedin", "youtube", "x"] as const).map((k) => (
              <Field key={k} label={SOCIAL_LABELS[k]} help="Full https:// link, or leave empty to hide the icon." error={errors.social}>
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
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Assignment &amp; SLA</h2>
            <Field label="New leads are">
              {(p) => (
                <select {...p} className="inp" value={s.assignment.mode} onChange={(e) => setS({ ...s, assignment: { ...s.assignment, mode: e.target.value as "manual" | "round-robin" } })}>
                  <option value="round-robin">Shared between active advisors in turn</option>
                  <option value="manual">Left unassigned for an administrator</option>
                </select>
              )}
            </Field>
            <Field label="First contact within (hours)" error={errors.assignment}>
              {(p) => <input {...p} className="inp" type="number" min={1} max={168} value={s.assignment.slaHours} onChange={(e) => setS({ ...s, assignment: { ...s.assignment, slaHours: Number(e.target.value) } })} />}
            </Field>
          </section>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Live chat hours (WAT)</h2>
            <div className="two-up">
              <Field label="Opens" error={errors.officeHours}>
                {(p) => <input {...p} className="inp" type="time" value={s.officeHours.open} onChange={(e) => setS({ ...s, officeHours: { ...s.officeHours, open: e.target.value } })} />}
              </Field>
              <Field label="Closes">{(p) => <input {...p} className="inp" type="time" value={s.officeHours.close} onChange={(e) => setS({ ...s, officeHours: { ...s.officeHours, close: e.target.value } })} />}</Field>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label">Days</legend>
              {DAYS.map((d, i) => (
                <label key={d} className="consent" style={{ margin: ".15rem 0" }}>
                  <input type="checkbox" checked={s.officeHours.days.includes(i)} onChange={(e) => setS({ ...s, officeHours: { ...s.officeHours, days: e.target.checked ? [...s.officeHours.days, i].sort() : s.officeHours.days.filter((x) => x !== i) } })} />
                  {d}
                </label>
              ))}
            </fieldset>
          </section>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Daily summary email</h2>
            <label className="consent">
              <input type="checkbox" checked={s.digest.enabled} onChange={(e) => setS({ ...s, digest: { ...s.digest, enabled: e.target.checked } })} /> Send a daily summary
            </label>
            <Field label="Recipients (comma separated)" error={errors.digest}>
              {(p) => <input {...p} className="inp" value={s.digest.recipients.join(", ")} onChange={(e) => setS({ ...s, digest: { ...s.digest, recipients: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} />}
            </Field>
            <Field label="Send after (hour, WAT)">{(p) => <input {...p} className="inp" type="number" min={0} max={23} value={s.digest.hour} onChange={(e) => setS({ ...s, digest: { ...s.digest, hour: Number(e.target.value) } })} />}</Field>
          </section>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Indicative currency prices</h2>
            <label className="consent">
              <input type="checkbox" checked={s.fx.enabled} onChange={(e) => setS({ ...s, fx: { ...s.fx, enabled: e.target.checked } })} /> Show GBP / USD / CAD next to naira prices
            </label>
            <p className="muted" style={{ fontSize: ".8rem", marginBottom: ".6rem" }}>
              Naira per one unit. Labelled “indicative” with the date; never contractual.
            </p>
            <div className="two-up">
              {(["GBP", "USD", "CAD"] as const).map((c) => (
                <Field key={c} label={`₦ per ${c}`} error={errors.fx}>
                  {(p) => <input {...p} className="inp" type="number" min={0} value={s.fx[c]} onChange={(e) => setS({ ...s, fx: { ...s.fx, [c]: Number(e.target.value) } })} />}
                </Field>
              ))}
              <Field label="Rates as of">{(p) => <input {...p} className="inp" type="date" value={s.fx.asOf} onChange={(e) => setS({ ...s, fx: { ...s.fx, asOf: e.target.value } })} />}</Field>
            </div>
          </section>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>WhatsApp messaging</h2>
            <label className="consent">
              <input type="checkbox" checked={s.whatsappMessaging.enabled} onChange={(e) => setS({ ...s, whatsappMessaging: { enabled: e.target.checked } })} /> Send booking confirmations and reminders on WhatsApp to people who opted in
            </label>
            <p className="muted" style={{ fontSize: ".8rem" }}>
              Needs the WhatsApp Cloud API keys and Meta-approved templates (see README).
            </p>
          </section>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Referral programme</h2>
            <label className="consent">
              <input type="checkbox" checked={s.referrals.enabled} onChange={(e) => setS({ ...s, referrals: { ...s.referrals, enabled: e.target.checked } })} /> Accept referral codes
            </label>
            <div className="two-up">
              <Field label="Payable after buyer has paid (%)" error={errors.referrals}>
                {(p) => <input {...p} className="inp" type="number" min={1} max={100} value={s.referrals.thresholdPercent} onChange={(e) => setS({ ...s, referrals: { ...s.referrals, thresholdPercent: Number(e.target.value) } })} />}
              </Field>
              <Field label="Commission (% of price)">
                {(p) => <input {...p} className="inp" type="number" min={0} max={20} step={0.25} value={s.referrals.commissionPercent} onChange={(e) => setS({ ...s, referrals: { ...s.referrals, commissionPercent: Number(e.target.value) } })} />}
              </Field>
            </div>
          </section>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Bank transfer details (buyer portal)</h2>
            <Field label="Bank">{(p) => <input {...p} className="inp" value={s.bankTransfer.bankName} onChange={(e) => setS({ ...s, bankTransfer: { ...s.bankTransfer, bankName: e.target.value } })} />}</Field>
            <Field label="Account name">{(p) => <input {...p} className="inp" value={s.bankTransfer.accountName} onChange={(e) => setS({ ...s, bankTransfer: { ...s.bankTransfer, accountName: e.target.value } })} />}</Field>
            <Field label="Account number">{(p) => <input {...p} className="inp" inputMode="numeric" value={s.bankTransfer.accountNumber} onChange={(e) => setS({ ...s, bankTransfer: { ...s.bankTransfer, accountNumber: e.target.value } })} />}</Field>
          </section>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Online payments</h2>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label">Provider for new payments</legend>
              {(["paystack", "flutterwave"] as const).map((p) => (
                <label key={p} className="consent" style={{ margin: ".2rem 0" }}>
                  <input type="radio" name="payments-provider" checked={s.payments.provider === p} onChange={() => setS({ ...s, payments: { provider: p } })} /> {p === "paystack" ? "Paystack" : "Flutterwave"}{" "}
                  <span className="muted" style={{ fontSize: ".78rem" }}>{keys[p] ? "· keys configured" : "· keys not set on the server"}</span>
                </label>
              ))}
            </fieldset>
            <p className="muted" style={{ fontSize: ".8rem" }}>
              Payments already started finish with the provider they began on. Keys are set by your developer as environment variables (see README), never here.
            </p>
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
