// Tier-4 sections (SRS §7.6): compose primitives; receive copy as props from the content store.
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { SiteImage, type ImageSource } from "@/components/ui/SiteImage";
import { OpenModalButton } from "@/components/layout/SiteProvider";
import { Button } from "@/components/ui/Button";

export function Eyebrow({ children, meta, center }: { children: ReactNode; meta?: string; center?: boolean }) {
  return (
    <div className={`eyebrow${center ? " center" : ""}`}>
      {children}
      {meta && <span>{meta}</span>}
    </div>
  );
}

export function SectionHead({ eyebrow, title, lede, action, as: H = "h2" }: { eyebrow?: string; title: string; lede?: string; action?: ReactNode; as?: "h1" | "h2" }) {
  return (
    <div className="head rv">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <H style={H === "h1" ? { fontSize: "var(--fs-h2)" } : undefined}>{title}</H>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {action}
    </div>
  );
}

export function CheckList({ items, style }: { items: string[]; style?: React.CSSProperties }) {
  if (!items.length) return null;
  return (
    <ul className="checks" style={style}>
      {items.map((t) => (
        <li className="check" key={t}>
          <Icon name="check" strokeWidth={1.6} />
          {t}
        </li>
      ))}
    </ul>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((c, i) => (
          <li key={i}>{c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ crumbs, title, lede, image, brief, children }: { crumbs: { label: string; href?: string }[]; title: ReactNode; lede?: string; image?: ImageSource | null; brief?: string; children?: ReactNode }) {
  return (
    <section className="phead">
      <SiteImage image={image} brief={brief} meta="1920×700 min" full priority />
      <div className="wrap">
        <Breadcrumbs items={crumbs} />
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
        {children}
      </div>
    </section>
  );
}

export function CtaBand({ copy, image }: { copy: { eyebrow: string; headline: string; lede: string; primaryLabel: string; primaryHref: string; secondaryLabel: string; imageBrief?: string }; image?: ImageSource | null }) {
  return (
    <section className="cta">
      <SiteImage image={image} brief={copy.imageBrief} meta="1920×800 min" full />
      <div className="wrap">
        <Eyebrow center>{copy.eyebrow}</Eyebrow>
        <h2>{copy.headline}</h2>
        <p className="lede">{copy.lede}</p>
        <div className="row">
          <Button variant="gold" href={copy.primaryHref}>
            {copy.primaryLabel}
          </Button>
          <OpenModalButton kind="advisor">{copy.secondaryLabel}</OpenModalButton>
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid({ items, columns = 4, numbered = true }: { items: { title: string; body: string; icon?: string }[]; columns?: 2 | 3 | 4; numbered?: boolean }) {
  return (
    <div className={`grid-lines g${columns} rv`}>
      {items.map((w, i) => (
        <div className="cell" key={i}>
          {numbered && <span className="num">{String(i + 1).padStart(2, "0")}</span>}
          {w.icon && (
            <div className="ico">
              <Icon name={w.icon} strokeWidth={1.2} />
            </div>
          )}
          <h3>{w.title}</h3>
          <p>{w.body}</p>
        </div>
      ))}
    </div>
  );
}

export function JourneySteps({ items }: { items: { title: string; body: string }[] }) {
  return (
    <ol className="journey rv">
      {items.map((s, i) => (
        <li className="step" key={i}>
          <div className="dot" aria-hidden="true">
            <span className="bar" />
          </div>
          <span className="n">STEP {String(i + 1).padStart(2, "0")}</span>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function Paragraphs({ items, className = "lede", style }: { items: string[]; className?: string; style?: React.CSSProperties }) {
  return (
    <>
      {items.map((p, i) => (
        <p key={i} className={className} style={{ marginBottom: "1.2rem", ...style }}>
          {p}
        </p>
      ))}
    </>
  );
}
