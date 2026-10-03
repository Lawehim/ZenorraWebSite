import type { Prisma, PostStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { uniqueSlug, slugify } from "@/lib/slug";
import { postInputSchema } from "@/lib/validation/admin";
import { fieldErrors } from "@/lib/validation/public";
import { sanitizeRichHtml } from "@/lib/richtext/sanitize";
import { readingMinutes } from "@/lib/format";
import { audit } from "./audit";
import type { Actor } from "./actor";

const MAX_REVISIONS = 20;

export const postInclude = { category: true, coverMedia: true } satisfies Prisma.PostInclude;
export type PublicPost = Prisma.PostGetPayload<{ include: typeof postInclude }>;

function visibleWhere(now: Date): Prisma.PostWhereInput {
  return { status: { in: ["PUBLISHED", "SCHEDULED"] }, publishedAt: { lte: now }, deletedAt: null };
}

export async function listPublicPosts(opts: { now?: Date; categorySlug?: string; take?: number } = {}): Promise<PublicPost[]> {
  const now = opts.now ?? new Date();
  return db.post.findMany({
    where: { ...visibleWhere(now), ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}) },
    orderBy: { publishedAt: "desc" },
    include: postInclude,
    take: opts.take,
  });
}

export async function getPublicPost(slug: string, now: Date = new Date()): Promise<PublicPost | null> {
  return db.post.findFirst({ where: { slug, ...visibleWhere(now) }, include: postInclude });
}

export async function listCategories() {
  return db.category.findMany({ orderBy: { name: "asc" } });
}

export type SavePostResult = { ok: true; id: string; slug: string } | { ok: false; errors: Record<string, string> };

export async function savePost(actor: Actor, id: string | null, raw: Record<string, unknown>, now: Date = new Date()): Promise<SavePostResult> {
  assertCan(actor.role, "posts.edit");
  const parsed = postInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.status === "PUBLISHED" || d.status === "SCHEDULED") assertCan(actor.role, "posts.publish");
  const before = id ? await db.post.findUniqueOrThrow({ where: { id } }) : null;

  const desired = d.slug ? slugify(d.slug) : slugify(d.title);
  const slug =
    before && before.slug === desired
      ? before.slug
      : await uniqueSlug(desired, async (s) => Boolean(await db.post.findFirst({ where: { slug: s, ...(id ? { NOT: { id } } : {}) } })));

  const bodyHtml = sanitizeRichHtml(d.bodyHtml);
  let status: PostStatus = d.status;
  let publishedAt: Date | null = d.publishedAt ? new Date(d.publishedAt) : before?.publishedAt ?? null;
  if (status === "PUBLISHED" && !publishedAt) publishedAt = now;
  if (status === "PUBLISHED" && publishedAt && publishedAt > now) status = "SCHEDULED";

  const data = {
    title: d.title,
    slug,
    excerpt: d.excerpt || null,
    bodyHtml,
    body: (d.body ?? undefined) as Prisma.InputJsonValue | undefined,
    categoryId: d.categoryId || null,
    authorName: d.authorName || null,
    authorId: before?.authorId ?? actor.id,
    coverMediaId: d.coverMediaId || null,
    status,
    publishedAt,
    readingMinutes: d.readingMinutes ?? readingMinutes(bodyHtml),
    readingOverride: d.readingMinutes != null,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
  } satisfies Prisma.PostUncheckedCreateInput;

  const saved = await db.$transaction(async (tx) => {
    const row = before ? await tx.post.update({ where: { id: before.id }, data }) : await tx.post.create({ data });
    await tx.postRevision.create({ data: { postId: row.id, title: row.title, body: { html: bodyHtml }, createdBy: actor.id } });
    const old = await tx.postRevision.findMany({ where: { postId: row.id }, orderBy: { createdAt: "desc" }, skip: MAX_REVISIONS, select: { id: true } });
    if (old.length) await tx.postRevision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
    if (before && before.slug !== slug) {
      const to = `/insights/${slug}`;
      await tx.redirect.updateMany({ where: { toPath: `/insights/${before.slug}` }, data: { toPath: to } });
      await tx.redirect.deleteMany({ where: { fromPath: to } });
      await tx.redirect.upsert({ where: { fromPath: `/insights/${before.slug}` }, create: { fromPath: `/insights/${before.slug}`, toPath: to }, update: { toPath: to } });
    }
    await audit(actor, before ? "post.update" : "post.create", "Post", row.id, { before: before && { title: before.title, status: before.status }, after: { title: row.title, status: row.status } }, tx);
    return row;
  });
  return { ok: true, id: saved.id, slug: saved.slug };
}

export async function softDeletePost(actor: Actor, id: string) {
  assertCan(actor.role, "posts.delete");
  await db.post.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(actor, "post.delete", "Post", id);
}

export async function restorePost(actor: Actor, id: string) {
  assertCan(actor.role, "posts.delete");
  await db.post.update({ where: { id }, data: { deletedAt: null } });
  await audit(actor, "post.restore", "Post", id);
}

export async function duplicatePost(actor: Actor, id: string) {
  assertCan(actor.role, "posts.edit");
  const p = await db.post.findUniqueOrThrow({ where: { id } });
  const slug = await uniqueSlug(`${p.slug}-copy`, async (s) => Boolean(await db.post.findUnique({ where: { slug: s } })));
  const copy = await db.post.create({
    data: { slug, title: `${p.title} (copy)`, excerpt: p.excerpt, bodyHtml: p.bodyHtml, categoryId: p.categoryId, authorName: p.authorName, authorId: actor.id, coverMediaId: p.coverMediaId, status: "DRAFT", readingMinutes: p.readingMinutes },
  });
  await audit(actor, "post.duplicate", "Post", copy.id, { after: { from: id } });
  return copy;
}

export async function saveCategory(actor: Actor, name: string) {
  assertCan(actor.role, "posts.edit");
  const clean = name.trim().slice(0, 60);
  if (!clean) return null;
  const slug = slugify(clean);
  return db.category.upsert({ where: { slug }, create: { slug, name: clean }, update: { name: clean } });
}

/** Restore an earlier revision as the current body; the restore itself becomes a new revision (FR-ADM-015). */
export async function restoreRevision(actor: Actor, revisionId: string) {
  assertCan(actor.role, "posts.edit");
  const rev = await db.postRevision.findUniqueOrThrow({ where: { id: revisionId } });
  const html = sanitizeRichHtml(((rev.body ?? {}) as { html?: string }).html ?? "");
  await db.$transaction([
    db.post.update({ where: { id: rev.postId }, data: { title: rev.title, bodyHtml: html, readingMinutes: readingMinutes(html) } }),
    db.postRevision.create({ data: { postId: rev.postId, title: rev.title, body: { html }, createdBy: actor.id } }),
  ]);
  await audit(actor, "post.restore-revision", "Post", rev.postId, { after: { revisionId } });
  return rev.postId;
}
