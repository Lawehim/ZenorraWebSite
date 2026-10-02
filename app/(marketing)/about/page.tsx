import type { Metadata } from "next";
import { getAllContent, getContent } from "@/server/services/content";
import { imageFromUrl, imageFromAsset } from "@/server/queries/mappers";
import { db } from "@/lib/db";
import { assetsByUrl, getSiteChrome } from "@/server/queries/site";
import { SiteImage } from "@/components/ui/SiteImage";
import { Button } from "@/components/ui/Button";
import { PageHeader, CtaBand, Eyebrow, SectionHead, FeatureGrid, Paragraphs } from "@/components/sections";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("about.header");
  return { title: c.seoTitle || "About", description: c.seoDescription, alternates: { canonical: "/about" } };
}

export default async function AboutPage() {
  const [c, chrome, team, partners] = await Promise.all([
    getAllContent(["about.header", "about.who", "about.missionVision", "about.why", "about.commitment"]),
    getSiteChrome(),
    db.teamMember.findMany({ where: { published: true }, orderBy: { order: "asc" }, include: { mediaAsset: true } }),
    db.partner.findMany({ where: { published: true }, orderBy: { order: "asc" }, include: { mediaAsset: true } }),
  ]);
  const h = c["about.header"];
  const assets = await assetsByUrl([h.image, c["about.commitment"].image, chrome.content["site.cta"].image]);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
        image={imageFromUrl(h.image, assets)}
        brief={h.imageBrief}
        title={
          <>
            {h.headlineLines.map((l, i) => (
              <span key={i} style={{ display: "block" }}>
                {l}
              </span>
            ))}
            {h.headlineAccent && <span className="gold-text" style={{ display: "block" }}>{h.headlineAccent}</span>}
          </>
        }
      />

      <section className="sec">
        <div className="wrap">
          <div className="split">
            <div className="rv">
              <Eyebrow>{c["about.who"].eyebrow}</Eyebrow>
              <p style={{ fontSize: "1.2rem", lineHeight: 1.65, marginBottom: "1.2rem" }}>{c["about.who"].lead}</p>
              <p className="lede">{c["about.who"].body}</p>
            </div>
            <div className="panel brackets rv">
              <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.6rem", margin: 0 }}>
                {c["about.who"].stats.map((s) => (
                  <div key={s.label}>
                    <dd style={{ margin: 0, fontFamily: "var(--display)", fontSize: "2rem", color: "var(--gold-lt)", lineHeight: 1.1 }}>{s.value}</dd>
                    <dt className="label" style={{ marginTop: ".35rem" }}>
                      {s.label}
                    </dt>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec-tight">
        <div className="wrap">
          <div className="grid-lines g2 rv">
            <div className="cell" style={{ padding: "2.8rem 2.4rem" }}>
              <Eyebrow>Our mission</Eyebrow>
              <p style={{ fontSize: "1.12rem", lineHeight: 1.6 }}>{c["about.missionVision"].mission}</p>
            </div>
            <div className="cell" style={{ padding: "2.8rem 2.4rem" }}>
              <Eyebrow>Our vision</Eyebrow>
              <p style={{ fontSize: "1.12rem", lineHeight: 1.6 }}>{c["about.missionVision"].vision}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec-tight">
        <div className="wrap">
          <SectionHead eyebrow={c["about.why"].eyebrow} title={c["about.why"].headline} />
          <FeatureGrid items={c["about.why"].items} columns={c["about.why"].items.length % 3 === 0 ? 3 : c["about.why"].items.length === 2 ? 2 : 4} />
        </div>
      </section>

      <section className="sec sec-tight">
        <div className="wrap">
          <div className="split rev">
            <div className="panel brackets flush rv">
              <SiteImage image={imageFromUrl(c["about.commitment"].image, assets)} brief={c["about.commitment"].imageBrief} meta="4:5 · 1200×1500 min" ratio="4/5" />
            </div>
            <div className="rv">
              <Eyebrow>{c["about.commitment"].eyebrow}</Eyebrow>
              <h2 style={{ fontSize: "var(--fs-h2)", marginBottom: "1.3rem" }}>{c["about.commitment"].headline}</h2>
              <Paragraphs items={c["about.commitment"].paragraphs} />
              <Button variant="gold" href={c["about.commitment"].ctaHref}>
                {c["about.commitment"].ctaLabel}
              </Button>
            </div>
          </div>
        </div>
      </section>
      {team.length > 0 && (
        <section className="sec sec-tight">
          <div className="wrap">
            <SectionHead eyebrow="Our team" title="The people you will speak to" />
            <div className="team">
              {team.map((m) => (
                <figure key={m.id}>
                  <SiteImage image={imageFromAsset(m.mediaAsset, m.name)} brief={`Portrait — ${m.name}`} meta="4:5" ratio="4/5" />
                  <figcaption>
                    <b>{m.name}</b>
                    <span>{m.roleText}</span>
                    {m.bio && <p className="muted" style={{ fontSize: ".86rem", marginTop: ".5rem" }}>{m.bio}</p>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {partners.length > 0 && (
        <section className="sec sec-tight">
          <div className="wrap">
            <SectionHead eyebrow="Partners" title="Developers and solar providers we work with" />
            <div className="partners">
              {partners.map((p) => {
                const inner = p.mediaAsset ? <img src={imageFromAsset(p.mediaAsset, p.name)!.src} alt={p.name} /> : <span style={{ border: 0, padding: 0, minWidth: 0 }}>{p.name}</span>;
                return p.url ? (
                  <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" title={p.name}>
                    {inner}
                  </a>
                ) : (
                  <span key={p.id}>{inner}</span>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <CtaBand copy={chrome.content["site.cta"]} image={imageFromUrl(chrome.content["site.cta"].image, assets)} />
    </>
  );
}
