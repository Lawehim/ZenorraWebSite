"use client";
import { useTransition } from "react";
import type { BookingStatus } from "@prisma/client";
import { setBookingStatusAction } from "@/server/actions/leads";

export function BookingActions({ id, status }: { id: string; status: BookingStatus }) {
  const [pending, start] = useTransition();
  return (
    <div className="rowacts">
      {status === "PENDING" && (
        <button className="btn btn-gold btn-sm" disabled={pending} onClick={() => start(() => setBookingStatusAction(id, "CONFIRMED"))}>
          Confirm
        </button>
      )}
      {status === "CONFIRMED" && (
        <button className="btn btn-line btn-sm" disabled={pending} onClick={() => start(() => setBookingStatusAction(id, "ATTENDED"))}>
          Attended
        </button>
      )}
      {status !== "CANCELLED" && status !== "ATTENDED" && (
        <button
          className="btn btn-danger btn-sm"
          disabled={pending}
          onClick={() => {
            if (confirm("Cancel this booking? The enquirer will get an SMS.")) start(() => setBookingStatusAction(id, "CANCELLED"));
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
