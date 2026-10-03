import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getContent } from "@/server/services/content";
import { getPublicProperty, listPublicProperties } from "@/server/services/properties";
import { relatedProperties } from "@/lib/properties/selection";
import { TITLE_LABELS } from "@/lib/properties/filters";
import { formatNaira, monthlyInstalment, depositAmount } from "@/lib/format";
import { sanitizeRichHtml } from "@/lib/richtext/sanitize";
import { toPropertyCard, imageFromAsset } from "@/server/queries/mappers";
import { getSiteChrome } from "@/server/queries/site";
import { whatsappLink } from "@/lib/whatsapp";
import { PropertyCard, AvailabilityTag } from "@/components/marketing/PropertyCard";
import { Gallery } from "@/components/marketing/Gallery";
import { TitleTerm } from "@/components/marketing/TitleTerm";
import { NotifyNextPhase } from "@/components/forms/NotifyNextPhase";
import { SiteImage } from "@/components/ui/SiteImage";
import { OpenModalButton } from "@/components/layout/SiteProvider";
import { Breadcrumbs, CheckList, Eyebrow } from "@/components/sections";
import { ShortlistButton } from "@/components/marketing/ShortlistButton";
import { MapEmbed } from "@/components/marketing/MapEmbed";
import { PropertyEnquiry } from "@/components/forms/PropertyEnquiry";
import { indicativePrices } from "@/lib/fx";
import { JsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const revalidate = 60;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await getPublicProperty((await params).slug);
  if (r.kind !== "property") return { title: "Property not found" };
  const p = r.property;
  const hero = imageFromAsset((p.media.find((m) => m.role === "hero") ?? p.media[0])?.mediaAsset);
  const title = p.seoTitle || `${p.name} — ${p.locationText}`;
  const description = p.seoDescription || `${p.name}, ${p.locationText}. ${formatNaira(p.priceNaira)} ${p.priceUnit ?? ""}. ${p.blurb ?? ""}`.trim().slice(0, 155);
  return {
    title,
    description,
    alternates: { canonical: `/properties/${p.slug}` },
    openGraph: { title: `${p.name} · ${formatNaira(p.priceNaira)}`, description, images: hero ? [{ url: hero.src, alt: hero.alt }] : [{ url: "/brand/lockup.webp" }] },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  const r = await getPublicProperty(slug);
  if (r.kind === "redirect") permanentRedirect(r.to);
  if (r.kind === "missing") notFound();
  const p = r.property;
  const [copy, all, chrome] = await Promise.all([getContent("properties.detail"), listPublicProperties(), getSiteChrome()]);

  const soldOut = p.status === "SOLD_OUT" || p.status === "ARCHIVED" || p.availability === "SOLD_OUT";
  const related = relatedProperties(p, all.filter((x) => x.status === "PUBLISHED"), 3);
  const hero = p.media.find((m) => m.role === "hero") ?? p.media[0];
  const gallery = p.media.filter((m) => m.mediaAsset && !m.mediaAsset.deletedAt).map((m) => imageFromAsset(m.mediaAsset, p.name)!).filter(Boolean);
  const monthly = p.planMonths > 1 ? monthlyInstalment(p.priceNaira, p.depositPercent, p.planMonths) : null;
  const titleLabel = p.titleLabel || TITLE_LABELS[p.titleType];
  const activePhase = p.phases.find((ph) => ph.status === "SELLING");
  const pastPhases = p.phases.filter((ph) => ph.status !== "SELLING");
  const settings = chrome.settings;

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Properties", path: "/properties" }, { name: p.name, path: `/properties/${p.slug}` }]} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "RealEstateListing",
          name: p.name,
          url: `${APP_URL}/properties/${p.slug}`,
          description: p.blurb ?? undefined,
          image: gallery.map((g) => `${APP_URL}${g.src}`),
          offers: { "@type": "Offer", price: p.priceNaira.toString(), priceCurrency: "NGN", availability: soldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock" },
          address: { "@type": "PostalAddress", addressLocality: p.locationText, addressCountry: "NG" },
        }}
      />
      <section className="pd-hero" data-property-ref={p.reference} data-property-name={p.name}>
        <SiteImage image={imageFromAsset(hero?.mediaAsset, p.name)} brief={p.heroBrief || "Estate hero photograph"} meta="1920×900 min" full priority />
        <div className="veil" />
        <div className="wrap">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Properties", href: "/properties" }, { label: p.name }]} />
          <div className="plot-tags" style={{ position: "static", marginBottom: "1rem" }}>
            <AvailabilityTag availability={p.availability} status={p.status} />
            {p.badges.map((b) => (
              <span className="tag" key={b}>
                {b}
              </span>
            ))}
          </div>
          <h1>{p.name}</h1>
          <div style={{ marginTop: ".8rem", display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
            <ShortlistButton slug={p.slug} name={p.name} variant="inline" />
            <a className="btn btn-ghost btn-sm" href={`/compare?slugs=${p.slug}`}>
              Compare
            </a>
          </div>
          <p className="mono" style={{ color: "var(--ink-2)", fontSize: ".8rem", letterSpacing: ".14em", marginTop: ".6rem" }}>
            {p.reference} · {p.locationText.toUpperCase()}
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="pd-grid">
            <div>
              {p.blurb && <p style={{ fontSize: "1.15rem", lineHeight: 1.7, marginBottom: "1.4rem" }}>{p.blurb}</p>}
              {p.description && <div className="article" style={{ maxWidth: "none" }} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(p.description.startsWith("<") ? p.description : `<p>${p.description}</p>`) }} />}
              <dl className="spec">
                {p.sizeText && (
                  <div>
                    <dt>Plot size</dt>
                    <dd>{p.sizeText}</dd>
                  </div>
                )}
                <div>
                  <dt>Title</dt>
                  <dd>
                    <TitleTerm type={p.titleType} label={titleLabel} />
                  </dd>
                </div>
                {p.planMonths > 0 && (
                  <div>
                    <dt>Payment plan</dt>
                    <dd>Up to {p.planMonths} months</dd>
                  </div>
                )}
                {p.appreciationNote && (
                  <div>
                    <dt>Appreciation</dt>
                    <dd>{p.appreciationNote}</dd>
                  </div>
                )}
              </dl>
              {p.appreciationNote && <p className="disclaimer">{copy.appreciationDisclaimer}</p>}

              {p.features.length > 0 && (
                <>
                  <h2 style={{ fontSize: "1.5rem", margin: "2.4rem 0 1.2rem" }}>{copy.featuresHeading}</h2>
                  <CheckList items={p.features} style={{ marginTop: 0 }} />
                </>
              )}

              {gallery.length > 0 && <Gallery images={gallery} title={p.name} />}

              {pastPhases.length > 0 && (
                <div style={{ marginTop: "2.4rem" }}>
                  <Eyebrow>Price history by phase</Eyebrow>
                  <dl className="spec">
                    {pastPhases.map((ph) => (
                      <div key={ph.id}>
                        <dt>
                          {ph.name} · {ph.status === "SOLD_OUT" ? "sold out" : ph.status.toLowerCase()}
                        </dt>
                        <dd>{formatNaira(ph.priceNaira)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {p.documents.length > 0 && (
                <ul className="docs">
                  {p.documents.map((d) => (
                    <li key={d.id}>
                      <a href={`/media/${d.mediaAsset.key}`} download>
                        {d.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <aside className="side" aria-label="Price and payment plan">
              {soldOut ? (
                <>
                  <h2 style={{ fontSize: "1.4rem", marginBottom: ".6rem" }}>{copy.soldOutHeadline}</h2>
                  <p className="muted" style={{ fontSize: ".9rem", marginBottom: "1.2rem" }}>
                    {copy.soldOutBody}
                  </p>
                  <NotifyNextPhase propertySlug={p.slug} />
                </>
              ) : (
                <>
                  <div className="price">
                    {p.priceUnit && <small>{p.priceUnit}</small>}
                    {formatNaira(activePhase?.priceNaira ?? p.priceNaira)}
                  </div>
                  {activePhase && <p style={{ fontSize: ".8rem", color: "var(--ink-3)" }}>{activePhase.name} pricing</p>}
                  {settings.fx.enabled && indicativePrices(activePhase?.priceNaira ?? p.priceNaira, settings.fx).length > 0 && (
                    <p className="fx">
                      Indicative: <b>{indicativePrices(activePhase?.priceNaira ?? p.priceNaira, settings.fx).map((x) => x.label).join(" · ")}</b>
                      <br />
                      Rates as of {settings.fx.asOf}. Naira is the contractual price.
                    </p>
                  )}
                  <p style={{ fontSize: ".85rem", color: "var(--ink-3)" }}>Initial deposit from {formatNaira(depositAmount(p.priceNaira, p.depositPercent))} ({p.depositPercent}%)</p>
                  <div className="pay">
                    {p.planMonths > 0 && (
                      <div className="payrow">
                        <span>Instalment plan</span>
                        <b>{p.planMonths} months</b>
                      </div>
                    )}
                    {monthly && (
                      <div className="payrow">
                        <span>Monthly</span>
                        <b>{formatNaira(monthly)} / month</b>
                      </div>
                    )}
                    <div className="payrow">
                      <span>Allocation</span>
                      <b>{p.allocationText || copy.allocationDefault}</b>
                    </div>
                    <div className="payrow">
                      <span>Currencies</span>
                      <b>{p.currencies.join(" · ")}</b>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: ".6rem", marginTop: "1.6rem" }}>
                    <OpenModalButton kind="booking" propertySlug={p.slug} className="btn btn-gold">
                      Book an inspection
                    </OpenModalButton>
                    <OpenModalButton kind="advisor" propertySlug={p.slug}>
                      Ask an advisor
                    </OpenModalButton>
                    <a className="btn btn-ghost" href={whatsappLink(settings.whatsappNumber, `Hello Zenorra, I'm interested in ${p.name} (${p.reference}). ${APP_URL}/properties/${p.slug}`)} target="_blank" rel="noopener noreferrer">
                      WhatsApp us about this estate
                    </a>
                  </div>
                </>
              )}
              <div className="rule" style={{ margin: "1.6rem 0" }} />
              <p style={{ fontSize: ".82rem", color: "var(--ink-3)" }}>{copy.diasporaNote}</p>
            </aside>
          </div>
        </div>
      </section>

      {!soldOut && (
        <section className="sec sec-tight">
          <div className="wrap">
            <div className="split" style={{ alignItems: "start" }}>
              <div>
                <Eyebrow>Ask about this estate</Eyebrow>
                <h2 style={{ fontSize: "var(--fs-h2)", marginBottom: "1.2rem" }}>Enquire about {p.name}</h2>
                <PropertyEnquiry slug={p.slug} name={p.name} corridor={p.corridor} />
              </div>
              <div>
                <Eyebrow>Location</Eyebrow>
                <p className="muted" style={{ marginBottom: "1rem" }}>{p.locationText}</p>
                <MapEmbed query={p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : p.locationText} label={p.name} />
              </div>
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="sec sec-tight">
          <div className="wrap">
            <div className="head">
              <div>
                <Eyebrow>Also available</Eyebrow>
                <h2>{copy.relatedHeading}</h2>
              </div>
            </div>
            <div className="plots">
              {related.map((x) => (
                <PropertyCard key={x.id} property={toPropertyCard(x)} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
