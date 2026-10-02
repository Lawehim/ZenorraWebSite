import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { formatDateTimeLagos } from "@/lib/format";

export const metadata = { title: "Audit log" };

function summarise(v: unknown): string {
  if (v == null) return "";
  const s = JSON.stringify(v);
  return s.length > 160 ? s.slice(0, 160) + "…" : s;
}

export default async function AuditLog({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  await requirePageUser("audit.view", "/admin/audit");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.type ? { entityType: sp.type } : {};
  const [rows, types] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 100, take: 100, include: { actor: { select: { name: true, email: true } } } }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true } }),
  ]);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Audit log</h1>
          <p>Every change to content, properties, leads, users and settings. Entries can&apos;t be edited or deleted. Kept 24 months.</p>
        </div>
      </div>
      <nav className="filters" aria-label="Filter by type">
        <Link className="chip" href="/admin/audit" aria-current={!sp.type ? "true" : undefined}>
          All
        </Link>
        {types.map((t) => (
          <Link key={t.entityType} className="chip" href={`/admin/audit?type=${t.entityType}`} aria-current={sp.type === t.entityType ? "true" : undefined}>
            {t.entityType}
          </Link>
        ))}
      </nav>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>When (WAT)</th>
              <th>Who</th>
              <th>Action</th>
              <th>Item</th>
              <th className="hide-sm">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono" style={{ fontSize: ".74rem", whiteSpace: "nowrap" }}>
                  {formatDateTimeLagos(r.createdAt)}
                </td>
                <td>{r.actor?.name ?? "System"}</td>
                <td>{r.action}</td>
                <td className="mono" style={{ fontSize: ".72rem" }}>
                  {r.entityType}
                  {r.entityId ? ` · ${r.entityId}` : ""}
                </td>
                <td className="hide-sm mono" style={{ fontSize: ".68rem", maxWidth: 420, overflowWrap: "anywhere" }}>
                  {r.before ? <div>before: {summarise(r.before)}</div> : null}
                  {r.after ? <div>after: {summarise(r.after)}</div> : null}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5}>Nothing recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <nav className="pager" aria-label="Pages">
        {page > 1 && (
          <Link className="btn btn-ghost btn-sm" href={`/admin/audit?${sp.type ? `type=${sp.type}&` : ""}page=${page - 1}`}>
            ← Newer
          </Link>
        )}
        {rows.length === 100 && (
          <Link className="btn btn-ghost btn-sm" href={`/admin/audit?${sp.type ? `type=${sp.type}&` : ""}page=${page + 1}`}>
            Older →
          </Link>
        )}
      </nav>
    </>
  );
}
