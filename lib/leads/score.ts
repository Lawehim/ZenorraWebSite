// Lead score 0–100 from qualification answers and engagement (FR-LEAD-018). Drives inbox sort.
export interface ScoreInput {
  budgetBand?: string | null;
  timeline?: string | null;
  residency?: string | null;
  enquiries?: number;
  bookedInspection?: boolean;
}

const BUDGET: [RegExp, number][] = [
  [/above ₦50m/i, 30],
  [/₦15m – ₦50m|15m-50m/i, 24],
  [/₦5m – ₦15m|5m-15m/i, 16],
  [/under ₦5m/i, 10],
];
const TIMELINE: [RegExp, number][] = [
  [/30 days/i, 25],
  [/1–3 months|1-3 months/i, 18],
  [/3–6 months|3-6 months/i, 10],
  [/research/i, 3],
];

function pick(table: [RegExp, number][], v?: string | null) {
  if (!v) return 0;
  return table.find(([re]) => re.test(v))?.[1] ?? 5;
}

export function scoreLead(i: ScoreInput): number {
  let s = pick(BUDGET, i.budgetBand) + pick(TIMELINE, i.timeline);
  if (i.residency && /diaspora/i.test(i.residency)) s += 10; // remote buyers need fast, senior attention
  s += Math.min(15, Math.max(0, (i.enquiries ?? 1) - 1) * 5);
  if (i.bookedInspection) s += 20;
  return Math.max(0, Math.min(100, s));
}
