// Lead scoring, round-robin assignment and first-response SLA (FR-LEAD-018, FR-ADM-041/042).
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { scoreLead } from "@/lib/leads/score";
import { nextAdvisor, slaDueAt } from "@/lib/leads/assignment";
import { getSettings } from "./settings";
import { enqueue } from "./notifications";
import { audit } from "./audit";
import { attributeReferral } from "./referrals";
import type { Actor } from "./actor";

const LAST_KEY = "assignment.lastAdvisorId";

export async function rescore(leadId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { _count: { select: { activities: { where: { type: "enquiry" } }, bookings: true } } } });
  if (!lead) return;
  const score = scoreLead({ budgetBand: lead.budgetBand, timeline: lead.timeline, residency: lead.residency, enquiries: lead._count.activities, bookedInspection: lead._count.bookings > 0 });
  if (score !== lead.score) await db.lead.update({ where: { id: leadId }, data: { score } });
}

async function notifyAssignee(leadId: string, userId: string) {
  const [lead, user] = await Promise.all([db.lead.findUnique({ where: { id: leadId } }), db.user.findUnique({ where: { id: userId } })]);
  if (!lead || !user) return;
  await enqueue({ channel: "email", to: user.email, template: "lead.assigned", payload: { advisor: user.name, reference: lead.reference, name: lead.name, leadId }, leadId });
}

/** Called after every committed public submission. */
export async function afterLeadSaved(leadId: string, opts: { isNew: boolean; now: Date; referralCode: string | null }) {
  await rescore(leadId);
  if (opts.referralCode) await attributeReferral(leadId, opts.referralCode);
  if (!opts.isNew) return;
  const settings = await getSettings();
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const data: Prisma.LeadUpdateInput = { firstResponseDueAt: slaDueAt(lead.createdAt, settings.assignment.slaHours) };
  let assigned: string | null = null;
  if (settings.assignment.mode === "round-robin" && !lead.assignedToId) {
    const advisors = await db.user.findMany({ where: { role: "ADVISOR", status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true } });
    const last = await db.setting.findUnique({ where: { key: LAST_KEY } });
    assigned = nextAdvisor(
      advisors.map((a) => a.id),
      (last?.value as string | undefined) ?? null,
    );
    if (assigned) {
      data.assignedTo = { connect: { id: assigned } };
      await db.setting.upsert({ where: { key: LAST_KEY }, create: { key: LAST_KEY, value: assigned }, update: { value: assigned } });
    }
  }
  await db.lead.update({ where: { id: leadId }, data });
  if (assigned) {
    await db.leadActivity.create({ data: { leadId, type: "assigned", payload: { to: assigned, mode: "round-robin" } } });
    await notifyAssignee(leadId, assigned);
  }
}

export async function assignLead(actor: Actor, leadId: string, userId: string | null) {
  assertCan(actor.role, "leads.assign");
  const before = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  await db.lead.update({ where: { id: leadId }, data: { assignedToId: userId } });
  await db.leadActivity.create({ data: { leadId, type: "assigned", actorId: actor.id, payload: { to: userId, mode: "manual" } } });
  await audit(actor, "lead.assign", "Lead", leadId, { before: { assignedToId: before.assignedToId }, after: { assignedToId: userId } });
  if (userId) await notifyAssignee(leadId, userId);
}

/** Flag NEW leads past their first-response deadline; notify administrators once (FR-ADM-042). */
export async function escalateOverdueLeads(now: Date = new Date()): Promise<number> {
  const overdue = await db.lead.findMany({ where: { status: "NEW", escalatedAt: null, firstResponseDueAt: { lt: now } }, take: 200 });
  if (!overdue.length) return 0;
  const admins = await db.user.findMany({ where: { role: { in: ["ADMINISTRATOR", "SUPER_ADMIN"] }, status: "ACTIVE" }, select: { email: true } });
  for (const l of overdue) {
    await db.lead.update({ where: { id: l.id }, data: { escalatedAt: now } });
    await db.leadActivity.create({ data: { leadId: l.id, type: "escalated", payload: { dueAt: l.firstResponseDueAt?.toISOString() } } });
  }
  for (const a of admins) {
    await enqueue({ channel: "email", to: a.email, template: "lead.escalated", payload: { count: overdue.length, references: overdue.map((l) => l.reference).slice(0, 30) } });
  }
  return overdue.length;
}
