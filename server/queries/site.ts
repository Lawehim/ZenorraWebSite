// Shared data for every public page: settings + site-wide copy, fetched once per request.
import { cache } from "react";
import { db } from "@/lib/db";
import { getSettings } from "@/server/services/settings";
import { getAllContent } from "@/server/services/content";
import type { MediaAsset } from "@prisma/client";

export const getSiteChrome = cache(async () => {
  const [settings, content, properties] = await Promise.all([
    getSettings(),
    getAllContent(["site.nav", "site.cta", "site.footer", "site.advisor", "site.booking", "site.rail", "site.notFound"]),
    db.property.findMany({ where: { status: "PUBLISHED", deletedAt: null }, select: { slug: true, name: true, reference: true }, orderBy: { curatedOrder: "asc" } }),
  ]);
  return { settings, content, bookableProperties: properties };
});

export type SiteChrome = Awaited<ReturnType<typeof getSiteChrome>>;

/** Load media assets referenced by URL inside content blocks, keyed by storage key. */
export async function assetsByUrl(urls: (string | undefined)[]): Promise<Map<string, MediaAsset>> {
  const keys = urls.filter((u): u is string => !!u && u.startsWith("/media/")).map((u) => u.slice(7));
  if (!keys.length) return new Map();
  const assets = await db.mediaAsset.findMany({ where: { key: { in: keys }, deletedAt: null } });
  return new Map(assets.map((a) => [a.key, a]));
}
