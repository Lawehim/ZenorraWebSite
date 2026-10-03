// Paystack helpers that need no network: webhook verification, money units, plain-language errors.
import crypto from "node:crypto";

export function nairaToKobo(naira: number | bigint): bigint {
  return BigInt(naira) * 100n;
}

export function koboToNaira(kobo: bigint): string {
  const neg = kobo < 0n;
  const v = neg ? -kobo : kobo;
  return `${neg ? "-" : ""}${v / 100n}.${String(v % 100n).padStart(2, "0")}`;
}

export function formatKobo(kobo: bigint): string {
  const naira = kobo / 100n;
  const k = kobo % 100n;
  return "₦" + new Intl.NumberFormat("en-NG").format(naira) + (k ? `.${String(k).padStart(2, "0")}` : "");
}

/** Paystack signs the raw body with HMAC-SHA512 using the secret key (x-paystack-signature). */
export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const MESSAGES: [RegExp, string][] = [
  [/declin|do not honou?r/i, "Your bank declined the payment. No money was taken — try another card or pay by bank transfer."],
  [/insufficient/i, "There were not enough funds on the card. No money was taken."],
  [/expired/i, "The card has expired. Please use another card."],
  [/otp|pin|authenticat/i, "The bank's verification step wasn't completed. Please try again."],
  [/abandon|cancel/i, "The payment was cancelled before it finished. Nothing was charged."],
  [/timeout|timed out/i, "The bank took too long to respond. Check your account before trying again."],
];

export function paystackFailureMessage(providerReason: string | null | undefined): string {
  const r = providerReason ?? "";
  return MESSAGES.find(([re]) => re.test(r))?.[1] ?? "The payment didn't go through. No money was taken — please try again or use bank transfer.";
}
