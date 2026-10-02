import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { pickDerivative } from "@/server/services/media";
import { PropertyForm, type PropertyDraft } from "@/components/admin/PropertyForm";
import { StatusPill } from "@/components/ui/StatusPill";
import { PropertyDocuments } from "@/components/admin/PropertyDocuments";

export const metadata = { title: "Edit property" };

export default async function EditProperty({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser("properties.edit", `/admin/properties/${id}`);
  const isNew = id === "new";
  const p = isNew ? null : await db.property.findUnique({ where: { id }, include: { media: { orderBy: { order: "asc" } }, documents: { include: { mediaAsset: true } } } });
  const pdfs = await db.mediaAsset.findMany({ where: { deletedAt: null, mimeType: "application/pdf" }, orderBy: { createdAt: "desc" }, select: { id: true, filename: true } });
  if (!isNew && !p) notFound();
  const assets = await db.mediaAsset.findMany({ where: { deletedAt: null, mimeType: { startsWith: "image/" } }, orderBy: { createdAt: "desc" }, take: 300 });
  const count = await db.property.count();

  const initial: PropertyDraft = {
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    reference: p?.reference ?? `ZNR-${String(count + 1).padStart(3, "0")}`,
    corridor: p?.corridor ?? "Ibeju-Lekki",
    locationText: p?.locationText ?? "",
    titleType: p?.titleType ?? "REGISTERED_SURVEY",
    titleLabel: p?.titleLabel ?? "",
    titleDocRef: p?.titleDocRef ?? "",
    sizeText: p?.sizeText ?? "",
    sizeSqm: p?.sizeSqm != null ? String(p.sizeSqm) : "",
    priceNaira: p ? p.priceNaira.toString() : "",
    priceUnit: p?.priceUnit ?? "",
    depositPercent: String(p?.depositPercent ?? 30),
    planMonths: String(p?.planMonths ?? 12),
    allocationText: p?.allocationText ?? "",
    appreciationNote: p?.appreciationNote ?? "",
    blurb: p?.blurb ?? "",
    description: (p?.description ?? "").replace(/<\/p>\s*<p>/g, "\n\n").replace(/<[^>]+>/g, ""),
    features: (p?.features ?? []).join("\n"),
    badges: (p?.badges ?? []).join("\n"),
    currencies: (p?.currencies ?? ["NGN", "GBP", "USD", "CAD"]).join(", "),
    availability: p?.availability ?? "AVAILABLE",
    featured: p?.featured ?? false,
    featuredOrder: p?.featuredOrder != null ? String(p.featuredOrder) : "",
    curatedOrder: String(p?.curatedOrder ?? count + 1),
    heroBrief: p?.heroBrief ?? "",
    seoTitle: p?.seoTitle ?? "",
    seoDescription: p?.seoDescription ?? "",
  };

  return (
    <>
      <div className="adm-head">
        <div>
          <p className="mono" style={{ fontSize: ".66rem", letterSpacing: ".16em", textTransform: "uppercase" }}>
            <Link href="/admin/properties">Properties</Link> / {isNew ? "New" : p!.reference}
          </p>
          <h1>
            {isNew ? "New property" : p!.name} {p && <StatusPill status={p.status} />}
          </h1>
        </div>
      </div>
      <PropertyForm
        id={isNew ? null : id}
        initial={initial}
        canSetPrice={can(user.role, "properties.price")}
        selectedMedia={p?.media.map((m) => m.mediaAssetId) ?? []}
        assets={assets.map((a) => ({ id: a.id, filename: a.filename, alt: a.alt, thumb: `/media/${pickDerivative(a.derivatives, 400)?.key ?? a.key}` }))}
      />
      {p && <PropertyDocuments propertyId={p.id} library={pdfs} docs={p.documents.map((d) => ({ id: d.id, label: d.label, kind: d.kind, isPublic: d.isPublic, filename: d.mediaAsset.filename }))} />}
    </>
  );
}
