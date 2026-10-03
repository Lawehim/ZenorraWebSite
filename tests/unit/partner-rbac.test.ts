import { can, CAPABILITIES, ROLE_LABELS, homePathFor } from "@/lib/rbac";

describe("partner-developer role (Phase 3 — read-only access)", () => {
  it("can open the partner portal and nothing in the staff admin", () => {
    expect(can("PARTNER", "partner.portal")).toBe(true);
    const staff = CAPABILITIES.filter((c) => c !== "partner.portal");
    expect(staff.filter((c) => can("PARTNER", c))).toEqual([]);
  });
  it("is not granted to staff roles (they already see everything in the admin)", () => {
    for (const r of ["SUPER_ADMIN", "ADMINISTRATOR", "EDITOR", "ADVISOR", "VIEWER"] as const) expect(can(r, "partner.portal")).toBe(false);
  });
  it("has a label and lands on the partner portal after sign-in", () => {
    expect(ROLE_LABELS.PARTNER).toBe("Partner developer");
    expect(homePathFor("PARTNER")).toBe("/partner");
    expect(homePathFor("EDITOR")).toBe("/admin");
  });
});
