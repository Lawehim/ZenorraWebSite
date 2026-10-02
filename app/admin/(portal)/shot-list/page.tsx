// Photography still needed: every placeholder brief on the site, in one list (FR-ADM-030).
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { BLOCKS, resolveBlock, type ContentKey } from "@/lib/content/registry";
import type { FieldDef } from "@/lib/content/fields";

export const metadata = { title: "Photo shot list" };

interface Need {
  where: string;
  brief: string;
  edit: string;
}

function walk(fields: FieldDef[], data: Record<string, unknown>, label: string, edit: string, out: Need[]) {
  const img = fields.find((f) => f.type === "image");
  if (img && !data[img.name]) out.push({ where: label, brief: String(data.imageBrief ?? "Photograph"), edit });
  for (const f of fields.filter((x) => x.type === "items")) {
    ((data[f.name] as Record<string, unknown>[]) ?? []).forEach((it, i) => walk(f.fields ?? [], it, `${label} — ${String(it.title ?? `item ${i + 1}`)}`, edit, out));
  }
}

export default async function ShotList() {
  await requirePageUser("media.upload", "/admin/shot-list");
  const stored = await db.contentBlock.findMany();
  const needs: Need[] = [];
  for (const b of BLOCKS) walk(b.fields, resolveBlock(b.key as ContentKey, stored.find((s) => s.key === b.key)?.data) as Record<string, unknown>, `${b.page} · ${b.label}`, `/admin/content/${b.key}`, needs);
  const props = await db.property.findMany({ where: { deletedAt: null, media: { none: {} } }, select: { id: true, name: true, heroBrief: true } });
  for (const p of props) needs.push({ where: `Property · ${p.name}`, brief: p.heroBrief ?? "Estate photographs (aerial, entrance, roads, plots)", edit: `/admin/properties/${p.id}` });
  const posts = await db.post.findMany({ where: { deletedAt: null, coverMediaId: null, status: { in: ["PUBLISHED", "SCHEDULED"] } }, select: { id: true, title: true } });
  for (const p of posts) needs.push({ where: `Article · ${p.title}`, brief: "Article cover image, 16:10, 1200×750 minimum", edit: `/admin/posts/${p.id}` });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Photo shot list</h1>
          <p>{needs.length} images still showing placeholders. Share this list with the photographer; once a photo is uploaded, set it on the item to remove it from here.</p>
        </div>
      </div>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Where</th>
              <th>Shot needed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {needs.map((n, i) => (
              <tr key={i}>
                <td>{n.where}</td>
                <td>{n.brief}</td>
                <td>
                  <Link className="btn btn-line btn-sm" href={n.edit}>
                    Set image
                  </Link>
                </td>
              </tr>
            ))}
            {!needs.length && (
              <tr>
                <td colSpan={3}>Every image slot has a photograph. </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
