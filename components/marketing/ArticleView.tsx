// Shared by the public article page and the access-controlled preview (FR-ADM-013).
import type { ContentOf } from "@/lib/content/registry";
import { formatDateLagos } from "@/lib/format";
import { sanitizeRichHtml } from "@/lib/richtext/sanitize";
import { SiteImage, type ImageSource } from "@/components/ui/SiteImage";
import { OpenModalButton } from "@/components/layout/SiteProvider";
import { Breadcrumbs } from "@/components/sections";

export interface ArticleViewProps {
  title: string;
  category: string | null;
  publishedAt: Date | null;
  readingMinutes: number | null;
  author: string;
  bodyHtml: string;
  cover: ImageSource | null;
  cta: ContentOf<"insights.articleCta">;
}

export function ArticleView({ title, category, publishedAt, readingMinutes, author, bodyHtml, cover, cta }: ArticleViewProps) {
  return (
    <>
      <section className="phead">
        <SiteImage image={cover} brief="Article hero image" meta="1920×700 min" full priority />
        <div className="wrap" style={{ maxWidth: "52rem" }}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Insights", href: "/insights" }, { label: category ?? "Article" }]} />
          <h1>{title}</h1>
        </div>
      </section>
      <section className="sec">
        <div className="wrap">
          <article className="article">
            <div className="pullbar">
              {category && <span>{category}</span>}
              {publishedAt && <time dateTime={publishedAt.toISOString()}>{formatDateLagos(publishedAt)}</time>}
              {readingMinutes && <span>{readingMinutes} min read</span>}
              <span>By {author}</span>
            </div>
            <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(bodyHtml) }} />
            <div className="panel brackets" style={{ marginTop: "3rem", display: "flex", gap: "1.4rem", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", margin: "0 0 .4rem" }}>{cta.headline}</h2>
                <p style={{ fontSize: ".9rem", color: "var(--ink-2)", margin: 0 }}>{cta.body}</p>
              </div>
              <OpenModalButton kind="advisor" className="btn btn-gold btn-sm">
                {cta.ctaLabel}
              </OpenModalButton>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
