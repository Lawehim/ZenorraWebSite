// Labelled image slot: shows the photography brief until the client supplies the shot.
import type { CSSProperties } from "react";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlaceholderProps {
  shot?: string;
  meta?: string;
  seed?: number;
  ratio?: string;
  full?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Placeholder({ shot = "Photograph", meta, seed = 1, ratio, full = false, className = "", style }: PlaceholderProps) {
  const r = rng(seed);
  const vars = {
    "--pa": `${Math.round(135 + r() * 80)}deg`,
    "--px": `${Math.round(22 + r() * 58)}%`,
    "--py": `${Math.round(10 + r() * 45)}%`,
    ...(ratio ? { aspectRatio: ratio } : {}),
    ...style,
  } as CSSProperties;
  const label = shot + (meta ? ` · ${meta}` : "");
  return (
    <div className={`ph${full ? " ph-full" : ""} ${className}`.trim()} style={vars} role="img" aria-label={`Image placeholder: ${label}`}>
      {full ? (
        <span className="ph-tag" aria-hidden="true">
          {label}
        </span>
      ) : (
        <div className="ph-in" aria-hidden="true">
          <svg className="ph-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1">
            <path d="M3 7.5h4l1.6-2.4h6.8L17 7.5h4v12H3z" />
            <circle cx="12" cy="13" r="3.6" />
          </svg>
          <span className="ph-shot">{shot}</span>
          {meta && <span className="ph-meta">{meta}</span>}
        </div>
      )}
    </div>
  );
}

export function seedFrom(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) || 1;
}
