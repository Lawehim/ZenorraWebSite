import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { pickDerivative } from "@/server/services/media";
import { PeopleManager } from "@/components/admin/PeopleManager";

export const metadata = { title: "Team & partners" };

export default async function TeamAdmin() {
  await requirePageUser("testimonials.manage", "/admin/team");
  const [team, partners, images] = await Promise.all([
    db.teamMember.findMany({ orderBy: { order: "asc" } }),
    db.partner.findMany({ orderBy: { order: "asc" } }),
    db.mediaAsset.findMany({ where: { deletedAt: null, mimeType: { startsWith: "image/" }, alt: { not: null } }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Team &amp; partners</h1>
          <p>Shown on the About page. Leave a list empty to hide that section.</p>
        </div>
      </div>
      <PeopleManager
        team={team.map((t) => ({ id: t.id, name: t.name, roleText: t.roleText, bio: t.bio ?? "", mediaAssetId: t.mediaAssetId ?? "", order: t.order, published: t.published }))}
        partners={partners.map((p) => ({ id: p.id, name: p.name, kind: p.kind, url: p.url ?? "", mediaAssetId: p.mediaAssetId ?? "", order: p.order, published: p.published }))}
        images={images.map((i) => ({ id: i.id, label: i.alt ?? i.filename, thumb: `/media/${pickDerivative(i.derivatives, 400)?.key ?? i.key}` }))}
      />
    </>
  );
}
