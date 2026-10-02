import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { PostEditor, type PostDraft } from "@/components/admin/PostEditor";

export const metadata = { title: "Edit article" };

function lagosLocal(d: Date | null): string {
  if (!d) return "";
  const lagos = new Date(d.getTime() + 3600_000); // WAT = UTC+1, no DST
  return lagos.toISOString().slice(0, 16);
}

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser("posts.edit", `/admin/posts/${id}`);
  const isNew = id === "new";
  const post = isNew ? null : await db.post.findUnique({ where: { id }, include: { coverMedia: true } });
  if (!isNew && !post) notFound();
  const [cats, assets] = await Promise.all([db.category.findMany({ orderBy: { name: "asc" } }), db.mediaAsset.findMany({ where: { deletedAt: null }, select: { id: true, key: true } })]);
  const initial: PostDraft = {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    bodyHtml: post?.bodyHtml ?? "<p></p>",
    categoryId: post?.categoryId ?? "",
    authorName: post?.authorName ?? "",
    coverUrl: post?.coverMedia ? `/media/${post.coverMedia.key}` : "",
    status: post?.status ?? "DRAFT",
    publishedAt: lagosLocal(post?.publishedAt ?? null),
    readingMinutes: post?.readingOverride && post.readingMinutes ? String(post.readingMinutes) : "",
    seoTitle: post?.seoTitle ?? "",
    seoDescription: post?.seoDescription ?? "",
  };
  return (
    <>
      <div className="adm-head">
        <div>
          <p className="mono" style={{ fontSize: ".66rem", letterSpacing: ".16em", textTransform: "uppercase" }}>
            <Link href="/admin/posts">Insights</Link> / {isNew ? "New" : "Edit"}
          </p>
          <h1>{isNew ? "New article" : post!.title}</h1>
        </div>
      </div>
      <PostEditor id={isNew ? null : id} initial={initial} categories={cats.map((c) => ({ id: c.id, name: c.name }))} canPublish={can(user.role, "posts.publish")} coverAssets={Object.fromEntries(assets.map((a) => [a.key, a.id]))} />
    </>
  );
}
