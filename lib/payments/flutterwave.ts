// Flutterwave helpers that need no network: webhook verification, amount conversion and
// mapping a webhook onto the provider-neutral outcome used by the payments service.
import crypto from "node:crypto";

/** Flutterwave sends the "secret hash" set in its dashboard as the verif-hash header. */
export function verifyFlutterwaveHash(header: string | null, secretHash: string): boolean {
  if (!header || !secretHash) return false;
  const a = crypto.createHash("sha256").update(header).digest();
  const b = crypto.createHash("sha256").update(secretHash).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Flutterwave amounts are in naira (major units). Strings are parsed exactly; numbers are
 * rounded to the nearest kobo, which absorbs binary floating-point noise such as 0.1 + 0.2.
 */
export function nairaAmountToKobo(amount: number | string): bigint | null {
  if (typeof amount === "string") {
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) return null;
    const [whole, frac = ""] = amount.trim().split(".");
    return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
  }
  if (!Number.isFinite(amount) || amount < 0) return null;
  const kobo = Math.round(amount * 100);
  return Number.isSafeInteger(kobo) ? BigInt(kobo) : null;
}

export interface ProviderOutcome {
  reference: string;
  transactionId: string;
  outcome: "success" | "failed" | "abandoned";
  amountKobo: bigint;
  currency: string;
  method: string;
  reason: string;
}

interface FlutterwaveEvent {
  event?: string;
  data?: { id?: number | string; tx_ref?: string; amount?: number | string; currency?: string; status?: string; processor_response?: string; payment_type?: string };
}

export function normaliseFlutterwaveEvent(evt: unknown): ProviderOutcome | null {
  const e = evt as FlutterwaveEvent | null;
  if (!e || e.event !== "charge.completed" || !e.data?.tx_ref) return null;
  const d = e.data;
  const amountKobo = nairaAmountToKobo(d.amount ?? -1);
  if (amountKobo === null) return null;
  const status = (d.status ?? "").toLowerCase();
  const outcome = status === "successful" ? "success" : status === "cancelled" ? "abandoned" : "failed";
  return { reference: d.tx_ref!, transactionId: String(d.id ?? ""), outcome, amountKobo, currency: d.currency ?? "NGN", method: d.payment_type ?? "card", reason: (d.processor_response ?? status).slice(0, 120) };
}
