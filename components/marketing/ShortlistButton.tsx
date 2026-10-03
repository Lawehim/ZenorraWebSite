"use client";
import { useShortlist } from "@/components/hooks/useShortlist";

export function ShortlistButton({ slug, name, variant = "overlay" }: { slug: string; name: string; variant?: "overlay" | "inline" }) {
  const { has, toggle } = useShortlist();
  const on = has(slug);
  return (
    <button
      type="button"
      className={variant === "overlay" ? "save-btn" : "btn btn-line btn-sm"}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from shortlist` : `Save ${name} to shortlist`}
      onClick={(e) => {
        e.preventDefault();
        toggle(slug);
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
      </svg>
      {variant === "inline" && <span>{on ? "Saved" : "Save to shortlist"}</span>}
    </button>
  );
}
