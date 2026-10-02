import Link from "next/link";
import type { Prisma, PostStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { effectiveStatus } from "@/lib/posts";
import { formatDateTimeLagos } from "@/lib/format";
import { can } from "@/lib/rbac";
import { StatusPill } from "@/components/ui/StatusPill";
import { PostRowActions } from "@/components/admin/PostRowActions";

export const metadata = { title: "Insights" };

export default async function PostsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string; deleted?: string }> }) {
  const user = await requirePageUser("posts.edit", "/admin/posts");
  const sp = await searchParams;
  const where: Prisma.PostWhereInput = { deletedAt: sp.deleted ? { not: null } : null };
  if (sp.q) where.title = { contains: sp.q, mode: "insensitive" };
  if (sp.status && ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].includes(sp.status)) where.status = sp.status as PostStatus;
  if (sp.category) where.categoryId = sp.category;
  const [posts, cats] = await Promise.all([db.post.findMany({ where, orderBy: { updatedAt: "desc" }, include: { category: true }, take: 200 }), db.category.findMany({ orderBy: { name: "asc" } })]);
  const now = new Date();
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Insights / blog</h1>
          <p>Write, schedule and publish articles. Times are Africa/Lagos (WAT).</p>
        </div>
        <Link className="btn btn-gold btn-sm" href="/admin/posts/new">
          New article
        </Link>
      </div>
      <form className="toolbar-row" role="search">
        <div className="field">
          <label htmlFor="q">Search titles</label>
          <input id="q" name="q" className="inp" defaultValue={sp.q} />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" className="inp" defaultValue={sp.status ?? ""}>
            <option value="">Any</option>
            <option value="DRAFT">Draft</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" className="inp" defaultValue={sp.category ?? ""}>
            <option value="">Any</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-line btn-sm" type="submit">
          Filter
        </button>
        <Link className="btn btn-ghost btn-sm" href={sp.deleted ? "/admin/posts" : "/admin/posts?deleted=1"}>
          {sp.deleted ? "Back to articles" : "Recently deleted"}
        </Link>
      </form>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Title</th>
              <th className="hide-sm">Category</th>
              <th>Status</th>
              <th className="hide-sm">Publish date</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link className="strong" href={`/admin/posts/${p.id}`}>
                    {p.title}
                  </Link>
                  <div className="mono" style={{ fontSize: ".66rem", color: "var(--ink-3)" }}>
                    /insights/{p.slug}
                  </div>
                </td>
                <td className="hide-sm">{p.category?.name ?? "—"}</td>
                <td>
                  <StatusPill status={effectiveStatus(p, now)} />
                </td>
                <td className="hide-sm">{p.publishedAt ? formatDateTimeLagos(p.publishedAt) : "—"}</td>
                <td>
                  <PostRowActions id={p.id} slug={p.slug} deleted={Boolean(p.deletedAt)} canDelete={can(user.role, "posts.delete")} />
                </td>
              </tr>
            ))}
            {!posts.length && (
              <tr>
                <td colSpan={5}>No articles match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
