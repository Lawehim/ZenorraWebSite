import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { formatKobo } from "@/lib/payments/paystack";
import { outstanding, arrears } from "@/lib/payments/schedule";
import { formatDateLagos, formatDateTimeLagos } from "@/lib/format";
import { failureMessageFor } from "@/server/services/payments";
import { StatusPill } from "@/components/ui/StatusPill";
import { OfflinePaymentForm } from "@/components/admin/OfflinePaymentForm";
import { PurchaseActions } from "@/components/admin/PurchaseActions";
import { VaultUpload } from "@/components/admin/VaultUpload";

export const metadata = { title: "Purchase" };

export default async function PurchaseDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; invite?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requirePageUser("buyers.view", `/admin/purchases/${id}`);
  const p = await db.purchase.findUnique({
    where: { id },
    include: { buyer: true, property: true, instalments: { orderBy: { sequence: "asc" }, include: { payments: { orderBy: { createdAt: "desc" } } } }, documents: { orderBy: { issuedAt: "desc" } }, referral: { include: { referrer: true } } },
  });
  if (!p) notFound();
  const now = new Date();
  const paid = p.instalments.reduce((s, i) => s + i.paidKobo, 0n);
  const owed = outstanding(p.instalments);
  const late = arrears(p.instalments, now);
  const payments = p.instalments.flatMap((i) => i.payments.map((x) => ({ ...x, label: i.label }))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return (
    <>
      <div className="adm-head">
        <div>
          <p className="mono" style={{ fontSize: ".66rem", letterSpacing: ".16em", textTransform: "uppercase" }}>
            <Link href="/admin/buyers">Buyers</Link> / {p.reference}
          </p>
          <h1>
            {p.buyer.name} — {p.property.name}
            {p.plotNumber ? ` plot ${p.plotNumber}` : ""}
          </h1>
          <p>
            Price {formatKobo(p.priceKobo)} · paid {formatKobo(paid)} · outstanding {formatKobo(owed)}
            {late > 0n && <span style={{ color: "var(--warn)" }}> · arrears {formatKobo(late)}</span>}
          </p>
        </div>
        <a className="btn btn-line btn-sm" href={`/api/admin/purchases/${p.id}/statement`}>
          Statement (PDF)
        </a>
      </div>
      {sp.created && (
        <p className="form-ok" role="status">
          Sale recorded and the buyer invited to their portal.
          {sp.invite && (
            <>
              {" "}
              You can also share this link directly (valid 7 days): <code style={{ overflowWrap: "anywhere" }}>{`${appUrl}/account/accept-invite?token=${sp.invite}`}</code>
            </>
          )}
        </p>
      )}
      <div className="editor-grid">
        <div>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Payment schedule</h2>
            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Instalment</th>
                    <th>Due</th>
                    <th>Amount</th>
                    <th>Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p.instalments.map((i) => (
                    <tr key={i.id}>
                      <td>{i.label}</td>
                      <td style={{ color: i.status !== "PAID" && i.dueDate < now ? "var(--warn)" : undefined }}>{formatDateLagos(i.dueDate)}</td>
                      <td className="mono">{formatKobo(i.amountKobo)}</td>
                      <td className="mono">{formatKobo(i.paidKobo)}</td>
                      <td>
                        <span className={`pill ${i.status === "PAID" ? "live" : i.status === "PART_PAID" ? "new" : i.dueDate < now ? "draft" : ""}`}>{i.status === "PART_PAID" ? "Part paid" : i.status === "PAID" ? "Paid" : i.dueDate < now ? "Overdue" : "Due"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <h2>Payments</h2>
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>For</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((x) => (
                  <tr key={x.id}>
                    <td style={{ fontSize: ".78rem" }}>{formatDateTimeLagos(x.paidAt ?? x.createdAt)}</td>
                    <td>{x.label}</td>
                    <td className="mono">{formatKobo(x.amountKobo)}</td>
                    <td style={{ fontSize: ".8rem" }}>
                      {x.provider === "offline" ? `Bank transfer · ${x.evidenceRef}` : x.method ?? "Paystack"}
                      {x.receiptNumber && <div className="mono">{x.receiptNumber}</div>}
                    </td>
                    <td>
                      <StatusPill status={x.status === "SUCCESS" ? "SENT" : x.status === "PENDING" ? "PENDING" : "FAILED"} />
                      {x.status === "FAILED" && <div style={{ fontSize: ".72rem" }}>{failureMessageFor(x.reasonCode)}</div>}
                    </td>
                  </tr>
                ))}
                {!payments.length && (
                  <tr>
                    <td colSpan={5}>No payments yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
        <aside>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Buyer</h2>
            <dl className="brief">
              <dt>Name</dt>
              <dd>{p.buyer.name}</dd>
              <dt>Contact</dt>
              <dd>{[p.buyer.email, p.buyer.phoneE164].filter(Boolean).join(" · ")}</dd>
              <dt>Portal</dt>
              <dd>
                <StatusPill status={p.buyer.status} />
              </dd>
              <dt>Referral code</dt>
              <dd className="mono">{p.buyer.referralCode}</dd>
              {p.referral && (
                <>
                  <dt>Referred by</dt>
                  <dd>
                    {p.referral.referrer.name} ({p.referral.status.toLowerCase()})
                  </dd>
                </>
              )}
              <dt>Allocation</dt>
              <dd>{p.allocationStatus === "ALLOCATED" ? `Allocated ${p.allocatedAt ? formatDateLagos(p.allocatedAt) : ""}` : "Pending"}</dd>
            </dl>
            {can(user.role, "buyers.manage") && <PurchaseActions purchaseId={p.id} buyerId={p.buyer.id} allocated={p.allocationStatus === "ALLOCATED"} invited={p.buyer.status !== "ACTIVE"} />}
          </section>
          {can(user.role, "payments.offline") && (
            <section className="card" style={{ marginBottom: "1rem" }}>
              <h2>Record a bank transfer</h2>
              <OfflinePaymentForm purchaseId={p.id} instalments={p.instalments.filter((i) => i.status !== "PAID").map((i) => ({ id: i.id, label: `${i.label} — ${formatKobo(i.amountKobo - i.paidKobo)} due` }))} />
            </section>
          )}
          <section className="card">
            <h2>Document vault</h2>
            <ul className="docs" style={{ marginTop: 0 }}>
              {p.documents.map((d) => (
                <li key={d.id}>
                  {d.title} <span className="muted">· {d.kind.toLowerCase()} · {formatDateLagos(d.issuedAt)}</span>
                </li>
              ))}
              {!p.documents.length && <li className="muted">No documents yet.</li>}
            </ul>
            {can(user.role, "buyers.manage") && <VaultUpload purchaseId={p.id} />}
          </section>
        </aside>
      </div>
    </>
  );
}
