import { db } from "@/lib/db";
import { currentUser, toActor } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

export async function GET() {
  const u = await currentUser();
  if (!u || !can(u.role, "leads.export")) return new Response("Forbidden", { status: 403 });
  const rows = await db.subscriber.findMany({ where: { status: "ACTIVE" }, orderBy: { confirmedAt: "asc" } });
  await audit(toActor(u), "subscribers.export", "Subscriber", null, { after: { count: rows.length } });
  const csv = "﻿" + [`"Exported by ${u.email} at ${new Date().toISOString()}"`, "Email,Confirmed", ...rows.map((r) => `${r.email},${r.confirmedAt?.toISOString() ?? ""}`)].join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="zenorra-subscribers.csv"', "Cache-Control": "no-store" } });
}
