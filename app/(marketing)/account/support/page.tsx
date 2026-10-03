import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireBuyer } from "@/server/auth/buyer-session";
import { formatDateLagos } from "@/lib/format";
import { TicketForm } from "@/components/account/TicketForm";

export const metadata: Metadata = { title: "Support", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Support({ searchParams }: { searchParams: Promise<{ purchase?: string }> }) {
  const b = await requireBuyer("/account/support");
  const [tickets, purchases] = await Promise.all([
    db.supportTicket.findMany({ where: { buyerId: b.id }, orderBy: { createdAt: "desc" }, include: { purchase: { include: { property: true } } } }),
    db.purchase.findMany({ where: { buyerId: b.id }, include: { property: true } }),
  ]);
  return (
    <section className="phead" style={{ minHeight: "80svh" }}>
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/account">My Zenorra</Link>
            </li>
            <li>
              <span aria-current="page">Support</span>
            </li>
          </ol>
        </nav>
        <h1>Support</h1>
        <div className="split" style={{ alignItems: "start", marginTop: "1.6rem" }}>
          <TicketForm purchases={purchases.map((p) => ({ id: p.id, label: `${p.property.name}${p.plotNumber ? ` · Plot ${p.plotNumber}` : ""}` }))} preselect={(await searchParams).purchase} />
          <div>
            {tickets.map((t) => (
              <article key={t.id} className="panel" style={{ marginBottom: "1rem" }}>
                <b>{t.subject}</b> <span className="pill">{t.status.toLowerCase()}</span>
                <div className="muted" style={{ fontSize: ".78rem" }}>
                  {t.reference} · {formatDateLagos(t.createdAt)}
                  {t.purchase && ` · ${t.purchase.property.name}`}
                </div>
                <p style={{ margin: ".6rem 0", whiteSpace: "pre-wrap" }}>{t.body}</p>
                {t.reply && <p className="bubble them" style={{ maxWidth: "100%" }}>Zenorra: {t.reply}</p>}
              </article>
            ))}
            {!tickets.length && <p className="muted">No requests yet.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
