"use server";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/auth/session";
import { savePost, softDeletePost, restorePost, duplicatePost, saveCategory } from "@/server/services/posts";

function purge(slug?: string) {
  revalidatePath("/insights");
  revalidatePath("/");
  if (slug) revalidatePath(`/insights/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function savePostAction(id: string | null, data: Record<string, unknown>) {
  const actor = await requireActor("posts.edit");
  const r = await savePost(actor, id, data);
  if (r.ok) purge(r.slug);
  return r;
}

export async function deletePostAction(id: string) {
  const actor = await requireActor("posts.delete");
  await softDeletePost(actor, id);
  purge();
  revalidatePath("/admin/posts");
}

export async function restorePostAction(id: string) {
  const actor = await requireActor("posts.delete");
  await restorePost(actor, id);
  purge();
  revalidatePath("/admin/posts");
}

export async function duplicatePostAction(id: string) {
  const actor = await requireActor("posts.edit");
  const copy = await duplicatePost(actor, id);
  revalidatePath("/admin/posts");
  return copy.id;
}

export async function addCategoryAction(name: string) {
  const actor = await requireActor("posts.edit");
  const c = await saveCategory(actor, name);
  return c ? { id: c.id, name: c.name } : null;
}
