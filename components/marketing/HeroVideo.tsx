"use client";
// Hero background video (FR-HOME-002): only above 900px, never when the browser reports
// save-data or the visitor prefers reduced motion. The still image underneath is the fallback.
import { useEffect, useState } from "react";
import { isUploadedVideoUrl, posterUrlFor } from "@/lib/media/video";

function allowed() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.matchMedia("(min-width: 900px)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !conn?.saveData;
}

export function HeroVideo({ src }: { src: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Decided after mount: the server can't know the viewport or data-saver preference.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(isUploadedVideoUrl(src) && allowed());
  }, [src]);
  if (!show) return null;
  return <video className="hero-video" src={src} poster={posterUrlFor(src)} autoPlay muted loop playsInline preload="auto" aria-hidden="true" tabIndex={-1} />;
}
