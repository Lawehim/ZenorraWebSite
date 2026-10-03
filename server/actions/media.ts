"use server";
import { retryVideo } from "@/server/services/video";
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

export async function retryVideoAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const actor = await requireActor("media.upload");
  try {
    await retryVideo(actor, id);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't retry." };
  }
  revalidatePath("/admin/media/videos");
  return { ok: true };
}
