"use client";
import { useState, useTransition } from "react";
import { saveTestimonialAction, deleteTestimonialAction } from "@/server/actions/misc";
import { Field } from "@/components/ui/Field";
import { VideoPickerInput } from "./VideoPickerInput";

interface Item {
  id: string;
  name: string;
  roleText: string;
  quote: string;
  initials: string;
  videoUrl: string;
  order: number;
  published: boolean;
}

const EMPTY: Omit<Item, "id"> = { name: "", roleText: "", quote: "", initials: "", videoUrl: "", order: 0, published: true };

function Editor({ item, onDone }: { item: Item | null; onDone: () => void }) {
  const [v, setV] = useState<Omit<Item, "id">>(item ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <form
      className="card"
      style={{ marginBottom: "1rem" }}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveTestimonialAction(item?.id ?? null, { ...v });
          if (r.ok) onDone();
          else setErrors(r.errors);
        });
      }}
    >
      <h2>{item ? "Edit testimonial" : "New testimonial"}</h2>
      <div className="two-up">
        <Field label="Client name" error={errors.name}>
          {(p) => <input {...p} className="inp" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
        </Field>
        <Field label="Context" error={errors.roleText} help="e.g. Bought 2 plots · Ibeju-Lekki">
          {(p) => <input {...p} className="inp" value={v.roleText} onChange={(e) => setV({ ...v, roleText: e.target.value })} />}
        </Field>
      </div>
      <Field label="Quote" error={errors.quote}>
        {(p) => <textarea {...p} className="inp" rows={4} maxLength={600} value={v.quote} onChange={(e) => setV({ ...v, quote: e.target.value })} />}
      </Field>
      <div className="two-up">
        <Field label="Position (lower shows first)">{(p) => <input {...p} className="inp" type="number" value={v.order} onChange={(e) => setV({ ...v, order: Number(e.target.value) })} />}</Field>
        <Field label="Video link (optional)" help="YouTube or Vimeo link, or pick an uploaded video below">
          {(p) => <input {...p} className="inp" value={v.videoUrl} onChange={(e) => setV({ ...v, videoUrl: e.target.value })} />}
        </Field>
      </div>
      <Field label="…or an uploaded video">{(p) => <VideoPickerInput {...p} label="Uploaded video" value={v.videoUrl.startsWith("/media/video/") ? v.videoUrl : ""} onChange={(url) => setV({ ...v, videoUrl: url })} />}</Field>
      <label className="consent">
        <input type="checkbox" checked={v.published} onChange={(e) => setV({ ...v, published: e.target.checked })} /> Show on the website
      </label>
      <div className="rowacts">
        <button className="btn btn-gold btn-sm" type="submit" disabled={pending}>
          Save
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function TestimonialsManager({ items }: { items: Item[] }) {
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      {editing ? (
        <Editor item={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <button className="btn btn-gold btn-sm" style={{ marginBottom: "1rem" }} onClick={() => setEditing("new")}>
          Add testimonial
        </button>
      )}
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Client</th>
              <th className="hide-sm">Quote</th>
              <th>Shown</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td className="mono">{t.order}</td>
                <td>
                  <b>{t.name}</b>
                  <div style={{ fontSize: ".78rem" }}>{t.roleText}</div>
                </td>
                <td className="hide-sm" style={{ maxWidth: 420 }}>
                  {t.quote.slice(0, 120)}
                  {t.quote.length > 120 ? "…" : ""}
                </td>
                <td>{t.published ? "Yes" : "Hidden"}</td>
                <td>
                  <div className="rowacts">
                    <button className="btn btn-line btn-sm" onClick={() => setEditing(t)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`Delete the testimonial from ${t.name}?`)) start(() => deleteTestimonialAction(t.id));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={5}>No testimonials yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
