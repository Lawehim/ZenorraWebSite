"use client";
import { useTransition } from "react";
import { referralStatusAction } from "@/server/actions/phase3";

export function ReferralActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  if (status === "PAID" || status === "REJECTED") return null;
  return (
    <div className="rowacts">
      {status === "QUALIFIED" && (
        <button className="btn btn-gold btn-sm" disabled={pending} onClick={() => confirm("Mark this commission as paid?") && start(() => referralStatusAction(id, "PAID"))}>
          Mark paid
        </button>
      )}
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => confirm("Reject this referral?") && start(() => referralStatusAction(id, "REJECTED"))}>
        Reject
      </button>
    </div>
  );
}
