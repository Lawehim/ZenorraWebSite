"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-NG">
      <body style={{ margin: 0, background: "#0E0D0B", color: "#F4EFE4", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", padding: "1rem" }}>
        <div style={{ maxWidth: 480 }}>
          <h1 style={{ fontWeight: 400 }}>Something went wrong</h1>
          <p style={{ color: "#B9B09E" }}>Please try again. If it keeps happening, call or WhatsApp Zenorra on +234 703 234 5179.</p>
          <button onClick={reset} style={{ marginTop: "1rem", padding: ".8rem 1.4rem", background: "#E4B04A", border: 0, color: "#1A1305", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
