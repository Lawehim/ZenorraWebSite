import { db } from "@/lib/db";
import { inviteUser, changeUserRole, acceptInvite, signIn, getSessionUser } from "@/server/services/auth";
import { setPropertyPartner, partnerDashboard } from "@/server/services/partner-portal";
import { createLead } from "@/server/services/leads";
import { createPurchase } from "@/server/services/purchases";
import { recordOfflinePayment } from "@/server/services/payments";
import { deletePartner } from "@/server/services/people";
import { ForbiddenError } from "@/lib/rbac";
import { resetDb, makeUser } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const PW = "gold-leaf-over-epe-2026";

async function world() {
  const admin = await makeUser("ADMINISTRATOR");
  const actor = { id: admin.id, role: "ADMINISTRATOR" as const, email: admin.email, name: admin.name };
  const acme = await db.partner.create({ data: { name: "Acme Developers", kind: "DEVELOPER" } });
  const other = await db.partner.create({ data: { name: "Other Homes", kind: "DEVELOPER" } });
  const mk = (reference: string, slug: string, name: string) =>
    db.property.create({ data: { reference, slug, name, corridor: "Ibeju-Lekki", locationText: "Eleko", titleType: "REGISTERED_SURVEY", priceNaira: 4_800_000n, status: "PUBLISHED" } });
  const mine = await mk("ZNR-001", "heritage", "Heritage Gardens");
  const theirs = await mk("ZNR-002", "palm", "Palm Court");
  await setPropertyPartner(actor, mine.id, acme.id);
  await setPropertyPartner(actor, theirs.id, other.id);

  const lead = async (name: string, phone: string, propertySlug: string) => {
    const r = await createLead({ source: "property", name, phone, email: `${phone.slice(-4)}@example.com`, propertySlug, website: "" }, { ip: `10.1.${phone.slice(-2)}.1`, userAgent: "jest", now: new Date() });
    if (!r.ok) throw new Error("lead");
    return db.lead.findUniqueOrThrow({ where: { reference: r.reference } });
  };
  const l1 = await lead("Adaeze Okonkwo", "+2348030000011", "heritage");
  await lead("Tunde Bakare", "+2348030000012", "heritage");
  await lead("Someone Else", "+2348030000013", "palm");
  await db.booking.create({ data: { reference: "INS-1", leadId: l1.id, propertyId: mine.id, date: new Date("2026-10-10"), departurePoint: "Surulere", seats: 2, status: "ATTENDED" } });

  const p = await createPurchase(actor, { leadId: l1.id, propertyId: mine.id, plotNumber: "14", priceNaira: 4_800_000, depositNaira: 1_440_000, planMonths: 24, startDate: "2026-10-01" });
  const deposit = await db.instalment.findFirstOrThrow({ where: { purchaseId: p.purchase.id, sequence: 0 } });
  await recordOfflinePayment(actor, deposit.id, deposit.amountKobo, "GTB-TRF-1");
  return { actor, acme, other, mine, theirs };
}

describe("partner-developer accounts", () => {
  it("must be linked to a partner when invited", async () => {
    const { actor, acme } = await world();
    await expect(inviteUser(actor, { email: "dev@acme.test", name: "Acme Sales", role: "PARTNER" })).rejects.toThrow(/partner/i);
    const { user, token } = await inviteUser(actor, { email: "dev@acme.test", name: "Acme Sales", role: "PARTNER", partnerId: acme.id });
    expect(user.partnerId).toBe(acme.id);
    await acceptInvite(token, PW);
    const s = await signIn("dev@acme.test", PW, { ip: "10.0.0.9" });
    expect(s.ok).toBe(true);
    if (s.ok) expect(await getSessionUser(s.token)).toMatchObject({ role: "PARTNER", partnerId: acme.id });
  });

  it("can't be created by turning a staff account into a partner, or the reverse", async () => {
    const { actor, acme } = await world();
    const editor = await makeUser("EDITOR", "ed@zenorra.test");
    await expect(changeUserRole(actor, editor.id, "PARTNER")).rejects.toThrow(/invite/i);
    const { user } = await inviteUser(actor, { email: "dev@acme.test", name: "Acme Sales", role: "PARTNER", partnerId: acme.id });
    await expect(changeUserRole(actor, user.id, "ADMINISTRATOR")).rejects.toThrow(/invite/i);
  });

  it("only administrators link estates to a developer", async () => {
    const { mine, acme } = await world();
    const ed = await makeUser("EDITOR", "ed2@zenorra.test");
    await expect(setPropertyPartner({ id: ed.id, role: "EDITOR" }, mine.id, acme.id)).rejects.toThrow(ForbiddenError);
  });
});

describe("removing a partner", () => {
  it("is refused while partner users exist, and otherwise unlinks its estates", async () => {
    const { actor, acme, mine } = await world();
    const { user } = await inviteUser(actor, { email: "dev@acme.test", name: "Acme Sales", role: "PARTNER", partnerId: acme.id });
    await expect(deletePartner(actor, acme.id)).rejects.toThrow(/portal/i);
    await db.user.delete({ where: { id: user.id } });
    await deletePartner(actor, acme.id);
    expect((await db.property.findUniqueOrThrow({ where: { id: mine.id } })).partnerId).toBeNull();
  });
});

describe("partner dashboard (read-only, partitioned)", () => {
  it("shows only the partner's own estates with enquiry, inspection and sales figures", async () => {
    const { acme } = await world();
    const d = await partnerDashboard(acme.id);
    expect(d.partner.name).toBe("Acme Developers");
    expect(d.estates.map((e) => e.name)).toEqual(["Heritage Gardens"]);
    const e = d.estates[0];
    expect(e).toMatchObject({ enquiries: 2, inspectionsAttended: 1, plotsSold: 1, contractKobo: 480_000_000n, collectedKobo: 144_000_000n });
    expect(d.totals).toMatchObject({ enquiries: 2, plotsSold: 1, collectedKobo: 144_000_000n });
  });

  it("never exposes buyer or enquirer identities", async () => {
    const { acme } = await world();
    const d = await partnerDashboard(acme.id);
    const text = JSON.stringify(d, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    for (const pii of ["Adaeze", "Okonkwo", "Tunde", "+234803", "@example.com"]) expect(text).not.toContain(pii);
    expect(d.recentEnquiries).toHaveLength(2);
    expect(Object.keys(d.recentEnquiries[0]).sort()).toEqual(["createdAt", "estate", "reference", "source", "status"]);
    expect(Object.keys(d.sales[0]).sort()).toEqual(["date", "estate", "paidPercent", "plot", "priceKobo", "reference"]);
  });

  it("returns nothing for another partner's estates", async () => {
    const { other } = await world();
    const d = await partnerDashboard(other.id);
    expect(d.estates.map((e) => e.name)).toEqual(["Palm Court"]);
    expect(d.totals.plotsSold).toBe(0);
    expect(d.recentEnquiries.every((r) => r.estate === "Palm Court")).toBe(true);
  });
});
