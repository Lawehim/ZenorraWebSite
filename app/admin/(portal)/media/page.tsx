import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { pickDerivative, listUnusedMedia } from "@/server/services/media";
import { DocumentUpload } from "@/components/admin/DocumentUpload";
import Link from "next/link";
import { MediaLibrary } from "@/components/admin/MediaLibrary";

export const metadata = { title: "Media library" };

export default async function MediaAdmin({ searchParams }: { searchParams: Promise<{ q?: string; missingAlt?: string; unused?: string }> }) {
  const user = await requirePageUser("media.upload", "/admin/media");
  const sp = await searchParams;
  const where: Prisma.MediaAssetWhereInput = { deletedAt: null, mimeType: { startsWith: "image/" } };
  if (sp.q) where.OR = [{ filename: { contains: sp.q, mode: "insensitive" } }, { alt: { contains: sp.q, mode: "insensitive" } }];
  if (sp.missingAlt) where.alt = null;
  const unusedIds = sp.unused ? new Set((await listUnusedMedia()).map((a) => a.id)) : null;
  const assets = (await db.mediaAsset.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 })).filter((a) => !unusedIds || unusedIds.has(a.id));
  const docs = await db.mediaAsset.findMany({ where: { deletedAt: null, mimeType: "application/pdf" }, orderBy: { createdAt: "desc" }, include: { documents: { include: { property: { select: { name: true } } } } } });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Media library</h1>
          <p>JPEG, PNG, WebP or AVIF up to 15MB each. Images are resized automatically and location data is removed.</p>
        </div>
      </div>
      <form className="toolbar-row" role="search">
        <div className="field">
          <label htmlFor="q">Search filename or alt text</label>
          <input id="q" name="q" className="inp" defaultValue={sp.q} />
        </div>
        <label className="consent" style={{ alignSelf: "center" }}>
          <input type="checkbox" name="missingAlt" value="1" defaultChecked={Boolean(sp.missingAlt)} /> Missing alt text only
        </label>
        <label className="consent" style={{ alignSelf: "center" }}>
          <input type="checkbox" name="unused" value="1" defaultChecked={Boolean(sp.unused)} /> Unused only
        </label>
        <Link className="btn btn-ghost btn-sm" href="/admin/shot-list">
          Photo shot list
        </Link>
        <button className="btn btn-line btn-sm" type="submit">
          Filter
        </button>
      </form>
      <MediaLibrary
        canDelete={can(user.role, "media.delete")}
        assets={assets.map((a) => ({
          id: a.id,
          url: `/media/${a.key}`,
          thumb: `/media/${pickDerivative(a.derivatives, 400)?.key ?? a.key}`,
          filename: a.filename,
          alt: a.alt ?? "",
          caption: a.caption ?? "",
          width: a.width,
          height: a.height,
          bytes: a.bytes,
          createdAt: a.createdAt.toISOString(),
          focalX: a.focalX,
          focalY: a.focalY,
        }))}
      />
      <section className="card" style={{ marginTop: "2rem" }}>
        <h2>Documents (PDF)</h2>
        <p className="muted" style={{ fontSize: ".86rem", marginBottom: "1rem" }}>
          Brochures, layout plans and price lists. Attach them to a property from its edit page and choose whether each is public or internal.
        </p>
        <DocumentUpload />
        <table className="tbl" style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>File</th>
              <th>Used on</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.filename}</td>
                <td>{d.documents.map((x) => `${x.property.name} (${x.isPublic ? "public" : "internal"})`).join(", ") || "Not attached"}</td>
              </tr>
            ))}
            {!docs.length && (
              <tr>
                <td colSpan={2}>No documents yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
