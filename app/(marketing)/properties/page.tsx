import type { Metadata } from "next";
import Link from "next/link";
import { getContent } from "@/server/services/content";
import { listPublishedProperties } from "@/server/services/properties";
import { applyFilters, sortProperties, parseFilters, hasActiveFilters, serialiseFilters } from "@/lib/properties/filters";
import { matchesSearch, normaliseSearch, paginate } from "@/lib/properties/search";
import { toPropertyCard, imageFromUrl } from "@/server/queries/mappers";
import { assetsByUrl, getSiteChrome } from "@/server/queries/site";
import { PropertyCard } from "@/components/marketing/PropertyCard";
import { PropertyFilters } from "@/components/marketing/PropertyFilters";
import { PageHeader, CtaBand } from "@/components/sections";
import { Button } from "@/components/ui/Button";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const revalidate = 60;
const PAGE_SIZE = 24;
type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const c = await getContent("properties.header");
  const page = Number(first((await searchParams).page)) || 1;
  // Filtered views canonicalise to the unfiltered catalogue (FR-SEO-006); paged views to themselves.
  return { title: c.seoTitle || c.headline, description: c.seoDescription || c.lede, alternates: { canonical: page > 1 ? `/properties?page=${page}` : "/properties" } };
}

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const q = normaliseSearch(first(sp.q) ?? "");
  const [c, all, chrome] = await Promise.all([getContent("properties.header"), listPublishedProperties(), getSiteChrome()]);
  const assets = await assetsByUrl([c.image, chrome.content["site.cta"].image]);
  const list = sortProperties(applyFilters(all, filters).filter((p) => matchesSearch(p, q)), filters.sort);
  const pg = paginate(list, Number(first(sp.page)) || 1, PAGE_SIZE);
  const base = [serialiseFilters(filters), q ? `q=${encodeURIComponent(q)}` : ""].filter(Boolean).join("&");
  const pageHref = (n: number) => `/properties?${[base, n > 1 ? `page=${n}` : ""].filter(Boolean).join("&")}`.replace(/\?$/, "");

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Properties", path: "/properties" }]} />
      {pg.hasPrev && <link rel="prev" href={pageHref(pg.page - 1)} />}
      {pg.hasNext && <link rel="next" href={pageHref(pg.page + 1)} />}
      <PageHeader crumbs={[{ label: "Home", href: "/" }, { label: "Properties" }]} title={c.headline} lede={c.lede} image={imageFromUrl(c.image, assets)} brief={c.imageBrief} />
      <section className="sec" style={{ paddingTop: "clamp(3rem,5vw,4.5rem)" }}>
        <div className="wrap">
          <form className="search-row" role="search" action="/properties">
            <label htmlFor="q" className="sr-only">
              Search estates
            </label>
            <input id="q" name="q" className="inp" defaultValue={q} placeholder="Search by estate, area or feature — e.g. Epe, dry land" maxLength={80} />
            {filters.corridor && <input type="hidden" name="corridor" value={filters.corridor} />}
            {filters.budget && <input type="hidden" name="budget" value={filters.budget} />}
            {filters.sort !== "curated" && <input type="hidden" name="sort" value={filters.sort} />}
            <button className="btn btn-line btn-sm" type="submit">
              Search
            </button>
            <Link className="btn btn-ghost btn-sm" href="/shortlist">
              My shortlist
            </Link>
          </form>
          <PropertyFilters filters={filters} total={all.length} shown={list.length} />
          {pg.items.length ? (
            <div className="plots">
              {pg.items.map((p) => (
                <PropertyCard key={p.id} property={toPropertyCard(p)} />
              ))}
            </div>
          ) : (
            <div className="empty" role="status">
              <span>{all.length ? (q ? `Nothing matches “${q}”.` : c.emptyMessage) : "New estates are being verified and will be listed here soon."}</span>
              {(hasActiveFilters(filters) || q) && (
                <Button href="/properties" variant="line" size="sm">
                  Clear filters
                </Button>
              )}
            </div>
          )}
          {pg.pages > 1 && (
            <nav className="pager-links" aria-label="Pages">
              {pg.hasPrev && (
                <Link className="btn btn-line btn-sm" href={pageHref(pg.page - 1)} rel="prev">
                  ← Previous
                </Link>
              )}
              <span>
                Page {pg.page} of {pg.pages}
              </span>
              {pg.hasNext && (
                <Link className="btn btn-line btn-sm" href={pageHref(pg.page + 1)} rel="next">
                  Next →
                </Link>
              )}
            </nav>
          )}
        </div>
      </section>
      <CtaBand copy={chrome.content["site.cta"]} image={imageFromUrl(chrome.content["site.cta"].image, assets)} />
    </>
  );
}
