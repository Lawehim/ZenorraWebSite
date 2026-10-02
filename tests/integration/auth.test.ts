import { db } from "@/lib/db";
import {
  signIn,
  getSessionUser,
  signOut,
  createUserWithPassword,
  setPassword,
  inviteUser,
  acceptInvite,
  removeUser,
  releaseLock,
  IDLE_MINUTES,
  ABSOLUTE_HOURS,
} from "@/server/services/auth";
import { resetDb } from "./helpers";

const ctx = { ip: "10.0.0.1", userAgent: "jest", now: new Date("2026-09-02T09:00:00Z") };
const at = (mins: number) => ({ ...ctx, now: new Date(ctx.now.getTime() + mins * 60_000) });
const PASSWORD = "gold-leaf-over-epe-2026";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

async function seedAdmin(role: "ADMINISTRATOR" | "EDITOR" = "EDITOR") {
  return createUserWithPassword({ email: "fatima@zenorra.test", name: "Fatima", role, password: PASSWORD });
}

describe("sign-in (FR-ADM-001/002, TC-ADM-001/002)", () => {
  it("issues a session for valid credentials and records last login", async () => {
    await seedAdmin();
    const r = await signIn("Fatima@Zenorra.test", PASSWORD, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const user = await getSessionUser(r.token, ctx);
    expect(user?.email).toBe("fatima@zenorra.test");
    expect((await db.user.findUniqueOrThrow({ where: { email: "fatima@zenorra.test" } })).lastLoginAt).not.toBeNull();
  });

  it("stores the password as an Argon2id hash, never plain text (NFR-SEC-014)", async () => {
    await seedAdmin();
    const u = await db.user.findUniqueOrThrow({ where: { email: "fatima@zenorra.test" } });
    expect(u.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("gives the same generic message for a wrong password and an unknown email (no enumeration)", async () => {
    await seedAdmin();
    const a = await signIn("fatima@zenorra.test", "wrong-password-123", ctx);
    const b = await signIn("nobody@zenorra.test", "wrong-password-123", ctx);
    expect(a).toEqual({ ok: false, message: "Email or password is incorrect." });
    expect(b).toEqual(a);
  });

  it("locks the account after 10 failures in 15 minutes and Super Admin can release (FR-ADM-005, TC-ADM-003)", async () => {
    await seedAdmin();
    for (let i = 0; i < 10; i++) await signIn("fatima@zenorra.test", "wrong-password-123", at(i));
    const locked = await signIn("fatima@zenorra.test", PASSWORD, at(11));
    expect(locked).toEqual({ ok: false, message: "This account is locked after repeated failed sign-ins. Try again in 15 minutes or ask a Super Admin to unlock it." });
    expect(await db.notification.count({ where: { template: "auth.locked" } })).toBe(1);
    const u = await db.user.findUniqueOrThrow({ where: { email: "fatima@zenorra.test" } });
    await releaseLock(u.id);
    expect((await signIn("fatima@zenorra.test", PASSWORD, at(12))).ok).toBe(true);
  });
});

describe("sessions (FR-ADM-004, TC-ADM-005, TC-ADM-029)", () => {
  it(`expires after ${IDLE_MINUTES} minutes of inactivity`, async () => {
    await seedAdmin();
    const r = await signIn("fatima@zenorra.test", PASSWORD, ctx);
    if (!r.ok) throw new Error();
    expect(await getSessionUser(r.token, at(IDLE_MINUTES - 1))).not.toBeNull();
    expect(await getSessionUser(r.token, at(IDLE_MINUTES * 2 + 1))).toBeNull();
  });

  it(`expires after ${ABSOLUTE_HOURS} hours even if active`, async () => {
    await seedAdmin();
    const r = await signIn("fatima@zenorra.test", PASSWORD, ctx);
    if (!r.ok) throw new Error();
    for (let m = 50; m < ABSOLUTE_HOURS * 60; m += 50) await getSessionUser(r.token, at(m));
    expect(await getSessionUser(r.token, at(ABSOLUTE_HOURS * 60 + 1))).toBeNull();
  });

  it("signs out by revoking the session", async () => {
    await seedAdmin();
    const r = await signIn("fatima@zenorra.test", PASSWORD, ctx);
    if (!r.ok) throw new Error();
    await signOut(r.token);
    expect(await getSessionUser(r.token, ctx)).toBeNull();
  });

  it("removing a user ends their active sessions immediately", async () => {
    await seedAdmin();
    const admin = await createUserWithPassword({ email: "ngozi@zenorra.test", name: "Ngozi", role: "ADMINISTRATOR", password: PASSWORD });
    const r = await signIn("fatima@zenorra.test", PASSWORD, ctx);
    if (!r.ok) throw new Error();
    const target = await db.user.findUniqueOrThrow({ where: { email: "fatima@zenorra.test" } });
    await removeUser({ id: admin.id, role: "ADMINISTRATOR" }, target.id);
    expect(await getSessionUser(r.token, ctx)).toBeNull();
  });

  it("rejects a forged token", async () => {
    expect(await getSessionUser("not-a-real-token", ctx)).toBeNull();
  });
});

describe("invitations (FR-ADM-050)", () => {
  it("invites a user who sets a password within 72 hours", async () => {
    const admin = await createUserWithPassword({ email: "ngozi@zenorra.test", name: "Ngozi", role: "ADMINISTRATOR", password: PASSWORD });
    const { token } = await inviteUser({ id: admin.id, role: "ADMINISTRATOR" }, { email: "emeka@zenorra.test", name: "Emeka", role: "ADVISOR" }, ctx.now);
    expect(await acceptInvite(token, "short", ctx.now)).toMatchObject({ ok: false });
    expect(await acceptInvite(token, PASSWORD, ctx.now)).toEqual({ ok: true });
    expect((await signIn("emeka@zenorra.test", PASSWORD, ctx)).ok).toBe(true);
  });

  it("refuses an expired invitation", async () => {
    const admin = await createUserWithPassword({ email: "ngozi@zenorra.test", name: "Ngozi", role: "ADMINISTRATOR", password: PASSWORD });
    const { token } = await inviteUser({ id: admin.id, role: "ADMINISTRATOR" }, { email: "emeka@zenorra.test", name: "Emeka", role: "ADVISOR" }, ctx.now);
    expect(await acceptInvite(token, PASSWORD, at(73 * 60).now)).toMatchObject({ ok: false });
  });

  it("enforces the password policy when changing a password (TC-SEC-009)", async () => {
    const u = await seedAdmin();
    expect(await setPassword(u.id, "password1234")).toMatchObject({ ok: false });
  });
});
