"use client";
import { useState } from "react";
import { shareLinks } from "@/lib/share";
import { SocialIcon } from "@/components/ui/Icon";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const l = shareLinks(url, title);
  const [copied, setCopied] = useState(false);
  return (
    <div className="share" role="group" aria-label="Share this article">
      <span className="label">Share</span>
      <a href={l.whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-sm">
        <SocialIcon name="whatsapp" /> WhatsApp
      </a>
      <a href={l.x} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-sm">
        <SocialIcon name="x" /> X
      </a>
      <a href={l.facebook} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-sm">
        <SocialIcon name="facebook" /> Facebook
      </a>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(l.copy);
            setCopied(true);
          } catch {
            prompt("Copy this link", l.copy);
          }
        }}
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
