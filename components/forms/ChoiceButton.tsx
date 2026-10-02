"use client";
import type { ReactNode } from "react";

export function ChoiceButton({ selected, onClick, children, hint }: { selected: boolean; onClick: () => void; children: ReactNode; hint?: string }) {
  return (
    <button type="button" className="opt" aria-pressed={selected} onClick={onClick}>
      <i className="bx" aria-hidden="true" />
      <span>
        {children}
        {hint && <small>{hint}</small>}
      </span>
    </button>
  );
}
