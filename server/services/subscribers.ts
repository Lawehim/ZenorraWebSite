// Newsletter double opt-in (FR-LEAD-010, FR-NOTIF-007/008).
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { subscribeInputSchema } from "@/lib/validation/public";
import { enqueue } from "./notifications";
import { hitRateLimit, LIMITS } from "./rate-limit";
import type { RequestCtx } from "./actor";

const TOKEN_DAYS = 7;

function secret(): string {
  return process.env.SESSION_SECRET ?? "dev-only-secret";
}

/** Stateless signed token for one-click unsubscribe links. */
export function unsubscribeToken(email: string): string {
  const body = Buffer.from(email).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(`unsub:${email}`).digest("base64url").slice(0, 32);
  return `${body}.${sig}`;
}

function verifyUnsubscribe(token: string): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const email = Buffer.from(body, "base64url").toString();
  const expected = unsubscribeToken(email).split(".")[1];
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? email : null;
}

export type SubscribeResult = { ok: true } | { ok: false; status: number; message: string };

export async function subscribe(input: unknown, ctx: RequestCtx = {}): Promise<SubscribeResult> {
  const now = ctx.now ?? new Date();
  const parsed = subscribeInputSchema.safeParse(input);
  if (!parsed.success) {
    const bot = parsed.error.issues.some((i) => i.path[0] === "website");
    return { ok: false, status: bot ? 400 : 422, message: bot ? "We couldn't accept that submission." : "Enter a valid email address." };
  }
  if (!(await hitRateLimit(`sub:${ctx.ip ?? "unknown"}`, LIMITS.subscribe.limit, LIMITS.subscribe.window, now))) {
    return { ok: false, status: 429, message: "Too many sign-ups from this connection. Try again later." };
  }
  const email = parsed.data.email;
  const existing = await db.subscriber.findUnique({ where: { email } });
  if (existing?.status === "ACTIVE") return { ok: true }; // don't reveal membership
  const token = crypto.randomBytes(24).toString("base64url");
  const tokenExpires = new Date(now.getTime() + TOKEN_DAYS * 86400_000);
  await db.subscriber.upsert({
    where: { email },
    create: { email, confirmToken: token, tokenExpires, createdAt: now },
    update: { status: "PENDING", confirmToken: token, tokenExpires, unsubscribedAt: null },
  });
  await enqueue({ channel: "email", to: email, template: "newsletter.confirm", payload: { token } });
  return { ok: true };
}

export async function confirmSubscription(token: string, now: Date = new Date()): Promise<boolean> {
  if (!token) return false;
  const s = await db.subscriber.findUnique({ where: { confirmToken: token } });
  if (!s || s.status !== "PENDING" || !s.tokenExpires || s.tokenExpires < now) return false;
  await db.subscriber.update({ where: { id: s.id }, data: { status: "ACTIVE", confirmedAt: now, confirmToken: null, tokenExpires: null } });
  return true;
}

export async function unsubscribe(token: string): Promise<boolean> {
  const email = verifyUnsubscribe(token);
  if (!email) return false;
  const r = await db.subscriber.updateMany({ where: { email }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  await db.lead.updateMany({ where: { email }, data: { marketingConsent: false } });
  return r.count > 0;
}

/** Purge unconfirmed subscribers older than 30 days (NFR-LEG-008). */
export async function purgeUnconfirmed(now: Date = new Date()) {
  return db.subscriber.deleteMany({ where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 30 * 86400_000) } } });
}
