"use client";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { formContext } from "@/lib/attribution";
import { postJson } from "./types";

/** Sold-out properties swap enquiry for a next-phase notification (FR-PROP-021). */
export function NotifyNextPhase({ propertySlug }: { propertySlug: string }) {
  const [v, setV] = useState({ name: "", phone: "", email: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await postJson("/api/leads", { source: "notify-next-phase", ...v, propertySlug, note: "Notify me of the next phase", website: "", ...formContext() });
      if (r.ok) setMsg({ ok: true, text: `Thank you — we'll tell you first when the next phase opens. Ref ${r.reference}.` });
      else {
        setErrors(r.errors ?? {});
        setMsg({ ok: false, text: r.message });
      }
    } catch {
      setMsg({ ok: false, text: "Couldn't send — check your connection and try again." });
    }
  }

  if (msg?.ok) return <p className="form-ok" role="status">{msg.text}</p>;
  return (
    <form onSubmit={submit} noValidate>
      <Field label="Full name" error={errors.name}>
        {(p) => <input {...p} className="inp" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" />}
      </Field>
      <Field label="Phone / WhatsApp" error={errors.phone}>
        {(p) => <input {...p} className="inp" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} autoComplete="tel" />}
      </Field>
      <Field label="Email (optional)" error={errors.email}>
        {(p) => <input {...p} className="inp" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoComplete="email" />}
      </Field>
      {msg && !msg.ok && <p className="form-alert" role="alert">{msg.text}</p>}
      <button type="submit" className="btn btn-gold btn-block">
        Notify me of the next phase
      </button>
    </form>
  );
}
