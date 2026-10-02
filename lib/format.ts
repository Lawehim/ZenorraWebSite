// Money, date and reading-time formatting. Naira is canonical (FR-GLOB-010, C-5).

export type NairaInput = number | bigint;

const GROUPING = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

function toBigInt(n: NairaInput): bigint {
  return typeof n === "bigint" ? n : BigInt(Math.round(n));
}

function trimDecimal(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

export function formatNaira(n: NairaInput, opts: { abbreviate?: boolean } = {}): string {
  const v = toBigInt(n);
  if (!opts.abbreviate || v < 1_000_000n) return "₦" + GROUPING.format(v);

  const millions = Number(v) / 1e6;
  const roundedMillions = Math.round(millions * 10) / 10;
  if (roundedMillions < 1000) return "₦" + trimDecimal(roundedMillions) + "m";

  const billions = Math.round((Number(v) / 1e9) * 10) / 10;
  const text = Number.isInteger(billions) ? GROUPING.format(billions) : trimDecimal(billions);
  return "₦" + text + "bn";
}

export function depositAmount(price: NairaInput, depositPercent: number): number {
  return Math.round((Number(price) * depositPercent) / 100);
}

/** Monthly instalment on the balance after deposit, rounded up to the naira. */
export function monthlyInstalment(price: NairaInput, depositPercent: number, planMonths: number): number {
  const balance = Number(price) - depositAmount(price, depositPercent);
  const months = Math.max(1, Math.floor(planMonths));
  return Math.ceil(balance / months);
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

export function formatDateLagos(d: Date | string): string {
  return DATE_FMT.format(typeof d === "string" ? new Date(d) : d);
}

const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

export function formatDateTimeLagos(d: Date | string): string {
  return DATETIME_FMT.format(typeof d === "string" ? new Date(d) : d) + " WAT";
}

export function readingMinutes(htmlOrText: string): number {
  const text = htmlOrText.replace(/<[^>]*>/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function relativeTime(d: Date, now: Date = new Date()): string {
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDateLagos(d);
}
