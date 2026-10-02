"use client";
import { useActionState } from "react";
import { signInAction, type AuthState } from "@/server/actions/auth";
import { Field } from "@/components/ui/Field";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signInAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      {state.message && (
        <p className="form-alert" role="alert">
          {state.message}
        </p>
      )}
      <Field label="Email">{(p) => <input {...p} className="inp" name="email" type="email" autoComplete="username" required defaultValue={state.email} />}</Field>
      <Field label="Password">{(p) => <input {...p} className="inp" name="password" type="password" autoComplete="current-password" required />}</Field>
      {state.twoFactor && (
        <Field label="Authenticator code" help="6 digits from your authenticator app.">
          {(p) => <input {...p} className="inp" name="totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" autoFocus />}
        </Field>
      )}
      <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
