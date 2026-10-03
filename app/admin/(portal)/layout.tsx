import type { Metadata } from "next";
import { headers } from "next/headers";
import { requirePageUser } from "@/server/auth/session";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/AdminNav";
import { signOutAction } from "@/server/actions/auth";
import { ROLE_LABELS } from "@/lib/rbac";
import { requiresTwoFactor } from "@/server/services/auth";
import { SessionWatch } from "@/components/admin/SessionWatch";
import "../admin.css";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Zenorra admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-zn-path") ?? "/admin";
  const user = await requirePageUser("dashboard.view", path);
  const [unread, unreadChats] = await Promise.all([db.lead.count({ where: { readAt: null } }), db.chatThread.count({ where: { status: "OPEN", unreadByStaff: { gt: 0 } } })]);
  return (
    <div className="admin">
      <header className="adm-top">
        <a className="brand" href="/admin" aria-label="Admin home">
          <img className="mk" src="/brand/mark.webp" alt="" width={22} height={26} />
          <span className="mono" style={{ fontSize: ".66rem", letterSpacing: ".2em", color: "var(--ink-3)" }}>
            ADMIN
          </span>
        </a>
        <a className="btn btn-ghost btn-sm" href="/" target="_blank" rel="noopener noreferrer">
          View site ↗
        </a>
        <div className="who">
          <span>
            {user.name} · {ROLE_LABELS[user.role]}
          </span>
          <form action={signOutAction}>
            <button className="btn btn-line btn-sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="adm-shell">
        <AdminNav role={user.role} unreadLeads={unread} unreadChats={unreadChats} />
        <main className="adm-main" id="main">
          {requiresTwoFactor(user.role) && !user.twoFactorEnabled && (
            <p className="notice">
              Your role requires two-factor authentication. <a href="/admin/account" style={{ textDecoration: "underline" }}>Set it up now</a> — it takes a minute.
            </p>
          )}
          {children}
        </main>
      </div>
      <SessionWatch expiresAt={user.sessionExpiresAt.toISOString()} />
    </div>
  );
}
