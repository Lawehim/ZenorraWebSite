"use server";
import { revalidatePath } from "next/cache";
import type { PropertyStatus } from "@prisma/client";
import { requireActor } from "@/server/auth/session";
import { saveProperty, setPropertyStatus, deleteProperty, restoreProperty, duplicateProperty, setPropertyMedia } from "@/server/services/properties";
import { db } from "@/lib/db";

function purge(slug?: string) {
  revalidatePath("/");
  revalidatePath("/properties");
  if (slug) revalidatePath(`/properties/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function savePropertyAction(id: string | null, data: Record<string, unknown>) {
  const actor = await requireActor("properties.edit");
  const r = await saveProperty(actor, id, data);
  if (r.ok) purge(r.slug);
  return r;
}

export async function setPropertyStatusAction(id: string, status: PropertyStatus) {
  const actor = await requireActor("properties.publish");
  await setPropertyStatus(actor, id, status);
  const p = await db.property.findUnique({ where: { id }, select: { slug: true } });
  purge(p?.slug);
  revalidatePath("/admin/properties");
}

export async function deletePropertyAction(id: string) {
  const actor = await requireActor("properties.publish");
  await deleteProperty(actor, id);
  purge();
  revalidatePath("/admin/properties");
}

export async function restorePropertyAction(id: string) {
  const actor = await requireActor("properties.publish");
  await restoreProperty(actor, id);
  revalidatePath("/admin/properties");
}

export async function duplicatePropertyAction(id: string) {
  const actor = await requireActor("properties.edit");
  const c = await duplicateProperty(actor, id);
  return c.id;
}

export async function setPropertyMediaAction(id: string, mediaIds: string[]) {
  const actor = await requireActor("properties.edit");
  const r = await setPropertyMedia(actor, id, mediaIds);
  const p = await db.property.findUnique({ where: { id }, select: { slug: true } });
  if (r.ok) purge(p?.slug);
  return r;
}
