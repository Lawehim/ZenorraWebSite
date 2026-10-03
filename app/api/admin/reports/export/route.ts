import { currentUser, toActor } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { leadsReport } from "@/server/services/reports";
import { audit } from "@/server/services/audit";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || !can(u.role, "reports.view")) return new Response("Forbidden", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return new Response("Bad dates", { status: 400 });
  const r = await leadsReport({ from: new Date(`${from}T00:00:00+01:00`), to: new Date(`${to}T23:59:59+01:00`) });
  await audit(toActor(u), "reports.export", "Report", null, { after: { from, to } });
  const lines = [`Zenorra lead report ${from} to ${to}`, `Total,${r.total}`, `Closed sales,${r.won}`, "", "Dimension,Value,Leads"];
  for (const [dim, rows] of [["Source", r.bySource], ["Property", r.byProperty], ["Advisor", r.byAdvisor]] as const) for (const row of rows) lines.push([dim, row.key, row.count].map(cell).join(","));
  return new Response("﻿" + lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="zenorra-report-${from}-${to}.csv"` } });
}
