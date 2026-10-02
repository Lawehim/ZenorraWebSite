// Instalment schedules and payment allocation, all in integer kobo (FR-PAY-005/009).
export interface ScheduleLine {
  id: string;
  sequence: number;
  amountKobo: bigint;
  paidKobo: bigint;
  dueDate: Date;
}

/** Add calendar months, clamping to the month's last day (31 Jan + 1 month → 28/29 Feb). */
export function addMonthsClamped(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const target = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d.getUTCDate(), lastDay)));
}

export function buildSchedule(p: { priceKobo: bigint; depositKobo: bigint; planMonths: number; start: Date }) {
  const lines: { sequence: number; label: string; amountKobo: bigint; dueDate: Date }[] = [];
  const deposit = p.depositKobo > p.priceKobo ? p.priceKobo : p.depositKobo;
  const months = Math.max(0, Math.floor(p.planMonths));
  if (months === 0) return [{ sequence: 0, label: "Full payment", amountKobo: p.priceKobo, dueDate: p.start }];
  lines.push({ sequence: 0, label: "Initial deposit", amountKobo: deposit, dueDate: p.start });
  const balance = p.priceKobo - deposit;
  const each = balance / BigInt(months); // bigint division floors
  for (let i = 1; i <= months; i++) {
    const amount = i === months ? balance - each * BigInt(months - 1) : each;
    lines.push({ sequence: i, label: `Instalment ${i} of ${months}`, amountKobo: amount, dueDate: addMonthsClamped(p.start, i) });
  }
  return lines;
}

export type InstalmentState = "DUE" | "PART_PAID" | "PAID";

/** Apply a payment to the target instalment; any excess rolls forward to later instalments. */
export function allocatePayment(lines: ScheduleLine[], targetId: string, amountKobo: bigint) {
  const ordered = [...lines].sort((a, b) => a.sequence - b.sequence);
  const start = ordered.findIndex((l) => l.id === targetId);
  if (start < 0) throw new Error("Unknown instalment");
  let left = amountKobo;
  const updates: { id: string; paidKobo: bigint; status: InstalmentState }[] = [];
  let carried = 0n;
  for (let i = start; i < ordered.length && left > 0n; i++) {
    const l = ordered[i];
    const due = l.amountKobo - l.paidKobo;
    if (due <= 0n) continue;
    const apply = left < due ? left : due;
    const paid = l.paidKobo + apply;
    updates.push({ id: l.id, paidKobo: paid, status: paid >= l.amountKobo ? "PAID" : "PART_PAID" });
    if (i > start) carried += apply;
    left -= apply;
  }
  return { updates, carriedForwardKobo: carried, overpaymentKobo: left };
}

export function outstanding(lines: Pick<ScheduleLine, "amountKobo" | "paidKobo">[]): bigint {
  return lines.reduce((s, l) => s + (l.amountKobo > l.paidKobo ? l.amountKobo - l.paidKobo : 0n), 0n);
}

export function arrears(lines: ScheduleLine[], now: Date = new Date()): bigint {
  return outstanding(lines.filter((l) => l.dueDate.getTime() < now.getTime()));
}

export function instalmentState(amountKobo: bigint, paidKobo: bigint): InstalmentState {
  return paidKobo >= amountKobo ? "PAID" : paidKobo > 0n ? "PART_PAID" : "DUE";
}
