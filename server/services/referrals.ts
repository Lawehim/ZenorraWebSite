// Referral programme (FR-REF-001..005). Codes belong to buyers; leads carry the code they arrived with.
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { normaliseReferralCode, referralQualifies, commissionKobo } from "@/lib/referrals";
import { getSettings } from "./settings";
import { enqueue } from "./notifications";
import { audit } from "./audit";
import type { Actor } from "./actor";

export async function attributeReferral(leadId: string, rawCode: string): Promise<"attributed" | "self" | "ignored"> {
  const code = normaliseReferralCode(rawCode);
  if (!code) return "ignored";
  const settings = await getSettings();
  if (!settings.referrals.enabled) return "ignored";
  const [buyer, lead] = await Promise.all([db.buyer.findUnique({ where: { referralCode: code } }), db.lead.findUnique({ where: { id: leadId }, include: { referral: true } })]);
  if (!buyer || !lead || lead.referral) return "ignored";
  const self = buyer.leadId === lead.id || (buyer.phoneE164 && buyer.phoneE164 === lead.phoneE164) || (buyer.email && buyer.email === lead.email);
  if (self) {
    await db.leadActivity.create({ data: { leadId, type: "referral-rejected", payload: { code, reason: "self-referral" } } });
    return "self";
  }
  await db.referral.create({ data: { referrerId: buyer.id, referredLeadId: leadId } });
  await db.lead.update({ where: { id: leadId }, data: { referralCode: code } });
  await db.leadActivity.create({ data: { leadId, type: "referral", payload: { code, referrer: buyer.name } } });
  return "attributed";
}

/** Link a new purchase to the referral that brought its buyer, and price the commission. */
export async function linkPurchaseToReferral(purchaseId: string) {
  const p = await db.purchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { buyer: true } });
  if (!p.buyer.leadId) return;
  const ref = await db.referral.findUnique({ where: { referredLeadId: p.buyer.leadId } });
  if (!ref || ref.purchaseId) return;
  const settings = await getSettings();
  await db.referral.update({ where: { id: ref.id }, data: { purchaseId, commissionKobo: commissionKobo(p.priceKobo, settings.referrals.commissionPercent) } });
}

/** After any successful payment: qualify the referral once the threshold is reached. */
export async function checkReferralQualification(purchaseId: string) {
  const ref = await db.referral.findUnique({ where: { purchaseId }, include: { referrer: true } });
  if (!ref || ref.status !== "PENDING") return;
  const p = await db.purchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { instalments: true } });
  const paid = p.instalments.reduce((s, i) => s + i.paidKobo, 0n);
  const settings = await getSettings();
  if (!referralQualifies(paid, p.priceKobo, settings.referrals.thresholdPercent)) return;
  await db.referral.update({ where: { id: ref.id }, data: { status: "QUALIFIED" } });
  const admins = await db.user.findMany({ where: { role: { in: ["ADMINISTRATOR", "SUPER_ADMIN"] }, status: "ACTIVE" }, select: { email: true } });
  for (const a of admins) await enqueue({ channel: "email", to: a.email, template: "referral.qualified", payload: { referrer: ref.referrer.name, purchase: p.reference } });
}

export async function setReferralStatus(actor: Actor, referralId: string, status: "PAID" | "REJECTED") {
  assertCan(actor.role, "referrals.approve");
  const r = await db.referral.findUniqueOrThrow({ where: { id: referralId } });
  if (status === "PAID" && r.status !== "QUALIFIED") throw new Error("Only qualified referrals can be paid out.");
  await db.referral.update({ where: { id: referralId }, data: { status, approvedById: actor.id, paidAt: status === "PAID" ? new Date() : null } });
  await audit(actor, `referral.${status.toLowerCase()}`, "Referral", referralId, { before: { status: r.status }, after: { status } });
}
