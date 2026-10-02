import type { PostStatus } from "@prisma/client";

interface Visible {
  status: PostStatus;
  publishedAt: Date | null;
  deletedAt: Date | null;
}

/** Published or scheduled, with a publish time that has passed (FR-CONT-001/007). */
export function isPubliclyVisible(p: Visible, now: Date = new Date()): boolean {
  if (p.deletedAt) return false;
  if (p.status !== "PUBLISHED" && p.status !== "SCHEDULED") return false;
  return p.publishedAt != null && p.publishedAt.getTime() <= now.getTime();
}

/** What the admin should see, accounting for the clock. */
export function effectiveStatus(p: Visible, now: Date = new Date()): PostStatus {
  if (p.status === "PUBLISHED" || p.status === "SCHEDULED") {
    return p.publishedAt && p.publishedAt.getTime() > now.getTime() ? "SCHEDULED" : "PUBLISHED";
  }
  return p.status;
}

interface Relatable {
  slug: string;
  categoryId: string | null;
  publishedAt: Date | null;
}

export function relatedPosts<T extends Relatable>(current: T, list: T[], count: number): T[] {
  return list
    .filter((p) => p.slug !== current.slug)
    .sort((a, b) => {
      const ca = a.categoryId === current.categoryId ? 0 : 1;
      const cb = b.categoryId === current.categoryId ? 0 : 1;
      return ca - cb || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
    })
    .slice(0, count);
}
