import Link from "next/link";
import { db } from "@/lib/db";
import { getAllContent } from "@/server/services/content";
import { listPublishedProperties } from "@/server/services/properties";
import { listPublicPosts } from "@/server/services/posts";
import { selectFeatured } from "@/lib/properties/selection";
import { toPropertyCard, toArticleCard, imageFromUrl } from "@/server/queries/mappers";
import { assetsByUrl, getSiteChrome } from "@/server/queries/site";
import { PropertyCard } from "@/components/marketing/PropertyCard";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { StatCounter } from "@/components/marketing/StatCounter";
import { TestimonialCarousel } from "@/components/marketing/TestimonialCarousel";
import { SiteImage } from "@/components/ui/SiteImage";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { OpenModalButton } from "@/components/layout/SiteProvider";
import { Eyebrow, SectionHead, CheckList, CtaBand, FeatureGrid, JourneySteps, Paragraphs } from "@/components/sections";
import { HeroVideo } from "@/components/marketing/HeroVideo";

export const revalidate = 60;

export default async function HomePage() {
  const [c, properties, posts, testimonials, chrome] = await Promise.all([
    getAllContent(["home.hero", "home.stats", "home.trustStrip", "home.about", "home.why", "home.featured", "home.journey", "home.twoSolutions", "home.solar", "home.insights", "home.testimonials"]),
    listPublishedProperties(),
    listPublicPosts({ take: 3 }),
    db.testimonial.findMany({ where: { published: true }, orderBy: { order: "asc" } }),
    getSiteChrome(),
  ]);
  const hero = c["home.hero"];
  const assets = await assetsByUrl([hero.image, c["home.about"].image, c["home.solar"].image, chrome.content["site.cta"].image]);
  const featured = selectFeatured(properties, 3);
  const strip = c["home.trustStrip"].items;
  const two = c["home.twoSolutions"];

  return (
    <>
      <section className="hero">
        <div className="hero-bg">
          <SiteImage image={imageFromUrl(hero.image, assets, hero.imageBrief)} brief={hero.imageBrief} meta="1920×1080 min" full priority />
          {hero.video && <HeroVideo src={hero.video} />}
        </div>
        <div className="hero-veil" />
        <div className="wrap">
          <div className="hero-in">
            <Eyebrow meta={hero.eyebrowMeta}>{hero.eyebrow}</Eyebrow>
            <h1>
              {hero.headline}
              <em className="gold-text">{hero.headlineAccent}</em>
            </h1>
            <p className="lede">{hero.lede}</p>
            <div className="hero-cta">
              <Button variant="gold" href="/properties">
                {hero.primaryLabel}
              </Button>
              <OpenModalButton kind="booking">{hero.secondaryLabel}</OpenModalButton>
              <OpenModalButton kind="advisor" className="btn btn-ghost">
                {hero.tertiaryLabel}
              </OpenModalButton>
            </div>
            <div className="hero-facts">
              {c["home.stats"].items.map((s) => (
                <StatCounter key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {strip.length > 0 && (
        <div className="strip" tabIndex={0} aria-label="What we verify">
          <div className="strip-track">
            {[0, 1].map((dup) =>
              strip.map((s, i) => (
                <div className="strip-item" key={`${dup}-${i}`} aria-hidden={dup === 1 ? "true" : undefined}>
                  <b aria-hidden="true">◆</b>
                  {s}
                </div>
              )),
            )}
          </div>
        </div>
      )}

      <section className="sec">
        <div className="wrap">
          <div className="split">
            <div className="rv">
              <Eyebrow meta="/ 01">{c["home.about"].eyebrow}</Eyebrow>
              <h2 style={{ fontSize: "var(--fs-h2)", marginBottom: "1.4rem" }}>{c["home.about"].headline}</h2>
              <Paragraphs items={c["home.about"].paragraphs} />
              <CheckList items={c["home.about"].checks} />
              <Button href="/about">{c["home.about"].ctaLabel}</Button>
            </div>
            <div className="panel brackets rv">
              <SiteImage image={imageFromUrl(c["home.about"].image, assets, c["home.about"].imageBrief)} brief={c["home.about"].imageBrief} meta="Square · 1200×1200 min" ratio="1/1" />
              {c["home.about"].caption && (
                <>
                  <div className="rule" style={{ marginTop: "1.4rem" }} />
                  <p className="mono" style={{ marginTop: "1rem", fontSize: ".62rem", letterSpacing: ".16em", color: "var(--ink-3)", textTransform: "uppercase" }}>
                    {c["home.about"].caption}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec-tight">
        <div className="wrap">
          <SectionHead eyebrow={c["home.why"].eyebrow} title={c["home.why"].headline} />
          <FeatureGrid items={c["home.why"].items} columns={4} />
        </div>
      </section>

      {featured.length > 0 && (
        <section className="sec sec-tight">
          <div className="wrap">
            <SectionHead eyebrow={c["home.featured"].eyebrow} title={c["home.featured"].headline} lede={c["home.featured"].lede} action={<Button href="/properties">{c["home.featured"].ctaLabel}</Button>} />
            <div className="plots">
              {featured.map((p) => (
                <PropertyCard key={p.id} property={toPropertyCard(p)} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="sec sec-tight">
        <div className="wrap">
          <SectionHead eyebrow={c["home.journey"].eyebrow} title={c["home.journey"].headline} />
          <JourneySteps items={c["home.journey"].items} />
        </div>
      </section>

      <section className="sec sec-tight">
        <div className="wrap">
          <div className="duo rv">
            <Eyebrow center>{two.eyebrow}</Eyebrow>
            <h2>{two.headline}</h2>
            <p className="sub">{two.subheadline}</p>
            <div className="duo-pillars">
              {two.pillars.map((p, i) => (
                <span className="duo-pillar" key={p}>
                  <Icon name={i === 0 ? "home" : "sun"} />
                  {p}
                </span>
              ))}
            </div>
            <p className="lede">{two.body}</p>
            <p className="tagline gold-text">{two.tagline}</p>
          </div>
        </div>
      </section>

      <section className="sec sec-tight">
        <div className="wrap">
          <div className="split rev">
            <div className="panel brackets flush rv">
              <SiteImage image={imageFromUrl(c["home.solar"].image, assets, c["home.solar"].imageBrief)} brief={c["home.solar"].imageBrief} meta="5:4 · 1400×1120 min" ratio="5/4" />
            </div>
            <div className="rv">
              <Eyebrow meta="/ 05">{c["home.solar"].eyebrow}</Eyebrow>
              <h2 style={{ fontSize: "var(--fs-h2)", marginBottom: "1.3rem" }}>{c["home.solar"].headline}</h2>
              <p className="lede">{c["home.solar"].lede}</p>
              <CheckList items={c["home.solar"].checks} />
              <Button href="/services">{c["home.solar"].ctaLabel}</Button>
            </div>
          </div>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="sec sec-tight">
          <div className="wrap">
            <SectionHead eyebrow={c["home.insights"].eyebrow} title={c["home.insights"].headline} lede={c["home.insights"].lede} action={<Button href="/insights">{c["home.insights"].ctaLabel}</Button>} />
            <div className="posts">
              {posts.map((p) => (
                <ArticleCard key={p.id} post={toArticleCard(p)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="sec sec-tight">
          <div className="wrap">
            <Eyebrow center>{c["home.testimonials"].eyebrow}</Eyebrow>
            <TestimonialCarousel items={testimonials.map((t) => ({ id: t.id, name: t.name, roleText: t.roleText, quote: t.quote, initials: t.initials, videoUrl: t.videoUrl }))} />
            {chrome.settings.googleReviewsUrl && (
              <p style={{ textAlign: "center", marginTop: "1.6rem" }}>
                <Link href={chrome.settings.googleReviewsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                  Read our Google reviews →
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      <CtaBand copy={chrome.content["site.cta"]} image={imageFromUrl(chrome.content["site.cta"].image, assets)} />
    </>
  );
}
