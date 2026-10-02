import type { LeadStatus } from "@prisma/client";
import { currentUser, toActor } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { exportLeadsCsv, LEAD_STATUSES } from "@/server/services/leads";
import { audit } from "@/server/services/audit";

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return new Response("Sign in required", { status: 401 });
  if (!can(u.role, "leads.export")) {
    await audit(toActor(u), "access.denied", "Capability", "leads.export");
    return new Response("Your role can't export leads.", { status: 403 });
  }
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const csv = await exportLeadsCsv(toActor(u), {
    status: LEAD_STATUSES.some((s) => s.value === status) ? (status as LeadStatus) : undefined,
    source: sp.get("source") || undefined,
    q: sp.get("q") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    propertyId: sp.get("propertyId") || undefined,
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zenorra-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
