// RSS 2.0 feed of published articles (FR-CONT-010).
import { listPublicPosts } from "@/server/services/posts";
import { escapeHtml } from "@/lib/richtext/sanitize";

export const revalidate = 300;

export async function GET() {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const posts = await listPublicPosts({ take: 50 });
  const items = posts
    .map(
      (p) => `<item><title>${escapeHtml(p.title)}</title><link>${base}/insights/${p.slug}</link><guid isPermaLink="true">${base}/insights/${p.slug}</guid>${p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ""}${p.category ? `<category>${escapeHtml(p.category.name)}</category>` : ""}<description>${escapeHtml(p.excerpt ?? "")}</description></item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Zenorra Insights</title><link>${base}/insights</link><atom:link href="${base}/insights/rss.xml" rel="self" type="application/rss+xml"/><description>Plain-language guidance on Nigerian land, property and solar energy.</description><language>en-ng</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
