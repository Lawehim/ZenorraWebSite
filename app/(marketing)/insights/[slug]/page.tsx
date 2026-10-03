import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";
import { getContent } from "@/server/services/content";
import { getPublicPost, listPublicPosts } from "@/server/services/posts";
import { relatedPosts } from "@/lib/posts";
import { toArticleCard, imageFromAsset } from "@/server/queries/mappers";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { ArticleView } from "@/components/marketing/ArticleView";
import { Eyebrow } from "@/components/sections";
import { ShareButtons } from "@/components/marketing/ShareButtons";
import { ReadingProgress } from "@/components/marketing/ReadingProgress";
import { JsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const revalidate = 60;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPublicPost((await params).slug);
  if (!p) return { title: "Article not found" };
  const img = imageFromAsset(p.coverMedia, p.title);
  return {
    title: p.seoTitle || p.title,
    description: p.seoDescription || p.excerpt || undefined,
    alternates: { canonical: `/insights/${p.slug}` },
    openGraph: { type: "article", title: p.title, description: p.excerpt ?? undefined, publishedTime: p.publishedAt?.toISOString(), images: img ? [{ url: img.src, alt: img.alt }] : [{ url: "/brand/lockup.webp" }] },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) {
    const r = await db.redirect.findUnique({ where: { fromPath: `/insights/${slug}` } });
    if (r) permanentRedirect(r.toPath);
    notFound();
  }
  const [cta, all] = await Promise.all([getContent("insights.articleCta"), listPublicPosts()]);
  const more = relatedPosts(post, all, 3);
  const author = post.authorName || "Zenorra Advisory";
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Insights", path: "/insights" }, { name: post.title, path: `/insights/${post.slug}` }]} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          datePublished: post.publishedAt?.toISOString(),
          dateModified: post.updatedAt.toISOString(),
          author: { "@type": "Organization", name: author },
          publisher: { "@type": "Organization", name: "Zenorra Limited", logo: { "@type": "ImageObject", url: `${APP_URL}/brand/lockup.webp` } },
          mainEntityOfPage: `${APP_URL}/insights/${post.slug}`,
        }}
      />
      <ReadingProgress />
      <ArticleView share={<ShareButtons url={`${APP_URL}/insights/${post.slug}`} title={post.title} />} title={post.title} category={post.category?.name ?? null} publishedAt={post.publishedAt} readingMinutes={post.readingMinutes} author={author} bodyHtml={post.bodyHtml ?? ""} cover={imageFromAsset(post.coverMedia, post.title)} cta={cta} />
      {more.length > 0 && (
        <section className="sec sec-tight">
          <div className="wrap">
            <div className="head">
              <div>
                <Eyebrow>Keep reading</Eyebrow>
                <h2>{cta.moreHeading}</h2>
              </div>
            </div>
            <div className="posts">
              {more.map((p) => (
                <ArticleCard key={p.id} post={toArticleCard(p)} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
