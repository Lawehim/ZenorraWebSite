// Article categories: rename, merge, delete (FR-ADM-016).
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { audit } from "./audit";
import type { Actor } from "./actor";

export async function renameCategory(actor: Actor, id: string, name: string) {
  assertCan(actor.role, "posts.edit");
  const clean = name.trim().slice(0, 60);
  if (!clean) return;
  await db.category.update({ where: { id }, data: { name: clean, slug: slugify(clean) } });
  await audit(actor, "category.rename", "Category", id, { after: { name: clean } });
}

export async function mergeCategories(actor: Actor, fromId: string, intoId: string) {
  assertCan(actor.role, "posts.edit");
  if (fromId === intoId) return;
  await db.$transaction([db.post.updateMany({ where: { categoryId: fromId }, data: { categoryId: intoId } }), db.category.delete({ where: { id: fromId } })]);
  await audit(actor, "category.merge", "Category", fromId, { after: { into: intoId } });
}

export async function deleteCategory(actor: Actor, id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  assertCan(actor.role, "posts.edit");
  const used = await db.post.count({ where: { categoryId: id } });
  if (used) return { ok: false, message: `${used} article${used === 1 ? " uses" : "s use"} this category. Merge it into another category first.` };
  await db.category.delete({ where: { id } });
  await audit(actor, "category.delete", "Category", id);
  return { ok: true };
}
