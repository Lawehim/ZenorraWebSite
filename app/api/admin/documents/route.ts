// PDF document upload for property brochures, layout plans and price lists (FR-ADM-036).
import { revalidatePath } from "next/cache";
import { currentUser, toActor } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { uploadDocument, MAX_UPLOAD_BYTES } from "@/server/services/media";
import { json, sameOrigin } from "@/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, message: "Upload refused." }, 403);
  const u = await currentUser();
  if (!u || !can(u.role, "media.upload")) return json({ ok: false, message: "Your role can't upload documents." }, 403);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ ok: false, message: "Choose a PDF to upload." }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ ok: false, message: `${file.name} is larger than the 15MB limit.` }, 413);
  const r = await uploadDocument(toActor(u), { filename: file.name, bytes: Buffer.from(await file.arrayBuffer()) });
  revalidatePath("/admin/media");
  return r.ok ? json({ ok: true, id: r.asset.id, filename: r.asset.filename }) : json({ ok: false, message: r.message }, 422);
}
