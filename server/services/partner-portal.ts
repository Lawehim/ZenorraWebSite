// Partner-developer read-only access (SRS §3 Phase 3, A-6). Data is partitioned by the
// partner linked to each estate, and nothing that identifies a buyer or enquirer leaves here
// (NDPA data minimisation): only references, dates, statuses and money figures.
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { audit } from "./audit";
import type { Actor } from "./actor";

/** Link (or unlink) an estate to the partner developer who supplies it. Administrators only. */
export async function setPropertyPartner(actor: Actor, propertyId: string, partnerId: string | null) {
  assertCan(actor.role, "properties.publish");
  const before = await db.property.findUniqueOrThrow({ where: { id: propertyId }, select: { partnerId: true } });
  if (partnerId) await db.partner.findUniqueOrThrow({ where: { id: partnerId } });
  await db.property.update({ where: { id: propertyId }, data: { partnerId } });
  await audit(actor, "property.partner", "Property", propertyId, { before, after: { partnerId } });
}

export interface EstateFigures {
  id: string;
  name: string;
  reference: string;
  status: string;
  availability: string;
  priceNaira: bigint;
  enquiries: number;
  enquiries30d: number;
  inspectionsBooked: number;
  inspectionsAttended: number;
  plotsSold: number;
  contractKobo: bigint;
  collectedKobo: bigint;
  outstandingKobo: bigint;
}

export async function partnerDashboard(partnerId: string, now: Date = new Date()) {
  const partner = await db.partner.findUniqueOrThrow({ where: { id: partnerId }, select: { id: true, name: true } });
  const since = new Date(now.getTime() - 30 * 86400_000);
  const properties = await db.property.findMany({
    where: { partnerId, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      reference: true,
      status: true,
      availability: true,
      priceNaira: true,
      leads: { select: { createdAt: true } },
      bookings: { select: { status: true } },
      purchases: { select: { priceKobo: true, instalments: { select: { paidKobo: true } } } },
    },
  });

  const estates: EstateFigures[] = properties.map((p) => {
    const contractKobo = p.purchases.reduce((s, x) => s + x.priceKobo, 0n);
    const collectedKobo = p.purchases.reduce((s, x) => s + x.instalments.reduce((t, i) => t + i.paidKobo, 0n), 0n);
    return {
      id: p.id,
      name: p.name,
      reference: p.reference,
      status: p.status,
      availability: p.availability,
      priceNaira: p.priceNaira,
      enquiries: p.leads.length,
      enquiries30d: p.leads.filter((l) => l.createdAt >= since).length,
      inspectionsBooked: p.bookings.filter((b) => b.status !== "CANCELLED").length,
      inspectionsAttended: p.bookings.filter((b) => b.status === "ATTENDED").length,
      plotsSold: p.purchases.length,
      contractKobo,
      collectedKobo,
      outstandingKobo: contractKobo - collectedKobo,
    };
  });

  const ids = estates.map((e) => e.id);
  const names = new Map(estates.map((e) => [e.id, e.name]));
  const [leads, purchases] = await Promise.all([
    db.lead.findMany({ where: { propertyId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 25, select: { reference: true, createdAt: true, source: true, status: true, propertyId: true } }),
    db.purchase.findMany({ where: { propertyId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 50, select: { reference: true, createdAt: true, plotNumber: true, priceKobo: true, propertyId: true, instalments: { select: { paidKobo: true } } } }),
  ]);

  const sum = (k: "enquiries" | "enquiries30d" | "inspectionsAttended" | "plotsSold") => estates.reduce((s, e) => s + e[k], 0);
  const sumK = (k: "contractKobo" | "collectedKobo" | "outstandingKobo") => estates.reduce((s, e) => s + e[k], 0n);
  return {
    partner,
    estates,
    totals: { enquiries: sum("enquiries"), enquiries30d: sum("enquiries30d"), inspectionsAttended: sum("inspectionsAttended"), plotsSold: sum("plotsSold"), contractKobo: sumK("contractKobo"), collectedKobo: sumK("collectedKobo"), outstandingKobo: sumK("outstandingKobo") },
    recentEnquiries: leads.map((l) => ({ reference: l.reference, createdAt: l.createdAt, source: l.source, status: l.status, estate: names.get(l.propertyId ?? "") ?? "" })),
    sales: purchases.map((p) => {
      const paid = p.instalments.reduce((s, i) => s + i.paidKobo, 0n);
      return { reference: p.reference, date: p.createdAt, estate: names.get(p.propertyId) ?? "", plot: p.plotNumber ?? "", priceKobo: p.priceKobo, paidPercent: p.priceKobo > 0n ? Number((paid * 1000n) / p.priceKobo) / 10 : 0 };
    }),
  };
}

export type PartnerDashboard = Awaited<ReturnType<typeof partnerDashboard>>;

/** Server-side guard for partner pages: the caller's own partner, never one from the URL. */
export function assertPartnerActor(actor: Actor & { partnerId?: string | null }): string {
  assertCan(actor.role, "partner.portal");
  if (!actor.partnerId) throw new Error("This account isn't linked to a partner developer.");
  return actor.partnerId;
}
