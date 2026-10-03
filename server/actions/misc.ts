"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActor } from "@/server/auth/session";
import { testimonialInputSchema, userInviteSchema } from "@/lib/validation/admin";
import { fieldErrors } from "@/lib/validation/public";
import { audit } from "@/server/services/audit";
import { inviteUser, changeUserRole, setUserStatus, releaseLock } from "@/server/services/auth";
import { processQueueSoon } from "@/server/services/queue-trigger";
import type { Role } from "@prisma/client";

export async function saveTestimonialAction(id: string | null, data: Record<string, unknown>) {
  const actor = await requireActor("testimonials.manage");
  const parsed = testimonialInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error) };
  const d = { ...parsed.data, initials: parsed.data.initials || parsed.data.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(), videoUrl: parsed.data.videoUrl || null };
  const row = id ? await db.testimonial.update({ where: { id }, data: d }) : await db.testimonial.create({ data: d });
  await audit(actor, id ? "testimonial.update" : "testimonial.create", "Testimonial", row.id, { after: d });
  revalidatePath("/");
  revalidatePath("/admin/testimonials");
  return { ok: true as const };
}

export async function deleteTestimonialAction(id: string) {
  const actor = await requireActor("testimonials.manage");
  await db.testimonial.delete({ where: { id } });
  await audit(actor, "testimonial.delete", "Testimonial", id);
  revalidatePath("/");
  revalidatePath("/admin/testimonials");
}

export async function inviteUserAction(data: Record<string, unknown>) {
  const actor = await requireActor("users.manage");
  const parsed = userInviteSchema.safeParse(data);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error) };
  let token: string;
  try {
    ({ token } = await inviteUser(actor, parsed.data));
  } catch (e) {
    if (e instanceof Error && /partner/i.test(e.message)) return { ok: false as const, errors: { [parsed.data.role === "PARTNER" ? "partnerId" : "email"]: e.message } as Record<string, string> };
    throw e;
  }
  processQueueSoon();
  revalidatePath("/admin/users");
  // The link is also shown once to the inviter, so onboarding works before email is configured.
  return { ok: true as const, link: `/admin/accept-invite?token=${token}` };
}

export async function changeRoleAction(id: string, role: Role) {
  const actor = await requireActor("users.manage");
  await changeUserRole(actor, id, role);
  revalidatePath("/admin/users");
}

export async function setUserStatusAction(id: string, status: "ACTIVE" | "SUSPENDED" | "REMOVED") {
  const actor = await requireActor("users.manage");
  await setUserStatus(actor, id, status);
  revalidatePath("/admin/users");
}

export async function unlockUserAction(id: string) {
  const actor = await requireActor("users.manage");
  await releaseLock(id);
  await audit(actor, "user.unlock", "User", id);
  revalidatePath("/admin/users");
}
