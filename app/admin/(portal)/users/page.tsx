import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { formatDateTimeLagos } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/rbac";
import { StatusPill } from "@/components/ui/StatusPill";
import { UsersManager } from "@/components/admin/UsersManager";

export const metadata = { title: "Users & roles" };

export default async function UsersAdmin() {
  const me = await requirePageUser("users.manage", "/admin/users");
  const [users, partners] = await Promise.all([
    db.user.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }], include: { partner: { select: { name: true } } } }),
    db.partner.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Users &amp; roles</h1>
          <p>Invitations expire after 72 hours. Removing or suspending someone signs them out immediately.</p>
        </div>
      </div>
      <UsersManager
        meId={me.id}
        meRole={me.role}
        partners={partners}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          roleLabel: ROLE_LABELS[u.role],
          status: u.status,
          locked: Boolean(u.lockedUntil && u.lockedUntil > new Date()),
          twoFactor: u.twoFactorEnabled,
          lastLogin: u.lastLoginAt ? formatDateTimeLagos(u.lastLoginAt) : "Never",
          partnerName: u.partner?.name ?? null,
        }))}
      />
      <details className="card" style={{ marginTop: "1.4rem" }}>
        <summary className="label" style={{ cursor: "pointer" }}>
          What each role can do
        </summary>
        <ul style={{ fontSize: ".88rem", color: "var(--ink-2)", marginTop: "1rem", display: "grid", gap: ".5rem" }}>
          <li>
            <b>Super Admin</b> — everything, including data-subject erasure and managing other Super Admins.
          </li>
          <li>
            <b>Administrator</b> — everything except erasure: content, prices, publishing, leads, exports, settings, users, audit log.
          </li>
          <li>
            <b>Editor</b> — site content, articles, media, testimonials and property copy. Cannot set prices, publish properties, see leads or change settings.
          </li>
          <li>
            <b>Advisor</b> — leads inbox (view, update status, notes) and inspections.
          </li>
          <li>
            <b>Viewer</b> — read-only dashboard and leads.
          </li>
          <li>
            <b>Partner developer</b> — an outside account for a developer whose estates Zenorra markets. Signs in to a separate read-only portal showing enquiry, inspection and sales figures for their own estates only — no buyer names or contact details, and no access to this admin.
          </li>
        </ul>
      </details>
      <span hidden>
        <StatusPill status="ACTIVE" />
      </span>
    </>
  );
}
