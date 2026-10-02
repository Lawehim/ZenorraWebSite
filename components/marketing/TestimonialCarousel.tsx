"use client";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/components/hooks/usePrefersReducedMotion";

export interface TestimonialItem {
  id: string;
  name: string;
  roleText: string;
  quote: string;
  initials: string | null;
}

/** Auto-advances every 7s; pauses on hover, focus, user request and reduced motion (FR-HOME-011). */
export function TestimonialCarousel({ items }: { items: TestimonialItem[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const reduced = usePrefersReducedMotion();
  const n = items.length;

  useEffect(() => {
    if (paused || hovering || reduced || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 7000);
    return () => clearInterval(t);
  }, [paused, hovering, reduced, n]);

  if (!n) return null;
  return (
    <div
      className="quotes"
      role="region"
      aria-roledescription="carousel"
      aria-label="Client testimonials"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <div className="quotes-track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {items.map((t, k) => (
          <figure className="quote" key={t.id} aria-hidden={k === i ? undefined : "true"} aria-roledescription="slide" aria-label={`${k + 1} of ${n}`} style={{ margin: 0 }}>
            <span className="qm" aria-hidden="true">
              “
            </span>
            <blockquote>{t.quote}</blockquote>
            <figcaption className="who">
              <div className="av" aria-hidden="true">
                {t.initials || t.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ textAlign: "left" }}>
                <b>{t.name}</b>
                <span>{t.roleText}</span>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      {n > 1 && (
        <div className="qnav">
          {items.map((t, k) => (
            <button key={t.id} type="button" className="qdot" aria-label={`Show testimonial ${k + 1} of ${n}`} aria-current={k === i ? "true" : undefined} onClick={() => setI(k)} />
          ))}
          {!reduced && (
            <button type="button" className="qpause" onClick={() => setPaused((p) => !p)}>
              {paused ? "Play" : "Pause"}
              <span className="sr-only"> testimonials</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
