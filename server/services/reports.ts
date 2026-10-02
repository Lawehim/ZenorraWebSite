// Lead reporting by source, property and advisor over a period (FR-ANL-006, FR-ADM-008).
import { db } from "@/lib/db";
import { lagosDateString } from "@/lib/bookings/dates";

export async function leadsReport({ from, to }: { from: Date; to: Date }) {
  const where = { createdAt: { gte: from, lte: to } };
  const [total, bySource, byPropertyRaw, byAdvisorRaw, won] = await Promise.all([
    db.lead.count({ where }),
    db.lead.groupBy({ by: ["source"], _count: { _all: true }, where }),
    db.lead.groupBy({ by: ["propertyId"], _count: { _all: true }, where }),
    db.lead.groupBy({ by: ["assignedToId"], _count: { _all: true }, where }),
    db.lead.count({ where: { ...where, status: "CLOSED_WON" } }),
  ]);
  const [props, users] = await Promise.all([
    db.property.findMany({ where: { id: { in: byPropertyRaw.map((r) => r.propertyId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
    db.user.findMany({ where: { id: { in: byAdvisorRaw.map((r) => r.assignedToId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
  ]);
  const sort = <T extends { count: number }>(a: T[]) => a.sort((x, y) => y.count - x.count);
  return {
    total,
    won,
    bySource: sort(bySource.map((r) => ({ key: r.source, count: r._count._all }))),
    byProperty: sort(byPropertyRaw.map((r) => ({ key: props.find((p) => p.id === r.propertyId)?.name ?? "No specific property", count: r._count._all }))),
    byAdvisor: sort(byAdvisorRaw.map((r) => ({ key: users.find((u) => u.id === r.assignedToId)?.name ?? "Unassigned", count: r._count._all }))),
  };
}

/** Daily lead counts for the last N days (Lagos dates), for the dashboard trend (FR-ADM-008). */
export async function dailyLeadTrend(days = 30, now: Date = new Date()) {
  const since = new Date(now.getTime() - days * 86400_000);
  const rows = await db.lead.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
  const counts = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) counts.set(lagosDateString(new Date(now.getTime() - i * 86400_000)), 0);
  for (const r of rows) {
    const k = lagosDateString(r.createdAt);
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }));
}
