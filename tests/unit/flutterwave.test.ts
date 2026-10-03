import { verifyFlutterwaveHash, nairaAmountToKobo, normaliseFlutterwaveEvent } from "@/lib/payments/flutterwave";
import { providerFailureMessage, paymentProviderFor } from "@/lib/payments/provider";

describe("Flutterwave webhook hash (FR-PAY-003)", () => {
  it("accepts the configured secret hash and rejects anything else", () => {
    expect(verifyFlutterwaveHash("s3cret-hash", "s3cret-hash")).toBe(true);
    expect(verifyFlutterwaveHash("wrong", "s3cret-hash")).toBe(false);
    expect(verifyFlutterwaveHash(null, "s3cret-hash")).toBe(false);
    expect(verifyFlutterwaveHash("", "")).toBe(false);
  });
});

describe("nairaAmountToKobo — Flutterwave reports major units (FR-PAY-009)", () => {
  it("converts without floating-point drift", () => {
    expect(nairaAmountToKobo(1500)).toBe(150_000n);
    expect(nairaAmountToKobo(1500.5)).toBe(150_050n);
    expect(nairaAmountToKobo("2000.75")).toBe(200_075n);
    expect(nairaAmountToKobo(0.1 + 0.2)).toBe(30n);
    expect(nairaAmountToKobo(4_800_000.07)).toBe(480_000_007n);
  });
  it("rejects negative, non-numeric and over-precise values", () => {
    expect(nairaAmountToKobo(-1)).toBeNull();
    expect(nairaAmountToKobo("abc")).toBeNull();
    expect(nairaAmountToKobo("1.234")).toBeNull();
  });
});

describe("normaliseFlutterwaveEvent", () => {
  const base = { event: "charge.completed", data: { id: 991, tx_ref: "ZP-1", amount: 1400, currency: "NGN", status: "successful", processor_response: "Approved", payment_type: "card" } };
  it("maps a successful charge", () => {
    expect(normaliseFlutterwaveEvent(base)).toEqual({ reference: "ZP-1", transactionId: "991", outcome: "success", amountKobo: 140_000n, currency: "NGN", method: "card", reason: "Approved" });
  });
  it("maps failed and cancelled charges", () => {
    expect(normaliseFlutterwaveEvent({ ...base, data: { ...base.data, status: "failed", processor_response: "Insufficient funds" } })?.outcome).toBe("failed");
    expect(normaliseFlutterwaveEvent({ ...base, data: { ...base.data, status: "cancelled" } })?.outcome).toBe("abandoned");
  });
  it("ignores other events and malformed payloads", () => {
    expect(normaliseFlutterwaveEvent({ event: "transfer.completed", data: base.data })).toBeNull();
    expect(normaliseFlutterwaveEvent({ event: "charge.completed" })).toBeNull();
    expect(normaliseFlutterwaveEvent(null)).toBeNull();
  });
});

describe("provider choice (A-5)", () => {
  it("uses the provider chosen in settings, falling back to Paystack", () => {
    expect(paymentProviderFor({ provider: "flutterwave" })).toBe("flutterwave");
    expect(paymentProviderFor({ provider: "paystack" })).toBe("paystack");
    expect(paymentProviderFor(undefined)).toBe("paystack");
  });
  it("gives buyers plain-language failure reasons whatever the provider", () => {
    expect(providerFailureMessage("Insufficient Funds")).toMatch(/not enough funds/);
    expect(providerFailureMessage("Transaction declined by bank")).toMatch(/declined/);
    expect(providerFailureMessage(null)).toMatch(/didn't go through/);
  });
});
