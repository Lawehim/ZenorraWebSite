"use client";
import { useState, useTransition } from "react";
import type { LeadStatus } from "@prisma/client";
import { setLeadStatusAction } from "@/server/actions/leads";

const OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "BOOKED_INSPECTION", label: "Booked inspection" },
  { value: "NEGOTIATING", label: "Negotiating" },
  { value: "CLOSED_WON", label: "Closed — won" },
  { value: "CLOSED_LOST", label: "Closed — lost" },
];

/** Saves without a page reload and records the change on the timeline (US-ADV-02). */
export function LeadStatusSelect({ id, status }: { id: string; status: LeadStatus }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".4rem" }}>
      <label className="sr-only" htmlFor={`st-${id}`}>
        Lead status
      </label>
      <select
        id={`st-${id}`}
        className="inp"
        style={{ padding: ".45rem 2rem .45rem .6rem", fontSize: ".8rem", minWidth: 150 }}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as LeadStatus;
          const prev = value;
          setValue(next);
          setError(false);
          start(async () => {
            try {
              await setLeadStatusAction(id, next);
            } catch {
              setValue(prev);
              setError(true);
            }
          });
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span role="status" aria-live="polite" style={{ fontSize: ".7rem", color: error ? "var(--warn)" : "var(--ok)" }}>
        {pending ? "Saving…" : error ? "Not saved" : ""}
      </span>
    </span>
  );
}
