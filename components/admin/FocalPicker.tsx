"use client";
// Click the subject of the photo; cards and heroes keep that point in frame when cropping (FR-ADM-027).
import { useState, useTransition } from "react";
import { setFocalPointAction } from "@/server/actions/phase2";

export function FocalPicker({ id, src, alt, focalX, focalY }: { id: string; src: string; alt: string; focalX: number | null; focalY: number | null }) {
  const [p, setP] = useState<{ x: number; y: number } | null>(focalX != null && focalY != null ? { x: focalX, y: focalY } : null);
  const [pending, start] = useTransition();
  const save = (x: number, y: number) => {
    setP({ x, y });
    start(() => setFocalPointAction(id, x, y));
  };
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        className="focal"
        role="button"
        tabIndex={0}
        aria-label="Set the focal point: click the subject of the photo, or use arrow keys"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          save(Math.round(((e.clientX - r.left) / r.width) * 100) / 100, Math.round(((e.clientY - r.top) / r.height) * 100) / 100);
        }}
        onKeyDown={(e) => {
          const cur = p ?? { x: 0.5, y: 0.5 };
          const step = 0.05;
          const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          const m = moves[e.key];
          if (!m) return;
          e.preventDefault();
          save(Math.min(1, Math.max(0, +(cur.x + m[0]).toFixed(2))), Math.min(1, Math.max(0, +(cur.y + m[1]).toFixed(2))));
        }}
      >
        <img src={src} alt={alt} />
        {p && <span className="pin" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />}
      </div>
      <p className="muted" style={{ fontSize: ".74rem", marginTop: ".3rem" }} aria-live="polite">
        {pending ? "Saving focal point…" : p ? `Focal point ${Math.round(p.x * 100)}% × ${Math.round(p.y * 100)}%` : "No focal point — images crop from the centre."}
      </p>
    </div>
  );
}
