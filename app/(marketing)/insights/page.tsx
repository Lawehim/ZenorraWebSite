import type { Metadata } from "next";
import Link from "next/link";
import { getContent } from "@/server/services/content";
import { listPublicPosts, listCategories } from "@/server/services/posts";
import { toArticleCard, imageFromUrl } from "@/server/queries/mappers";
import { assetsByUrl, getSiteChrome } from "@/server/queries/site";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { PageHeader, CtaBand } from "@/components/sections";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("insights.header");
  return { title: c.seoTitle || c.headline, description: c.seoDescription || c.lede, alternates: { canonical: "/insights", types: { "application/rss+xml": "/insights/rss.xml" } } };
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const [c, cats, chrome] = await Promise.all([getContent("insights.header"), listCategories(), getSiteChrome()]);
  const active = cats.find((x) => x.slug === category)?.slug;
  const posts = await listPublicPosts({ categorySlug: active });
  const assets = await assetsByUrl([c.image, chrome.content["site.cta"].image]);
  const [lead, ...rest] = posts;
  return (
    <>
      <PageHeader crumbs={[{ label: "Home", href: "/" }, { label: "Insights" }]} title={c.headline} lede={c.lede} image={imageFromUrl(c.image, assets)} brief={c.imageBrief} />
      <section className="sec">
        <div className="wrap">
          {cats.length > 1 && (
            <nav className="filters" aria-label="Article categories">
              <Link className="chip" href="/insights" aria-current={!active ? "true" : undefined}>
                All
              </Link>
              {cats.map((x) => (
                <Link key={x.id} className="chip" href={`/insights?category=${x.slug}`} aria-current={active === x.slug ? "true" : undefined}>
                  {x.name}
                </Link>
              ))}
            </nav>
          )}
          {lead ? (
            <>
              <ArticleCard post={toArticleCard(lead)} featured />
              <div className="posts">
                {rest.map((p) => (
                  <ArticleCard key={p.id} post={toArticleCard(p)} />
                ))}
              </div>
            </>
          ) : (
            <p className="empty">No articles published yet.</p>
          )}
        </div>
      </section>
      <CtaBand copy={chrome.content["site.cta"]} image={imageFromUrl(chrome.content["site.cta"].image, assets)} />
    </>
  );
}
