"use client";
import { useState, useTransition } from "react";
import { resendInviteAction, setAllocationAction } from "@/server/actions/phase3";

export function PurchaseActions({ purchaseId, buyerId, allocated, invited }: { purchaseId: string; buyerId: string; allocated: boolean; invited: boolean }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  return (
    <div style={{ marginTop: "1rem", display: "grid", gap: ".5rem" }}>
      <button className="btn btn-line btn-sm" disabled={pending} onClick={() => start(() => setAllocationAction(purchaseId, !allocated))}>
        {allocated ? "Mark allocation pending" : "Mark plot allocated"}
      </button>
      {invited && (
        <button
          className="btn btn-ghost btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await resendInviteAction(buyerId);
              if (r.link) setLink(`${location.origin}${r.link}`);
            })
          }
        >
          Resend portal invitation
        </button>
      )}
      {link && (
        <p className="form-ok" style={{ overflowWrap: "anywhere", fontSize: ".78rem" }}>
          Invitation sent. Link (7 days): <code>{link}</code>
        </p>
      )}
    </div>
  );
}
