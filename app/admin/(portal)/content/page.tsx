import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { listContentPages } from "@/lib/content/registry";
import { formatDateTimeLagos } from "@/lib/format";

export const metadata = { title: "Site content" };

const PAGE_LINKS: Record<string, string> = { Home: "/", About: "/about", Services: "/services", Properties: "/properties", Insights: "/insights", Contact: "/contact", Legal: "/legal/privacy" };

export default async function ContentIndex() {
  await requirePageUser("content.edit", "/admin/content");
  const stored = await db.contentBlock.findMany({ select: { key: true, updatedAt: true } });
  const edited = new Map(stored.map((s) => [s.key, s.updatedAt]));
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Site content</h1>
          <p>Every headline, paragraph, list and button on the public website. Pick a section to edit it — changes go live within a minute.</p>
        </div>
      </div>
      {listContentPages().map(({ page, blocks }) => (
        <section key={page} className="card" style={{ marginBottom: "1.4rem" }} aria-labelledby={`pg-${page}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: ".8rem" }}>
            <h2 id={`pg-${page}`} style={{ margin: 0 }}>
              {page}
            </h2>
            {PAGE_LINKS[page] && (
              <a href={PAGE_LINKS[page]} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                View page ↗
              </a>
            )}
          </div>
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Section</th>
                  <th className="hide-sm">Last edited</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => (
                  <tr key={b.key}>
                    <td>
                      <b>{b.label}</b>
                      {b.description && <div style={{ fontSize: ".78rem", color: "var(--ink-3)" }}>{b.description}</div>}
                    </td>
                    <td className="hide-sm">{edited.get(b.key) ? formatDateTimeLagos(edited.get(b.key)!) : "Original text"}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="btn btn-line btn-sm" href={`/admin/content/${b.key}`}>
                        Edit<span className="sr-only"> {b.label}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
