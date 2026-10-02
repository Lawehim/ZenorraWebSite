"use client";
import { useState, useTransition } from "react";
import { dsrSearchAction, dsrExportAction, dsrEraseAction } from "@/server/actions/phase2";

type Found = Awaited<ReturnType<typeof dsrSearchAction>>;

export function DsrTool({ canErase }: { canErase: boolean }) {
  const [id, setId] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card" style={{ maxWidth: 820 }}>
      <form
        className="toolbar-row"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          start(async () => setFound(await dsrSearchAction(id)));
        }}
      >
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="dsr-id">Phone number or email address</label>
          <input id="dsr-id" className="inp" value={id} onChange={(e) => setId(e.target.value)} placeholder="0803 992 1140 or ada@example.com" />
        </div>
        <button className="btn btn-gold btn-sm" type="submit" disabled={pending || !id.trim()}>
          Search
        </button>
      </form>
      {found && (
        <div aria-live="polite">
          <p style={{ margin: "1rem 0" }}>
            Found <b>{found.leads.length}</b> lead record(s), <b>{found.subscribers}</b> newsletter subscription(s), <b>{found.buyers}</b> buyer account(s) and <b>{found.chats}</b> chat(s).
          </p>
          <ul style={{ fontSize: ".86rem", color: "var(--ink-2)" }}>
            {found.leads.map((l) => (
              <li key={l.id}>
                <a href={`/admin/leads/${l.id}`}>{l.reference}</a> — {l.name} ({l.createdAt.slice(0, 10)})
              </li>
            ))}
          </ul>
          <div className="rowacts" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-line btn-sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const json = await dsrExportAction(id);
                  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "personal-data-export.json";
                  a.click();
                  URL.revokeObjectURL(url);
                })
              }
            >
              Download export (JSON)
            </button>
          </div>
          {canErase ? (
            <form
              style={{ marginTop: "1.6rem", borderTop: "1px solid var(--line)", paddingTop: "1.2rem" }}
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await dsrEraseAction(id, confirm);
                  setMsg(r.ok ? `Erased. ${r.leads} lead(s) anonymised; aggregate counts kept for reporting.` : r.message ?? "Not erased.");
                  if (r.ok) setFound(null);
                });
              }}
            >
              <p className="notice">Erasure removes names, contact details, notes and chat text permanently. Anonymised records remain so totals still add up. This cannot be undone.</p>
              <div className="field" style={{ maxWidth: 260 }}>
                <label htmlFor="dsr-confirm">Type ERASE to confirm</label>
                <input id="dsr-confirm" className="inp" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <button className="btn btn-danger btn-sm" type="submit" disabled={pending}>
                Erase this person&apos;s data
              </button>
            </form>
          ) : (
            <p className="muted" style={{ marginTop: "1rem", fontSize: ".84rem" }}>
              Only a Super Admin can erase data.
            </p>
          )}
        </div>
      )}
      {msg && (
        <p className="form-ok" role="status" style={{ marginTop: "1rem" }}>
          {msg}
        </p>
      )}
    </div>
  );
}
