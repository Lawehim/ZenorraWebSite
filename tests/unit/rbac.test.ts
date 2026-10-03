import { can, CAPABILITIES, type Capability, ForbiddenError, assertCan } from "@/lib/rbac";
import type { Role } from "@prisma/client";

// SRS §7.8 RBAC matrix, transcribed row by row. TC-SEC-004 relies on this being exhaustive.
const MATRIX: Record<Capability, Role[]> = {
  "dashboard.view": ["SUPER_ADMIN", "ADMINISTRATOR", "EDITOR", "ADVISOR", "VIEWER"],
  "posts.edit": ["SUPER_ADMIN", "ADMINISTRATOR", "EDITOR"],
  "posts.publish": ["SUPER_ADMIN", "ADMINISTRATOR", "EDITOR"],
  "posts.delete": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "media.upload": ["SUPER_ADMIN", "ADMINISTRATOR", "EDITOR"],
  "media.delete": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "properties.edit": ["SUPER_ADMIN", "ADMINISTRATOR", "EDITOR"],
  "properties.publish": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "properties.price": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "leads.view": ["SUPER_ADMIN", "ADMINISTRATOR", "ADVISOR", "VIEWER"],
  "leads.edit": ["SUPER_ADMIN", "ADMINISTRATOR", "ADVISOR"],
  "leads.assign": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "leads.export": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "inspections.manage": ["SUPER_ADMIN", "ADMINISTRATOR", "ADVISOR"],
  "testimonials.manage": ["SUPER_ADMIN", "ADMINISTRATOR", "EDITOR"],
  "content.edit": ["SUPER_ADMIN", "ADMINISTRATOR", "EDITOR"],
  "settings.edit": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "users.manage": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "audit.view": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "dsr.erase": ["SUPER_ADMIN"],
  "payments.offline": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "referrals.approve": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "buyers.manage": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "buyers.view": ["SUPER_ADMIN", "ADMINISTRATOR", "ADVISOR"],
  "reports.view": ["SUPER_ADMIN", "ADMINISTRATOR", "VIEWER"],
  "partner.portal": ["PARTNER"],
};
const ROLES: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "EDITOR", "ADVISOR", "VIEWER", "PARTNER"];

describe("RBAC permission map (FR-ADM-051)", () => {
  it("covers every capability in the matrix and no others", () => {
    expect([...CAPABILITIES].sort()).toEqual(Object.keys(MATRIX).sort());
  });

  for (const cap of Object.keys(MATRIX) as Capability[]) {
    for (const role of ROLES) {
      const expected = MATRIX[cap].includes(role);
      it(`${role} ${expected ? "can" : "cannot"} ${cap}`, () => {
        expect(can(role, cap)).toBe(expected);
      });
    }
  }

  it("assertCan throws ForbiddenError when the role lacks the capability", () => {
    expect(() => assertCan("ADVISOR", "settings.edit")).toThrow(ForbiddenError);
    expect(() => assertCan("ADMINISTRATOR", "settings.edit")).not.toThrow();
  });
});
