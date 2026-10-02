"use client";
import { useEffect, useState } from "react";
import type { FieldControlProps } from "@/components/ui/Field";

interface Asset {
  id: string;
  url: string;
  thumb: string;
  filename: string;
  alt: string | null;
}

/** Text field holding a /media/... URL, with a browsable picker over the media library. */
export function MediaPickerInput({ value, onChange, label, ...p }: FieldControlProps & { value: string; label: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || assets) return;
    fetch("/api/admin/media")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { assets: Asset[] }) => setAssets(d.assets))
      .catch(() => setError("Couldn't load the media library."));
  }, [open, assets]);

  return (
    <div>
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <input {...p} aria-label={label} className="inp" value={value} placeholder="No image — placeholder shown" onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="btn btn-line btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Close" : "Choose"}
        </button>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}>
            Clear
          </button>
        )}
      </div>
      {open && (
        <div className="media-grid" style={{ marginTop: ".8rem" }}>
          {error && <p className="muted">{error}</p>}
          {!assets && !error && <p className="muted">Loading…</p>}
          {assets?.length === 0 && <p className="muted">No images yet. Upload some under Media.</p>}
          {assets?.map((a) => (
            <button
              type="button"
              key={a.id}
              className="media-item"
              disabled={!a.alt}
              title={a.alt ? a.filename : "Add alt text in the Media library before using this image."}
              onClick={() => {
                onChange(a.url);
                setOpen(false);
              }}
            >
              <div className="thumb">
                <img src={a.thumb} alt={a.alt ?? ""} />
              </div>
              <div className="mi">
                {a.filename}
                {!a.alt && <span>needs alt text</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
