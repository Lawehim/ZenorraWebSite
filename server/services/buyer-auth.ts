// Buyer portal authentication: invitation, password, one-time passcode (FR-PORT-001/002).
import crypto from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { db } from "@/lib/db";
import { normalisePhone } from "@/lib/phone";
import { normaliseEmail } from "@/lib/email";
import { checkPasswordPolicy } from "@/lib/auth/password-policy";
import { enqueue } from "./notifications";
import { hitRateLimit } from "./rate-limit";
import { sha } from "./purchases";
import type { RequestCtx } from "./actor";

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
const SESSION_DAYS = 7;
const IDLE_HOURS = 2;
const OTP_MINUTES = 10;
const OTP_ATTEMPTS = 5;
const GENERIC = "Those details didn't match an active account.";

function otpHash(code: string) {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET ?? "dev-only-secret").update(code).digest("hex");
}

async function findBuyer(identifier: string) {
  const phone = normalisePhone(identifier);
  const email = normaliseEmail(identifier);
  if (phone) return db.buyer.findUnique({ where: { phoneE164: phone } });
  if (email) return db.buyer.findUnique({ where: { email } });
  return null;
}

async function issueSession(buyerId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  await db.buyerSession.create({ data: { tokenHash: sha(token), buyerId, expiresAt: new Date(now.getTime() + SESSION_DAYS * 86400_000) } });
  await db.buyer.update({ where: { id: buyerId }, data: { lastLoginAt: now } });
  return token;
}

export async function acceptBuyerInvite(token: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const buyer = await db.buyer.findUnique({ where: { inviteToken: sha(token) } });
  if (!buyer || !buyer.inviteExpires || buyer.inviteExpires < new Date()) return { ok: false, message: "This invitation has expired. Ask your Zenorra advisor to send a new one." };
  const policy = checkPasswordPolicy(password);
  if (!policy.ok) return { ok: false, message: policy.reason };
  await db.buyer.update({ where: { id: buyer.id }, data: { passwordHash: await hash(password, ARGON), status: "ACTIVE", inviteToken: null, inviteExpires: null } });
  return { ok: true };
}

export async function buyerSignIn(identifier: string, password: string, ctx: RequestCtx = {}): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  if (!(await hitRateLimit(`bsignin:${ctx.ip ?? "?"}`, 5, 60, ctx.now))) return { ok: false, message: "Too many attempts. Wait a minute and try again." };
  const buyer = await findBuyer(identifier);
  if (!buyer?.passwordHash || buyer.status !== "ACTIVE" || !(await verify(buyer.passwordHash, password).catch(() => false))) return { ok: false, message: GENERIC };
  return { ok: true, token: await issueSession(buyer.id) };
}

/** Always answers ok so the form can't be used to discover accounts. */
export async function requestOtp(identifier: string, channel: "sms" | "whatsapp" | "email", ctx: RequestCtx = {}): Promise<{ ok: boolean; message?: string }> {
  if (!(await hitRateLimit(`otp:${ctx.ip ?? "?"}`, 5, 600, ctx.now))) return { ok: false, message: "Too many code requests. Try again in 10 minutes." };
  const buyer = await findBuyer(identifier);
  if (!buyer || buyer.status !== "ACTIVE") return { ok: true };
  const to = channel === "email" ? buyer.email : buyer.phoneE164;
  if (!to) return { ok: true };
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await db.buyerOtp.updateMany({ where: { buyerId: buyer.id, usedAt: null }, data: { usedAt: new Date() } }); // one live code at a time
  await db.buyerOtp.create({ data: { buyerId: buyer.id, codeHash: otpHash(code), channel, expiresAt: new Date(Date.now() + OTP_MINUTES * 60_000) } });
  await enqueue({ channel, to, template: "buyer.otp", payload: { code, minutes: OTP_MINUTES } });
  return { ok: true };
}

export async function verifyOtp(identifier: string, code: string, ctx: RequestCtx = {}): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const buyer = await findBuyer(identifier);
  const fail = { ok: false as const, message: "That code is incorrect or has expired. Request a new one." };
  if (!buyer || buyer.status !== "ACTIVE") return fail;
  const otp = await db.buyerOtp.findFirst({ where: { buyerId: buyer.id, usedAt: null, expiresAt: { gt: ctx.now ?? new Date() } }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.attempts >= OTP_ATTEMPTS) return fail;
  const a = Buffer.from(otpHash(code.replace(/\s/g, "")));
  const b = Buffer.from(otp.codeHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await db.buyerOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return fail;
  }
  await db.buyerOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  return { ok: true, token: await issueSession(buyer.id) };
}

export async function getBuyerSession(token: string | undefined) {
  if (!token) return null;
  const s = await db.buyerSession.findUnique({ where: { tokenHash: sha(token) }, include: { buyer: true } });
  const now = new Date();
  if (!s || s.revokedAt || s.expiresAt <= now || now.getTime() - s.lastSeenAt.getTime() > IDLE_HOURS * 3600_000 || s.buyer.status !== "ACTIVE") return null;
  await db.buyerSession.update({ where: { id: s.id }, data: { lastSeenAt: now } });
  const { id, name, email, phoneE164, referralCode } = s.buyer;
  return { id, name, email, phoneE164, referralCode };
}

export async function signOutBuyer(token: string) {
  await db.buyerSession.updateMany({ where: { tokenHash: sha(token) }, data: { revokedAt: new Date() } });
}

/** Anonymous shortlist (localStorage) joins the account on sign-in (FR-PORT-009). */
export async function mergeShortlist(buyerId: string, slugs: unknown[]) {
  const clean = [...new Set(slugs.filter((s): s is string => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s)))].slice(0, 50);
  if (clean.length) await db.shortlistItem.createMany({ data: clean.map((propertySlug) => ({ buyerId, propertySlug })), skipDuplicates: true });
}
