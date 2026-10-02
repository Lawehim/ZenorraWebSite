import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { pickDerivative } from "@/server/services/media";
import { MediaLibrary } from "@/components/admin/MediaLibrary";

export const metadata = { title: "Media library" };

export default async function MediaAdmin({ searchParams }: { searchParams: Promise<{ q?: string; missingAlt?: string }> }) {
  const user = await requirePageUser("media.upload", "/admin/media");
  const sp = await searchParams;
  const where: Prisma.MediaAssetWhereInput = { deletedAt: null };
  if (sp.q) where.OR = [{ filename: { contains: sp.q, mode: "insensitive" } }, { alt: { contains: sp.q, mode: "insensitive" } }];
  if (sp.missingAlt) where.alt = null;
  const assets = await db.mediaAsset.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });
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
        }))}
      />
    </>
  );
}
