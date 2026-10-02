"use client";
import { useActionState, useState } from "react";
import { passwordSignInAction, requestOtpAction, verifyOtpAction, type AccountState } from "@/server/actions/account";
import { Field } from "@/components/ui/Field";

export function BuyerLogin({ next }: { next: string }) {
  const [mode, setMode] = useState<"password" | "code">("code");
  const [pw, pwAction, pwPending] = useActionState<AccountState, FormData>(passwordSignInAction, {});
  const [req, reqAction, reqPending] = useActionState<AccountState, FormData>(requestOtpAction, {});
  const [ver, verAction, verPending] = useActionState<AccountState, FormData>(verifyOtpAction, {});
  const codeStep = req.step === "code" || ver.step === "code";
  const identifier = ver.identifier ?? req.identifier ?? "";

  return (
    <div className="panel">
      <div role="tablist" aria-label="Sign-in method" style={{ display: "flex", gap: ".5rem", marginBottom: "1.4rem" }}>
        <button role="tab" type="button" aria-selected={mode === "code"} className={`chip`} aria-current={mode === "code" ? "true" : undefined} onClick={() => setMode("code")}>
          One-time code
        </button>
        <button role="tab" type="button" aria-selected={mode === "password"} className="chip" aria-current={mode === "password" ? "true" : undefined} onClick={() => setMode("password")}>
          Password
        </button>
      </div>

      {mode === "password" ? (
        <form action={pwAction}>
          <input type="hidden" name="next" value={next} />
          {pw.message && (
            <p className="form-alert" role="alert">
              {pw.message}
            </p>
          )}
          <Field label="Email or phone">{(p) => <input {...p} name="identifier" className="inp" autoComplete="username" required />}</Field>
          <Field label="Password">{(p) => <input {...p} name="password" type="password" className="inp" autoComplete="current-password" required />}</Field>
          <button className="btn btn-gold btn-block" type="submit" disabled={pwPending}>
            {pwPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : !codeStep ? (
        <form action={reqAction}>
          {req.message && (
            <p className="form-alert" role="alert">
              {req.message}
            </p>
          )}
          <Field label="Phone or email on your account">{(p) => <input {...p} name="identifier" className="inp" autoComplete="username" required />}</Field>
          <fieldset className="opts two" style={{ marginBottom: "1rem" }}>
            <legend className="label" style={{ marginBottom: ".4rem" }}>
              Send the code by
            </legend>
            {[
              ["sms", "SMS"],
              ["whatsapp", "WhatsApp"],
              ["email", "Email"],
            ].map(([v, l]) => (
              <label key={v} className="consent" style={{ margin: 0 }}>
                <input type="radio" name="channel" value={v} defaultChecked={v === "sms"} /> {l}
              </label>
            ))}
          </fieldset>
          <button className="btn btn-gold btn-block" type="submit" disabled={reqPending}>
            {reqPending ? "Sending…" : "Send me a code"}
          </button>
        </form>
      ) : (
        <form action={verAction}>
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="identifier" value={identifier} />
          <p className={ver.message ? "form-alert" : "form-ok"} role="status">
            {ver.message ?? req.message}
          </p>
          <Field label="6-digit code">{(p) => <input {...p} name="code" className="inp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required autoFocus />}</Field>
          <button className="btn btn-gold btn-block" type="submit" disabled={verPending}>
            {verPending ? "Checking…" : "Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}
