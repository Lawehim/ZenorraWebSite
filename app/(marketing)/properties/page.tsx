import type { Metadata } from "next";
import { getContent } from "@/server/services/content";
import { listPublishedProperties } from "@/server/services/properties";
import { applyFilters, sortProperties, parseFilters, hasActiveFilters } from "@/lib/properties/filters";
import { toPropertyCard, imageFromUrl } from "@/server/queries/mappers";
import { assetsByUrl, getSiteChrome } from "@/server/queries/site";
import { PropertyCard } from "@/components/marketing/PropertyCard";
import { PropertyFilters } from "@/components/marketing/PropertyFilters";
import { PageHeader, CtaBand } from "@/components/sections";
import { Button } from "@/components/ui/Button";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("properties.header");
  // Filtered views canonicalise to the unfiltered catalogue (FR-SEO-006).
  return { title: c.seoTitle || c.headline, description: c.seoDescription || c.lede, alternates: { canonical: "/properties" } };
}

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const [c, all, chrome] = await Promise.all([getContent("properties.header"), listPublishedProperties(), getSiteChrome()]);
  const assets = await assetsByUrl([c.image, chrome.content["site.cta"].image]);
  const list = sortProperties(applyFilters(all, filters), filters.sort);

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Properties", path: "/properties" }]} />
      <PageHeader crumbs={[{ label: "Home", href: "/" }, { label: "Properties" }]} title={c.headline} lede={c.lede} image={imageFromUrl(c.image, assets)} brief={c.imageBrief} />
      <section className="sec" style={{ paddingTop: "clamp(3rem,5vw,4.5rem)" }}>
        <div className="wrap">
          <PropertyFilters filters={filters} total={all.length} shown={list.length} />
          {list.length ? (
            <div className="plots">
              {list.map((p) => (
                <PropertyCard key={p.id} property={toPropertyCard(p)} />
              ))}
            </div>
          ) : (
            <div className="empty" role="status">
              <span>{all.length ? c.emptyMessage : "New estates are being verified and will be listed here soon."}</span>
              {hasActiveFilters(filters) && (
                <Button href="/properties" variant="line" size="sm">
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
      <CtaBand copy={chrome.content["site.cta"]} image={imageFromUrl(chrome.content["site.cta"].image, assets)} />
    </>
  );
}
