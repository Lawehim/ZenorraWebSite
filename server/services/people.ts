// Team members and partners shown on the About page (FR-CORP-003/006).
import { z } from "zod";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { audit } from "./audit";
import type { Actor } from "./actor";

const team = z.object({
  name: z.string().trim().min(1).max(80),
  roleText: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(400).optional().default(""),
  mediaAssetId: z.string().optional().nullable(),
  order: z.coerce.number().int().min(0).max(999).optional().default(0),
  published: z.boolean().optional().default(true),
});

const partner = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["DEVELOPER", "SOLAR", "OTHER"]),
  url: z
    .string()
    .trim()
    .max(300)
    .optional()
    .default("")
    .refine((v) => v === "" || /^https:\/\//.test(v), "Use a full https:// link."),
  mediaAssetId: z.string().optional().nullable(),
  order: z.coerce.number().int().min(0).max(999).optional().default(0),
  published: z.boolean().optional().default(true),
});

export async function saveTeamMember(actor: Actor, id: string | null, input: unknown) {
  assertCan(actor.role, "testimonials.manage");
  const d = team.parse(input);
  const data = { ...d, bio: d.bio || null, mediaAssetId: d.mediaAssetId || null };
  const row = id ? await db.teamMember.update({ where: { id }, data }) : await db.teamMember.create({ data });
  await audit(actor, id ? "team.update" : "team.create", "TeamMember", row.id, { after: { name: row.name } });
  return row;
}

export async function deleteTeamMember(actor: Actor, id: string) {
  assertCan(actor.role, "testimonials.manage");
  await db.teamMember.delete({ where: { id } });
  await audit(actor, "team.delete", "TeamMember", id);
}

export async function savePartner(actor: Actor, id: string | null, input: unknown) {
  assertCan(actor.role, "testimonials.manage");
  const d = partner.parse(input);
  const data = { ...d, url: d.url || null, mediaAssetId: d.mediaAssetId || null };
  const row = id ? await db.partner.update({ where: { id }, data }) : await db.partner.create({ data });
  await audit(actor, id ? "partner.update" : "partner.create", "Partner", row.id, { after: { name: row.name } });
  return row;
}

export async function deletePartner(actor: Actor, id: string) {
  assertCan(actor.role, "testimonials.manage");
  const users = await db.user.count({ where: { partnerId: id, status: { not: "REMOVED" } } });
  if (users) throw new Error("This partner still has partner-portal users. Remove them under Users & roles first.");
  await db.$transaction([db.property.updateMany({ where: { partnerId: id }, data: { partnerId: null } }), db.user.updateMany({ where: { partnerId: id }, data: { partnerId: null } }), db.partner.delete({ where: { id } })]);
  await audit(actor, "partner.delete", "Partner", id);
}
