import { db } from "@/lib/db";
import { saveProperty, listPublishedProperties, getPublicProperty, setPropertyStatus, deleteProperty } from "@/server/services/properties";
import { savePost, listPublicPosts, getPublicPost, softDeletePost, restorePost } from "@/server/services/posts";
import { ForbiddenError } from "@/lib/rbac";
import { resetDb, makeUser } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const baseProperty = {
  name: "Heritage Gardens",
  slug: "",
  reference: "ZNR-001",
  corridor: "Ibeju-Lekki",
  locationText: "Eleko, Ibeju-Lekki, Lagos",
  titleType: "REGISTERED_SURVEY",
  titleDocRef: "",
  priceNaira: "4800000",
  depositPercent: "30",
  planMonths: "24",
  features: "Fenced\nTarred roads",
};

describe("properties (FR-ADM-031/032, FR-PROP-008/021, FR-SEO-007)", () => {
  it("creates a property with an auto-derived slug and audits it", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const r = await saveProperty({ id: admin.id, role: "ADMINISTRATOR" }, null, baseProperty);
    expect(r.ok).toBe(true);
    const p = await db.property.findFirstOrThrow();
    expect(p.slug).toBe("heritage-gardens");
    expect(p.priceNaira).toBe(4_800_000n);
    expect(p.features).toEqual(["Fenced", "Tarred roads"]);
    expect(await db.auditLog.count({ where: { entityType: "Property" } })).toBe(1);
  });

  it("only lists published properties publicly (TC-PROP-001)", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const actor = { id: admin.id, role: "ADMINISTRATOR" as const };
    await saveProperty(actor, null, baseProperty);
    await saveProperty(actor, null, { ...baseProperty, name: "Coral Reserve", reference: "ZNR-002" });
    const coral = await db.property.findUniqueOrThrow({ where: { slug: "coral-reserve" } });
    await setPropertyStatus(actor, coral.id, "PUBLISHED");
    expect((await listPublishedProperties()).map((p) => p.slug)).toEqual(["coral-reserve"]);
  });

  it("disambiguates duplicate slugs (TC-EDGE-010)", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const actor = { id: admin.id, role: "ADMINISTRATOR" as const };
    await saveProperty(actor, null, baseProperty);
    await saveProperty(actor, null, { ...baseProperty, reference: "ZNR-099" });
    expect((await db.property.findMany({ orderBy: { createdAt: "asc" } })).map((p) => p.slug)).toEqual(["heritage-gardens", "heritage-gardens-2"]);
  });

  it("creates a 301 redirect when the slug changes, with no chains (TC-PROP-014, TC-SEO-006)", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const actor = { id: admin.id, role: "ADMINISTRATOR" as const };
    await saveProperty(actor, null, baseProperty);
    const p = await db.property.findFirstOrThrow();
    await setPropertyStatus(actor, p.id, "PUBLISHED");
    await saveProperty(actor, p.id, { ...baseProperty, slug: "heritage-gardens-eleko" });
    await saveProperty(actor, p.id, { ...baseProperty, slug: "heritage-gardens-phase-2" });
    const redirects = await db.redirect.findMany();
    expect(redirects.every((r) => r.toPath === "/properties/heritage-gardens-phase-2")).toBe(true);
    expect(redirects.map((r) => r.fromPath).sort()).toEqual(["/properties/heritage-gardens", "/properties/heritage-gardens-eleko"]);
    const res = await getPublicProperty("heritage-gardens");
    expect(res).toEqual({ kind: "redirect", to: "/properties/heritage-gardens-phase-2" });
  });

  it("keeps sold-out properties reachable (FR-PROP-021, TC-PROP-013)", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const actor = { id: admin.id, role: "ADMINISTRATOR" as const };
    await saveProperty(actor, null, baseProperty);
    const p = await db.property.findFirstOrThrow();
    await setPropertyStatus(actor, p.id, "SOLD_OUT");
    const res = await getPublicProperty("heritage-gardens");
    expect(res.kind).toBe("property");
    if (res.kind === "property") expect(res.property.status).toBe("SOLD_OUT");
  });

  it("does not expose drafts publicly", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    await saveProperty({ id: admin.id, role: "ADMINISTRATOR" }, null, baseProperty);
    expect(await getPublicProperty("heritage-gardens")).toEqual({ kind: "missing" });
  });

  it("lets an Editor edit copy but not change price or publish (RBAC: Set prices, Publish)", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const editor = await makeUser("EDITOR");
    await saveProperty({ id: admin.id, role: "ADMINISTRATOR" }, null, baseProperty);
    const p = await db.property.findFirstOrThrow();
    const ed = { id: editor.id, role: "EDITOR" as const };
    expect((await saveProperty(ed, p.id, { ...baseProperty, blurb: "New blurb" })).ok).toBe(true);
    await expect(saveProperty(ed, p.id, { ...baseProperty, priceNaira: "5000000" })).rejects.toThrow(ForbiddenError);
    await expect(setPropertyStatus(ed, p.id, "PUBLISHED")).rejects.toThrow(ForbiddenError);
  });

  it("rejects invalid prices with field errors (TC-ADM-020)", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const r = await saveProperty({ id: admin.id, role: "ADMINISTRATOR" }, null, { ...baseProperty, priceNaira: "-500" });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.errors.priceNaira).toMatch(/whole number/);
  });

  it("soft-deletes properties", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const actor = { id: admin.id, role: "ADMINISTRATOR" as const };
    await saveProperty(actor, null, baseProperty);
    const p = await db.property.findFirstOrThrow();
    await deleteProperty(actor, p.id);
    expect((await db.property.findUniqueOrThrow({ where: { id: p.id } })).deletedAt).not.toBeNull();
  });
});

describe("posts (FR-ADM-010..014, FR-CONT-001/007, TC-ADM-007/008/010/011/012)", () => {
  const now = new Date("2026-09-02T09:00:00Z");

  it("publishes an article that appears in the public index", async () => {
    const editor = await makeUser("EDITOR");
    const r = await savePost({ id: editor.id, role: "EDITOR" }, null, { title: "How to avoid land scams", status: "PUBLISHED", bodyHtml: "<p>Check the title.</p>" }, now);
    expect(r.ok).toBe(true);
    const list = await listPublicPosts({ now });
    expect(list.map((p) => p.slug)).toEqual(["how-to-avoid-land-scams"]);
    expect(list[0].readingMinutes).toBe(1);
  });

  it("hides a scheduled post until its time without a deploy", async () => {
    const editor = await makeUser("EDITOR");
    await savePost({ id: editor.id, role: "EDITOR" }, null, { title: "Future", status: "SCHEDULED", publishedAt: "2026-09-02T11:00:00Z", bodyHtml: "<p>x</p>" }, now);
    expect(await listPublicPosts({ now })).toHaveLength(0);
    expect(await listPublicPosts({ now: new Date("2026-09-02T11:00:01Z") })).toHaveLength(1);
  });

  it("sanitises the body on save (TC-ADM-011)", async () => {
    const editor = await makeUser("EDITOR");
    await savePost({ id: editor.id, role: "EDITOR" }, null, { title: "XSS", status: "PUBLISHED", bodyHtml: '<p>ok</p><script>alert(1)</script><img src="x" onerror="alert(1)">' }, now);
    const p = await db.post.findFirstOrThrow();
    expect(p.bodyHtml).not.toMatch(/script|onerror/);
  });

  it("disambiguates slugs for identical titles (TC-ADM-010)", async () => {
    const editor = await makeUser("EDITOR");
    const ed = { id: editor.id, role: "EDITOR" as const };
    await savePost(ed, null, { title: "Same title", status: "DRAFT" }, now);
    await savePost(ed, null, { title: "Same title", status: "DRAFT" }, now);
    expect((await db.post.findMany({ orderBy: { createdAt: "asc" } })).map((p) => p.slug)).toEqual(["same-title", "same-title-2"]);
  });

  it("soft-deletes (admin only) and restores within 30 days (TC-ADM-012, US-EDT-05)", async () => {
    const editor = await makeUser("EDITOR");
    const admin = await makeUser("ADMINISTRATOR");
    await savePost({ id: editor.id, role: "EDITOR" }, null, { title: "Oops", status: "PUBLISHED", bodyHtml: "<p>x</p>" }, now);
    const p = await db.post.findFirstOrThrow();
    await expect(softDeletePost({ id: editor.id, role: "EDITOR" }, p.id)).rejects.toThrow(ForbiddenError);
    await softDeletePost({ id: admin.id, role: "ADMINISTRATOR" }, p.id);
    expect(await getPublicPost("oops", now)).toBeNull();
    await restorePost({ id: admin.id, role: "ADMINISTRATOR" }, p.id);
    expect(await getPublicPost("oops", now)).not.toBeNull();
  });

  it("keeps the last 20 revisions", async () => {
    const editor = await makeUser("EDITOR");
    const ed = { id: editor.id, role: "EDITOR" as const };
    await savePost(ed, null, { title: "Rev", status: "DRAFT", bodyHtml: "<p>0</p>" }, now);
    const p = await db.post.findFirstOrThrow();
    for (let i = 1; i <= 25; i++) await savePost(ed, p.id, { title: "Rev", slug: "rev", status: "DRAFT", bodyHtml: `<p>${i}</p>` }, now);
    expect(await db.postRevision.count({ where: { postId: p.id } })).toBe(20);
  });
});
