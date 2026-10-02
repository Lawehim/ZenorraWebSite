import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { formatDateTimeLagos } from "@/lib/format";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { ChatReply } from "@/components/admin/ChatReply";

export const metadata = { title: "Chat" };

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser("leads.view", `/admin/chat/${id}`);
  const t = await db.chatThread.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } }, lead: true } });
  if (!t) notFound();
  if (t.unreadByStaff && can(user.role, "leads.edit")) await db.chatThread.update({ where: { id }, data: { unreadByStaff: 0 } });
  return (
    <>
      <AutoRefresh seconds={5} />
      <div className="adm-head">
        <div>
          <p className="mono" style={{ fontSize: ".66rem", letterSpacing: ".16em", textTransform: "uppercase" }}>
            <Link href="/admin/chat">Live chat</Link> / {t.status === "OPEN" ? "Open" : "Closed"}
          </p>
          <h1>{t.name || "Visitor"}</h1>
          <p>
            {t.contact ?? "No contact given"} · started {formatDateTimeLagos(t.createdAt)} on {t.pagePath}
            {t.lead && (
              <>
                {" "}
                · lead <Link href={`/admin/leads/${t.lead.id}`}>{t.lead.reference}</Link>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 760 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem", marginBottom: "1.2rem" }} aria-live="polite">
          {t.messages.map((m) => (
            <div key={m.id} className={`bubble ${m.sender === "VISITOR" ? "them" : "me"}`}>
              <div className="mono" style={{ fontSize: ".6rem", color: "var(--ink-3)", marginBottom: ".2rem" }}>
                {m.sender === "VISITOR" ? t.name || "Visitor" : m.author?.name ?? "Zenorra"} · {formatDateTimeLagos(m.createdAt)}
              </div>
              {m.body}
            </div>
          ))}
        </div>
        {can(user.role, "leads.edit") && <ChatReply threadId={t.id} open={t.status === "OPEN"} linked={Boolean(t.lead)} />}
      </div>
    </>
  );
}
