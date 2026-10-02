"use client";
import { useState, useTransition } from "react";
import { attachDocumentAction, documentVisibilityAction, removeDocumentAction } from "@/server/actions/phase2";

interface Doc {
  id: string;
  label: string;
  kind: string;
  isPublic: boolean;
  filename: string;
}

export function PropertyDocuments({ propertyId, docs, library }: { propertyId: string; docs: Doc[]; library: { id: string; filename: string }[] }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ mediaAssetId: library[0]?.id ?? "", label: "", kind: "brochure", isPublic: false });
  return (
    <section className="card" style={{ marginTop: "1.2rem" }}>
      <h2>Documents</h2>
      <p className="muted" style={{ fontSize: ".84rem", marginBottom: "1rem" }}>
        Public documents are downloadable on the property page. Internal ones are never shown publicly.
      </p>
      <table className="tbl">
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td>
                <b>{d.label}</b>
                <div style={{ fontSize: ".74rem" }}>
                  {d.kind} · {d.filename}
                </div>
              </td>
              <td>
                <label className="consent" style={{ margin: 0 }}>
                  <input type="checkbox" checked={d.isPublic} disabled={pending} onChange={(e) => start(() => documentVisibilityAction(d.id, e.target.checked, propertyId))} /> Public
                </label>
              </td>
              <td>
                <button className="btn btn-danger btn-sm" disabled={pending} onClick={() => start(() => removeDocumentAction(d.id, propertyId))}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {!docs.length && (
            <tr>
              <td>No documents attached.</td>
            </tr>
          )}
        </tbody>
      </table>
      {library.length ? (
        <form
          style={{ marginTop: "1rem" }}
          onSubmit={(e) => {
            e.preventDefault();
            start(() => attachDocumentAction(propertyId, form));
          }}
        >
          <div className="two-up">
            <div className="field">
              <label htmlFor="doc-file">PDF from the library</label>
              <select id="doc-file" className="inp" value={form.mediaAssetId} onChange={(e) => setForm({ ...form, mediaAssetId: e.target.value })}>
                {library.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.filename}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="doc-kind">Type</label>
              <select id="doc-kind" className="inp" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="brochure">Brochure</option>
                <option value="layout-plan">Layout plan</option>
                <option value="price-list">Price list</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="doc-label">Label shown to buyers</label>
            <input id="doc-label" className="inp" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Heritage Gardens brochure (PDF)" />
          </div>
          <label className="consent">
            <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} /> Public — show on the property page
          </label>
          <button className="btn btn-line btn-sm" type="submit" disabled={pending}>
            Attach document
          </button>
        </form>
      ) : (
        <p className="muted" style={{ marginTop: "1rem", fontSize: ".84rem" }}>
          Upload PDFs in the Media library first.
        </p>
      )}
    </section>
  );
}
