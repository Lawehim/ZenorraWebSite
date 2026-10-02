"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DocumentUpload() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <label className="drop" style={{ padding: "1.2rem", marginBottom: 0 }}>
      <input
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 15 * 1024 * 1024) return setMsg({ ok: false, text: `${f.name} is larger than the 15MB limit.` });
          setBusy(true);
          const fd = new FormData();
          fd.append("file", f);
          try {
            const r = await fetch("/api/admin/documents", { method: "POST", body: fd });
            const d = (await r.json()) as { ok: boolean; message?: string; filename?: string };
            setMsg({ ok: d.ok, text: d.ok ? `${d.filename} uploaded.` : d.message ?? "Upload failed." });
            router.refresh();
          } catch {
            setMsg({ ok: false, text: "Upload interrupted — try again." });
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <strong style={{ color: "var(--ink)", fontWeight: 400 }}>{busy ? "Uploading…" : "Upload a PDF document"}</strong>
      {msg && (
        <span role="status" style={{ display: "block", marginTop: ".4rem", color: msg.ok ? "var(--ok)" : "var(--warn)" }}>
          {msg.text}
        </span>
      )}
    </label>
  );
}
