"use client";
import { useActionState, useState } from "react";
import { payAction, type AccountState } from "@/server/actions/account";
import { Field } from "@/components/ui/Field";

export function PayForm({ instalments }: { instalments: { id: string; label: string; remaining: number }[] }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(payAction, {});
  const [sel, setSel] = useState(instalments[0]?.id ?? "");
  const remaining = instalments.find((i) => i.id === sel)?.remaining ?? 0;
  const [amount, setAmount] = useState(String(remaining));
  return (
    <form action={action}>
      {state.message && (
        <p className="form-alert" role="alert">
          {state.message}
        </p>
      )}
      <Field label="Pay towards">
        {(p) => (
          <select
            {...p}
            name="instalmentId"
            className="inp"
            value={sel}
            onChange={(e) => {
              setSel(e.target.value);
              setAmount(String(instalments.find((i) => i.id === e.target.value)?.remaining ?? ""));
            }}
          >
            {instalments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Amount (₦)" help="You can pay part, or more — anything extra goes to your next instalment.">
        {(p) => <input {...p} name="amount" className="inp" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
      <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
        {pending ? "Opening secure checkout…" : "Pay securely"}
      </button>
      <p className="muted" style={{ fontSize: ".74rem", marginTop: ".6rem" }}>
        Card, bank transfer or USSD via Paystack. Zenorra never sees or stores your card details.
      </p>
    </form>
  );
}
