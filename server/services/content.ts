import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { resolveBlock, validateBlockData, type ContentKey, type ContentOf } from "@/lib/content/registry";
import { audit } from "./audit";
import type { Actor } from "./actor";

export async function getContent<K extends ContentKey>(key: K): Promise<ContentOf<K>> {
  const row = await db.contentBlock.findUnique({ where: { key } });
  return resolveBlock(key, row?.data);
}

export async function getAllContent<K extends ContentKey>(keys: K[]): Promise<{ [P in K]: ContentOf<P> }> {
  const rows = await db.contentBlock.findMany({ where: { key: { in: keys } } });
  const byKey = new Map(rows.map((r) => [r.key, r.data]));
  const out = {} as { [P in K]: ContentOf<P> };
  for (const k of keys) out[k] = resolveBlock(k, byKey.get(k));
  return out;
}

export async function getStoredContent(key: string) {
  return db.contentBlock.findUnique({ where: { key } });
}

export type SaveResult = { ok: true } | { ok: false; errors: Record<string, string> };

export async function updateContent(actor: Actor, key: string, data: unknown): Promise<SaveResult> {
  assertCan(actor.role, "content.edit");
  const v = validateBlockData(key, data);
  if (!v.ok) return v;
  await db.$transaction(async (tx) => {
    const before = await tx.contentBlock.findUnique({ where: { key } });
    await tx.contentBlock.upsert({
      where: { key },
      create: { key, data: v.data as Prisma.InputJsonValue, updatedBy: actor.id },
      update: { data: v.data as Prisma.InputJsonValue, updatedBy: actor.id },
    });
    await audit(actor, "content.update", "ContentBlock", key, { before: before?.data, after: v.data }, tx);
  });
  return { ok: true };
}

export async function resetContent(actor: Actor, key: string): Promise<void> {
  assertCan(actor.role, "content.edit");
  await db.$transaction(async (tx) => {
    const before = await tx.contentBlock.findUnique({ where: { key } });
    if (!before) return;
    await tx.contentBlock.delete({ where: { key } });
    await audit(actor, "content.reset", "ContentBlock", key, { before: before.data }, tx);
  });
}
