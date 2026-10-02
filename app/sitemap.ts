// Regenerated on every request window; drafts, previews and admin are never listed (FR-SEO-004).
import type { MetadataRoute } from "next";
import { listPublicProperties } from "@/server/services/properties";
import { listPublicPosts } from "@/server/services/posts";
import { LEGAL_PAGES } from "@/lib/content/legal";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const [properties, posts] = await Promise.all([listPublicProperties(), listPublicPosts()]);
  const pages = ["", "/properties", "/services", "/about", "/insights", "/contact"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.8 }));
  return [
    ...pages,
    ...properties.map((p) => ({ url: `${base}/properties/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...posts.map((p) => ({ url: `${base}/insights/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...Object.keys(LEGAL_PAGES).map((s) => ({ url: `${base}/legal/${s}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
