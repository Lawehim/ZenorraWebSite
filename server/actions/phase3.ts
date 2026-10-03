"use server";
// Staff-side Phase 3 actions: record sales, offline payments, referrals, tickets.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/auth/session";
import { createPurchase, inviteBuyer } from "@/server/services/purchases";
import { recordOfflinePayment } from "@/server/services/payments";
import { setReferralStatus } from "@/server/services/referrals";
import { replyTicket, closeTicket } from "@/server/services/tickets";
import { audit } from "@/server/services/audit";
import { db } from "@/lib/db";

export interface StaffState {
  message?: string;
  ok?: boolean;
  link?: string;
}

export async function createPurchaseAction(_p: StaffState, form: FormData): Promise<StaffState> {
  const actor = await requireActor("buyers.manage");
  const num = (k: string) => Number(String(form.get(k) ?? "").replace(/[,\s₦]/g, ""));
  try {
    const r = await createPurchase(actor, {
      leadId: String(form.get("leadId") ?? ""),
      propertyId: String(form.get("propertyId") ?? ""),
      plotNumber: String(form.get("plotNumber") ?? ""),
      priceNaira: num("priceNaira"),
      depositNaira: num("depositNaira"),
      planMonths: Math.max(0, Math.floor(num("planMonths"))),
      startDate: String(form.get("startDate") ?? ""),
      phaseName: String(form.get("phaseName") ?? "") || undefined,
    });
    revalidatePath("/admin/buyers");
    redirect(`/admin/purchases/${r.purchase.id}?created=1${r.inviteToken ? `&invite=${encodeURIComponent(r.inviteToken)}` : ""}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // let Next's redirect through
    return { message: e instanceof Error ? e.message : "Couldn't record the sale." };
  }
}

export async function resendInviteAction(buyerId: string): Promise<StaffState> {
  const actor = await requireActor("buyers.manage");
  const token = await inviteBuyer(buyerId);
  await audit(actor, "buyer.invite", "Buyer", buyerId);
  return { ok: true, link: `/account/accept-invite?token=${encodeURIComponent(token)}` };
}

export async function offlinePaymentAction(_p: StaffState, form: FormData): Promise<StaffState> {
  const actor = await requireActor("payments.offline");
  const naira = String(form.get("amount") ?? "").replace(/[,\s₦]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(naira)) return { message: "Enter the amount received in naira." };
  const [w, f = ""] = naira.split(".");
  try {
    const receipt = await recordOfflinePayment(actor, String(form.get("instalmentId") ?? ""), BigInt(w) * 100n + BigInt(f.padEnd(2, "0") || "0"), String(form.get("evidenceRef") ?? ""));
    revalidatePath(`/admin/purchases/${String(form.get("purchaseId") ?? "")}`);
    return { ok: true, message: `Recorded. Receipt ${receipt} issued to the buyer.` };
  } catch (e) {
    return { message: e instanceof Error ? e.message : "Couldn't record the payment." };
  }
}

export async function setAllocationAction(purchaseId: string, allocated: boolean) {
  const actor = await requireActor("buyers.manage");
  await db.purchase.update({ where: { id: purchaseId }, data: { allocationStatus: allocated ? "ALLOCATED" : "PENDING", allocatedAt: allocated ? new Date() : null } });
  await audit(actor, "purchase.allocation", "Purchase", purchaseId, { after: { allocated } });
  revalidatePath(`/admin/purchases/${purchaseId}`);
}

export async function referralStatusAction(id: string, status: "PAID" | "REJECTED") {
  const actor = await requireActor("referrals.approve");
  await setReferralStatus(actor, id, status);
  revalidatePath("/admin/referrals");
}

export async function replyTicketAction(id: string, reply: string) {
  const actor = await requireActor("buyers.view");
  await replyTicket(actor, id, reply);
  revalidatePath("/admin/tickets");
}

export async function closeTicketAction(id: string) {
  const actor = await requireActor("buyers.view");
  await closeTicket(actor, id);
  revalidatePath("/admin/tickets");
}
