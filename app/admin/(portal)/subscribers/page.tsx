import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { formatDateLagos } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";

export const metadata = { title: "Subscribers" };

export default async function Subscribers() {
  await requirePageUser("leads.export", "/admin/subscribers");
  const [rows, counts] = await Promise.all([db.subscriber.findMany({ orderBy: { createdAt: "desc" }, take: 500 }), db.subscriber.groupBy({ by: ["status"], _count: { _all: true } })]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Newsletter subscribers</h1>
          <p>
            {n("ACTIVE")} active · {n("PENDING")} awaiting confirmation · {n("UNSUBSCRIBED")} unsubscribed. Only active subscribers are exported.
          </p>
        </div>
        <a className="btn btn-line btn-sm" href="/api/admin/subscribers/export">
          Export active (CSV)
        </a>
      </div>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Signed up</th>
              <th className="hide-sm">Confirmed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.email}</td>
                <td>
                  <StatusPill status={s.status} />
                </td>
                <td>{formatDateLagos(s.createdAt)}</td>
                <td className="hide-sm">{s.confirmedAt ? formatDateLagos(s.confirmedAt) : "—"}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4}>No subscribers yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
