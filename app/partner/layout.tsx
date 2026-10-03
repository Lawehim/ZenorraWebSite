import type { Metadata } from "next";
import { requirePartnerUser } from "@/server/auth/session";
import { db } from "@/lib/db";
import { signOutAction } from "@/server/actions/auth";
import { SessionWatch } from "@/components/admin/SessionWatch";
import "../admin/admin.css";

export const metadata: Metadata = { title: { default: "Partner portal", template: "%s · Zenorra partner portal" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePartnerUser();
  const partner = await db.partner.findUnique({ where: { id: user.partnerId }, select: { name: true } });
  return (
    <div className="admin">
      <header className="adm-top">
        <a className="brand" href="/partner" aria-label="Partner portal home">
          <img className="mk" src="/brand/mark.webp" alt="" width={22} height={26} />
          <span className="mono" style={{ fontSize: ".66rem", letterSpacing: ".2em", color: "var(--ink-3)" }}>
            PARTNER PORTAL
          </span>
        </a>
        <div className="who">
          <span>
            {user.name} · {partner?.name}
          </span>
          <form action={signOutAction}>
            <button className="btn btn-line btn-sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="adm-main" id="main" style={{ maxWidth: 1200, margin: "0 auto" }}>
        {children}
      </main>
      <SessionWatch expiresAt={user.sessionExpiresAt.toISOString()} />
    </div>
  );
}
