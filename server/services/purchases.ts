// Recording a sale: buyer account (by invitation), purchase and instalment schedule (FR-PORT-001/003/005).
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { makeReference } from "@/lib/reference";
import { generateReferralCode } from "@/lib/referrals";
import { buildSchedule } from "@/lib/payments/schedule";
import { nairaToKobo } from "@/lib/payments/paystack";
import { enqueue } from "./notifications";
import { audit } from "./audit";
import { linkPurchaseToReferral } from "./referrals";
import type { Actor } from "./actor";

const INVITE_DAYS = 7;

export function sha(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function uniqueReferralCode() {
  for (let i = 0; i < 10; i++) {
    const c = generateReferralCode();
    if (!(await db.buyer.findUnique({ where: { referralCode: c } }))) return c;
  }
  throw new Error("Could not allocate a referral code");
}

export interface PurchaseInput {
  leadId: string;
  propertyId: string;
  plotNumber: string;
  priceNaira: number;
  depositNaira: number;
  planMonths: number;
  startDate: string; // YYYY-MM-DD, first payment due
  phaseName?: string;
  sizeText?: string;
}

/** Issue (or re-issue) a buyer invitation; returns the raw token for the email link. */
export async function inviteBuyer(buyerId: string) {
  const token = crypto.randomBytes(24).toString("base64url");
  const buyer = await db.buyer.update({ where: { id: buyerId }, data: { inviteToken: sha(token), inviteExpires: new Date(Date.now() + INVITE_DAYS * 86400_000) } });
  const to = buyer.email ?? buyer.phoneE164;
  if (to) await enqueue({ channel: buyer.email ? "email" : "sms", to, template: "buyer.invite", payload: { name: buyer.name, token }, leadId: buyer.leadId ?? undefined });
  return token;
}

export async function createPurchase(actor: Actor, input: PurchaseInput) {
  assertCan(actor.role, "buyers.manage");
  if (!(input.priceNaira > 0) || input.depositNaira < 0 || input.depositNaira > input.priceNaira) throw new Error("Check the price and deposit.");
  const lead = await db.lead.findUniqueOrThrow({ where: { id: input.leadId } });
  const property = await db.property.findUniqueOrThrow({ where: { id: input.propertyId } });

  let buyer =
    (await db.buyer.findUnique({ where: { leadId: lead.id } })) ??
    (lead.phoneE164 ? await db.buyer.findUnique({ where: { phoneE164: lead.phoneE164 } }) : null) ??
    (lead.email ? await db.buyer.findUnique({ where: { email: lead.email } }) : null);
  if (!buyer) {
    buyer = await db.buyer.create({ data: { leadId: lead.id, name: lead.name, phoneE164: lead.phoneE164, email: lead.email, referralCode: await uniqueReferralCode() } });
  }

  const priceKobo = nairaToKobo(Math.round(input.priceNaira));
  const depositKobo = nairaToKobo(Math.round(input.depositNaira));
  const lines = buildSchedule({ priceKobo, depositKobo, planMonths: input.planMonths, start: new Date(`${input.startDate}T00:00:00Z`) });
  const purchase = await db.purchase.create({
    data: {
      reference: makeReference("PU", new Date().getFullYear(), crypto.randomInt(1, 99999)),
      buyerId: buyer.id,
      propertyId: property.id,
      plotNumber: input.plotNumber.trim().slice(0, 30) || null,
      phaseName: input.phaseName ?? null,
      sizeText: input.sizeText ?? property.sizeText,
      priceKobo,
      depositKobo,
      planMonths: input.planMonths,
      instalments: { create: lines.map((l) => ({ sequence: l.sequence, label: l.label, dueDate: l.dueDate, amountKobo: l.amountKobo })) },
    },
  });
  await db.lead.update({ where: { id: lead.id }, data: { status: "CLOSED_WON" } });
  await db.leadActivity.create({ data: { leadId: lead.id, type: "purchase", actorId: actor.id, payload: { purchase: purchase.reference, property: property.name, plot: input.plotNumber } } });
  await audit(actor, "purchase.create", "Purchase", purchase.id, { after: { reference: purchase.reference, priceKobo: priceKobo.toString(), buyerId: buyer.id } });
  await linkPurchaseToReferral(purchase.id);

  const inviteToken = buyer.status === "ACTIVE" ? "" : await inviteBuyer(buyer.id);
  return { purchase, buyer, inviteToken };
}
