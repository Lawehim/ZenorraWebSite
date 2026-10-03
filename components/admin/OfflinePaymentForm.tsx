"use client";
import { useActionState } from "react";
import { offlinePaymentAction, type StaffState } from "@/server/actions/phase3";
import { Field } from "@/components/ui/Field";

export function OfflinePaymentForm({ purchaseId, instalments }: { purchaseId: string; instalments: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(offlinePaymentAction, {});
  if (!instalments.length) return <p className="muted">Fully paid.</p>;
  return (
    <form action={action}>
      <input type="hidden" name="purchaseId" value={purchaseId} />
      {state.message && (
        <p className={state.ok ? "form-ok" : "form-alert"} role="status">
          {state.message}
        </p>
      )}
      <Field label="Apply to">
        {(p) => (
          <select {...p} name="instalmentId" className="inp">
            {instalments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Amount received (₦)" help="Any excess rolls forward to the next instalment.">
        {(p) => <input {...p} name="amount" className="inp" inputMode="decimal" required />}
      </Field>
      <Field label="Bank transfer reference (evidence)">{(p) => <input {...p} name="evidenceRef" className="inp" required maxLength={80} />}</Field>
      <button className="btn btn-gold btn-sm" type="submit" disabled={pending}>
        {pending ? "Recording…" : "Record payment & issue receipt"}
      </button>
    </form>
  );
}
