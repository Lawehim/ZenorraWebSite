import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { formatDateTimeLagos } from "@/lib/format";
import { lineDiff, htmlToLines } from "@/lib/diff";
import { RestoreRevisionButton } from "@/components/admin/RestoreRevisionButton";

export const metadata = { title: "Article history" };

export default async function History({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  const { id } = await params;
  await requirePageUser("posts.edit", `/admin/posts/${id}/history`);
  const sp = await searchParams;
  const post = await db.post.findUnique({ where: { id }, include: { revisions: { orderBy: { createdAt: "desc" } } } });
  if (!post) notFound();
  const users = await db.user.findMany({ where: { id: { in: post.revisions.map((r) => r.createdBy).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const name = (uid: string | null) => users.find((u) => u.id === uid)?.name ?? "—";
  const revA = post.revisions.find((r) => r.id === sp.a) ?? post.revisions[1];
  const revB = post.revisions.find((r) => r.id === sp.b) ?? post.revisions[0];
  const html = (r: (typeof post.revisions)[number] | undefined) => ((r?.body ?? {}) as { html?: string }).html ?? "";
  const diff = revA && revB ? lineDiff(htmlToLines(html(revA)), htmlToLines(html(revB))) : [];

  return (
    <>
      <div className="adm-head">
        <div>
          <p className="mono" style={{ fontSize: ".66rem", letterSpacing: ".16em", textTransform: "uppercase" }}>
            <Link href="/admin/posts">Insights</Link> / <Link href={`/admin/posts/${id}`}>{post.title}</Link> / History
          </p>
          <h1>Revision history</h1>
          <p>The last 20 saved versions. Compare any two, or restore an earlier one — the restore is saved as a new version.</p>
        </div>
      </div>
      <div className="editor-grid">
        <section className="card">
          <h2>
            Changes {revA ? formatDateTimeLagos(revA.createdAt) : ""} → {revB ? formatDateTimeLagos(revB.createdAt) : ""}
          </h2>
          {diff.length ? (
            <div className="diff">
              {diff.map((d, i) => (
                <div key={i} className={d.op}>
                  <span className="sr-only">{d.op === "add" ? "Added: " : d.op === "del" ? "Removed: " : ""}</span>
                  {d.op === "add" ? "+ " : d.op === "del" ? "− " : "  "}
                  {d.text}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Save the article at least twice to compare versions.</p>
          )}
        </section>
        <aside className="card">
          <h2>Versions</h2>
          <form>
            <table className="tbl">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Saved</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {post.revisions.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input type="radio" name="a" value={r.id} defaultChecked={r.id === revA?.id} aria-label={`Compare from ${formatDateTimeLagos(r.createdAt)}`} />
                    </td>
                    <td>
                      <input type="radio" name="b" value={r.id} defaultChecked={r.id === revB?.id} aria-label={`Compare to ${formatDateTimeLagos(r.createdAt)}`} />
                    </td>
                    <td style={{ fontSize: ".78rem" }}>
                      {formatDateTimeLagos(r.createdAt)}
                      <br />
                      {name(r.createdBy)}
                    </td>
                    <td>
                      <RestoreRevisionButton revisionId={r.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-line btn-sm" type="submit" style={{ marginTop: ".8rem" }}>
              Compare selected
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
