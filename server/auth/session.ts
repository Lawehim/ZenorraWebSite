import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/server/services/auth";
import { can, ForbiddenError, type Capability } from "@/lib/rbac";
import { audit } from "@/server/services/audit";
import type { Actor } from "@/server/services/actor";

export const SESSION_COOKIE = "zn_admin";

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

export function toActor(u: SessionUser): Actor {
  return { id: u.id, role: u.role, email: u.email, name: u.name };
}

/** For pages: redirect to sign-in (preserving destination) or show 403. */
export async function requirePageUser(capability: Capability = "dashboard.view", nextPath?: string): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect(`/admin/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  if (u.role === "PARTNER") redirect("/partner"); // partner developers never see the staff admin
  if (!can(u.role, capability)) redirect("/admin?denied=1");
  return u;
}

/** For partner-developer pages: their own partner id comes from the session, never the URL. */
export async function requirePartnerUser(): Promise<SessionUser & { partnerId: string }> {
  const u = await currentUser();
  if (!u) redirect("/admin/login?next=%2Fpartner");
  if (u.role !== "PARTNER" || !can(u.role, "partner.portal") || !u.partnerId) redirect("/admin");
  return { ...u, partnerId: u.partnerId };
}

/** For server actions / route handlers: throw, and audit the attempt (NFR-SEC-008, TC-SEC-004). */
export async function requireActor(capability: Capability): Promise<Actor> {
  const u = await currentUser();
  if (!u) throw new ForbiddenError(capability);
  if (!can(u.role, capability)) {
    const h = await headers();
    await audit(toActor(u), "access.denied", "Capability", capability, { ip: h.get("x-forwarded-for") ?? undefined });
    throw new ForbiddenError(capability);
  }
  return toActor(u);
}
