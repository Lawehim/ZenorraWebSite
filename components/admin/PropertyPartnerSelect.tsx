"use client";
// Which partner developer supplies this estate — decides whose partner portal shows its figures.
import { useState, useTransition } from "react";
import { setPropertyPartnerAction } from "@/server/actions/phase2";

export function PropertyPartnerSelect({ propertyId, partners, value, canEdit }: { propertyId: string; partners: { id: string; name: string }[]; value: string | null; canEdit: boolean }) {
  const [current, setCurrent] = useState(value ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="card" style={{ marginTop: "1.2rem" }}>
      <h2>Developer</h2>
      <p className="muted" style={{ fontSize: ".84rem", marginBottom: ".8rem" }}>
        The partner developer who supplies this estate. Their partner-portal users see its enquiry, inspection and sales figures (never buyers&apos; personal details).
      </p>
      <label className="label" htmlFor="property-partner">
        Partner developer
      </label>
      <select
        id="property-partner"
        className="inp"
        value={current}
        disabled={!canEdit || pending}
        onChange={(e) => {
          const next = e.target.value;
          setCurrent(next);
          start(async () => {
            await setPropertyPartnerAction(propertyId, next || null);
            setMsg("Saved.");
          });
        }}
      >
        <option value="">None (Zenorra&apos;s own)</option>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {!canEdit && <p className="muted" style={{ fontSize: ".78rem", marginTop: ".4rem" }}>Only administrators can change this.</p>}
      <p role="status" aria-live="polite" style={{ fontSize: ".8rem", color: "var(--ok)", marginTop: ".4rem" }}>
        {msg}
      </p>
    </section>
  );
}
