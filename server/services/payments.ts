// Instalment payments. The webhook is the only source of truth (FR-PAY-002, AD-7);
// applying a payment is idempotent on the provider reference (FR-PAY-003).
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { makeReference } from "@/lib/reference";
import { allocatePayment, outstanding } from "@/lib/payments/schedule";
import { formatKobo } from "@/lib/payments/paystack";
import { normaliseFlutterwaveEvent, nairaAmountToKobo } from "@/lib/payments/flutterwave";
import { paymentProviderFor, providerConfigured, providerFailureMessage, type PaymentProvider } from "@/lib/payments/provider";
import { lagosDateString } from "@/lib/bookings/dates";
import { enqueue } from "./notifications";
import { audit } from "./audit";
import { checkReferralQualification } from "./referrals";
import { buildReceiptPdf, storePrivateFile } from "./buyer-docs";
import { getSettings } from "./settings";
import type { Actor } from "./actor";

const PAYSTACK_INIT = "https://api.paystack.co/transaction/initialize";
const FLW_API = "https://api.flutterwave.com/v3";

async function instalmentForBuyer(buyerId: string, instalmentId: string) {
  return db.instalment.findFirst({ where: { id: instalmentId, purchase: { buyerId } }, include: { purchase: { include: { instalments: true, buyer: true } } } });
}

export type InitiateResult = { ok: true; reference: string; checkoutUrl: string } | { ok: false; message: string };

export async function initiatePayment(buyerId: string, instalmentId: string, amountKobo: bigint): Promise<InitiateResult> {
  const inst = await instalmentForBuyer(buyerId, instalmentId);
  if (!inst) return { ok: false, message: "That instalment isn't on your account." };
  const owed = outstanding(inst.purchase.instalments);
  if (amountKobo <= 0n) return { ok: false, message: "Enter an amount above zero." };
  if (amountKobo > owed) return { ok: false, message: `That's more than your outstanding balance of ${formatKobo(owed)}.` };
  const reference = `ZP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const provider = paymentProviderFor((await getSettings()).payments);
  await db.payment.create({ data: { instalmentId, provider, providerRef: reference, amountKobo } });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (!providerConfigured(provider)) {
    if (process.env.NODE_ENV === "production") return { ok: false, message: "Online payment isn't available yet. Please pay by bank transfer using the details on this page." };
    return { ok: true, reference, checkoutUrl: `/account/pay/simulate?ref=${reference}` }; // local development only
  }
  const checkoutUrl = provider === "flutterwave" ? await flutterwaveCheckout(inst, reference, amountKobo, appUrl) : await paystackCheckout(inst, reference, amountKobo, appUrl);
  if (!checkoutUrl) {
    await db.payment.update({ where: { providerRef: reference }, data: { status: "FAILED", reasonCode: "init-failed" } });
    return { ok: false, message: "We couldn't reach the payment provider. Nothing was charged — please try again shortly." };
  }
  return { ok: true, reference, checkoutUrl };
}

type BuyerInstalment = NonNullable<Awaited<ReturnType<typeof instalmentForBuyer>>>;

async function paystackCheckout(inst: BuyerInstalment, reference: string, amountKobo: bigint, appUrl: string): Promise<string | null> {
  const res = await fetch(PAYSTACK_INIT, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: inst.purchase.buyer.email ?? `buyer-${inst.purchase.buyerId}@zenorra.invalid`, amount: Number(amountKobo), reference, currency: "NGN", callback_url: `${appUrl}/account/pay/return?ref=${reference}`, metadata: { instalmentId: inst.id, purchase: inst.purchase.reference } }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  const data = res && res.ok ? ((await res.json()) as { status: boolean; data?: { authorization_url: string } }) : null;
  return data?.status && data.data ? data.data.authorization_url : null;
}

/** Flutterwave Standard: hosted checkout link; amounts are sent in naira (major units). */
async function flutterwaveCheckout(inst: BuyerInstalment, reference: string, amountKobo: bigint, appUrl: string): Promise<string | null> {
  const b = inst.purchase.buyer;
  const res = await fetch(`${FLW_API}/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tx_ref: reference,
      amount: `${amountKobo / 100n}.${String(amountKobo % 100n).padStart(2, "0")}`,
      currency: "NGN",
      redirect_url: `${appUrl}/account/pay/return?ref=${reference}`,
      customer: { email: b.email ?? `buyer-${b.id}@zenorra.invalid`, name: b.name, phonenumber: b.phoneE164 ?? undefined },
      customizations: { title: "Zenorra Limited", description: `${inst.label} — ${inst.purchase.reference}` },
      meta: { instalmentId: inst.id, purchase: inst.purchase.reference },
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  const data = res && res.ok ? ((await res.json()) as { status?: string; data?: { link?: string } }) : null;
  return data?.status === "success" && data.data?.link ? data.data.link : null;
}

export async function paymentStatusForBuyer(buyerId: string, reference: string) {
  const p = await db.payment.findFirst({ where: { providerRef: reference, instalment: { purchase: { buyerId } } } });
  return p?.status ?? null;
}

/** Apply a confirmed payment to the schedule, issue the receipt, notify, check referral. */
async function applySuccess(paymentId: string, amountKobo: bigint, method: string) {
  const pay = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { instalment: { include: { purchase: { include: { instalments: true, buyer: true, property: true } } } } } });
  const purchase = pay.instalment.purchase;
  const alloc = allocatePayment(
    purchase.instalments.map((i) => ({ id: i.id, sequence: i.sequence, amountKobo: i.amountKobo, paidKobo: i.paidKobo, dueDate: i.dueDate })),
    pay.instalmentId,
    amountKobo,
  );
  const receiptNumber = makeReference("RC", new Date().getFullYear(), crypto.randomInt(1, 99999));
  await db.$transaction([...alloc.updates.map((u) => db.instalment.update({ where: { id: u.id }, data: { paidKobo: u.paidKobo, status: u.status } })), db.payment.update({ where: { id: paymentId }, data: { receiptNumber, method, amountKobo } })]);

  const after = await db.instalment.findMany({ where: { purchaseId: purchase.id } });
  const balance = outstanding(after);
  const pdf = buildReceiptPdf({ receiptNumber, buyer: purchase.buyer.name, property: purchase.property.name, plot: purchase.plotNumber, purchaseRef: purchase.reference, amountKobo, method, paidAt: new Date(), balanceKobo: balance });
  const key = `receipts/${purchase.id}/${receiptNumber}.pdf`;
  await storePrivateFile(key, pdf);
  await db.buyerDocument.create({ data: { buyerId: purchase.buyerId, purchaseId: purchase.id, kind: "RECEIPT", title: `Receipt ${receiptNumber}`, storageKey: key } });

  const b = purchase.buyer;
  const to = b.email ?? b.phoneE164;
  if (to) {
    await enqueue({
      channel: b.email ? "email" : "sms",
      to,
      template: "payment.receipt",
      payload: { name: b.name, receiptNumber, amount: formatKobo(amountKobo), balance: formatKobo(balance), property: purchase.property.name, overpayment: alloc.overpaymentKobo > 0n ? formatKobo(alloc.overpaymentKobo) : "", carried: alloc.carriedForwardKobo > 0n ? formatKobo(alloc.carriedForwardKobo) : "" },
    });
  }
  await checkReferralQualification(purchase.id);
  return receiptNumber;
}

interface PaystackEvent {
  event: string;
  data: { reference: string; amount: number; status?: string; gateway_response?: string; channel?: string };
}

type WebhookResult = "applied" | "duplicate" | "failed" | "ignored" | "mismatch";
type Outcome = { reference: string; outcome: "success" | "failed" | "abandoned" | "other"; amountKobo: bigint; method: string; reason: string };

/** Provider-neutral outcome handling. Atomic, so a replayed webhook never double-credits. */
async function applyOutcome(provider: PaymentProvider, o: Outcome, raw: unknown): Promise<WebhookResult> {
  const pay = await db.payment.findUnique({ where: { providerRef: o.reference } });
  if (!pay || pay.provider !== provider) return "ignored";
  if (o.outcome === "success") {
    // Atomic claim: only one delivery of this webhook can move PENDING → SUCCESS.
    const claimed = await db.payment.updateMany({ where: { id: pay.id, status: { in: ["PENDING", "FAILED", "ABANDONED"] } }, data: { status: "SUCCESS", paidAt: new Date(), rawWebhook: raw as never } });
    if (!claimed.count) return "duplicate";
    await applySuccess(pay.id, o.amountKobo, o.method);
    return "applied";
  }
  if (o.outcome === "failed" || o.outcome === "abandoned") {
    await db.payment.updateMany({ where: { id: pay.id, status: "PENDING" }, data: { status: o.outcome === "abandoned" ? "ABANDONED" : "FAILED", reasonCode: o.reason.slice(0, 120), rawWebhook: raw as never } });
    return "failed";
  }
  return "ignored";
}

export async function handlePaystackEvent(evt: PaystackEvent): Promise<WebhookResult> {
  const ref = evt.data?.reference;
  if (!ref) return "ignored";
  const failed = evt.event === "charge.failed" || evt.data.status === "failed" || evt.data.status === "abandoned";
  const outcome = evt.event === "charge.success" ? "success" : failed ? (evt.data.status === "abandoned" ? "abandoned" : "failed") : "other";
  return applyOutcome("paystack", { reference: ref, outcome, amountKobo: BigInt(evt.data.amount ?? 0), method: evt.data.channel ?? "card", reason: evt.data.gateway_response ?? "" }, evt);
}

export interface FlutterwaveVerification {
  status?: string;
  amount?: number | string;
  currency?: string;
  tx_ref?: string;
}

/** GET /transactions/:id/verify — Flutterwave's recommended check before giving value. */
async function verifyWithFlutterwave(transactionId: string): Promise<FlutterwaveVerification | null> {
  const res = await fetch(`${FLW_API}/transactions/${encodeURIComponent(transactionId)}/verify`, { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { data?: FlutterwaveVerification }).data ?? null;
}

/**
 * Flutterwave webhook. A success only credits when the amount and currency match what was
 * initiated and, when the secret key is configured, Flutterwave's verify API agrees.
 */
export async function handleFlutterwaveEvent(evt: unknown, opts: { verify?: (transactionId: string) => Promise<FlutterwaveVerification | null> } = {}): Promise<WebhookResult> {
  const o = normaliseFlutterwaveEvent(evt);
  if (!o) return "ignored";
  const pay = await db.payment.findUnique({ where: { providerRef: o.reference } });
  if (!pay || pay.provider !== "flutterwave") return "ignored";
  if (o.outcome === "success") {
    if (pay.status === "SUCCESS") return "duplicate";
    if (o.currency !== "NGN" || o.amountKobo !== pay.amountKobo) return mismatch(pay.id, "amount-mismatch");
    const verify = opts.verify ?? (process.env.FLW_SECRET_KEY ? verifyWithFlutterwave : null);
    if (verify) {
      const v = await verify(o.transactionId);
      const vKobo = v?.amount === undefined ? null : nairaAmountToKobo(v.amount);
      if (!v || v.status !== "successful" || v.currency !== "NGN" || v.tx_ref !== o.reference || vKobo !== pay.amountKobo) return mismatch(pay.id, "verify-failed");
    }
  }
  return applyOutcome("flutterwave", o, evt);
}

async function mismatch(paymentId: string, reason: string): Promise<WebhookResult> {
  await audit(null, "webhook.mismatch", "Payment", paymentId, { after: { provider: "flutterwave", reason } });
  return "mismatch";
}

export function failureMessageFor(reasonCode: string | null) {
  return providerFailureMessage(reasonCode);
}

/** Bank transfer received directly (FR-PAY-008). */
export async function recordOfflinePayment(actor: Actor, instalmentId: string, amountKobo: bigint, evidenceRef: string) {
  assertCan(actor.role, "payments.offline");
  if (amountKobo <= 0n) throw new Error("Amount must be above zero.");
  if (!evidenceRef.trim()) throw new Error("Add the bank transfer reference as evidence.");
  const pay = await db.payment.create({
    data: { instalmentId, provider: "offline", providerRef: `OFF-${crypto.randomBytes(6).toString("hex").toUpperCase()}`, amountKobo, status: "SUCCESS", paidAt: new Date(), evidenceRef: evidenceRef.trim().slice(0, 80), recordedById: actor.id },
  });
  const receipt = await applySuccess(pay.id, amountKobo, "bank transfer");
  await audit(actor, "payment.offline", "Payment", pay.id, { after: { instalmentId, amountKobo: amountKobo.toString(), evidenceRef, receipt } });
  return receipt;
}

const REMINDER_DAYS: [number, string][] = [
  [7, "d7"],
  [1, "d1"],
  [0, "d0"],
];

/** 7 days before, 1 day before and on the due date; suppressed once paid (FR-PAY-007). */
export async function sendPaymentReminders(now: Date = new Date()): Promise<number> {
  const today = new Date(`${lagosDateString(now)}T00:00:00Z`);
  const horizon = new Date(today.getTime() + 8 * 86400_000);
  const due = await db.instalment.findMany({ where: { status: { not: "PAID" }, dueDate: { gte: today, lte: horizon } }, include: { purchase: { include: { buyer: true, property: true } } } });
  let sent = 0;
  for (const i of due) {
    const days = Math.round((i.dueDate.getTime() - today.getTime()) / 86400_000);
    const tag = REMINDER_DAYS.find(([d]) => d === days)?.[1];
    if (!tag || i.remindersSent.includes(tag)) continue;
    const b = i.purchase.buyer;
    const to = b.email ?? b.phoneE164;
    if (!to) continue;
    await enqueue({
      channel: b.email ? "email" : "sms",
      to,
      template: "payment.reminder",
      payload: { instalmentId: i.id, name: b.name, label: i.label, amount: formatKobo(i.amountKobo - i.paidKobo), due: lagosDateString(i.dueDate), property: i.purchase.property.name, when: days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days` },
    });
    await db.instalment.update({ where: { id: i.id }, data: { remindersSent: { push: tag } } });
    sent++;
  }
  return sent;
}
