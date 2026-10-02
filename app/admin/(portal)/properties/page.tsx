import Link from "next/link";
import type { Prisma, PropertyStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { formatNaira } from "@/lib/format";
import { CORRIDORS, BUDGET_BANDS, TITLE_LABELS, TITLE_TYPES } from "@/lib/properties/filters";
import { StatusPill } from "@/components/ui/StatusPill";
import { PropertyRowActions } from "@/components/admin/PropertyRowActions";

export const metadata = { title: "Properties" };

export default async function PropertiesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser("properties.edit", "/admin/properties");
  const sp = await searchParams;
  const where: Prisma.PropertyWhereInput = { deletedAt: sp.deleted ? { not: null } : null };
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, { reference: { contains: sp.q, mode: "insensitive" } }];
  if (sp.corridor) where.corridor = sp.corridor;
  if (sp.title && (TITLE_TYPES as string[]).includes(sp.title)) where.titleType = sp.title as never;
  if (sp.status && ["DRAFT", "PUBLISHED", "SOLD_OUT", "ARCHIVED"].includes(sp.status)) where.status = sp.status as PropertyStatus;
  const band = BUDGET_BANDS.find((b) => b.id === sp.budget);
  if (band) where.priceNaira = { gte: BigInt(band.min), ...(Number.isFinite(band.max) ? { lt: BigInt(band.max) } : {}) };
  const rows = await db.property.findMany({ where, orderBy: [{ curatedOrder: "asc" }, { createdAt: "desc" }] });
  const canPublish = can(user.role, "properties.publish");

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Properties</h1>
          <p>Estates, prices and payment plans. Featured properties appear on the homepage in the order you set.</p>
        </div>
        <Link className="btn btn-gold btn-sm" href="/admin/properties/new">
          New property
        </Link>
      </div>
      <form className="toolbar-row" role="search">
        <div className="field">
          <label htmlFor="q">Name or reference</label>
          <input id="q" name="q" className="inp" defaultValue={sp.q} />
        </div>
        <div className="field">
          <label htmlFor="corridor">Corridor</label>
          <select id="corridor" name="corridor" className="inp" defaultValue={sp.corridor ?? ""}>
            <option value="">Any</option>
            {CORRIDORS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="title">Title</label>
          <select id="title" name="title" className="inp" defaultValue={sp.title ?? ""}>
            <option value="">Any</option>
            {TITLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TITLE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="budget">Price band</label>
          <select id="budget" name="budget" className="inp" defaultValue={sp.budget ?? ""}>
            <option value="">Any</option>
            {BUDGET_BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" className="inp" defaultValue={sp.status ?? ""}>
            <option value="">Any</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="SOLD_OUT">Sold out</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <button className="btn btn-line btn-sm" type="submit">
          Filter
        </button>
        <Link className="btn btn-ghost btn-sm" href={sp.deleted ? "/admin/properties" : "/admin/properties?deleted=1"}>
          {sp.deleted ? "Back" : "Recently deleted"}
        </Link>
      </form>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Property</th>
              <th className="hide-sm">Corridor</th>
              <th>Price</th>
              <th>Status</th>
              <th className="hide-sm">Featured</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link className="strong" href={`/admin/properties/${p.id}`}>
                    {p.name}
                  </Link>
                  <div className="mono" style={{ fontSize: ".66rem", color: "var(--ink-3)" }}>
                    {p.reference} · /properties/{p.slug}
                  </div>
                </td>
                <td className="hide-sm">{p.corridor}</td>
                <td className="mono">{formatNaira(p.priceNaira)}</td>
                <td>
                  <StatusPill status={p.status} />
                </td>
                <td className="hide-sm">{p.featured ? `Yes · #${p.featuredOrder ?? "–"}` : "—"}</td>
                <td>
                  <PropertyRowActions id={p.id} slug={p.slug} status={p.status} deleted={Boolean(p.deletedAt)} canPublish={canPublish} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6}>No properties match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
