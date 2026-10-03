"use client";
// Picks a converted video from Media → Videos; stores its /media/video/… link.
import { useEffect, useState } from "react";
import type { FieldControlProps } from "@/components/ui/Field";

interface V {
  id: string;
  url: string;
  filename: string;
  status: string;
}

export function VideoPickerInput({ value, onChange, label, ...p }: FieldControlProps & { value: string; label: string; onChange: (v: string) => void }) {
  const [videos, setVideos] = useState<V[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve()
      .then(() => fetch("/api/admin/media/video"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { videos: V[] }) => setVideos(d.videos.filter((v) => v.status === "READY")))
      .catch(() => setError("Couldn't load your videos."));
  }, []);

  const known = videos?.some((v) => v.url === value);
  return (
    <div>
      <select {...p} aria-label={label} className="inp" value={value} onChange={(e) => onChange(e.target.value)} disabled={!videos}>
        <option value="">No video</option>
        {value && !known && <option value={value}>{value}</option>}
        {(videos ?? []).map((v) => (
          <option key={v.id} value={v.url}>
            {v.filename}
          </option>
        ))}
      </select>
      {error && <p className="err">{error}</p>}
      {videos && videos.length === 0 && (
        <p className="muted" style={{ fontSize: ".78rem", marginTop: ".3rem" }}>
          No converted videos yet — upload one in <a href="/admin/media/videos">Media → Videos</a>.
        </p>
      )}
    </div>
  );
}
