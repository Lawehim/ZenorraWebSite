import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { formatKobo } from "@/lib/payments/paystack";
import { outstanding, arrears } from "@/lib/payments/schedule";
import { StatusPill } from "@/components/ui/StatusPill";

export const metadata = { title: "Buyers & payments" };

export default async function Buyers({ searchParams }: { searchParams: Promise<{ q?: string; arrears?: string }> }) {
  await requirePageUser("buyers.view", "/admin/buyers");
  const sp = await searchParams;
  const purchases = await db.purchase.findMany({
    where: sp.q ? { OR: [{ reference: { contains: sp.q.toUpperCase() } }, { buyer: { name: { contains: sp.q, mode: "insensitive" } } }, { property: { name: { contains: sp.q, mode: "insensitive" } } }] } : {},
    orderBy: { createdAt: "desc" },
    include: { buyer: true, property: true, instalments: true },
    take: 300,
  });
  const now = new Date();
  const rows = purchases
    .map((p) => {
      const lines = p.instalments.map((i) => ({ ...i }));
      const paid = p.instalments.reduce((s, i) => s + i.paidKobo, 0n);
      return { p, paid, owed: outstanding(lines), late: arrears(lines, now) };
    })
    .filter((r) => !sp.arrears || r.late > 0n);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Buyers &amp; payments</h1>
          <p>Every recorded sale with its schedule. To record a new sale, open the buyer&apos;s lead and choose “Record a sale”.</p>
        </div>
      </div>
      <form className="toolbar-row" role="search">
        <div className="field">
          <label htmlFor="q">Buyer, property or purchase ref</label>
          <input id="q" name="q" className="inp" defaultValue={sp.q} />
        </div>
        <label className="consent" style={{ alignSelf: "center" }}>
          <input type="checkbox" name="arrears" value="1" defaultChecked={Boolean(sp.arrears)} /> In arrears only
        </label>
        <button className="btn btn-line btn-sm" type="submit">
          Filter
        </button>
      </form>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Purchase</th>
              <th>Buyer</th>
              <th className="hide-sm">Property</th>
              <th>Paid</th>
              <th>Outstanding</th>
              <th>Arrears</th>
              <th className="hide-sm">Portal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, paid, owed, late }) => (
              <tr key={p.id}>
                <td className="mono">
                  <Link href={`/admin/purchases/${p.id}`}>{p.reference}</Link>
                </td>
                <td>
                  <b>{p.buyer.name}</b>
                  <div style={{ fontSize: ".74rem" }}>{p.buyer.email ?? p.buyer.phoneE164}</div>
                </td>
                <td className="hide-sm">
                  {p.property.name}
                  {p.plotNumber ? ` · plot ${p.plotNumber}` : ""}
                </td>
                <td className="mono">{formatKobo(paid)}</td>
                <td className="mono">{formatKobo(owed)}</td>
                <td className="mono" style={{ color: late > 0n ? "var(--warn)" : undefined }}>
                  {late > 0n ? formatKobo(late) : "—"}
                </td>
                <td className="hide-sm">
                  <StatusPill status={p.buyer.status} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7}>No sales recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
