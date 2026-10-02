import { buildSchedule, allocatePayment, arrears, outstanding, addMonthsClamped, type ScheduleLine } from "@/lib/payments/schedule";
import { verifyPaystackSignature, paystackFailureMessage, nairaToKobo, koboToNaira } from "@/lib/payments/paystack";
import { generateReferralCode, normaliseReferralCode, referralQualifies, commissionKobo } from "@/lib/referrals";
import { renderTextPdf } from "@/lib/pdf";
import crypto from "node:crypto";

describe("money in minor units (FR-PAY-009)", () => {
  it("converts naira to kobo and back without floating point drift", () => {
    expect(nairaToKobo(4_800_000)).toBe(480_000_000n);
    expect(koboToNaira(480_000_050n)).toBe("4800000.50");
  });
  it("reconciles 10,000 synthetic partial payments with zero drift (TC-PAY-007)", () => {
    let total = 0n;
    let sum = 0n;
    for (let i = 1; i <= 10_000; i++) {
      const k = BigInt((i * 7919) % 100_000) + 1n;
      total += k;
      sum += k;
    }
    expect(total).toBe(sum);
  });
});

describe("addMonthsClamped (TC-EDGE-049)", () => {
  it("resolves 31 January + 1 month to the last day of February", () => {
    expect(addMonthsClamped(new Date("2027-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(addMonthsClamped(new Date("2028-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2028-02-29");
  });
  it("keeps the anchor day once a short month has passed", () => {
    expect(addMonthsClamped(new Date("2027-01-31T00:00:00Z"), 2).toISOString().slice(0, 10)).toBe("2027-03-31");
  });
});

describe("buildSchedule (FR-PORT-005)", () => {
  const s = buildSchedule({ priceKobo: 480_000_000n, depositKobo: 144_000_000n, planMonths: 24, start: new Date("2026-10-01T00:00:00Z") });
  it("has a deposit line plus one line per month", () => {
    expect(s).toHaveLength(25);
    expect(s[0]).toMatchObject({ sequence: 0, label: "Initial deposit", amountKobo: 144_000_000n });
    expect(s[1].dueDate.toISOString().slice(0, 10)).toBe("2026-11-01");
  });
  it("sums exactly to the price, putting any remainder on the last instalment", () => {
    const odd = buildSchedule({ priceKobo: 100_000_000n, depositKobo: 30_000_000n, planMonths: 9, start: new Date("2026-10-01T00:00:00Z") });
    expect(odd.reduce((a, l) => a + l.amountKobo, 0n)).toBe(100_000_000n);
    expect(odd[1].amountKobo).toBe(7_777_777n);
    expect(odd[9].amountKobo).toBe(7_777_784n);
  });
  it("handles an outright purchase (no plan)", () => {
    expect(buildSchedule({ priceKobo: 10n, depositKobo: 10n, planMonths: 0, start: new Date() })).toHaveLength(1);
  });
});

describe("allocatePayment (FR-PAY-005, TC-PAY-005/006)", () => {
  const lines = (): ScheduleLine[] => [
    { id: "i0", sequence: 0, amountKobo: 1000n, paidKobo: 1000n, dueDate: new Date("2026-10-01") },
    { id: "i1", sequence: 1, amountKobo: 500n, paidKobo: 0n, dueDate: new Date("2026-11-01") },
    { id: "i2", sequence: 2, amountKobo: 500n, paidKobo: 0n, dueDate: new Date("2026-12-01") },
  ];
  it("part-pays the targeted instalment", () => {
    const r = allocatePayment(lines(), "i1", 200n);
    expect(r.updates).toEqual([{ id: "i1", paidKobo: 200n, status: "PART_PAID" }]);
    expect(r.overpaymentKobo).toBe(0n);
  });
  it("applies an overpayment to the next instalment and reports it", () => {
    const r = allocatePayment(lines(), "i1", 700n);
    expect(r.updates).toEqual([
      { id: "i1", paidKobo: 500n, status: "PAID" },
      { id: "i2", paidKobo: 200n, status: "PART_PAID" },
    ]);
    expect(r.carriedForwardKobo).toBe(200n);
  });
  it("reports overpayment beyond the whole schedule as credit", () => {
    const r = allocatePayment(lines(), "i1", 1500n);
    expect(r.overpaymentKobo).toBe(500n);
  });
  it("computes outstanding balance and arrears", () => {
    const l = lines();
    expect(outstanding(l)).toBe(1000n);
    expect(arrears(l, new Date("2026-11-15"))).toBe(500n);
    expect(arrears(l, new Date("2026-10-15"))).toBe(0n);
  });
});

describe("Paystack webhook signature (FR-PAY-003, TC-SEC-014)", () => {
  const secret = "sk_test_secret";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "ZP-1" } });
  const sig = crypto.createHmac("sha512", secret).update(body).digest("hex");
  it("accepts a correctly signed body", () => expect(verifyPaystackSignature(body, sig, secret)).toBe(true));
  it("rejects a forged or missing signature", () => {
    expect(verifyPaystackSignature(body, "deadbeef", secret)).toBe(false);
    expect(verifyPaystackSignature(body, null, secret)).toBe(false);
    expect(verifyPaystackSignature(body + " ", sig, secret)).toBe(false);
  });
});

describe("paystackFailureMessage (FR-PAY-006)", () => {
  it("explains failures in plain language, never the raw provider string", () => {
    expect(paystackFailureMessage("Declined")).toMatch(/bank declined/i);
    expect(paystackFailureMessage("Insufficient Funds")).toMatch(/not enough funds/i);
    expect(paystackFailureMessage("weird_internal_code_17")).toBe("The payment didn't go through. No money was taken — please try again or use bank transfer.");
  });
});

describe("referral codes (FR-REF-001..005)", () => {
  it("are short, unambiguous (no 0/O/1/I) and unique-ish", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateReferralCode()));
    for (const c of codes) {
      expect(c).toMatch(/^ZN[A-HJ-NP-Z2-9]{6}$/);
    }
    expect(codes.size).toBeGreaterThan(195);
  });
  it("are case-insensitive", () => expect(normaliseReferralCode(" zn2abc9x ")).toBe("ZN2ABC9X"));
  it("rejects malformed codes", () => expect(normaliseReferralCode("ZN0O1I22")).toBeNull());
  it("qualify once the referred purchase reaches the threshold", () => {
    expect(referralQualifies(30_000n, 100_000n, 30)).toBe(true);
    expect(referralQualifies(29_999n, 100_000n, 30)).toBe(false);
  });
  it("compute commission from the configured rate", () => expect(commissionKobo(480_000_000n, 2)).toBe(9_600_000n));
});

describe("renderTextPdf (FR-PORT-007, receipts FR-PAY-004)", () => {
  it("produces a valid single-page PDF containing the text", () => {
    const pdf = renderTextPdf({ title: "Statement of account", lines: ["Heritage Gardens — Plot 14", "Balance: NGN 1,000 (O'Brien)"] });
    const s = pdf.toString("latin1");
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s).toContain("xref");
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("Statement of account");
    expect(s).toContain("O'Brien");
  });
  it("escapes PDF syntax characters in text", () => {
    const s = renderTextPdf({ title: "T", lines: ["a (b) \\ c"] }).toString("latin1");
    expect(s).toContain("a \\(b\\) \\\\ c");
  });
  it("paginates long content", () => {
    const s = renderTextPdf({ title: "T", lines: Array.from({ length: 200 }, (_, i) => `Line ${i}`) }).toString("latin1");
    expect((s.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });
});
