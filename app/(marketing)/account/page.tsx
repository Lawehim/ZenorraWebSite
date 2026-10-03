import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireBuyer } from "@/server/auth/buyer-session";
import { formatKobo } from "@/lib/payments/paystack";
import { outstanding, arrears } from "@/lib/payments/schedule";
import { formatDateLagos } from "@/lib/format";
import { buyerSignOutAction } from "@/server/actions/account";
import { ShortlistSync } from "@/components/account/ShortlistSync";
import { CopyLink } from "@/components/account/CopyLink";

export const metadata: Metadata = { title: "My Zenorra", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountHome() {
  const b = await requireBuyer();
  const [purchases, referrals, shortlist] = await Promise.all([
    db.purchase.findMany({ where: { buyerId: b.id }, include: { property: true, instalments: { orderBy: { sequence: "asc" } } }, orderBy: { createdAt: "asc" } }),
    db.referral.findMany({ where: { referrerId: b.id }, include: { referredLead: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    db.shortlistItem.findMany({ where: { buyerId: b.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const now = new Date();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const refLink = `${appUrl}/?ref=${b.referralCode}`;
  return (
    <section className="phead" style={{ minHeight: "80svh" }}>
      <ShortlistSync />
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow">Buyer portal</div>
            <h1>Welcome, {b.name.split(" ")[0]}</h1>
          </div>
          <div className="rowacts" style={{ display: "flex", gap: ".5rem" }}>
            <Link className="btn btn-line btn-sm" href="/account/support">
              Support
            </Link>
            <form action={buyerSignOutAction}>
              <button className="btn btn-ghost btn-sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <h2 style={{ fontSize: "1.4rem", margin: "2rem 0 1rem" }}>My plots</h2>
        <div className="plots">
          {purchases.map((p) => {
            const paid = p.instalments.reduce((s, i) => s + i.paidKobo, 0n);
            const pct = Number((paid * 100n) / (p.priceKobo || 1n));
            const next = p.instalments.find((i) => i.status !== "PAID");
            const late = arrears(p.instalments, now);
            return (
              <Link key={p.id} href={`/account/plots/${p.id}`} className="plot">
                <div className="plot-body">
                  <h3>
                    {p.property.name}
                    {p.plotNumber ? ` · Plot ${p.plotNumber}` : ""}
                  </h3>
                  <div className="plot-loc">{p.property.locationText}</div>
                  <div className="plot-meta">
                    <div>
                      Paid<b>{pct}%</b>
                    </div>
                    <div>
                      Balance<b>{formatKobo(outstanding(p.instalments))}</b>
                    </div>
                    <div>
                      Allocation<b>{p.allocationStatus === "ALLOCATED" ? "Allocated" : "Pending"}</b>
                    </div>
                  </div>
                  <div className="track" style={{ height: 6, background: "var(--surface-3)", marginTop: ".6rem" }} aria-hidden="true">
                    <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: "var(--gold)" }} />
                  </div>
                  {late > 0n ? (
                    <p style={{ color: "var(--warn)", fontSize: ".86rem", marginTop: ".6rem" }}>Overdue: {formatKobo(late)}</p>
                  ) : next ? (
                    <p className="muted" style={{ fontSize: ".86rem", marginTop: ".6rem" }}>
                      Next: {formatKobo(next.amountKobo - next.paidKobo)} due {formatDateLagos(next.dueDate)}
                    </p>
                  ) : (
                    <p style={{ color: "var(--ok)", fontSize: ".86rem", marginTop: ".6rem" }}>Fully paid</p>
                  )}
                </div>
              </Link>
            );
          })}
          {!purchases.length && <p className="muted">No purchases on your account yet.</p>}
        </div>

        <div className="split" style={{ marginTop: "3rem", alignItems: "start" }}>
          <section className="panel">
            <div className="eyebrow">Refer a friend</div>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              Share your link. When someone you refer buys and pays their deposit, you earn a commission.
            </p>
            <p className="mono" style={{ fontSize: "1.2rem", letterSpacing: ".12em", color: "var(--gold-lt)" }}>
              {b.referralCode}
            </p>
            <CopyLink url={refLink} />
            <table className="tbl" style={{ marginTop: "1rem" }}>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id}>
                    <td>{r.referredLead.name}</td>
                    <td>{r.status === "PAID" ? "Paid" : r.status === "QUALIFIED" ? "Approved — payout pending" : r.status === "REJECTED" ? "Not eligible" : "Pending"}</td>
                    <td className="mono">{r.commissionKobo > 0n ? formatKobo(r.commissionKobo) : ""}</td>
                  </tr>
                ))}
                {!referrals.length && (
                  <tr>
                    <td>No referrals yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          <section className="panel">
            <div className="eyebrow">My shortlist</div>
            {shortlist.length ? (
              <ul className="docs">
                {shortlist.map((s) => (
                  <li key={s.id}>
                    <Link href={`/properties/${s.propertySlug}`}>{s.propertySlug.replace(/-/g, " ")}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Estates you save while browsing appear here.</p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
