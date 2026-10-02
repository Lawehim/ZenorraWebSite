import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { resolveSettings, siteSettingsSchema, type SiteSettings } from "@/lib/settings/schema";
import { fieldErrors } from "@/lib/validation/public";
import { audit } from "./audit";
import type { Actor } from "./actor";

const KEY = "site";

export async function getSettings(): Promise<SiteSettings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  return resolveSettings(row?.value);
}

export async function updateSettings(actor: Actor, input: unknown): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  assertCan(actor.role, "settings.edit");
  const parsed = siteSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  await db.$transaction(async (tx) => {
    const before = await tx.setting.findUnique({ where: { key: KEY } });
    const value = parsed.data as unknown as Prisma.InputJsonValue;
    await tx.setting.upsert({ where: { key: KEY }, create: { key: KEY, value, updatedBy: actor.id }, update: { value, updatedBy: actor.id } });
    await audit(actor, "settings.update", "Setting", KEY, { before: before?.value, after: parsed.data }, tx);
  });
  return { ok: true };
}
