import Link from "next/link";
import type { LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { listLeads, LEAD_STATUSES, type LeadFilters } from "@/server/services/leads";
import { relativeTime } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";

export const metadata = { title: "Leads inbox" };

export default async function LeadsInbox({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser("leads.view", "/admin/leads");
  const sp = await searchParams;
  const f: LeadFilters = {
    status: LEAD_STATUSES.some((s) => s.value === sp.status) ? (sp.status as LeadStatus) : undefined,
    source: sp.source || undefined,
    q: sp.q || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    propertyId: sp.propertyId || undefined,
    assignedToId: sp.assigned === "me" ? user.id : sp.assigned || undefined,
    overdue: sp.overdue === "1",
    sort: sp.sort === "score" ? "score" : "newest",
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ rows, total, pageSize }, sources, properties, advisors] = await Promise.all([
    listLeads(f, page),
    db.lead.findMany({ distinct: ["source"], select: { source: true } }),
    db.property.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: { in: ["ADVISOR", "ADMINISTRATOR", "SUPER_ADMIN"] }, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  const canEdit = can(user.role, "leads.edit");
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Leads inbox</h1>
          <p>
            {total} lead{total === 1 ? "" : "s"}. Unread leads are marked with a gold edge. Change status inline — it saves straight away.
          </p>
        </div>
        {can(user.role, "leads.export") && (
          <a className="btn btn-line btn-sm" href={`/api/admin/leads/export?${qs}`}>
            Export CSV
          </a>
        )}
      </div>
      <form className="toolbar-row" role="search">
        <div className="field">
          <label htmlFor="q">Name, phone, email or ref</label>
          <input id="q" name="q" className="inp" defaultValue={sp.q} />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" className="inp" defaultValue={sp.status ?? ""}>
            <option value="">Any</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="source">Source</label>
          <select id="source" name="source" className="inp" defaultValue={sp.source ?? ""}>
            <option value="">Any</option>
            {sources.map((s) => (
              <option key={s.source}>{s.source}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="propertyId">Property</label>
          <select id="propertyId" name="propertyId" className="inp" defaultValue={sp.propertyId ?? ""}>
            <option value="">Any</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="from">From</label>
          <input id="from" name="from" type="date" className="inp" defaultValue={sp.from} />
        </div>
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="date" className="inp" defaultValue={sp.to} />
        </div>
        <div className="field">
          <label htmlFor="assigned">Assigned to</label>
          <select id="assigned" name="assigned" className="inp" defaultValue={sp.assigned ?? ""}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
            {advisors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Sort</label>
          <select id="sort" name="sort" className="inp" defaultValue={sp.sort ?? "newest"}>
            <option value="newest">Newest first</option>
            <option value="score">Highest score first</option>
          </select>
        </div>
        <label className="consent" style={{ alignSelf: "center" }}>
          <input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === "1"} /> Past SLA only
        </label>
        <button className="btn btn-line btn-sm" type="submit">
          Filter
        </button>
      </form>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Name &amp; contact</th>
              <th className="hide-sm">Interest</th>
              <th className="hide-sm">Budget</th>
              <th className="hide-sm">Source</th>
              <th>Score</th>
              <th className="hide-sm">Advisor</th>
              <th>Age</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className={l.readAt ? "" : "unread"}>
                <td className="mono">
                  <Link href={`/admin/leads/${l.id}`}>{l.reference}</Link>
                </td>
                <td>
                  <Link href={`/admin/leads/${l.id}`}>
                    <b>{l.name}</b>
                  </Link>
                  {l.residency === "Diaspora" && <span className="pill new" style={{ marginLeft: ".4rem" }}>Diaspora</span>}
                  <br />
                  <span style={{ fontSize: ".78rem" }}>
                    {displayPhone(l.phoneE164)} {l.email}
                    {l.disposableEmail && " ⚠ disposable email"}
                  </span>
                </td>
                <td className="hide-sm">{l.property?.name ?? (l.corridors.join(", ") || l.enquiryType || "—")}</td>
                <td className="hide-sm">{l.budgetBand ?? "—"}</td>
                <td className="hide-sm">{l.source}</td>
                <td className="mono">{l.score ?? "—"}</td>
                <td className="hide-sm">{l.assignedTo?.name ?? "—"}</td>
                <td>
                  {relativeTime(l.createdAt)}
                  {l.escalatedAt && l.status === "NEW" && <span className="pill draft" style={{ marginLeft: ".3rem" }}>Past SLA</span>}
                  {l.isPartial && <span className="pill" style={{ marginLeft: ".3rem" }}>Partial</span>}
                </td>
                <td>{canEdit ? <LeadStatusSelect id={l.id} status={l.status} /> : l.status}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9}>No leads match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <nav className="pager" aria-label="Pages">
        {page > 1 && (
          <Link className="btn btn-ghost btn-sm" href={`/admin/leads?${qs}&page=${page - 1}`}>
            ← Newer
          </Link>
        )}
        <span>
          Page {page} of {pages}
        </span>
        {page < pages && (
          <Link className="btn btn-ghost btn-sm" href={`/admin/leads?${qs}&page=${page + 1}`}>
            Older →
          </Link>
        )}
      </nav>
    </>
  );
}
