"use client";
import { useActionState } from "react";
import { changePasswordAction, enableTotpAction, type AuthState } from "@/server/actions/auth";
import { Field } from "@/components/ui/Field";

export function AccountForms({ twoFactorEnabled, required, secret, uri }: { twoFactorEnabled: boolean; required: boolean; secret: string | null; uri: string | null }) {
  const [pw, pwAction, pwPending] = useActionState<AuthState, FormData>(changePasswordAction, {});
  const [totp, totpAction, totpPending] = useActionState<AuthState, FormData>(enableTotpAction, {});
  return (
    <div className="editor-grid">
      <form action={pwAction} className="card">
        <h2>Change password</h2>
        <Field label="New password" help="At least 12 characters. A short sentence works well.">
          {(p) => <input {...p} className="inp" name="password" type="password" autoComplete="new-password" minLength={12} required />}
        </Field>
        <Field label="Repeat new password">{(p) => <input {...p} className="inp" name="confirm" type="password" autoComplete="new-password" required />}</Field>
        <button className="btn btn-gold btn-sm" type="submit" disabled={pwPending}>
          Update password
        </button>
        {pw.message && (
          <p role="status" style={{ marginTop: ".8rem", fontSize: ".86rem" }}>
            {pw.message}
          </p>
        )}
      </form>
      <section className="card">
        <h2>Two-factor authentication</h2>
        {twoFactorEnabled ? (
          <p className="form-ok">On. You&apos;ll be asked for a code from your authenticator app each time you sign in.</p>
        ) : (
          <form action={totpAction}>
            <p className="muted" style={{ fontSize: ".88rem", marginBottom: "1rem" }}>
              {required ? "Required for your role. " : ""}Add this key to Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code it shows.
            </p>
            <p className="mono" style={{ fontSize: ".9rem", letterSpacing: ".12em", overflowWrap: "anywhere", padding: ".8rem", border: "1px dashed var(--line-2)", marginBottom: ".6rem" }}>
              {secret?.match(/.{1,4}/g)?.join(" ")}
            </p>
            {uri && (
              <p style={{ fontSize: ".78rem", marginBottom: "1rem" }}>
                On your phone? <a href={uri} style={{ textDecoration: "underline" }}>Open in your authenticator app</a>
              </p>
            )}
            <input type="hidden" name="secret" value={secret ?? ""} />
            <Field label="6-digit code">{(p) => <input {...p} className="inp" name="code" inputMode="numeric" autoComplete="one-time-code" required />}</Field>
            <button className="btn btn-gold btn-sm" type="submit" disabled={totpPending}>
              Turn on
            </button>
            {totp.message && (
              <p role="status" style={{ marginTop: ".8rem", fontSize: ".86rem" }}>
                {totp.message}
              </p>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
