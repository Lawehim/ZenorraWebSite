"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const KINDS = [
  ["CONTRACT", "Contract"],
  ["SURVEY", "Survey plan"],
  ["DEED", "Deed of assignment"],
  ["ALLOCATION", "Allocation letter"],
  ["OTHER", "Other"],
];

export function VaultUpload({ purchaseId }: { purchaseId: string }) {
  const [kind, setKind] = useState("CONTRACT");
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      style={{ marginTop: "1rem" }}
      onSubmit={async (e) => {
        e.preventDefault();
        const file = (e.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
        if (!file) return setMsg({ ok: false, text: "Choose a PDF or image." });
        setBusy(true);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("purchaseId", purchaseId);
        fd.append("kind", kind);
        fd.append("title", title || KINDS.find((k) => k[0] === kind)![1]);
        try {
          const r = await fetch("/api/admin/vault", { method: "POST", body: fd });
          const d = (await r.json()) as { ok: boolean; message?: string };
          setMsg({ ok: d.ok, text: d.ok ? "Added to the buyer's vault." : d.message ?? "Upload failed." });
          if (d.ok) router.refresh();
        } catch {
          setMsg({ ok: false, text: "Upload interrupted — try again." });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="v-kind">Document type</label>
        <select id="v-kind" className="inp" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="v-title">Title shown to the buyer</label>
        <input id="v-title" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="v-file">File (PDF, JPEG or PNG, max 15MB)</label>
        <input id="v-file" name="file" type="file" accept="application/pdf,image/jpeg,image/png" />
      </div>
      <button className="btn btn-line btn-sm" type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Add to vault"}
      </button>
      {msg && (
        <p role="status" style={{ marginTop: ".5rem", color: msg.ok ? "var(--ok)" : "var(--warn)", fontSize: ".84rem" }}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
