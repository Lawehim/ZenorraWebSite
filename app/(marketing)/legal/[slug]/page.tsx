import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/server/services/content";
import { LEGAL_PAGES, parseLegal, type LegalSlug } from "@/lib/content/legal";
import type { ContentKey } from "@/lib/content/registry";
import { Breadcrumbs } from "@/components/sections";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

function key(slug: string): ContentKey | null {
  return slug in LEGAL_PAGES ? (`legal.${slug as LegalSlug}` as ContentKey) : null;
}

export function generateStaticParams() {
  return Object.keys(LEGAL_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const k = key((await params).slug);
  if (!k) return {};
  const c = (await getContent(k)) as { title: string };
  return { title: c.title, alternates: { canonical: `/legal/${(await params).slug}` } };
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const k = key(slug);
  if (!k) notFound();
  const c = (await getContent(k)) as { title: string; body: string };
  return (
    <section className="phead" style={{ borderBottom: 0 }}>
      <div className="wrap" style={{ maxWidth: "52rem" }}>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: c.title }]} />
        <h1>{c.title}</h1>
        <article className="article" style={{ marginTop: "2rem", marginInline: 0 }}>
          {parseLegal(c.body).map((b, i) =>
            b.type === "h2" ? (
              <h2 key={i}>{b.text}</h2>
            ) : b.type === "ul" ? (
              <ul key={i}>
                {b.items.map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>{b.text}</p>
            ),
          )}
        </article>
      </div>
    </section>
  );
}
