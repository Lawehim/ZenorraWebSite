import type { Prisma, PropertyStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { uniqueSlug, slugify } from "@/lib/slug";
import { propertyInputSchema } from "@/lib/validation/admin";
import { fieldErrors } from "@/lib/validation/public";
import { sanitizeRichHtml, escapeHtml } from "@/lib/richtext/sanitize";
import { audit } from "./audit";
import type { Actor } from "./actor";

const PUBLIC_STATUSES: PropertyStatus[] = ["PUBLISHED", "SOLD_OUT"];

/** Plain text with blank-line paragraphs becomes escaped <p> blocks; HTML input is sanitised. */
export function toDescriptionHtml(input: string): string {
  const t = input.trim();
  if (t.startsWith("<")) return sanitizeRichHtml(t);
  return t
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p.replace(/\s*\n\s*/g, " ").trim())}</p>`)
    .join("");
}

export const propertyInclude = {
  media: { orderBy: { order: "asc" }, include: { mediaAsset: true } },
  phases: { orderBy: { order: "asc" } },
  documents: { where: { isPublic: true }, include: { mediaAsset: true } },
} satisfies Prisma.PropertyInclude;

export type PublicProperty = Prisma.PropertyGetPayload<{ include: typeof propertyInclude }>;

export async function listPublishedProperties(): Promise<PublicProperty[]> {
  return db.property.findMany({
    where: { status: { in: ["PUBLISHED"] }, deletedAt: null },
    orderBy: [{ curatedOrder: "asc" }, { createdAt: "asc" }],
    include: propertyInclude,
  });
}

/** Public catalogue plus sold-out ones (still reachable, used for related/price evidence). */
export async function listPublicProperties(): Promise<PublicProperty[]> {
  return db.property.findMany({ where: { status: { in: PUBLIC_STATUSES }, deletedAt: null }, orderBy: [{ curatedOrder: "asc" }, { createdAt: "asc" }], include: propertyInclude });
}

export type PublicPropertyResult = { kind: "property"; property: PublicProperty } | { kind: "redirect"; to: string } | { kind: "missing" };

export async function getPublicProperty(slug: string): Promise<PublicPropertyResult> {
  const p = await db.property.findUnique({ where: { slug }, include: propertyInclude });
  if (p && !p.deletedAt && (PUBLIC_STATUSES.includes(p.status) || p.status === "ARCHIVED")) {
    return { kind: "property", property: p };
  }
  const r = await db.redirect.findUnique({ where: { fromPath: `/properties/${slug}` } });
  if (r) return { kind: "redirect", to: r.toPath };
  return { kind: "missing" };
}

export type SaveResult = { ok: true; id: string; slug: string } | { ok: false; errors: Record<string, string> };

export async function saveProperty(actor: Actor, id: string | null, raw: Record<string, unknown>): Promise<SaveResult> {
  assertCan(actor.role, "properties.edit");
  const parsed = propertyInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const before = id ? await db.property.findUniqueOrThrow({ where: { id } }) : null;

  // Changing commercial terms on an existing property is privileged (RBAC "Set prices").
  // Editors may draft a new property with a price; publishing it still needs an administrator.
  const priceChanged = before && (before.priceNaira !== d.priceNaira || before.depositPercent !== d.depositPercent || before.planMonths !== d.planMonths);
  if (priceChanged) assertCan(actor.role, "properties.price");

  const desired = d.slug ? slugify(d.slug) : slugify(d.name);
  const slug =
    before && before.slug === desired
      ? before.slug
      : await uniqueSlug(desired, async (s) => Boolean(await db.property.findFirst({ where: { slug: s, ...(id ? { NOT: { id } } : {}) } })));

  const refTaken = await db.property.findFirst({ where: { reference: d.reference, ...(id ? { NOT: { id } } : {}) } });
  if (refTaken) return { ok: false, errors: { reference: `Reference ${d.reference} is already used by ${refTaken.name}.` } };

  const data = {
    name: d.name,
    slug,
    reference: d.reference,
    corridor: d.corridor,
    locationText: d.locationText,
    titleType: d.titleType,
    titleLabel: d.titleLabel || null,
    titleDocRef: d.titleDocRef || null,
    sizeText: d.sizeText || null,
    sizeSqm: d.sizeSqm,
    priceNaira: d.priceNaira,
    priceUnit: d.priceUnit || null,
    depositPercent: d.depositPercent,
    planMonths: d.planMonths,
    allocationText: d.allocationText || null,
    appreciationNote: d.appreciationNote || null,
    blurb: d.blurb || null,
    description: d.description ? toDescriptionHtml(d.description) : null,
    features: d.features,
    badges: d.badges,
    currencies: d.currencies.length ? d.currencies : ["NGN"],
    availability: d.availability,
    featured: d.featured,
    featuredOrder: d.featured ? d.featuredOrder : null,
    curatedOrder: d.curatedOrder,
    heroBrief: d.heroBrief || null,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
  } satisfies Prisma.PropertyUncheckedCreateInput;

  const saved = await db.$transaction(async (tx) => {
    const row = before ? await tx.property.update({ where: { id: before.id }, data }) : await tx.property.create({ data });
    if (before && before.slug !== slug) {
      const to = `/properties/${slug}`;
      // Collapse chains: every historic URL points straight at the current one.
      await tx.redirect.updateMany({ where: { toPath: `/properties/${before.slug}` }, data: { toPath: to } });
      await tx.redirect.deleteMany({ where: { fromPath: to } });
      await tx.redirect.upsert({ where: { fromPath: `/properties/${before.slug}` }, create: { fromPath: `/properties/${before.slug}`, toPath: to }, update: { toPath: to } });
    }
    await audit(actor, before ? "property.update" : "property.create", "Property", row.id, { before, after: row }, tx);
    return row;
  });
  return { ok: true, id: saved.id, slug: saved.slug };
}

export async function setPropertyStatus(actor: Actor, id: string, status: PropertyStatus) {
  assertCan(actor.role, "properties.publish");
  const before = await db.property.findUniqueOrThrow({ where: { id } });
  await db.property.update({
    where: { id },
    data: { status, publishedAt: status === "PUBLISHED" && !before.publishedAt ? new Date() : before.publishedAt, availability: status === "SOLD_OUT" ? "SOLD_OUT" : before.availability === "SOLD_OUT" ? "AVAILABLE" : before.availability },
  });
  await audit(actor, "property.status", "Property", id, { before: { status: before.status }, after: { status } });
}

export async function deleteProperty(actor: Actor, id: string) {
  assertCan(actor.role, "properties.publish");
  await db.property.update({ where: { id }, data: { deletedAt: new Date(), status: "ARCHIVED", featured: false } });
  await audit(actor, "property.delete", "Property", id);
}

export async function restoreProperty(actor: Actor, id: string) {
  assertCan(actor.role, "properties.publish");
  await db.property.update({ where: { id }, data: { deletedAt: null, status: "DRAFT" } });
  await audit(actor, "property.restore", "Property", id);
}

export async function duplicateProperty(actor: Actor, id: string) {
  assertCan(actor.role, "properties.edit");
  const p = await db.property.findUniqueOrThrow({ where: { id }, include: { media: true } });
  const slug = await uniqueSlug(`${p.slug}-copy`, async (s) => Boolean(await db.property.findUnique({ where: { slug: s } })));
  const { id: _i, createdAt: _c, updatedAt: _u, publishedAt: _p, media, ...rest } = p;
  const copy = await db.property.create({
    data: { ...rest, slug, name: `${p.name} (copy)`, reference: `${p.reference}-C${Date.now().toString(36).slice(-3).toUpperCase()}`, status: "DRAFT", featured: false, media: { create: media.map((m) => ({ mediaAssetId: m.mediaAssetId, order: m.order, role: m.role })) } },
  });
  await audit(actor, "property.duplicate", "Property", copy.id, { after: { from: id } });
  return copy;
}

export async function setPropertyMedia(actor: Actor, propertyId: string, mediaIds: string[]) {
  assertCan(actor.role, "properties.edit");
  const assets = await db.mediaAsset.findMany({ where: { id: { in: mediaIds }, deletedAt: null } });
  const missingAlt = assets.filter((a) => !a.alt?.trim());
  if (missingAlt.length) {
    return { ok: false as const, message: `Add alt text to ${missingAlt.map((a) => a.filename).join(", ")} before using ${missingAlt.length > 1 ? "them" : "it"} on a public page.` };
  }
  await db.$transaction([
    db.propertyMedia.deleteMany({ where: { propertyId } }),
    ...mediaIds.filter((m) => assets.some((a) => a.id === m)).map((mediaAssetId, order) => db.propertyMedia.create({ data: { propertyId, mediaAssetId, order, role: order === 0 ? "hero" : "gallery" } })),
  ]);
  await audit(actor, "property.media", "Property", propertyId, { after: { mediaIds } });
  return { ok: true as const };
}
