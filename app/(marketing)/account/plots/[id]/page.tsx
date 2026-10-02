import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireBuyer } from "@/server/auth/buyer-session";
import { formatKobo } from "@/lib/payments/paystack";
import { outstanding, arrears } from "@/lib/payments/schedule";
import { formatDateLagos } from "@/lib/format";
import { documentLink } from "@/server/services/buyer-docs";
import { getSettings } from "@/server/services/settings";
import { PayForm } from "@/components/account/PayForm";

export const metadata: Metadata = { title: "My plot", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PlotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await requireBuyer(`/account/plots/${id}`);
  // Scoped to the signed-in buyer — another buyer's plot is simply "not found" (TC-SEC-005).
  const p = await db.purchase.findFirst({ where: { id, buyerId: b.id }, include: { property: true, instalments: { orderBy: { sequence: "asc" } }, documents: { orderBy: { issuedAt: "desc" } } } });
  if (!p) notFound();
  const settings = await getSettings();
  const now = new Date();
  const late = arrears(p.instalments, now);
  const due = p.instalments.filter((i) => i.status !== "PAID");
  return (
    <section className="phead" style={{ minHeight: "80svh" }}>
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/account">My Zenorra</Link>
            </li>
            <li>
              <span aria-current="page">{p.property.name}</span>
            </li>
          </ol>
        </nav>
        <h1>
          {p.property.name}
          {p.plotNumber ? ` · Plot ${p.plotNumber}` : ""}
        </h1>
        <p className="lede">
          Purchase {p.reference} · {formatKobo(p.priceKobo)} · balance {formatKobo(outstanding(p.instalments))}
          {late > 0n && <span style={{ color: "var(--warn)" }}> · overdue {formatKobo(late)}</span>}
        </p>

        <div className="pd-grid" style={{ marginTop: "2rem" }}>
          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Payment schedule</h2>
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
                  {p.instalments.map((i) => {
                    const overdue = i.status !== "PAID" && i.dueDate < now;
                    return (
                      <tr key={i.id}>
                        <td>{i.label}</td>
                        <td>{formatDateLagos(i.dueDate)}</td>
                        <td className="mono">{formatKobo(i.amountKobo)}</td>
                        <td className="mono">{formatKobo(i.paidKobo)}</td>
                        <td>
                          <span className={`pill ${i.status === "PAID" ? "live" : overdue ? "draft" : i.status === "PART_PAID" ? "new" : ""}`}>{i.status === "PAID" ? "Paid" : overdue ? `Overdue ${formatKobo(i.amountKobo - i.paidKobo)}` : i.status === "PART_PAID" ? "Part paid" : "Due"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h2 style={{ fontSize: "1.4rem", margin: "2.4rem 0 1rem" }}>Documents</h2>
            <ul className="docs" style={{ marginTop: 0 }}>
              {p.documents.map((d) => (
                <li key={d.id}>
                  <a href={documentLink(d.id, b.id).url}>{d.title}</a> <span className="muted">· {formatDateLagos(d.issuedAt)}</span>
                </li>
              ))}
              {!p.documents.length && <li className="muted">Your contract, receipts, survey, deed and allocation letter will appear here.</li>}
            </ul>
            <a className="btn btn-line btn-sm" style={{ marginTop: "1rem" }} href={`/api/account/statement/${p.id}`}>
              Download statement of account (PDF)
            </a>
          </div>
          <aside className="side">
            {due.length ? (
              <>
                <h2 style={{ fontSize: "1.2rem", marginBottom: ".8rem" }}>Make a payment</h2>
                <PayForm instalments={due.map((i) => ({ id: i.id, label: `${i.label} — due ${formatDateLagos(i.dueDate)}`, remaining: Number((i.amountKobo - i.paidKobo) / 100n) }))} />
                <div className="rule" style={{ margin: "1.4rem 0" }} />
                <p style={{ fontSize: ".86rem" }}>
                  <b>Prefer bank transfer?</b>
                  <br />
                  {settings.bankTransfer.bankName ? (
                    <>
                      {settings.bankTransfer.bankName} · {settings.bankTransfer.accountNumber}
                      <br />
                      {settings.bankTransfer.accountName}
                      <br />
                      Use reference <span className="mono">{p.reference}</span>. We&apos;ll issue your receipt once it arrives.
                    </>
                  ) : (
                    "Ask your advisor for Zenorra's account details."
                  )}
                </p>
              </>
            ) : (
              <p style={{ color: "var(--ok)" }}>This plot is fully paid. Thank you.</p>
            )}
            <div className="rule" style={{ margin: "1.4rem 0" }} />
            <Link className="btn btn-ghost btn-sm" href={`/account/support?purchase=${p.id}`}>
              Ask a question about this plot
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
