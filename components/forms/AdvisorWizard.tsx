"use client";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import { initialWizardState, wizardReducer, canContinue, blockedReason, validateContactStep, TOTAL_STEPS, type WizardState } from "@/lib/leads/wizard";
import type { ContentOf } from "@/lib/content/registry";
import { formContext } from "@/lib/attribution";
import { Field } from "@/components/ui/Field";
import { ChoiceButton } from "./ChoiceButton";
import type { SubmitOutcome } from "./types";

const STORE = "zn.advisor";
const RESIDENCY = [
  { value: "Nigeria", label: "I'm in Nigeria" },
  { value: "Diaspora", label: "I'm in the diaspora" },
];
const OBJECTIVE_HINTS: Record<string, string> = {
  "Buy land to hold": "Land banking for future appreciation",
  "Buy a home to live in": "Ready or off-plan residential",
  "Buy to rent out": "Income-producing property",
  "Still exploring": "Send me guidance first",
};

export interface AdvisorWizardProps {
  copy: ContentOf<"site.advisor">;
  corridors: string[];
  propertySlug?: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<SubmitOutcome>;
  onDone?: () => void;
}

function load(): WizardState | null {
  try {
    const raw = sessionStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as WizardState) : null;
  } catch {
    return null;
  }
}
function save(s: WizardState | null) {
  try {
    if (s) sessionStorage.setItem(STORE, JSON.stringify(s));
    else sessionStorage.removeItem(STORE);
  } catch {
    /* ignore */
  }
}

export function AdvisorWizard({ copy, corridors, propertySlug, onSubmit }: AdvisorWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, undefined, () => {
    const saved = typeof window !== "undefined" ? load() : null;
    return saved ? wizardReducer(initialWizardState(), { type: "restore", state: saved }) : initialWizardState();
  });
  const [contact, setContact] = useState({ name: "", phone: "", email: "", note: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference: string; firstName?: string } | null>(null);
  const hintId = useId();
  const headingRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const firstRender = useRef(true);

  useEffect(() => {
    if (!done) save(state);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!done) save(state);
  }, [state, done]);

  const a = state.answers;
  const reason = blockedReason(state);
  const isContact = state.step === TOTAL_STEPS;

  async function send() {
    const check = validateContactStep(contact);
    if (!check.ok) {
      setErrors({ [check.field]: check.message });
      fieldRefs.current[check.field]?.focus();
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      const r = await onSubmit({
        source: propertySlug ? "property" : "advisor",
        ...a,
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        email: contact.email.trim(),
        note: contact.note.trim(),
        marketingConsent: consent,
        propertySlug: propertySlug ?? "",
        website: contact.website,
        ...formContext(),
      });
      if (r.ok) {
        setDone({ reference: r.reference, firstName: r.firstName });
        save(null);
      } else if (r.field && r.field !== "_") {
        setErrors(r.errors ?? { [r.field]: r.message });
        fieldRefs.current[r.field]?.focus();
      } else {
        setFailure(r.message);
      }
    } catch {
      setFailure("We couldn't send your brief — check your connection. Your answers are still here.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (isContact) return void send();
    if (!canContinue(state)) return;
    dispatch({ type: "next" });
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
        <p>
          Brief received: <b>{a.objective}</b> in <b>{a.corridors.join(", ")}</b>, budget <b>{a.budgetBand}</b>. {copy.successBody}
        </p>
        <p className="mono" style={{ fontSize: ".75rem", letterSpacing: ".14em", color: "var(--ink-3)", marginTop: "1rem" }}>
          REFERENCE {done.reference}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="prog" aria-hidden="true" style={{ padding: "0 0 1.2rem" }}>
        {Array.from({ length: TOTAL_STEPS }, (_, k) => (
          <i key={k} className={k < state.step ? "on" : ""} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Step {state.step} of {TOTAL_STEPS}
      </p>

      <div ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
        {state.step === 1 && (
          <fieldset className="opts">
            <legend className="qlabel">What are you looking to do?</legend>
            <p className="qhint">This tells us which of our advisors should call you.</p>
            {copy.objectives.map((o) => (
              <ChoiceButton key={o} selected={a.objective === o} onClick={() => dispatch({ type: "select", field: "objective", value: o })} hint={OBJECTIVE_HINTS[o]}>
                {o}
              </ChoiceButton>
            ))}
          </fieldset>
        )}

        {state.step === 2 && (
          <fieldset className="opts two">
            <legend className="qlabel">Where are you interested in?</legend>
            <p className="qhint" style={{ gridColumn: "1/-1" }}>
              Pick as many locations as you like.
            </p>
            {[...corridors, "Open to advice"].map((c) => (
              <ChoiceButton key={c} selected={a.corridors.includes(c)} onClick={() => dispatch({ type: "toggle", field: "corridors", value: c })}>
                {c}
              </ChoiceButton>
            ))}
          </fieldset>
        )}

        {state.step === 3 && (
          <fieldset className="opts">
            <legend className="qlabel">What budget are you working with?</legend>
            <p className="qhint">A rough range is fine — it filters what we send you.</p>
            {copy.budgets.map((b) => (
              <ChoiceButton key={b} selected={a.budgetBand === b} onClick={() => dispatch({ type: "select", field: "budgetBand", value: b })}>
                {b}
              </ChoiceButton>
            ))}
          </fieldset>
        )}

        {state.step === 4 && (
          <>
            <fieldset className="opts two">
              <legend className="qlabel">When would you like to complete?</legend>
              <p className="qhint" style={{ gridColumn: "1/-1" }}>
                And are you buying from Nigeria or abroad?
              </p>
              {copy.timelines.map((t) => (
                <ChoiceButton key={t} selected={a.timeline === t} onClick={() => dispatch({ type: "select", field: "timeline", value: t })}>
                  {t}
                </ChoiceButton>
              ))}
            </fieldset>
            <fieldset className="opts two" style={{ marginTop: "1.3rem" }}>
              <legend className="sr-only">Where are you buying from?</legend>
              {RESIDENCY.map((r) => (
                <ChoiceButton key={r.value} selected={a.residency === r.value} onClick={() => dispatch({ type: "select", field: "residency", value: r.value })}>
                  {r.label}
                </ChoiceButton>
              ))}
            </fieldset>
          </>
        )}

        {isContact && (
          <div>
            <div className="qlabel">Where should the advisor reach you?</div>
            <p className="qhint">We call within one business day. No mass mailing lists.</p>
            {failure && (
              <div className="form-alert" role="alert">
                <span>{failure}</span>
                <button type="button" className="btn btn-line btn-sm" onClick={send}>
                  Try again
                </button>
              </div>
            )}
            <div className="two-up">
              <Field label="Full name" error={errors.name}>
                {(p) => <input {...p} ref={(el) => void (fieldRefs.current.name = el)} className="inp" autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />}
              </Field>
              <Field label="Phone / WhatsApp" error={errors.phone}>
                {(p) => <input {...p} ref={(el) => void (fieldRefs.current.phone = el)} className="inp" type="tel" autoComplete="tel" inputMode="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />}
              </Field>
            </div>
            <Field label="Email" error={errors.email} help="Phone or email — at least one.">
              {(p) => <input {...p} ref={(el) => void (fieldRefs.current.email = el)} className="inp" type="email" autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />}
            </Field>
            <Field label="Anything we should know? (optional)">
              {(p) => <textarea {...p} className="inp" maxLength={2000} value={contact.note} onChange={(e) => setContact({ ...contact, note: e.target.value })} />}
            </Field>
            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{copy.consentText}</span>
            </label>
            <div className="hp" aria-hidden="true">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={contact.website} onChange={(e) => setContact({ ...contact, website: e.target.value })} />
              </label>
            </div>
            <p style={{ fontSize: ".76rem", color: "var(--ink-3)" }}>
              We use your details to respond to this enquiry. See our <a href="/legal/privacy" style={{ textDecoration: "underline" }}>privacy notice</a>.
            </p>
          </div>
        )}
      </div>

      <div className="modal-foot" style={{ padding: "1.4rem 0 0", borderTop: 0 }}>
        <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: "back" })} style={{ visibility: state.step > 1 ? "visible" : "hidden" }}>
          Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span className="mono" aria-hidden="true" style={{ fontSize: ".68rem", letterSpacing: ".16em", color: "var(--ink-3)" }}>
            {String(state.step).padStart(2, "0")} / {String(TOTAL_STEPS).padStart(2, "0")}
          </span>
          <button type="button" className="btn btn-gold btn-sm" aria-disabled={reason ? "true" : "false"} aria-describedby={reason ? hintId : undefined} onClick={next} disabled={busy}>
            {isContact ? (busy ? "Sending…" : "Send to an advisor") : "Continue"}
          </button>
          {reason && (
            <span id={hintId} className="sr-only">
              {reason}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
