"use server";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/auth/session";
import { deleteMedia, updateMediaMeta } from "@/server/services/media";

export async function updateMediaAction(id: string, alt: string, caption: string) {
  const actor = await requireActor("media.upload");
  await updateMediaMeta(actor, id, { alt, caption });
  revalidatePath("/admin/media");
  revalidatePath("/", "layout");
}

export async function deleteMediaAction(id: string) {
  const actor = await requireActor("media.delete");
  const r = await deleteMedia(actor, id);
  revalidatePath("/admin/media");
  return r;
}
