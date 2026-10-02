"use client";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/hooks/usePrefersReducedMotion";

const fmt = new Intl.NumberFormat("en-NG");

/** Counts up once when first visible; static under reduced motion (FR-HOME-003, NFR-ACC-008). */
export function StatCounter({ value, suffix = "", label }: { value: number; suffix?: string; label: string }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState<number | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (reduced || typeof IntersectionObserver === "undefined") return;
    const el = ref.current;
    if (!el) return;
    setShown(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 1500);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [reduced, value]);

  const display = shown === null || shown === value ? `${fmt.format(value)}${suffix}` : fmt.format(shown);
  return (
    <div className="fact">
      <b ref={ref} aria-hidden="true">
        {display}
      </b>
      <span className="sr-only">{`${label}: ${fmt.format(value)}${suffix}`}</span>
      <span aria-hidden="true">{label}</span>
    </div>
  );
}
