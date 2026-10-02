"use client";
// Branded 500 (FR-GLOB-006). Never shows stack traces or framework details (NFR-SEC-016).
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook for Sentry (NFR-OBS-001): report error.digest, never personal data.
    console.error("page-error", error.digest);
  }, [error]);
  return (
    <main className="phead" style={{ minHeight: "80svh", display: "flex", alignItems: "center", paddingTop: "4rem" }}>
      <div className="wrap">
        <div className="eyebrow">Something went wrong</div>
        <h1>This page didn&apos;t load properly</h1>
        <p className="lede" style={{ marginBottom: "2rem" }}>
          It&apos;s our fault, not yours. Try again, or call us — we&apos;re happy to help directly.
        </p>
        <div style={{ display: "flex", gap: ".8rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-gold" onClick={reset}>
            Try again
          </button>
          <a className="btn btn-line" href="/">
            Go to the homepage
          </a>
        </div>
        {error.digest && (
          <p className="mono" style={{ marginTop: "1.6rem", fontSize: ".7rem", color: "var(--ink-3)" }}>
            Reference {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
