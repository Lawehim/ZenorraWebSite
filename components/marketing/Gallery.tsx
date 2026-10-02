"use client";
import { useEffect, useRef, useState } from "react";
import type { ImageSource } from "@/components/ui/SiteImage";

/** Thumbnail grid + lightbox: arrows, Escape, swipe, focus return (FR-PROP-014, TC-PROP-011). */
export function Gallery({ images, title }: { images: ImageSource[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const n = images.length;

  useEffect(() => {
    if (open === null) return;
    const opened = open;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % n));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + n) % n));
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      triggers.current[opened]?.focus();
    };
  }, [open === null]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h2 style={{ fontSize: "1.5rem", margin: "2.4rem 0 0" }}>Photographs</h2>
      <div className="gallery">
        {images.map((img, i) => (
          <button key={img.src} type="button" ref={(el) => void (triggers.current[i] = el)} onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${n}: ${img.alt}`}>
            <img src={img.src} srcSet={img.srcSet} sizes="200px" alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photographs`}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) setOpen((i) => (i === null ? i : (i + (dx < 0 ? 1 : -1) + n) % n));
            touchX.current = null;
          }}
        >
          <img src={images[open].src} srcSet={images[open].srcSet} sizes="100vw" alt={images[open].alt} />
          <div className="lb-bar">
            <button type="button" className="btn btn-line btn-sm" onClick={() => setOpen((open - 1 + n) % n)} aria-label="Previous photo">
              ←
            </button>
            <span aria-live="polite">
              {open + 1} / {n}
            </span>
            <button type="button" className="btn btn-line btn-sm" onClick={() => setOpen((open + 1) % n)} aria-label="Next photo">
              →
            </button>
            <button type="button" ref={closeRef} className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
