// Phone normalisation to E.164 — the lead dedupe key (FR-LEAD-014, TC-EDGE-013).
// Nigerian numbers are the default; anything already carrying "+<cc>" is kept.

const NG_NATIONAL = /^0[789][01]\d{8}$/; // 0803 992 1140
const NG_INTL = /^234[789][01]\d{8}$/; // 2348039921140

export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  // "+234 (0) 803..." — drop the trunk zero written in brackets
  let digits = trimmed.replace(/\(0\)/g, "").replace(/\D/g, "");
  if (!digits) return null;

  if (NG_NATIONAL.test(digits)) return "+234" + digits.slice(1);
  if (NG_INTL.test(digits)) return "+" + digits;
  if (digits.startsWith("2340") && NG_INTL.test("234" + digits.slice(4))) return "+234" + digits.slice(4);

  if (hasPlus && !digits.startsWith("234")) {
    // Other country: E.164 allows 8–15 digits including the country code.
    if (digits.length >= 10 && digits.length <= 15) return "+" + digits;
  }
  return null;
}

export function isValidPhone(raw: string | null | undefined): boolean {
  return normalisePhone(raw) !== null;
}

/** Human display for an E.164 Nigerian number: +234 803 992 1140 */
export function displayPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = e164.match(/^\+234(\d{3})(\d{3})(\d{4})$/);
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
