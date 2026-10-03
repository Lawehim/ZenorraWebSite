// Media listing (for pickers) and upload (multipart, one or more files) — admin only.
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentUser, toActor } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { uploadMedia, pickDerivative, MAX_UPLOAD_BYTES, MAX_BATCH_BYTES } from "@/server/services/media";
import { json, sameOrigin } from "@/server/http";

export async function GET() {
  const u = await currentUser();
  if (!u || !can(u.role, "media.upload")) return json({ ok: false }, 403);
  const assets = await db.mediaAsset.findMany({ where: { deletedAt: null, mimeType: { startsWith: "image/" } }, orderBy: { createdAt: "desc" }, take: 300 });
  return json({ assets: assets.map((a) => ({ id: a.id, url: `/media/${a.key}`, thumb: `/media/${pickDerivative(a.derivatives, 400)?.key ?? a.key}`, filename: a.filename, alt: a.alt })) });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, message: "Upload refused." }, 403);
  const u = await currentUser();
  if (!u || !can(u.role, "media.upload")) return json({ ok: false, message: "Your role can't upload media." }, 403);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BATCH_BYTES + 1_000_000) return json({ ok: false, message: "That batch is over the 100MB limit. Upload fewer files at once." }, 413);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, message: "The upload was interrupted. Please try again." }, 400);
  }
  const results: { filename: string; ok: boolean; message?: string; id?: string }[] = [];
  for (const entry of form.getAll("files")) {
    if (!(entry instanceof File)) continue;
    if (entry.size > MAX_UPLOAD_BYTES) {
      results.push({ filename: entry.name, ok: false, message: `${entry.name} is larger than the 15MB limit.` });
      continue;
    }
    const r = await uploadMedia(toActor(u), { filename: entry.name, bytes: Buffer.from(await entry.arrayBuffer()) });
    results.push(r.ok ? { filename: entry.name, ok: true, id: r.asset.id } : { filename: entry.name, ok: false, message: r.message });
  }
  revalidatePath("/admin/media");
  return json({ ok: results.every((r) => r.ok), results });
}
