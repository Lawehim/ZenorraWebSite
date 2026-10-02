"use client";

export function PrintButton({ label = "Print manifest" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-gold btn-sm" onClick={() => window.print()}>
      {label}
    </button>
  );
}
