// Inspection dates are evaluated in Africa/Lagos using server time (TC-EDGE-022).

const LAGOS_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function lagosDateString(d: Date): string {
  return LAGOS_DATE.format(d); // en-CA gives YYYY-MM-DD
}

function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return lagosDateString(new Date(d.getTime() + 12 * 3600_000)) === s ? d : null;
}

export type BookableResult = { ok: true } | { ok: false; reason: "invalid" | "past" | "not-inspection-day" };

/** Bookings close the day before; only configured weekdays (0=Sun..6=Sat). */
export function isBookableDate(iso: string, inspectionDays: number[], now: Date = new Date()): BookableResult {
  const d = parseIsoDate(iso);
  if (!d) return { ok: false, reason: "invalid" };
  if (iso <= lagosDateString(now)) return { ok: false, reason: "past" };
  if (!inspectionDays.includes(d.getUTCDay())) return { ok: false, reason: "not-inspection-day" };
  return { ok: true };
}

export function nextInspectionDates(inspectionDays: number[], now: Date = new Date(), count = 8): string[] {
  const out: string[] = [];
  const today = parseIsoDate(lagosDateString(now))!;
  for (let i = 1; out.length < count && i < 400; i++) {
    const d = new Date(today.getTime() + i * 86400_000);
    if (inspectionDays.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export const BOOKING_REASON_TEXT: Record<"invalid" | "past" | "not-inspection-day", string> = {
  invalid: "Choose a date from the list.",
  past: "That date has passed or is too soon. Choose a later inspection day.",
  "not-inspection-day": "Inspections don't run on that day. Choose one of the listed dates.",
};
