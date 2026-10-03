"use client";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/components/hooks/usePrefersReducedMotion";
import { isUploadedVideoUrl, posterUrlFor } from "@/lib/media/video";

export interface TestimonialItem {
  id: string;
  name: string;
  roleText: string;
  quote: string;
  initials: string | null;
  videoUrl?: string | null;
}

function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  return vm ? `https://player.vimeo.com/video/${vm[1]}?autoplay=1` : null;
}

/** Auto-advances every 7s; pauses on hover, focus, user request and reduced motion (FR-HOME-011). */
export function TestimonialCarousel({ items }: { items: TestimonialItem[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
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
            {t.videoUrl && (isUploadedVideoUrl(t.videoUrl) || embedUrl(t.videoUrl)) && (
              playing === t.id ? (
                isUploadedVideoUrl(t.videoUrl) ? (
                  <video className="video-frame" src={t.videoUrl} poster={posterUrlFor(t.videoUrl)} controls autoPlay playsInline preload="metadata" aria-label={`Video testimonial from ${t.name}`} />
                ) : (
                  <iframe className="video-frame" src={embedUrl(t.videoUrl)!} title={`Video testimonial from ${t.name}`} allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
                )
              ) : (
                <button type="button" className="btn btn-line btn-sm video-btn" onClick={() => { setPaused(true); setPlaying(t.id); }}>
                  ▶ Watch {t.name.split(" ")[0]}&apos;s video
                </button>
              )
            )}
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
