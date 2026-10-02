import { getContent } from "@/server/services/content";
import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/ui/Placeholder";

export default async function NotFound() {
  const c = await getContent("site.notFound");
  return (
    <section className="phead" style={{ minHeight: "60svh", display: "flex", alignItems: "center" }}>
      <Placeholder full shot="Brand photograph" seed={42} />
      <div className="wrap">
        <div className="eyebrow">404</div>
        <h1>{c.headline}</h1>
        <p className="lede" style={{ marginBottom: "2rem" }}>
          {c.lede}
        </p>
        <div style={{ display: "flex", gap: ".8rem", flexWrap: "wrap" }}>
          <Button variant="gold" href="/">
            {c.ctaLabel}
          </Button>
          <Button href="/properties">Browse properties</Button>
        </div>
      </div>
    </section>
  );
}
