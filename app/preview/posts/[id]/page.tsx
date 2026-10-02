// Access-controlled, non-indexed preview rendered in the public template (FR-ADM-013, TC-ADM-009).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { getContent } from "@/server/services/content";
import { imageFromAsset } from "@/server/queries/mappers";
import { getSiteChrome } from "@/server/queries/site";
import { ArticleView } from "@/components/marketing/ArticleView";
import { SiteProvider } from "@/components/layout/SiteProvider";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PreviewPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageUser("posts.edit", `/preview/posts/${id}`);
  const post = await db.post.findUnique({ where: { id }, include: { category: true, coverMedia: true } });
  if (!post) notFound();
  const [cta, chrome] = await Promise.all([getContent("insights.articleCta"), getSiteChrome()]);
  return (
    <SiteProvider advisorCopy={chrome.content["site.advisor"]} bookingCopy={chrome.content["site.booking"]} properties={[]} departurePoints={chrome.settings.departurePoints} inspectionDates={[]}>
      <div className="toast" role="status" style={{ top: 12, bottom: "auto" }}>
        Preview — {post.status.toLowerCase()} · not visible to the public
      </div>
      <Header ctaLabel={chrome.content["site.nav"].ctaLabel} />
      <main>
        <ArticleView title={post.title} category={post.category?.name ?? null} publishedAt={post.publishedAt} readingMinutes={post.readingMinutes} author={post.authorName || "Zenorra Advisory"} bodyHtml={post.bodyHtml ?? ""} cover={imageFromAsset(post.coverMedia, post.title)} cta={cta} />
      </main>
    </SiteProvider>
  );
}
