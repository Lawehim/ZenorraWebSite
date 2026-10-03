"use client";
// Thin progress bar for long articles (FR-CONT-009). Decorative; hidden from assistive tech.
import { useEffect, useState } from "react";

export function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return <div className="read-progress" aria-hidden="true" style={{ transform: `scaleX(${p})` }} />;
}
