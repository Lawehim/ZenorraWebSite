"use client";
import { useMemo, useState } from "react";
import type { BlockDef } from "@/lib/content/registry";
import type { FieldDef } from "@/lib/content/fields";
import { Field } from "@/components/ui/Field";
import { MediaPickerInput } from "./MediaPickerInput";
import { VideoPickerInput } from "./VideoPickerInput";
import { useDraftRecovery } from "./useDraftRecovery";

type Draft = Record<string, unknown>;
export type SaveOutcome = { ok: true } | { ok: false; errors: Record<string, string> };

function singular(label: string) {
  const l = label.toLowerCase();
  return l.endsWith("ies") ? l.slice(0, -3) + "y" : l.endsWith("s") ? l.slice(0, -1) : l;
}

function toDraft(fields: FieldDef[], value: Record<string, unknown>): Draft {
  const d: Draft = {};
  for (const f of fields) {
    const v = value?.[f.name];
    if (f.type === "list") d[f.name] = Array.isArray(v) ? (v as string[]).join("\n") : "";
    else if (f.type === "items") d[f.name] = Array.isArray(v) ? (v as Record<string, unknown>[]).map((it) => toDraft(f.fields ?? [], it)) : [];
    else if (f.type === "number") d[f.name] = v ?? 0;
    else d[f.name] = v ?? "";
  }
  return d;
}

function fromDraft(fields: FieldDef[], draft: Draft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = draft[f.name];
    if (f.type === "list") out[f.name] = String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    else if (f.type === "items") out[f.name] = ((v as Draft[]) ?? []).map((it) => fromDraft(f.fields ?? [], it));
    else if (f.type === "number") out[f.name] = Number(v);
    else out[f.name] = typeof v === "string" ? v : String(v ?? "");
  }
  return out;
}

function emptyItem(fields: FieldDef[]): Draft {
  return toDraft(fields, Object.fromEntries(fields.map((f) => [f.name, f.type === "number" ? 0 : f.type === "list" ? [] : f.type === "select" ? f.options?.[0]?.value ?? "" : ""])));
}

interface ControlProps {
  f: FieldDef;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
  path: string;
  errors: Record<string, string>;
}

function Control({ f, value, error, onChange, path, errors }: ControlProps) {
  if (f.type === "items") {
    const items = (value as Draft[]) ?? [];
    const noun = singular(f.label);
    return (
      <fieldset className="card" style={{ marginBottom: "1rem" }} aria-describedby={error ? `${path}-err` : undefined}>
        <legend className="label" style={{ padding: "0 .4rem" }}>
          {f.label}
        </legend>
        {error && (
          <p className="err" id={`${path}-err`} role="alert" style={{ color: "var(--warn)", fontSize: ".82rem" }}>
            {error}
          </p>
        )}
        {items.map((it, k) => (
          <fieldset key={k} style={{ border: "1px solid var(--line)", padding: "1rem", margin: "0 0 .8rem" }}>
            <legend className="mono" style={{ fontSize: ".62rem", letterSpacing: ".16em", color: "var(--ink-3)", padding: "0 .4rem" }}>
              {noun} {k + 1}
            </legend>
            {(f.fields ?? []).map((sub) => (
              <Control
                key={sub.name}
                f={sub}
                path={`${path}.${k}.${sub.name}`}
                value={it[sub.name]}
                error={errors[`${f.name}.${k}.${sub.name}`]}
                errors={errors}
                onChange={(v) => onChange(items.map((x, j) => (j === k ? { ...x, [sub.name]: v } : x)))}
              />
            ))}
            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-ghost btn-sm" disabled={k === 0} onClick={() => onChange(items.map((x, j) => (j === k - 1 ? items[k] : j === k ? items[k - 1] : x)))}>
                Move up<span className="sr-only">: {noun} {k + 1}</span>
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => onChange(items.filter((_, j) => j !== k))}>
                Remove<span className="sr-only"> {noun} {k + 1}</span>
              </button>
            </div>
          </fieldset>
        ))}
        {items.length < (f.maxItems ?? 20) && (
          <button type="button" className="btn btn-line btn-sm" onClick={() => onChange([...items, emptyItem(f.fields ?? [])])}>
            Add {noun}
          </button>
        )}
      </fieldset>
    );
  }

  const help = f.type === "list" ? [f.help, "One entry per line."].filter(Boolean).join(" ") : f.help;
  return (
    <Field label={f.label + (f.optional ? " (optional)" : "")} error={error} help={help}>
      {(p) => {
        const label = f.label;
        switch (f.type) {
          case "textarea":
          case "list":
            return <textarea {...p} aria-label={label} className="inp" rows={f.type === "list" ? 5 : 4} maxLength={f.type === "list" ? undefined : f.max} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
          case "number":
            return <input {...p} aria-label={label} className="inp" type="number" value={String(value ?? 0)} onChange={(e) => onChange(e.target.value)} />;
          case "select":
            return (
              <select {...p} aria-label={label} className="inp" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          case "image":
            return <MediaPickerInput {...p} label={label} value={String(value ?? "")} onChange={onChange} />;
          case "video":
            return <VideoPickerInput {...p} label={label} value={String(value ?? "")} onChange={onChange} />;
          default:
            return <input {...p} aria-label={label} className="inp" maxLength={f.max} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
        }
      }}
    </Field>
  );
}

export interface ContentBlockFormProps {
  def: BlockDef;
  value: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => Promise<SaveOutcome>;
  onReset?: () => Promise<void>;
}

export function ContentBlockForm({ def, value, onSave, onReset }: ContentBlockFormProps) {
  const initial = useMemo(() => toDraft(def.fields, value), [def, value]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const recovery = useDraftRecovery(`content:${def.key}`, draft, initial);

  // When the saved value changes (after a save/refresh), reset the draft to it.
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setDraft(initial);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const r = await onSave(fromDraft(def.fields, draft));
      if (r.ok) {
        setErrors({});
        setStatus("saved");
        recovery.clear();
      } else {
        setErrors(r.errors);
        setStatus("error");
      }
    } catch {
      setStatus("error");
      setErrors({ _: "Couldn't reach the server. Your changes are kept on this device — try again when you're back online." });
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {recovery.available && (
        <div className="form-ok" role="status" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <span>You have unsaved changes from an earlier session.</span>
          <button type="button" className="btn btn-line btn-sm" onClick={() => setDraft(recovery.restore() as Draft)}>
            Recover them
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={recovery.clear}>
            Discard
          </button>
        </div>
      )}
      {def.description && <p className="muted" style={{ marginBottom: "1.2rem", fontSize: ".9rem" }}>{def.description}</p>}
      {def.fields.map((f) => (
        <Control key={f.name} f={f} path={`${def.key}.${f.name}`} value={draft[f.name]} error={errors[f.name]} errors={errors} onChange={(v) => setDraft((d) => ({ ...d, [f.name]: v }))} />
      ))}
      {errors._ && (
        <div className="form-alert" role="alert">
          {errors._}
        </div>
      )}
      <div style={{ display: "flex", gap: ".8rem", alignItems: "center", flexWrap: "wrap", marginTop: "1rem" }}>
        <button type="submit" className="btn btn-gold btn-sm" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {onReset && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onReset()}>
            Restore original text
          </button>
        )}
        <span role="status" aria-live="polite" style={{ fontSize: ".85rem", color: status === "error" ? "var(--warn)" : "var(--ok)" }}>
          {status === "saved" ? "Saved. The live site updates within a minute." : status === "error" && !errors._ ? "Fix the highlighted fields and save again." : ""}
        </span>
      </div>
    </form>
  );
}
