import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { formatKobo } from "@/lib/payments/paystack";
import { formatDateLagos } from "@/lib/format";
import { getSettings } from "@/server/services/settings";
import { ReferralActions } from "@/components/admin/ReferralActions";

export const metadata = { title: "Referrals" };

export default async function Referrals() {
  await requirePageUser("referrals.approve", "/admin/referrals");
  const [rows, settings] = await Promise.all([
    db.referral.findMany({ orderBy: { createdAt: "desc" }, include: { referrer: true, referredLead: true, purchase: { include: { property: true } } }, take: 300 }),
    getSettings(),
  ]);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Referrals</h1>
          <p>
            A referral becomes payable once the referred buyer has paid {settings.referrals.thresholdPercent}% of the price. Commission is {settings.referrals.commissionPercent}% of the price. Self-referrals are blocked automatically. Change these under Settings.
          </p>
        </div>
      </div>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Referrer</th>
              <th>Referred</th>
              <th className="hide-sm">Purchase</th>
              <th>Commission</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <b>{r.referrer.name}</b>
                  <div className="mono" style={{ fontSize: ".7rem" }}>
                    {r.referrer.referralCode}
                  </div>
                </td>
                <td>
                  <Link href={`/admin/leads/${r.referredLeadId}`}>{r.referredLead.name}</Link>
                  <div style={{ fontSize: ".72rem" }}>{formatDateLagos(r.createdAt)}</div>
                </td>
                <td className="hide-sm">{r.purchase ? <Link href={`/admin/purchases/${r.purchase.id}`}>{r.purchase.property.name}</Link> : "Not yet bought"}</td>
                <td className="mono">{r.commissionKobo > 0n ? formatKobo(r.commissionKobo) : "—"}</td>
                <td>
                  <span className={`pill ${r.status === "PAID" ? "live" : r.status === "QUALIFIED" ? "new" : r.status === "REJECTED" ? "draft" : ""}`}>{r.status.toLowerCase()}</span>
                </td>
                <td>
                  <ReferralActions id={r.id} status={r.status} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6}>No referrals yet. Buyers find their code and share link in their portal.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
