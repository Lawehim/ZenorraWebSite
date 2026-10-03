"use client";
import { useState, useTransition } from "react";
import { assignLeadAction } from "@/server/actions/phase2";

export function AssignSelect({ leadId, current, users }: { leadId: string; current: string | null; users: { id: string; name: string }[] }) {
  const [value, setValue] = useState(current ?? "");
  const [pending, start] = useTransition();
  return (
    <span style={{ display: "inline-flex", gap: ".4rem", alignItems: "center" }}>
      <label htmlFor="assign" className="sr-only">
        Assigned advisor
      </label>
      <select
        id="assign"
        className="inp"
        style={{ padding: ".45rem 2rem .45rem .6rem", fontSize: ".85rem" }}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          start(() => assignLeadAction(leadId, v));
        }}
      >
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      <span role="status" aria-live="polite" style={{ fontSize: ".72rem", color: "var(--ok)" }}>
        {pending ? "Saving…" : ""}
      </span>
    </span>
  );
}
