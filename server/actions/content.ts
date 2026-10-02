"use server";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/auth/session";
import { updateContent, resetContent } from "@/server/services/content";
import { updateSettings } from "@/server/services/settings";

// Content and settings appear on every public page — purge the whole site cache (FR-ADM-014/047).
function purgeSite() {
  revalidatePath("/", "layout");
}

export async function saveContentAction(key: string, data: Record<string, unknown>) {
  const actor = await requireActor("content.edit");
  const r = await updateContent(actor, key, data);
  if (r.ok) purgeSite();
  return r;
}

export async function resetContentAction(key: string) {
  const actor = await requireActor("content.edit");
  await resetContent(actor, key);
  purgeSite();
  revalidatePath(`/admin/content/${key}`);
}

export async function saveSettingsAction(data: unknown) {
  const actor = await requireActor("settings.edit");
  const r = await updateSettings(actor, data);
  if (r.ok) purgeSite();
  return r;
}
