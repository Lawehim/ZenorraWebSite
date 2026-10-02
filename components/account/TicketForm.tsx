"use client";
import { useActionState } from "react";
import { createTicketAction, type AccountState } from "@/server/actions/account";
import { Field } from "@/components/ui/Field";

export function TicketForm({ purchases, preselect }: { purchases: { id: string; label: string }[]; preselect?: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(createTicketAction, {});
  return (
    <form action={action} className="panel">
      {state.message && (
        <p className={state.ok ? "form-ok" : "form-alert"} role="status">
          {state.message}
        </p>
      )}
      <Field label="About">
        {(p) => (
          <select {...p} name="purchaseId" className="inp" defaultValue={preselect ?? ""}>
            <option value="">General question</option>
            {purchases.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Subject">{(p) => <input {...p} name="subject" className="inp" maxLength={140} required />}</Field>
      <Field label="Message">{(p) => <textarea {...p} name="body" className="inp" rows={5} maxLength={4000} required />}</Field>
      <button className="btn btn-gold" type="submit" disabled={pending}>
        Send request
      </button>
    </form>
  );
}
