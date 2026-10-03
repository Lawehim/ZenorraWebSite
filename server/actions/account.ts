"use server";
// Buyer portal actions (FR-PORT-001..009). Every action re-checks the buyer session server-side.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { buyerSignIn, requestOtp, verifyOtp, acceptBuyerInvite, signOutBuyer, mergeShortlist } from "@/server/services/buyer-auth";
import { initiatePayment, handlePaystackEvent } from "@/server/services/payments";
import { createTicket } from "@/server/services/tickets";
import { BUYER_COOKIE, requireBuyer, setBuyerCookie } from "@/server/auth/buyer-session";
import { db } from "@/lib/db";

export interface AccountState {
  message?: string;
  step?: "code";
  identifier?: string;
  ok?: boolean;
}

async function ctx() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0] ?? "local", userAgent: h.get("user-agent") ?? undefined };
}

function safeNext(v: FormDataEntryValue | null) {
  const n = typeof v === "string" ? v : "";
  return n.startsWith("/account") && !n.startsWith("//") ? n : "/account";
}

export async function passwordSignInAction(_p: AccountState, form: FormData): Promise<AccountState> {
  const r = await buyerSignIn(String(form.get("identifier") ?? ""), String(form.get("password") ?? ""), await ctx());
  if (!r.ok) return { message: r.message };
  await setBuyerCookie(r.token);
  redirect(safeNext(form.get("next")));
}

export async function requestOtpAction(_p: AccountState, form: FormData): Promise<AccountState> {
  const identifier = String(form.get("identifier") ?? "").trim();
  const channel = String(form.get("channel") ?? "sms") as "sms" | "whatsapp" | "email";
  if (!identifier) return { message: "Enter the phone number or email on your account." };
  const r = await requestOtp(identifier, ["sms", "whatsapp", "email"].includes(channel) ? channel : "sms", await ctx());
  if (!r.ok) return { message: r.message };
  return { step: "code", identifier, message: "If that matches an account, a 6-digit code is on its way. It expires in 10 minutes." };
}

export async function verifyOtpAction(_p: AccountState, form: FormData): Promise<AccountState> {
  const identifier = String(form.get("identifier") ?? "");
  const r = await verifyOtp(identifier, String(form.get("code") ?? ""), await ctx());
  if (!r.ok) return { step: "code", identifier, message: r.message };
  await setBuyerCookie(r.token);
  redirect(safeNext(form.get("next")));
}

export async function acceptBuyerInviteAction(_p: AccountState, form: FormData): Promise<AccountState> {
  const pw = String(form.get("password") ?? "");
  if (pw !== String(form.get("confirm") ?? "")) return { message: "The two passwords don't match." };
  const r = await acceptBuyerInvite(String(form.get("token") ?? ""), pw);
  if (!r.ok) return { message: r.message };
  redirect("/account/login?welcome=1");
}

export async function buyerSignOutAction() {
  const jar = await cookies();
  const t = jar.get(BUYER_COOKIE)?.value;
  if (t) await signOutBuyer(t);
  jar.delete(BUYER_COOKIE);
  redirect("/account/login");
}

export async function payAction(_p: AccountState, form: FormData): Promise<AccountState> {
  const buyer = await requireBuyer();
  const naira = String(form.get("amount") ?? "").replace(/[,\s₦]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(naira) || Number(naira) <= 0) return { message: "Enter an amount in naira, e.g. 140000." };
  const [whole, frac = ""] = naira.split(".");
  const kobo = BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0") || "0");
  const r = await initiatePayment(buyer.id, String(form.get("instalmentId") ?? ""), kobo);
  if (!r.ok) return { message: r.message };
  redirect(r.checkoutUrl);
}

/** Local development only: stand-in for Paystack's checkout + webhook when no secret key is set. */
export async function simulatePaymentAction(reference: string, outcome: "success" | "failed") {
  if (process.env.NODE_ENV === "production" || process.env.PAYSTACK_SECRET_KEY) throw new Error("Not available");
  const buyer = await requireBuyer();
  const pay = await db.payment.findFirst({ where: { providerRef: reference, instalment: { purchase: { buyerId: buyer.id } } } });
  if (!pay) throw new Error("Unknown payment");
  await handlePaystackEvent({ event: outcome === "success" ? "charge.success" : "charge.failed", data: { reference, amount: Number(pay.amountKobo), status: outcome, gateway_response: outcome === "success" ? "Approved" : "Declined", channel: "card (simulated)" } });
  redirect(`/account/pay/return?ref=${reference}`);
}

export async function createTicketAction(_p: AccountState, form: FormData): Promise<AccountState> {
  const buyer = await requireBuyer("/account/support");
  try {
    const t = await createTicket(buyer.id, { purchaseId: String(form.get("purchaseId") ?? "") || undefined, subject: String(form.get("subject") ?? ""), body: String(form.get("body") ?? "") });
    revalidatePath("/account/support");
    return { ok: true, message: `Request ${t.reference} sent. We'll reply here and by ${buyer.email ? "email" : "SMS"}.` };
  } catch (e) {
    return { message: e instanceof Error ? e.message : "Couldn't send your request." };
  }
}

export async function mergeShortlistAction(slugs: string[]) {
  const buyer = await requireBuyer();
  await mergeShortlist(buyer.id, slugs);
}
