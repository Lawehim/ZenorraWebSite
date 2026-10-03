import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { formatDateTimeLagos } from "@/lib/format";
import { TicketReply } from "@/components/admin/TicketReply";

export const metadata = { title: "Support tickets" };

export default async function Tickets({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requirePageUser("buyers.view", "/admin/tickets");
  const all = (await searchParams).all === "1";
  const tickets = await db.supportTicket.findMany({ where: all ? {} : { status: { not: "CLOSED" } }, orderBy: [{ status: "desc" }, { createdAt: "desc" }], include: { buyer: true, purchase: { include: { property: true } } }, take: 200 });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Buyer support</h1>
          <p>Requests raised from the buyer portal. Replies are emailed (or texted) to the buyer and shown in their portal.</p>
        </div>
        <Link className="btn btn-ghost btn-sm" href={all ? "/admin/tickets" : "/admin/tickets?all=1"}>
          {all ? "Open only" : "Include closed"}
        </Link>
      </div>
      {tickets.map((t) => (
        <section key={t.id} className="card" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <b>{t.subject}</b> <span className="pill">{t.status.toLowerCase()}</span>
              <div style={{ fontSize: ".78rem", color: "var(--ink-3)" }}>
                {t.reference} · {t.buyer.name}
                {t.purchase && (
                  <>
                    {" "}
                    · <Link href={`/admin/purchases/${t.purchase.id}`}>{t.purchase.property.name}</Link>
                  </>
                )}{" "}
                · {formatDateTimeLagos(t.createdAt)}
              </div>
            </div>
          </div>
          <p style={{ margin: ".8rem 0", whiteSpace: "pre-wrap" }}>{t.body}</p>
          {t.reply && <p className="bubble me" style={{ maxWidth: "100%" }}>{t.reply}</p>}
          {t.status !== "CLOSED" && <TicketReply id={t.id} />}
        </section>
      ))}
      {!tickets.length && <p className="muted card">No support requests.</p>}
    </>
  );
}
