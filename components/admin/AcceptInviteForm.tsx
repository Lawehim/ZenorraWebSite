"use client";
import { useActionState } from "react";
import { acceptInviteAction, type AuthState } from "@/server/actions/auth";
import { Field } from "@/components/ui/Field";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(acceptInviteAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      {state.message && (
        <p className="form-alert" role="alert">
          {state.message}
        </p>
      )}
      <Field label="Password">{(p) => <input {...p} className="inp" name="password" type="password" autoComplete="new-password" minLength={12} required />}</Field>
      <Field label="Repeat password">{(p) => <input {...p} className="inp" name="confirm" type="password" autoComplete="new-password" required />}</Field>
      <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
        Set password
      </button>
    </form>
  );
}
