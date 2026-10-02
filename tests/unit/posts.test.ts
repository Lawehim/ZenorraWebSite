import { isPubliclyVisible, effectiveStatus, relatedPosts } from "@/lib/posts";

const now = new Date("2026-09-01T12:00:00Z");

describe("isPubliclyVisible (FR-CONT-001, FR-CONT-007)", () => {
  it("shows published posts whose publish date has passed", () => {
    expect(isPubliclyVisible({ status: "PUBLISHED", publishedAt: new Date("2026-08-01"), deletedAt: null }, now)).toBe(true);
  });
  it("hides drafts and archived posts", () => {
    expect(isPubliclyVisible({ status: "DRAFT", publishedAt: new Date("2026-08-01"), deletedAt: null }, now)).toBe(false);
    expect(isPubliclyVisible({ status: "ARCHIVED", publishedAt: new Date("2026-08-01"), deletedAt: null }, now)).toBe(false);
  });
  it("hides future-dated posts until their time, without a deploy", () => {
    const post = { status: "SCHEDULED" as const, publishedAt: new Date("2026-09-01T13:00:00Z"), deletedAt: null };
    expect(isPubliclyVisible(post, now)).toBe(false);
    expect(isPubliclyVisible(post, new Date("2026-09-01T13:00:01Z"))).toBe(true);
  });
  it("hides soft-deleted posts", () => {
    expect(isPubliclyVisible({ status: "PUBLISHED", publishedAt: new Date("2026-08-01"), deletedAt: new Date() }, now)).toBe(false);
  });
});

describe("effectiveStatus", () => {
  it("labels a published post with a future date as scheduled", () => {
    expect(effectiveStatus({ status: "PUBLISHED", publishedAt: new Date("2026-10-01"), deletedAt: null }, now)).toBe("SCHEDULED");
  });
  it("labels a scheduled post whose time has passed as published", () => {
    expect(effectiveStatus({ status: "SCHEDULED", publishedAt: new Date("2026-08-01"), deletedAt: null }, now)).toBe("PUBLISHED");
  });
});

describe("relatedPosts (FR-CONT-006)", () => {
  const mk = (slug: string, categoryId: string | null, d: string) => ({ slug, categoryId, publishedAt: new Date(d) });
  const posts = [
    mk("a", "buyer", "2026-08-01"),
    mk("b", "buyer", "2026-07-01"),
    mk("c", "market", "2026-08-20"),
    mk("d", "solar", "2026-06-01"),
    mk("e", "buyer", "2026-05-01"),
  ];
  it("prefers the same category, then most recent, excluding the current post", () => {
    expect(relatedPosts(posts[0], posts, 3).map((p) => p.slug)).toEqual(["b", "e", "c"]);
  });
});
