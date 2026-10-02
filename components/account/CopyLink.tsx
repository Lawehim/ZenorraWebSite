"use client";
import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginTop: ".6rem" }}>
      <button
        type="button"
        className="btn btn-line btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setDone(true);
          } catch {
            prompt("Copy your link", url);
          }
        }}
      >
        {done ? "Link copied" : "Copy my link"}
      </button>
      <a className="btn btn-ghost btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`I bought land through Zenorra — have a look: ${url}`)}`} target="_blank" rel="noopener noreferrer">
        Share on WhatsApp
      </a>
    </div>
  );
}
