import { db } from "@/lib/db";
import { createLead } from "@/server/services/leads";
import { createPurchase } from "@/server/services/purchases";
import { acceptBuyerInvite } from "@/server/services/buyer-auth";
import { initiatePayment, handleFlutterwaveEvent, handlePaystackEvent } from "@/server/services/payments";
import { updateSettings } from "@/server/services/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { resetDb, makeUser } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

async function setup(provider: "paystack" | "flutterwave" = "flutterwave") {
  const admin = await makeUser("ADMINISTRATOR");
  const actor = { id: admin.id, role: "ADMINISTRATOR" as const };
  await updateSettings(actor, { ...DEFAULT_SETTINGS, payments: { provider } });
  const property = await db.property.create({ data: { reference: "ZNR-001", slug: "heritage", name: "Heritage Gardens", corridor: "Ibeju-Lekki", locationText: "Eleko", titleType: "REGISTERED_SURVEY", priceNaira: 4_800_000n, status: "PUBLISHED" } });
  const r = await createLead({ source: "advisor", name: "Adaeze Okonkwo", phone: "+44 7700 900 812", email: "ada@example.com", website: "" }, { ip: "10.9.1.1", userAgent: "jest", now: new Date() });
  if (!r.ok) throw new Error();
  const lead = await db.lead.findUniqueOrThrow({ where: { reference: r.reference } });
  const p = await createPurchase(actor, { leadId: lead.id, propertyId: property.id, plotNumber: "14", priceNaira: 4_800_000, depositNaira: 1_440_000, planMonths: 24, startDate: "2026-10-01" });
  await acceptBuyerInvite(p.inviteToken, "gold-leaf-over-epe-2026");
  const buyer = await db.buyer.findFirstOrThrow();
  const deposit = await db.instalment.findFirstOrThrow({ where: { purchaseId: p.purchase.id, sequence: 0 } });
  return { buyer, deposit, actor };
}

const charge = (tx_ref: string, kobo: bigint, status = "successful", extra: Record<string, unknown> = {}) => ({
  event: "charge.completed",
  data: { id: 4401, tx_ref, amount: Number(kobo) / 100, currency: "NGN", status, processor_response: status === "successful" ? "Approved" : "Insufficient funds", payment_type: "card", ...extra },
});

describe("Flutterwave payments (A-5, FR-PAY-001..006)", () => {
  it("initiates through the provider chosen in settings", async () => {
    const { buyer, deposit } = await setup();
    const r = await initiatePayment(buyer.id, deposit.id, deposit.amountKobo);
    expect(r.ok && r.checkoutUrl).toMatch(/^\/account\/pay\/simulate\?ref=ZP-/); // no FLW_SECRET_KEY in tests
    expect((await db.payment.findFirstOrThrow()).provider).toBe("flutterwave");
  });

  it("credits once on a successful webhook, issues a receipt, and ignores replays", async () => {
    const { buyer, deposit } = await setup();
    await initiatePayment(buyer.id, deposit.id, deposit.amountKobo);
    const pay = await db.payment.findFirstOrThrow();
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await handleFlutterwaveEvent(charge(pay.providerRef, deposit.amountKobo)));
    expect(results).toEqual(["applied", "duplicate", "duplicate"]);
    expect(await db.instalment.findUniqueOrThrow({ where: { id: deposit.id } })).toMatchObject({ status: "PAID", paidKobo: deposit.amountKobo });
    expect(await db.buyerDocument.count({ where: { kind: "RECEIPT" } })).toBe(1);
  });

  it("refuses to credit when the amount or currency differs from what was initiated", async () => {
    const { buyer, deposit } = await setup();
    await initiatePayment(buyer.id, deposit.id, deposit.amountKobo);
    const pay = await db.payment.findFirstOrThrow();
    expect(await handleFlutterwaveEvent(charge(pay.providerRef, 100n))).toBe("mismatch");
    expect(await handleFlutterwaveEvent(charge(pay.providerRef, deposit.amountKobo, "successful", { currency: "USD" }))).toBe("mismatch");
    expect((await db.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe("PENDING");
    expect((await db.instalment.findUniqueOrThrow({ where: { id: deposit.id } })).paidKobo).toBe(0n);
  });

  it("re-verifies with the provider before crediting, and trusts the verification over the webhook", async () => {
    const { buyer, deposit } = await setup();
    await initiatePayment(buyer.id, deposit.id, deposit.amountKobo);
    const pay = await db.payment.findFirstOrThrow();
    const verify = jest.fn(async () => ({ status: "failed", amount: Number(deposit.amountKobo) / 100, currency: "NGN", tx_ref: pay.providerRef }));
    expect(await handleFlutterwaveEvent(charge(pay.providerRef, deposit.amountKobo), { verify })).toBe("mismatch");
    expect(verify).toHaveBeenCalledWith("4401");
    expect((await db.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe("PENDING");
  });

  it("records a failure with the provider's reason", async () => {
    const { buyer, deposit } = await setup();
    await initiatePayment(buyer.id, deposit.id, deposit.amountKobo);
    const pay = await db.payment.findFirstOrThrow();
    expect(await handleFlutterwaveEvent(charge(pay.providerRef, deposit.amountKobo, "failed"))).toBe("failed");
    expect(await db.payment.findUniqueOrThrow({ where: { id: pay.id } })).toMatchObject({ status: "FAILED", reasonCode: "Insufficient funds" });
  });

  it("never lets one provider's webhook settle the other provider's payment", async () => {
    const { buyer, deposit, actor } = await setup("paystack");
    await initiatePayment(buyer.id, deposit.id, deposit.amountKobo);
    const pay = await db.payment.findFirstOrThrow();
    expect(pay.provider).toBe("paystack");
    expect(await handleFlutterwaveEvent(charge(pay.providerRef, deposit.amountKobo))).toBe("ignored");
    await updateSettings(actor, { ...DEFAULT_SETTINGS, payments: { provider: "flutterwave" } });
    await initiatePayment(buyer.id, deposit.id, deposit.amountKobo);
    const fw = await db.payment.findFirstOrThrow({ where: { provider: "flutterwave" } });
    expect(await handlePaystackEvent({ event: "charge.success", data: { reference: fw.providerRef, amount: Number(deposit.amountKobo) } })).toBe("ignored");
  });
});
