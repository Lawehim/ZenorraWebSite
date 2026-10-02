"use client";
import { useActionState } from "react";
import { acceptBuyerInviteAction, type AccountState } from "@/server/actions/account";
import { Field } from "@/components/ui/Field";

export function BuyerInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(acceptBuyerInviteAction, {});
  return (
    <form action={action} className="panel">
      <input type="hidden" name="token" value={token} />
      {state.message && (
        <p className="form-alert" role="alert">
          {state.message}
        </p>
      )}
      <Field label="Password">{(p) => <input {...p} name="password" type="password" className="inp" autoComplete="new-password" minLength={12} required />}</Field>
      <Field label="Repeat password">{(p) => <input {...p} name="confirm" type="password" className="inp" autoComplete="new-password" required />}</Field>
      <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
        Set password
      </button>
    </form>
  );
}
