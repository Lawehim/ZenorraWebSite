import crypto from "node:crypto";
import { db } from "@/lib/db";
import { createLead } from "@/server/services/leads";
import { createPurchase } from "@/server/services/purchases";
import { acceptBuyerInvite, buyerSignIn, requestOtp, verifyOtp, getBuyerSession, mergeShortlist } from "@/server/services/buyer-auth";
import { initiatePayment, handlePaystackEvent, recordOfflinePayment, sendPaymentReminders, paymentStatusForBuyer } from "@/server/services/payments";
import { documentLink, verifyDocumentLink, buildStatementPdf } from "@/server/services/buyer-docs";
import { createTicket, replyTicket } from "@/server/services/tickets";
import { setReferralStatus } from "@/server/services/referrals";
import { ForbiddenError } from "@/lib/rbac";
import { resetDb, makeUser } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const PW = "gold-leaf-over-epe-2026";
const ctx = () => ({ ip: `10.${Math.floor(Math.random() * 250)}.1.1`, userAgent: "jest", now: new Date() });

async function setup() {
  const admin = await makeUser("ADMINISTRATOR");
  const actor = { id: admin.id, role: "ADMINISTRATOR" as const };
  const property = await db.property.create({ data: { reference: "ZNR-001", slug: "heritage", name: "Heritage Gardens", corridor: "Ibeju-Lekki", locationText: "Eleko", titleType: "REGISTERED_SURVEY", priceNaira: 4_800_000n, status: "PUBLISHED" } });
  const r = await createLead({ source: "advisor", name: "Adaeze Okonkwo", phone: "+44 7700 900 812", email: "ada@example.com", website: "" }, ctx());
  if (!r.ok) throw new Error();
  const lead = await db.lead.findUniqueOrThrow({ where: { reference: r.reference } });
  const p = await createPurchase(actor, { leadId: lead.id, propertyId: property.id, plotNumber: "14", priceNaira: 4_800_000, depositNaira: 1_440_000, planMonths: 24, startDate: "2026-10-01" });
  return { actor, admin, property, lead, ...p };
}

describe("purchases + buyer invitation (FR-PORT-001/003/005)", () => {
  it("creates a buyer, purchase and full instalment schedule from a lead, and invites the buyer", async () => {
    const { purchase, inviteToken } = await setup();
    const instalments = await db.instalment.findMany({ where: { purchaseId: purchase.id }, orderBy: { sequence: "asc" } });
    expect(instalments).toHaveLength(25);
    expect(instalments.reduce((s, i) => s + i.amountKobo, 0n)).toBe(480_000_000n);
    expect(inviteToken).toBeTruthy();
    expect(await db.notification.count({ where: { template: "buyer.invite" } })).toBe(1);
  });
  it("refuses purchase creation for non-administrators", async () => {
    const adv = await makeUser("ADVISOR");
    await expect(createPurchase({ id: adv.id, role: "ADVISOR" }, { leadId: "x", propertyId: "y", plotNumber: "1", priceNaira: 1, depositNaira: 1, planMonths: 0, startDate: "2026-10-01" })).rejects.toThrow(ForbiddenError);
  });
});

describe("buyer authentication (FR-PORT-001/002)", () => {
  it("accepts the invitation, then signs in with a password", async () => {
    const { inviteToken } = await setup();
    expect(await acceptBuyerInvite(inviteToken, PW)).toEqual({ ok: true });
    const r = await buyerSignIn("ada@example.com", PW, ctx());
    expect(r.ok).toBe(true);
    if (r.ok) expect((await getBuyerSession(r.token))?.name).toBe("Adaeze Okonkwo");
  });
  it("signs in with a one-time passcode that expires and allows five attempts", async () => {
    const { inviteToken } = await setup();
    await acceptBuyerInvite(inviteToken, PW);
    const sent = await requestOtp("+447700900812", "sms", ctx());
    expect(sent.ok).toBe(true);
    const n = await db.notification.findFirstOrThrow({ where: { template: "buyer.otp" } });
    const code = (n.payload as { code: string }).code;
    for (let i = 0; i < 4; i++) expect((await verifyOtp("+447700900812", "000000", ctx())).ok).toBe(false);
    const ok = await verifyOtp("+447700900812", code, ctx());
    expect(ok.ok).toBe(true);
    expect((await verifyOtp("+447700900812", code, ctx())).ok).toBe(false); // single use
  });
  it("locks the code after five wrong attempts", async () => {
    const { inviteToken } = await setup();
    await acceptBuyerInvite(inviteToken, PW);
    await requestOtp("ada@example.com", "email", ctx());
    const code = ((await db.notification.findFirstOrThrow({ where: { template: "buyer.otp" } })).payload as { code: string }).code;
    for (let i = 0; i < 5; i++) await verifyOtp("ada@example.com", "000000", ctx());
    expect((await verifyOtp("ada@example.com", code, ctx())).ok).toBe(false);
  });
  it("does not reveal whether an account exists", async () => {
    expect(await requestOtp("nobody@example.com", "email", ctx())).toEqual({ ok: true });
    expect(await db.notification.count({ where: { template: "buyer.otp" } })).toBe(0);
  });
  it("merges an anonymous shortlist on sign-in (FR-PORT-009)", async () => {
    const { inviteToken } = await setup();
    await acceptBuyerInvite(inviteToken, PW);
    const buyer = await db.buyer.findFirstOrThrow();
    await mergeShortlist(buyer.id, ["heritage", "coral", "heritage", "<bad>"]);
    expect((await db.shortlistItem.findMany({ where: { buyerId: buyer.id } })).map((s) => s.propertySlug).sort()).toEqual(["coral", "heritage"]);
  });
});

describe("payments via Paystack (FR-PAY-001..006, TC-PAY-001..006)", () => {
  async function paid() {
    const s = await setup();
    await acceptBuyerInvite(s.inviteToken, PW);
    const buyer = await db.buyer.findFirstOrThrow();
    const deposit = await db.instalment.findFirstOrThrow({ where: { purchaseId: s.purchase.id, sequence: 0 } });
    return { ...s, buyer, deposit };
  }
  const event = (reference: string, amount: bigint, status = "success", gateway_response = "Approved") => ({
    event: status === "success" ? "charge.success" : "charge.failed",
    data: { reference, amount: Number(amount), status, gateway_response, channel: "card" },
  });

  it("initiates a pending payment server-side; a redirect alone never marks it paid", async () => {
    const { buyer, deposit } = await paid();
    const r = await initiatePayment(buyer.id, deposit.id, deposit.amountKobo);
    expect(r.ok).toBe(true);
    const pay = await db.payment.findFirstOrThrow();
    expect(pay.status).toBe("PENDING");
    expect(await paymentStatusForBuyer(buyer.id, pay.providerRef)).toBe("PENDING");
  });

  it("marks paid on a verified webhook, issues a receipt and is idempotent on replay", async () => {
    const { buyer, deposit } = await paid();
    await initiatePayment(buyer.id, deposit.id, deposit.amountKobo);
    const pay = await db.payment.findFirstOrThrow();
    for (let i = 0; i < 5; i++) await handlePaystackEvent(event(pay.providerRef, deposit.amountKobo));
    const inst = await db.instalment.findUniqueOrThrow({ where: { id: deposit.id } });
    expect(inst).toMatchObject({ status: "PAID", paidKobo: deposit.amountKobo });
    const after = await db.payment.findUniqueOrThrow({ where: { id: pay.id } });
    expect(after.status).toBe("SUCCESS");
    expect(after.receiptNumber).toMatch(/^RC-\d{4}-\d{5}$/);
    expect(await db.buyerDocument.count({ where: { kind: "RECEIPT" } })).toBe(1);
    expect(await db.notification.count({ where: { template: "payment.receipt" } })).toBe(1);
  });

  it("handles partial and overpayments against the schedule", async () => {
    const { buyer, deposit, purchase } = await paid();
    await initiatePayment(buyer.id, deposit.id, 100_000_000n);
    const p1 = await db.payment.findFirstOrThrow();
    await handlePaystackEvent(event(p1.providerRef, 100_000_000n));
    expect((await db.instalment.findUniqueOrThrow({ where: { id: deposit.id } })).status).toBe("PART_PAID");
    await initiatePayment(buyer.id, deposit.id, 50_000_000n);
    const p2 = await db.payment.findFirstOrThrow({ where: { NOT: { id: p1.id } } });
    await handlePaystackEvent(event(p2.providerRef, 50_000_000n));
    const first = await db.instalment.findFirstOrThrow({ where: { purchaseId: purchase.id, sequence: 1 } });
    expect((await db.instalment.findUniqueOrThrow({ where: { id: deposit.id } })).status).toBe("PAID");
    expect(first.paidKobo).toBe(6_000_000n); // 150m − 144m deposit carried forward
  });

  it("records failures with a plain-language reason and leaves the schedule unchanged", async () => {
    const { buyer, deposit } = await paid();
    await initiatePayment(buyer.id, deposit.id, deposit.amountKobo);
    const pay = await db.payment.findFirstOrThrow();
    await handlePaystackEvent(event(pay.providerRef, deposit.amountKobo, "failed", "Declined"));
    expect((await db.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe("FAILED");
    expect((await db.instalment.findUniqueOrThrow({ where: { id: deposit.id } })).paidKobo).toBe(0n);
  });

  it("ignores events for unknown references", async () => {
    await expect(handlePaystackEvent(event("NOPE", 100n))).resolves.toBe("ignored");
  });

  it("refuses to pay another buyer's instalment (TC-SEC-005)", async () => {
    const { deposit } = await paid();
    const other = await db.buyer.create({ data: { name: "Other", referralCode: "ZNOTHER2" } });
    expect((await initiatePayment(other.id, deposit.id, 100n)).ok).toBe(false);
  });

  it("lets an administrator record an offline bank transfer with evidence (FR-PAY-008)", async () => {
    const { actor, deposit } = await paid();
    const adv = await makeUser("ADVISOR");
    await expect(recordOfflinePayment({ id: adv.id, role: "ADVISOR" }, deposit.id, 10n, "TRF-1")).rejects.toThrow(ForbiddenError);
    await recordOfflinePayment(actor, deposit.id, deposit.amountKobo, "GTB-TRF-88812");
    expect((await db.instalment.findUniqueOrThrow({ where: { id: deposit.id } })).status).toBe("PAID");
    expect(await db.auditLog.count({ where: { action: "payment.offline" } })).toBe(1);
  });

  it("sends reminders 7 days before, 1 day before and on the due date — once each (FR-PAY-007)", async () => {
    const { purchase } = await paid();
    const first = await db.instalment.findFirstOrThrow({ where: { purchaseId: purchase.id, sequence: 1 } }); // due 2026-11-01
    const at = (d: string) => new Date(`${d}T09:00:00+01:00`);
    await sendPaymentReminders(at("2026-10-25"));
    await sendPaymentReminders(at("2026-10-25"));
    await sendPaymentReminders(at("2026-10-31"));
    await sendPaymentReminders(at("2026-11-01"));
    const sent = await db.notification.findMany({ where: { template: "payment.reminder", payload: { path: ["instalmentId"], equals: first.id } } });
    expect(sent).toHaveLength(3);
  });
});

describe("document vault (FR-PORT-004, TC-SEC-005)", () => {
  it("issues signed, expiring links that only work for the owner", async () => {
    const { purchase } = await setup();
    const buyer = await db.buyer.findFirstOrThrow();
    const doc = await db.buyerDocument.create({ data: { buyerId: buyer.id, purchaseId: purchase.id, kind: "CONTRACT", title: "Contract" } });
    const link = documentLink(doc.id, buyer.id, new Date());
    expect(verifyDocumentLink(link.token, doc.id, buyer.id, new Date())).toBe(true);
    expect(verifyDocumentLink(link.token, doc.id, "someone-else", new Date())).toBe(false);
    expect(verifyDocumentLink(link.token, doc.id, buyer.id, new Date(Date.now() + 16 * 60_000))).toBe(false);
  });
  it("builds a statement of account PDF (FR-PORT-007)", async () => {
    const { purchase } = await setup();
    const buyer = await db.buyer.findFirstOrThrow();
    const pdf = await buildStatementPdf(buyer.id, purchase.id);
    expect(pdf.toString("latin1")).toContain("Heritage Gardens");
    await expect(buildStatementPdf("other", purchase.id)).rejects.toThrow();
  });
});

describe("support tickets (FR-PORT-008)", () => {
  it("creates a ticket against a plot and lets staff reply", async () => {
    const { purchase, actor } = await setup();
    const buyer = await db.buyer.findFirstOrThrow();
    const t = await createTicket(buyer.id, { purchaseId: purchase.id, subject: "Allocation letter", body: "When will it be ready?" });
    expect(t.reference).toMatch(/^ST-\d{4}-\d{5}$/);
    await replyTicket(actor, t.id, "This week.");
    expect((await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("ANSWERED");
  });
});

describe("referral programme end to end (FR-REF-001..005, TC-PAY-009/010)", () => {
  it("attributes a referred lead, qualifies at the threshold, and pays out with approval", async () => {
    const s = await setup();
    const referrer = await db.buyer.findFirstOrThrow();
    const r = await createLead({ source: "advisor", name: "Friend", phone: "08039921140", email: "", referralCode: referrer.referralCode.toLowerCase(), website: "" }, ctx());
    if (!r.ok) throw new Error();
    const friendLead = await db.lead.findUniqueOrThrow({ where: { reference: r.reference }, include: { referral: true } });
    expect(friendLead.referral?.status).toBe("PENDING");
    const fp = await createPurchase(s.actor, { leadId: friendLead.id, propertyId: s.property.id, plotNumber: "15", priceNaira: 4_800_000, depositNaira: 1_440_000, planMonths: 24, startDate: "2026-10-01" });
    const ref = await db.referral.findFirstOrThrow();
    expect(ref.purchaseId).toBe(fp.purchase.id);
    expect(ref.commissionKobo).toBe(9_600_000n);
    const deposit = await db.instalment.findFirstOrThrow({ where: { purchaseId: fp.purchase.id, sequence: 0 } });
    await recordOfflinePayment(s.actor, deposit.id, deposit.amountKobo, "TRF-1"); // 30% = threshold
    expect((await db.referral.findFirstOrThrow()).status).toBe("QUALIFIED");
    await setReferralStatus(s.actor, ref.id, "PAID");
    expect((await db.referral.findFirstOrThrow()).status).toBe("PAID");
  });
  it("blocks self-referral", async () => {
    await setup();
    const buyer = await db.buyer.findFirstOrThrow();
    await createLead({ source: "advisor", name: "Me again", phone: "+44 7700 900 812", email: "", referralCode: buyer.referralCode, website: "" }, ctx());
    expect(await db.referral.count()).toBe(0);
  });
});

describe("crypto sanity", () => {
  it("uses unguessable invite tokens and stores only their hash", async () => {
    const { inviteToken } = await setup();
    const stored = (await db.buyer.findFirstOrThrow()).inviteToken;
    expect(inviteToken.length).toBeGreaterThanOrEqual(32);
    expect(stored).not.toBe(inviteToken);
    expect(stored).toBe(crypto.createHash("sha256").update(inviteToken).digest("hex"));
  });
});
