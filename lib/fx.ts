// Indicative foreign-currency display (FR-GLOB-011). Naira stays canonical and contractual.
export interface FxRates {
  GBP: number; // naira per 1 unit
  USD: number;
  CAD: number;
  asOf: string;
}

const SYMBOL: Record<keyof Omit<FxRates, "asOf">, string> = { GBP: "£", USD: "$", CAD: "CA$" };
const FMT = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export function indicativePrices(naira: number | bigint, rates: FxRates | null | undefined) {
  if (!rates) return [];
  const out: { currency: string; amount: number; label: string }[] = [];
  for (const c of ["GBP", "USD", "CAD"] as const) {
    const r = rates[c];
    if (!r || r <= 0) continue;
    const amount = Math.round(Number(naira) / r);
    out.push({ currency: c, amount, label: `≈ ${SYMBOL[c]}${FMT.format(amount)}` });
  }
  return out;
}
