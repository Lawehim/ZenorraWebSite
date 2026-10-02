"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMediaAction, deleteMediaAction } from "@/server/actions/media";
import { formatDateLagos } from "@/lib/format";

interface Asset {
  id: string;
  url: string;
  thumb: string;
  filename: string;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
  bytes: number;
  createdAt: string;
}

const MAX = 15 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`);

export function MediaLibrary({ assets, canDelete }: { assets: Asset[]; canDelete: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<{ ok: boolean; text: string }[]>([]);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [pending, start] = useTransition();

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    const pre: { ok: boolean; text: string }[] = [];
    const ok = list.filter((f) => {
      if (f.size > MAX) pre.push({ ok: false, text: `${f.name} is larger than the 15MB limit.` });
      else if (f.type && !ACCEPT.includes(f.type)) pre.push({ ok: false, text: `${f.name} isn't a supported image. Upload JPEG, PNG, WebP or AVIF.` });
      else return true;
      return false;
    });
    setMessages(pre);
    if (!ok.length) return;
    setBusy(true);
    const fd = new FormData();
    ok.forEach((f) => fd.append("files", f));
    try {
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const data = (await res.json()) as { results?: { filename: string; ok: boolean; message?: string }[]; message?: string };
      setMessages([...pre, ...(data.results ?? []).map((r) => ({ ok: r.ok, text: r.ok ? `${r.filename} uploaded — add alt text before using it publicly.` : r.message ?? `${r.filename} failed.` })), ...(data.message ? [{ ok: false, text: data.message }] : [])]);
      router.refresh();
    } catch {
      setMessages([...pre, { ok: false, text: "The upload was interrupted. Nothing was saved — please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label
        className={`drop${over ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(e.dataTransfer.files);
        }}
      >
        <input ref={input} type="file" multiple accept={ACCEPT.join(",")} className="sr-only" onChange={(e) => e.target.files && upload(e.target.files)} />
        <strong style={{ display: "block", color: "var(--ink)", fontWeight: 400, marginBottom: ".3rem" }}>{busy ? "Uploading and processing…" : "Drop images here, or click to choose"}</strong>
        Several at once is fine (up to 100MB per batch).
      </label>
      <div aria-live="polite">
        {messages.map((m, i) => (
          <p key={i} className={m.ok ? "form-ok" : "form-alert"} style={{ marginBottom: ".4rem" }}>
            {m.text}
          </p>
        ))}
      </div>

      <div className="editor-grid" style={{ marginTop: "1rem" }}>
        <div className="media-grid">
          {assets.map((a) => (
            <button key={a.id} type="button" className="media-item" aria-pressed={selected?.id === a.id} onClick={() => setSelected(a)}>
              <div className="thumb">
                <img src={a.thumb} alt={a.alt} loading="lazy" />
              </div>
              <div className="mi">
                {a.filename}
                {!a.alt && <span>needs alt</span>}
              </div>
            </button>
          ))}
          {!assets.length && <p className="muted">No images yet.</p>}
        </div>
        <aside>
          {selected ? (
            <form
              key={selected.id}
              className="card"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                start(async () => {
                  await updateMediaAction(selected.id, String(f.get("alt")), String(f.get("caption")));
                  setMessages([{ ok: true, text: "Details saved." }]);
                  router.refresh();
                });
              }}
            >
              <h2>Image details</h2>
              <img src={selected.thumb} alt={selected.alt} style={{ marginBottom: "1rem", border: "1px solid var(--line)" }} />
              <dl className="brief" style={{ marginBottom: "1rem" }}>
                <dt>File</dt>
                <dd>{selected.filename}</dd>
                <dt>Size</dt>
                <dd>
                  {selected.width}×{selected.height} · {kb(selected.bytes)}
                </dd>
                <dt>Uploaded</dt>
                <dd>{formatDateLagos(selected.createdAt)}</dd>
                <dt>Address</dt>
                <dd className="mono" style={{ fontSize: ".72rem" }}>
                  {selected.url}
                </dd>
              </dl>
              <div className="field">
                <label htmlFor="alt">Alt text (required for public use)</label>
                <input id="alt" name="alt" className="inp" defaultValue={selected.alt} maxLength={250} placeholder="e.g. Aerial view of Heritage Gardens' tarred roads" />
              </div>
              <div className="field">
                <label htmlFor="caption">Caption (optional)</label>
                <input id="caption" name="caption" className="inp" defaultValue={selected.caption} maxLength={300} />
              </div>
              <div className="rowacts">
                <button className="btn btn-gold btn-sm" type="submit" disabled={pending}>
                  Save details
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(selected.url)}>
                  Copy address
                </button>
                {canDelete && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        if (!confirm("Delete this image? It can be recovered for 30 days.")) return;
                        const r = await deleteMediaAction(selected.id);
                        setMessages([{ ok: r.ok, text: r.ok ? "Image deleted." : r.message }]);
                        if (r.ok) setSelected(null);
                        router.refresh();
                      })
                    }
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          ) : (
            <p className="muted card">Select an image to add alt text, a caption, or copy its address.</p>
          )}
        </aside>
      </div>
    </>
  );
}
