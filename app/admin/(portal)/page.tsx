import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { relativeTime } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { StatusPill } from "@/components/ui/StatusPill";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requirePageUser();
  const { denied } = await searchParams;
  const since = new Date(Date.now() - 30 * 86400_000);
  const [leads, leads30, posts, properties, media, recent, bySource, bookings] = await Promise.all([
    db.lead.count(),
    db.lead.count({ where: { createdAt: { gte: since } } }),
    db.post.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    db.property.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    db.mediaAsset.count({ where: { deletedAt: null } }),
    can(user.role, "leads.view") ? db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { property: { select: { name: true } } } }) : Promise.resolve([]),
    db.lead.groupBy({ by: ["source"], _count: { _all: true }, where: { createdAt: { gte: since } } }),
    db.booking.count({ where: { date: { gte: new Date(new Date().toISOString().slice(0, 10)) }, status: { not: "CANCELLED" } } }),
  ]);
  const max = Math.max(1, ...bySource.map((s) => s._count._all));

  return (
    <>
      {denied && (
        <p className="notice" role="alert">
          Your role doesn&apos;t have access to that page. Ask an administrator if you need it.
        </p>
      )}
      <div className="adm-head">
        <div>
          <h1>Good to see you, {user.name.split(" ")[0]}</h1>
          <p>Live figures — refreshed every time you open this page.</p>
        </div>
        <div className="rowacts">
          {can(user.role, "posts.edit") && (
            <Link className="btn btn-gold btn-sm" href="/admin/posts/new">
              New article
            </Link>
          )}
          {can(user.role, "properties.edit") && (
            <Link className="btn btn-line btn-sm" href="/admin/properties/new">
              New property
            </Link>
          )}
          {can(user.role, "media.upload") && (
            <Link className="btn btn-line btn-sm" href="/admin/media">
              Upload media
            </Link>
          )}
          {can(user.role, "content.edit") && (
            <Link className="btn btn-line btn-sm" href="/admin/content">
              Edit site content
            </Link>
          )}
        </div>
      </div>

      <div className="stats">
        <Link className="stat" href="/admin/leads">
          <b>{leads}</b>
          <span>Total leads</span>
          <i>+{leads30} in 30 days</i>
        </Link>
        <Link className="stat" href="/admin/inspections">
          <b>{bookings}</b>
          <span>Upcoming inspection bookings</span>
        </Link>
        <Link className="stat" href="/admin/posts">
          <b>{posts}</b>
          <span>Published articles</span>
        </Link>
        <Link className="stat" href="/admin/properties">
          <b>{properties}</b>
          <span>Listed properties</span>
        </Link>
        <Link className="stat" href="/admin/media">
          <b>{media}</b>
          <span>Media assets</span>
        </Link>
      </div>

      <div className="editor-grid">
        {can(user.role, "leads.view") && (
          <section className="card" aria-labelledby="recent-h">
            <h2 id="recent-h">Recent enquiries</h2>
            {recent.length ? (
              <div className="tblwrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Name</th>
                      <th className="hide-sm">Interest</th>
                      <th>Received</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((l) => (
                      <tr key={l.id} className={l.readAt ? "" : "unread"}>
                        <td className="mono">
                          <Link href={`/admin/leads/${l.id}`}>{l.reference}</Link>
                        </td>
                        <td>
                          <b>{l.name}</b>
                          <br />
                          <span style={{ fontSize: ".78rem" }}>{displayPhone(l.phoneE164) || l.email}</span>
                        </td>
                        <td className="hide-sm">{l.property?.name ?? (l.corridors.join(", ") || l.enquiryType || "General")}</td>
                        <td>{relativeTime(l.createdAt)}</td>
                        <td>
                          <StatusPill status={l.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No enquiries yet. They appear here the moment a form is submitted.</p>
            )}
          </section>
        )}
        <section className="card" aria-labelledby="src-h">
          <h2 id="src-h">Lead sources · last 30 days</h2>
          {bySource.length ? (
            <>
              <div className="bar-chart" aria-hidden="true">
                {bySource.map((s) => (
                  <div className="row" key={s.source}>
                    <span>{s.source}</span>
                    <div className="track">
                      <div className="fill" style={{ width: `${(s._count._all / max) * 100}%` }} />
                    </div>
                    <span>{s._count._all}</span>
                  </div>
                ))}
              </div>
              <table className="sr-only">
                <caption>Lead sources in the last 30 days</caption>
                <tbody>
                  {bySource.map((s) => (
                    <tr key={s.source}>
                      <th scope="row">{s.source}</th>
                      <td>{s._count._all}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted">No leads in the last 30 days.</p>
          )}
        </section>
      </div>
    </>
  );
}
