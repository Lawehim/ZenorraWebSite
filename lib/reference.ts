// Short human-readable references: ZN-2026-04812 (FR-LEAD-005).

export function makeReference(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
}

export function isReference(value: string): boolean {
  return /^[A-Z]{2}-\d{4}-\d{5,}$/.test(value);
}
