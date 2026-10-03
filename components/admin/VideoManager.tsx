"use client";
// Video uploads (FR-ADM-028): upload with progress, conversion status, copy link, retry, delete.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMediaAction, retryVideoAction } from "@/server/actions/media";

export interface VideoRow {
  id: string;
  url: string;
  poster: string | null;
  filename: string;
  status: string;
  error: string | null;
  duration: string;
  size: string;
  usedBy: string[];
}

const MAX = 200 * 1024 * 1024;

export function VideoManager({ videos, canDelete }: { videos: VideoRow[]; canDelete: boolean }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const busy = videos.some((v) => v.status === "QUEUED" || v.status === "PROCESSING");

  // While anything is converting, refresh the list every few seconds.
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [busy, router]);

  function upload(file: File) {
    setMsg(null);
    if (file.size > MAX) return setMsg({ ok: false, text: `${file.name} is larger than the 200MB limit.` });
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media/video");
    xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress({ name: file.name, pct: Math.round((e.loaded / e.total) * 100) });
    xhr.onload = () => {
      setProgress(null);
      let body: { ok?: boolean; message?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status === 200 && body.ok) {
        setMsg({ ok: true, text: `${file.name} uploaded. Converting for the web — this usually takes a minute or two.` });
        router.refresh();
      } else setMsg({ ok: false, text: body.message ?? "The upload failed. Please try again." });
    };
    xhr.onerror = () => {
      setProgress(null);
      setMsg({ ok: false, text: "The upload was interrupted. Check your connection and try again." });
    };
    setProgress({ name: file.name, pct: 0 });
    xhr.send(file);
  }

  return (
    <>
      <section className="card" style={{ marginBottom: "1.2rem" }}>
        <h2>Upload a video</h2>
        <p className="muted" style={{ fontSize: ".84rem", marginBottom: ".8rem" }}>
          MP4, MOV or WebM up to 200MB. It&apos;s converted to a web-friendly MP4 (up to 1280px wide) and a poster frame is taken automatically. Location and device data are removed.
        </p>
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm"
          disabled={Boolean(progress)}
          aria-label="Choose a video to upload"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        {progress && (
          <div style={{ marginTop: ".8rem" }}>
            <label htmlFor="video-progress" style={{ fontSize: ".84rem" }}>
              Uploading {progress.name} — {progress.pct}%
            </label>
            <progress id="video-progress" max={100} value={progress.pct} style={{ width: "100%" }} />
          </div>
        )}
        <p role="status" aria-live="polite" style={{ fontSize: ".84rem", marginTop: ".6rem", color: msg?.ok ? "var(--ok)" : "var(--warn)" }}>
          {msg?.text}
        </p>
      </section>

      {videos.length === 0 ? (
        <p className="muted">No videos yet.</p>
      ) : (
        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Video</th>
                <th>Status</th>
                <th className="hide-sm">Length · size</th>
                <th className="hide-sm">Used by</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div style={{ display: "flex", gap: ".8rem", alignItems: "center" }}>
                      {v.status === "READY" && v.poster ? (
                        <video src={v.url} poster={v.poster} controls preload="none" width={160} style={{ background: "#000", aspectRatio: "16/9" }} />
                      ) : (
                        <span className="muted" style={{ width: 160, aspectRatio: "16/9", display: "grid", placeItems: "center", border: "1px solid var(--line)", fontSize: ".7rem" }}>
                          {v.status === "FAILED" ? "No preview" : "Converting…"}
                        </span>
                      )}
                      <div>
                        <b>{v.filename}</b>
                        {v.status === "READY" && <div className="mono" style={{ fontSize: ".66rem", overflowWrap: "anywhere" }}>{v.url}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${v.status === "READY" ? "ok" : v.status === "FAILED" ? "draft" : ""}`.trim()}>{v.status === "READY" ? "Ready" : v.status === "FAILED" ? "Failed" : v.status === "PROCESSING" ? "Converting" : "Queued"}</span>
                    {v.error && <div style={{ fontSize: ".75rem", color: "var(--warn)", maxWidth: "28ch" }}>{v.error}</div>}
                  </td>
                  <td className="hide-sm">
                    {v.duration} · {v.size}
                  </td>
                  <td className="hide-sm" style={{ fontSize: ".8rem" }}>{v.usedBy.length ? v.usedBy.join(", ") : <span className="muted">Not used</span>}</td>
                  <td>
                    <div className="rowacts">
                      {v.status === "READY" && (
                        <button
                          type="button"
                          className="btn btn-line btn-sm"
                          onClick={async () => {
                            await navigator.clipboard?.writeText(v.url).catch(() => {});
                            setCopied(v.id);
                            setTimeout(() => setCopied(null), 2000);
                          }}
                        >
                          {copied === v.id ? "Copied" : "Copy link"}
                        </button>
                      )}
                      {v.status === "FAILED" && (
                        <button
                          type="button"
                          className="btn btn-line btn-sm"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const r = await retryVideoAction(v.id);
                              if (!r.ok) setMsg({ ok: false, text: r.message ?? "Couldn't retry." });
                              router.refresh();
                            })
                          }
                        >
                          Retry
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={pending}
                          onClick={() =>
                            confirm(`Delete ${v.filename}?`) &&
                            start(async () => {
                              const r = await deleteMediaAction(v.id);
                              if (!r.ok) setMsg({ ok: false, text: r.message.replace("This image", "This video") });
                              router.refresh();
                            })
                          }
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
