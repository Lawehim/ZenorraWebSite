import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { relativeTime } from "@/lib/format";
import { AutoRefresh } from "@/components/admin/AutoRefresh";

export const metadata = { title: "Live chat" };

export default async function ChatInbox({ searchParams }: { searchParams: Promise<{ closed?: string }> }) {
  await requirePageUser("leads.view", "/admin/chat");
  const closed = (await searchParams).closed === "1";
  const threads = await db.chatThread.findMany({
    where: { status: closed ? "CLOSED" : "OPEN", messages: { some: {} } },
    orderBy: [{ unreadByStaff: "desc" }, { lastMessageAt: "desc" }],
    take: 100,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 }, lead: { select: { reference: true } } },
  });
  return (
    <>
      <AutoRefresh seconds={8} />
      <div className="adm-head">
        <div>
          <h1>Live chat</h1>
          <p>Conversations from the website chat. Out-of-hours chats with contact details also appear in the leads inbox.</p>
        </div>
        <Link className="btn btn-ghost btn-sm" href={closed ? "/admin/chat" : "/admin/chat?closed=1"}>
          {closed ? "Open chats" : "Closed chats"}
        </Link>
      </div>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Last message</th>
              <th className="hide-sm">Page</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {threads.map((t) => (
              <tr key={t.id} className={t.unreadByStaff ? "unread" : ""}>
                <td>
                  <Link href={`/admin/chat/${t.id}`}>
                    <b>{t.name || "Visitor"}</b>
                  </Link>
                  {t.unreadByStaff > 0 && <span className="pill new" style={{ marginLeft: ".4rem" }}>{t.unreadByStaff} new</span>}
                  <div style={{ fontSize: ".76rem" }}>
                    {t.contact ?? "No contact given"}
                    {t.lead && ` · ${t.lead.reference}`}
                  </div>
                </td>
                <td style={{ maxWidth: 380 }}>{t.messages[0]?.body.slice(0, 120)}</td>
                <td className="hide-sm mono" style={{ fontSize: ".72rem" }}>
                  {t.pagePath}
                </td>
                <td>{relativeTime(t.lastMessageAt)}</td>
              </tr>
            ))}
            {!threads.length && (
              <tr>
                <td colSpan={4}>No {closed ? "closed" : "open"} chats.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
