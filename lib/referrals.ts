// Referral programme rules (FR-REF-001..005).
import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I

export function generateReferralCode(): string {
  let s = "ZN";
  for (let i = 0; i < 6; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

export function normaliseReferralCode(raw: string | null | undefined): string | null {
  const c = (raw ?? "").trim().toUpperCase();
  return /^ZN[A-HJ-NP-Z2-9]{6}$/.test(c) ? c : null;
}

/** Payable once the referred buyer has paid at least `thresholdPercent` of the price. */
export function referralQualifies(paidKobo: bigint, priceKobo: bigint, thresholdPercent: number): boolean {
  return paidKobo * 100n >= priceKobo * BigInt(Math.round(thresholdPercent));
}

export function commissionKobo(priceKobo: bigint, ratePercent: number): bigint {
  // rate stored with up to 2 decimals (e.g. 2.5%) → basis points
  return (priceKobo * BigInt(Math.round(ratePercent * 100))) / 10_000n;
}

export const REFERRAL_COOKIE = "zn_ref";
export const REFERRAL_DAYS = 90;
