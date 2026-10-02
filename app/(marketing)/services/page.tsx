import type { Metadata } from "next";
import { getAllContent, getContent } from "@/server/services/content";
import { imageFromUrl } from "@/server/queries/mappers";
import { assetsByUrl, getSiteChrome } from "@/server/queries/site";
import { SiteImage } from "@/components/ui/SiteImage";
import { OpenModalButton } from "@/components/layout/SiteProvider";
import { PageHeader, CtaBand, Eyebrow, CheckList } from "@/components/sections";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("services.header");
  return { title: c.seoTitle || c.headline, description: c.seoDescription || c.lede, alternates: { canonical: "/services" } };
}

export default async function ServicesPage() {
  const [c, chrome] = await Promise.all([getAllContent(["services.header", "services.pillars"]), getSiteChrome()]);
  const h = c["services.header"];
  const pillars = c["services.pillars"].items;
  const assets = await assetsByUrl([h.image, chrome.content["site.cta"].image, ...pillars.map((p) => p.image)]);
  return (
    <>
      <PageHeader crumbs={[{ label: "Home", href: "/" }, { label: "Services" }]} title={h.headline} lede={h.lede} image={imageFromUrl(h.image, assets)} brief={h.imageBrief} />
      <section className="sec">
        <div className="wrap">
          {pillars.map((s, i) => (
            <div key={s.title} className={`split${i % 2 ? " rev" : ""} rv`} style={{ marginBottom: i < pillars.length - 1 ? "clamp(3.5rem,7vw,6rem)" : 0 }}>
              <div>
                <Eyebrow>Service {String(i + 1).padStart(2, "0")}</Eyebrow>
                <h2 style={{ fontSize: "var(--fs-h2)", marginBottom: "1.2rem" }}>{s.title}</h2>
                <p className="lede" style={{ marginBottom: "1.8rem" }}>
                  {s.body}
                </p>
                <CheckList items={s.subServices} style={{ margin: "0 0 2rem" }} />
                <OpenModalButton kind="advisor">{s.ctaLabel}</OpenModalButton>
              </div>
              <div className="panel brackets flush">
                <SiteImage image={imageFromUrl(s.image, assets)} brief={s.imageBrief} meta="Square · 1200×1200 min" ratio="1/1" />
              </div>
            </div>
          ))}
        </div>
      </section>
      <CtaBand copy={chrome.content["site.cta"]} image={imageFromUrl(chrome.content["site.cta"].image, assets)} />
    </>
  );
}
