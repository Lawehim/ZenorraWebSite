"use client";
import { useActionState, useMemo, useState } from "react";
import { createPurchaseAction, type StaffState } from "@/server/actions/phase3";
import { formatNaira, monthlyInstalment } from "@/lib/format";
import { Field } from "@/components/ui/Field";

interface P {
  id: string;
  name: string;
  price: number;
  depositPercent: number;
  planMonths: number;
}

export function PurchaseForm({ leadId, properties, defaultPropertyId, today, hasContact }: { leadId: string; properties: P[]; defaultPropertyId: string; today: string; hasContact: boolean }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(createPurchaseAction, {});
  const first = properties.find((p) => p.id === defaultPropertyId) ?? properties[0];
  const [v, setV] = useState({ propertyId: first?.id ?? "", price: String(first?.price ?? ""), deposit: String(first ? Math.round((first.price * first.depositPercent) / 100) : ""), months: String(first?.planMonths ?? 12) });
  const preview = useMemo(() => {
    const price = Number(v.price);
    const dep = Number(v.deposit);
    const m = Number(v.months);
    if (!(price > 0) || dep < 0 || dep > price) return null;
    return m > 1 ? `${formatNaira(dep)} deposit, then ${formatNaira(monthlyInstalment(price, (dep / price) * 100, m))} × ${m} months` : `${formatNaira(price)} in one payment`;
  }, [v]);

  return (
    <form action={action} className="card" style={{ maxWidth: 760 }}>
      {!hasContact && <p className="notice">This lead has no phone or email, so the buyer can&apos;t be invited to the portal. Add contact details first.</p>}
      {state.message && (
        <p className="form-alert" role="alert">
          {state.message}
        </p>
      )}
      <input type="hidden" name="leadId" value={leadId} />
      <div className="two-up">
        <Field label="Property">
          {(p) => (
            <select
              {...p}
              name="propertyId"
              className="inp"
              value={v.propertyId}
              onChange={(e) => {
                const pr = properties.find((x) => x.id === e.target.value)!;
                setV({ propertyId: pr.id, price: String(pr.price), deposit: String(Math.round((pr.price * pr.depositPercent) / 100)), months: String(pr.planMonths) });
              }}
            >
              {properties.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Plot number">{(p) => <input {...p} name="plotNumber" className="inp" required maxLength={30} />}</Field>
      </div>
      <div className="two-up">
        <Field label="Agreed price (₦)">{(p) => <input {...p} name="priceNaira" className="inp" inputMode="numeric" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} />}</Field>
        <Field label="Initial deposit (₦)">{(p) => <input {...p} name="depositNaira" className="inp" inputMode="numeric" value={v.deposit} onChange={(e) => setV({ ...v, deposit: e.target.value })} />}</Field>
      </div>
      <div className="two-up">
        <Field label="Plan length (months, 0 = outright)">{(p) => <input {...p} name="planMonths" className="inp" type="number" min={0} max={120} value={v.months} onChange={(e) => setV({ ...v, months: e.target.value })} />}</Field>
        <Field label="Deposit due on" help="Monthly instalments fall due on the same day each month.">
          {(p) => <input {...p} name="startDate" className="inp" type="date" defaultValue={today} required />}
        </Field>
      </div>
      <Field label="Phase (optional)">{(p) => <input {...p} name="phaseName" className="inp" placeholder="Phase 2" />}</Field>
      {preview && (
        <p className="form-ok" aria-live="polite">
          {preview}
        </p>
      )}
      <button className="btn btn-gold" type="submit" disabled={pending || !hasContact}>
        {pending ? "Recording…" : "Record sale & invite buyer"}
      </button>
    </form>
  );
}
