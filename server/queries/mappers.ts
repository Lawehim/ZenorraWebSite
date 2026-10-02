// Prisma rows → serialisable view models for components (bigint → string, media → srcsets).
import type { MediaAsset } from "@prisma/client";
import type { ImageSource } from "@/components/ui/SiteImage";
import type { PropertyCardData } from "@/components/marketing/PropertyCard";
import type { ArticleCardData } from "@/components/marketing/ArticleCard";
import { TITLE_LABELS } from "@/lib/properties/filters";
import type { PublicProperty } from "@/server/services/properties";
import type { PublicPost } from "@/server/services/posts";
import type { Derivative } from "@/server/services/media";

export function imageFromAsset(a: MediaAsset | null | undefined, fallbackAlt = ""): ImageSource | null {
  if (!a || a.deletedAt) return null;
  const ds = (Array.isArray(a.derivatives) ? a.derivatives : []) as unknown as Derivative[];
  const set = (fmt: Derivative["format"]) =>
    ds
      .filter((d) => d.format === fmt)
      .sort((x, y) => x.width - y.width)
      .map((d) => `/media/${d.key} ${d.width}w`)
      .join(", ");
  const jpeg = ds.filter((d) => d.format === "jpeg").sort((x, y) => x.width - y.width);
  const src = jpeg.find((d) => d.width >= 1200) ?? jpeg.at(-1);
  return {
    src: src ? `/media/${src.key}` : `/media/${a.key}`,
    alt: a.alt ?? fallbackAlt,
    width: a.width,
    height: a.height,
    srcSet: set("webp") || undefined,
    avifSrcSet: set("avif") || undefined,
  };
}

/** Content blocks store a /media/<key> URL; resolve it to an ImageSource with srcsets. */
export function imageFromUrl(url: string | undefined, assets: Map<string, MediaAsset>, alt = ""): ImageSource | null {
  if (!url) return null;
  const key = url.replace(/^\/media\//, "");
  const asset = assets.get(key);
  return asset ? imageFromAsset(asset, alt) : { src: url, alt };
}

export function toPropertyCard(p: PublicProperty): PropertyCardData {
  const hero = p.media.find((m) => m.role === "hero") ?? p.media[0];
  return {
    slug: p.slug,
    reference: p.reference,
    name: p.name,
    locationText: p.locationText,
    priceNaira: p.priceNaira.toString(),
    priceUnit: p.priceUnit,
    depositPercent: p.depositPercent,
    planMonths: p.planMonths,
    sizeText: p.sizeText,
    titleLabel: p.titleLabel || TITLE_LABELS[p.titleType],
    availability: p.availability,
    status: p.status,
    badges: p.badges,
    image: imageFromAsset(hero?.mediaAsset, p.name),
    heroBrief: p.heroBrief,
  };
}

export function toArticleCard(p: PublicPost): ArticleCardData {
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category?.name ?? null,
    readingMinutes: p.readingMinutes,
    image: imageFromAsset(p.coverMedia, p.title),
  };
}

export function filterable(p: PublicProperty) {
  return { ...p, sizeSqm: p.sizeSqm, publishedAt: p.publishedAt };
}
