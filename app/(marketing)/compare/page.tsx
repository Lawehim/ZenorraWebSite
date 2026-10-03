// Side-by-side comparison of up to three properties (FR-PROP-020).
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatNaira, monthlyInstalment } from "@/lib/format";
import { TITLE_LABELS } from "@/lib/properties/filters";
import { PageHeader } from "@/components/sections";

export const metadata: Metadata = { title: "Compare properties", robots: { index: false } };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ slugs?: string }> }) {
  const slugs = ((await searchParams).slugs ?? "")
    .split(",")
    .filter((s) => /^[a-z0-9-]{1,80}$/.test(s))
    .slice(0, 3);
  const rows = slugs.length ? await db.property.findMany({ where: { slug: { in: slugs }, status: { in: ["PUBLISHED", "SOLD_OUT"] }, deletedAt: null } }) : [];
  const ps = slugs.map((s) => rows.find((r) => r.slug === s)).filter((x): x is (typeof rows)[number] => !!x);
  const spec: [string, (p: (typeof ps)[number]) => string][] = [
    ["Price", (p) => `${formatNaira(p.priceNaira)}${p.priceUnit ? ` ${p.priceUnit}` : ""}`],
    ["Monthly", (p) => (p.planMonths > 1 ? `${formatNaira(monthlyInstalment(p.priceNaira, p.depositPercent, p.planMonths))} × ${p.planMonths}` : "—")],
    ["Deposit", (p) => `${p.depositPercent}%`],
    ["Plot size", (p) => p.sizeText ?? "—"],
    ["Title", (p) => p.titleLabel || TITLE_LABELS[p.titleType]],
    ["Corridor", (p) => p.corridor],
    ["Location", (p) => p.locationText],
    ["Appreciation", (p) => p.appreciationNote ?? "—"],
    ["Availability", (p) => (p.status === "SOLD_OUT" ? "Sold out" : p.availability === "SELLING_FAST" ? "Selling fast" : "Available")],
  ];
  return (
    <>
      <PageHeader crumbs={[{ label: "Home", href: "/" }, { label: "Shortlist", href: "/shortlist" }, { label: "Compare" }]} title="Compare estates" lede="Price, plan, size, title and corridor side by side. Appreciation figures are historical and not a guarantee of future returns." brief="Wide estate photograph" />
      <section className="sec" style={{ paddingTop: "clamp(2.5rem,5vw,4rem)" }}>
        <div className="wrap">
          {ps.length < 2 ? (
            <div className="empty">
              <span>Choose two or three estates from your shortlist to compare.</span>
              <Link className="btn btn-gold btn-sm" href="/shortlist">
                Open shortlist
              </Link>
            </div>
          ) : (
            <div className="tblwrap" style={{ background: "transparent" }}>
              <table className="compare">
                <caption className="sr-only">Comparison of {ps.map((p) => p.name).join(", ")}</caption>
                <thead>
                  <tr>
                    <td />
                    {ps.map((p) => (
                      <th key={p.id} scope="col">
                        <Link href={`/properties/${p.slug}`}>{p.name}</Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {spec.map(([label, get]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      {ps.map((p) => (
                        <td key={p.id}>{get(p)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
