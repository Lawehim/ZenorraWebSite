// Staff authentication (FR-ADM-001..005, FR-ADM-050, NFR-SEC-014).
// Sessions are opaque random tokens; only their SHA-256 is stored, so a database
// leak does not leak live sessions. Revocation is a row update — immediate.
import crypto from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { authenticator } from "otplib";
import type { Role, User } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, ForbiddenError } from "@/lib/rbac";
import { checkPasswordPolicy } from "@/lib/auth/password-policy";
import { enqueue } from "./notifications";
import { hitRateLimit, LIMITS } from "./rate-limit";
import { audit } from "./audit";
import type { Actor, RequestCtx } from "./actor";

export const IDLE_MINUTES = 60;
export const ABSOLUTE_HOURS = 8;
export const LOCK_THRESHOLD = 10;
export const LOCK_WINDOW_MINUTES = 15;
const INVITE_HOURS = 72;

// @node-rs/argon2 defaults to Argon2id; parameters follow OWASP's minimum (19 MiB, t=2, p=1).
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
const GENERIC = "Email or password is incorrect.";
const LOCKED = "This account is locked after repeated failed sign-ins. Try again in 15 minutes or ask a Super Admin to unlock it.";
let dummyHash: string | null = null;

export async function hashPassword(pw: string) {
  return hash(pw, ARGON);
}

function sha(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type SignInResult = { ok: true; token: string; user: User } | { ok: false; message: string; twoFactorRequired?: boolean };

export async function signIn(emailRaw: string, password: string, ctx: RequestCtx = {}, totp?: string): Promise<SignInResult> {
  const now = ctx.now ?? new Date();
  if (!(await hitRateLimit(`signin:${ctx.ip ?? "unknown"}`, LIMITS.signIn.limit, LIMITS.signIn.window, now))) {
    return { ok: false, message: "Too many sign-in attempts. Wait a minute and try again." };
  }
  const email = emailRaw.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash || user.status !== "ACTIVE") {
    dummyHash ??= await hashPassword("timing-equaliser-password");
    await verify(dummyHash, password).catch(() => false);
    return { ok: false, message: GENERIC };
  }
  if (user.lockedUntil && user.lockedUntil > now) return { ok: false, message: LOCKED };

  const valid = await verify(user.passwordHash, password).catch(() => false);
  if (!valid) {
    const inWindow = user.failedWindowStart && now.getTime() - user.failedWindowStart.getTime() < LOCK_WINDOW_MINUTES * 60_000;
    const failedLogins = inWindow ? user.failedLogins + 1 : 1;
    const lock = failedLogins >= LOCK_THRESHOLD;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins,
        failedWindowStart: inWindow ? user.failedWindowStart : now,
        lockedUntil: lock ? new Date(now.getTime() + LOCK_WINDOW_MINUTES * 60_000) : user.lockedUntil,
      },
    });
    if (lock) {
      await enqueue({ channel: "email", to: user.email, template: "auth.locked", payload: { name: user.name, at: now.toISOString() } });
      await audit(null, "auth.locked", "User", user.id, { ip: ctx.ip });
      return { ok: false, message: LOCKED };
    }
    return { ok: false, message: GENERIC };
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!totp) return { ok: false, twoFactorRequired: true, message: "Enter the 6-digit code from your authenticator app." };
    if (!authenticator.check(totp.replace(/\s/g, ""), user.twoFactorSecret)) {
      return { ok: false, twoFactorRequired: true, message: "That code didn't match. Check your authenticator app and try again." };
    }
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await db.$transaction([
    db.session.create({
      data: { tokenHash: sha(token), userId: user.id, createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + ABSOLUTE_HOURS * 3600_000), ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) },
    }),
    db.user.update({ where: { id: user.id }, data: { failedLogins: 0, failedWindowStart: null, lockedUntil: null, lastLoginAt: now } }),
  ]);
  return { ok: true, token, user };
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "twoFactorEnabled" | "partnerId"> & { sessionExpiresAt: Date };

export async function getSessionUser(token: string | undefined, ctx: RequestCtx = {}): Promise<SessionUser | null> {
  if (!token) return null;
  const now = ctx.now ?? new Date();
  const session = await db.session.findUnique({ where: { tokenHash: sha(token) }, include: { user: true } });
  if (!session || session.revokedAt) return null;
  if (session.expiresAt <= now) return null;
  if (now.getTime() - session.lastSeenAt.getTime() > IDLE_MINUTES * 60_000) return null;
  if (session.user.status !== "ACTIVE") return null;
  await db.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  const { id, email, name, role, twoFactorEnabled, partnerId } = session.user;
  return { id, email, name, role, twoFactorEnabled, partnerId, sessionExpiresAt: new Date(Math.min(session.expiresAt.getTime(), now.getTime() + IDLE_MINUTES * 60_000)) };
}

export async function signOut(token: string) {
  await db.session.updateMany({ where: { tokenHash: sha(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

async function revokeAll(userId: string) {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function setPassword(userId: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const policy = checkPasswordPolicy(password);
  if (!policy.ok) return { ok: false, message: policy.reason };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  return { ok: true };
}

export async function createUserWithPassword(input: { email: string; name: string; role: Role; password: string }) {
  const policy = checkPasswordPolicy(input.password);
  if (!policy.ok) throw new Error(policy.reason);
  return db.user.create({
    data: { email: input.email.trim().toLowerCase(), name: input.name, role: input.role, status: "ACTIVE", passwordHash: await hashPassword(input.password) },
  });
}

function guardRoleChange(actor: Actor, role: Role) {
  assertCan(actor.role, "users.manage");
  if (role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw new ForbiddenError("users.manage");
}

const PARTNER_SWITCH = "Partner developer accounts are separate from staff accounts — invite a new user instead.";

export async function inviteUser(actor: Actor, input: { email: string; name: string; role: Role; partnerId?: string | null }, now: Date = new Date()) {
  guardRoleChange(actor, input.role);
  const isPartner = input.role === "PARTNER";
  if (isPartner && !(input.partnerId && (await db.partner.findUnique({ where: { id: input.partnerId } })))) throw new Error("Choose which partner developer this person works for.");
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && (existing.role === "PARTNER") !== isPartner) throw new Error(PARTNER_SWITCH);
  const token = crypto.randomBytes(24).toString("base64url");
  const partnerId = isPartner ? input.partnerId! : null;
  const user = await db.user.upsert({
    where: { email },
    create: { email, name: input.name, role: input.role, partnerId, status: "INVITED", inviteToken: sha(token), inviteExpires: new Date(now.getTime() + INVITE_HOURS * 3600_000) },
    update: { name: input.name, role: input.role, partnerId, status: "INVITED", inviteToken: sha(token), inviteExpires: new Date(now.getTime() + INVITE_HOURS * 3600_000) },
  });
  await enqueue({ channel: "email", to: email, template: "auth.invite", payload: { name: input.name, token, invitedBy: actor.name ?? actor.email ?? "" } });
  await audit(actor, "user.invite", "User", user.id, { after: { email, role: input.role, partnerId } });
  return { user, token };
}

export async function acceptInvite(token: string, password: string, now: Date = new Date()): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await db.user.findUnique({ where: { inviteToken: sha(token) } });
  if (!user || user.status !== "INVITED" || !user.inviteExpires || user.inviteExpires < now) {
    return { ok: false, message: "This invitation has expired or was already used. Ask an administrator to send a new one." };
  }
  const policy = checkPasswordPolicy(password);
  if (!policy.ok) return { ok: false, message: policy.reason };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), status: "ACTIVE", inviteToken: null, inviteExpires: null } });
  return { ok: true };
}

export async function changeUserRole(actor: Actor, userId: string, role: Role) {
  guardRoleChange(actor, role);
  const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (before.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw new ForbiddenError("users.manage");
  if ((before.role === "PARTNER") !== (role === "PARTNER")) throw new Error(PARTNER_SWITCH);
  await db.user.update({ where: { id: userId }, data: { role } });
  await revokeAll(userId);
  await audit(actor, "user.role", "User", userId, { before: { role: before.role }, after: { role } });
}

export async function setUserStatus(actor: Actor, userId: string, status: "ACTIVE" | "SUSPENDED" | "REMOVED") {
  assertCan(actor.role, "users.manage");
  if (userId === actor.id) throw new Error("You can't change your own account status.");
  const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (before.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw new ForbiddenError("users.manage");
  await db.user.update({ where: { id: userId }, data: { status } });
  if (status !== "ACTIVE") await revokeAll(userId);
  await audit(actor, `user.${status.toLowerCase()}`, "User", userId, { before: { status: before.status }, after: { status } });
}

export async function removeUser(actor: Actor, userId: string) {
  await setUserStatus(actor, userId, "REMOVED");
}

export async function releaseLock(userId: string) {
  await db.user.update({ where: { id: userId }, data: { lockedUntil: null, failedLogins: 0, failedWindowStart: null } });
}

// ---- TOTP (FR-ADM-003)
export function newTotpSecret() {
  return authenticator.generateSecret();
}

export function totpUri(email: string, secret: string) {
  return authenticator.keyuri(email, "Zenorra Admin", secret);
}

export async function enableTotp(userId: string, secret: string, code: string): Promise<boolean> {
  if (!authenticator.check(code.replace(/\s/g, ""), secret)) return false;
  await db.user.update({ where: { id: userId }, data: { twoFactorSecret: secret, twoFactorEnabled: true } });
  return true;
}

export function requiresTwoFactor(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMINISTRATOR";
}
