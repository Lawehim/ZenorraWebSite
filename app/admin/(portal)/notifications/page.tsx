import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { formatDateTimeLagos } from "@/lib/format";
import { renderMessage } from "@/server/services/templates";
import { StatusPill } from "@/components/ui/StatusPill";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  await requirePageUser("audit.view", "/admin/notifications");
  const rows = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const configured = Boolean(process.env.RESEND_API_KEY || process.env.TERMII_API_KEY);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Notifications</h1>
          <p>Every email and SMS the platform sends, with delivery status. Failed messages are retried three times over 30 minutes.</p>
        </div>
      </div>
      {!configured && (
        <p className="notice">
          Email (Resend) and SMS (Termii) keys aren&apos;t configured yet, so messages are recorded here but not delivered. Add <code>RESEND_API_KEY</code> and <code>TERMII_API_KEY</code> to the environment to switch delivery on.
        </p>
      )}
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Queued</th>
              <th>Channel</th>
              <th>To</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => {
              const m = renderMessage(n.template, n.payload as Record<string, unknown>);
              return (
                <tr key={n.id}>
                  <td className="mono" style={{ fontSize: ".72rem", whiteSpace: "nowrap" }}>
                    {formatDateTimeLagos(n.createdAt)}
                  </td>
                  <td>{n.channel}</td>
                  <td style={{ overflowWrap: "anywhere" }}>{n.to}</td>
                  <td>
                    <details>
                      <summary style={{ cursor: "pointer" }}>{m.subject}</summary>
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: ".74rem", color: "var(--ink-2)" }}>{m.text}</pre>
                    </details>
                    {n.lastError && <div style={{ color: "var(--warn)", fontSize: ".74rem" }}>{n.lastError}</div>}
                  </td>
                  <td>
                    <StatusPill status={n.status} />
                    {n.attempts > 1 && <div style={{ fontSize: ".7rem" }}>{n.attempts} attempts</div>}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={5}>Nothing sent yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
