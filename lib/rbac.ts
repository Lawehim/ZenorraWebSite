// SRS §7.8 RBAC matrix, expressed once. Every server action asserts against this.
import type { Role } from "@prisma/client";

const ALL: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "EDITOR", "ADVISOR", "VIEWER"];
const ADMINS: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR"];
const CONTENT: Role[] = [...ADMINS, "EDITOR"];

const PERMISSIONS = {
  "dashboard.view": ALL,
  "posts.edit": CONTENT,
  "posts.publish": CONTENT,
  "posts.delete": ADMINS,
  "media.upload": CONTENT,
  "media.delete": ADMINS,
  "properties.edit": CONTENT,
  "properties.publish": ADMINS,
  "properties.price": ADMINS,
  "leads.view": [...ADMINS, "ADVISOR", "VIEWER"],
  "leads.edit": [...ADMINS, "ADVISOR"],
  "leads.assign": ADMINS,
  "leads.export": ADMINS,
  "inspections.manage": [...ADMINS, "ADVISOR"],
  "testimonials.manage": CONTENT,
  "content.edit": CONTENT,
  "settings.edit": ADMINS,
  "users.manage": ADMINS,
  "audit.view": ADMINS,
  "dsr.erase": ["SUPER_ADMIN"],
  // Phase 3 (SRS §7.8 P3 rows) and supporting capabilities
  "payments.offline": ADMINS,
  "referrals.approve": ADMINS,
  "buyers.manage": ADMINS,
  "buyers.view": [...ADMINS, "ADVISOR"],
  "reports.view": [...ADMINS, "VIEWER"],
  // Partner developers: read-only figures for their own estates, nothing else (SRS §3 Phase 3, A-6)
  "partner.portal": ["PARTNER"],
} satisfies Record<string, Role[]>;

export type Capability = keyof typeof PERMISSIONS;
export const CAPABILITIES = Object.keys(PERMISSIONS) as Capability[];

export function can(role: Role, capability: Capability): boolean {
  return (PERMISSIONS[capability] as Role[]).includes(role);
}

export class ForbiddenError extends Error {
  constructor(public capability: Capability) {
    super(`Forbidden: missing capability ${capability}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, capability: Capability): void {
  if (!can(role, capability)) throw new ForbiddenError(capability);
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMINISTRATOR: "Administrator",
  EDITOR: "Editor",
  ADVISOR: "Advisor",
  VIEWER: "Viewer",
  PARTNER: "Partner developer",
};

/** Where a signed-in user belongs: partner developers never see the staff admin. */
export function homePathFor(role: Role): "/partner" | "/admin" {
  return role === "PARTNER" ? "/partner" : "/admin";
}
