"use server";
import { revalidatePath } from "next/cache";
import type { BookingStatus, LeadStatus } from "@prisma/client";
import { requireActor } from "@/server/auth/session";
import { updateLeadStatus, addLeadNote } from "@/server/services/leads";
import { db } from "@/lib/db";
import { enqueue } from "@/server/services/notifications";
import { audit } from "@/server/services/audit";
import { processQueueSoon } from "@/server/services/queue-trigger";

export async function setLeadStatusAction(id: string, status: LeadStatus) {
  const actor = await requireActor("leads.edit");
  await updateLeadStatus(actor, id, status);
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
}

export async function addLeadNoteAction(id: string, text: string) {
  const actor = await requireActor("leads.edit");
  await addLeadNote(actor, id, text);
  revalidatePath(`/admin/leads/${id}`);
}

export async function setBookingStatusAction(id: string, status: BookingStatus) {
  const actor = await requireActor("inspections.manage");
  const b = await db.booking.update({ where: { id }, data: { status }, include: { lead: true, property: true } });
  await audit(actor, "booking.status", "Booking", id, { after: { status } });
  if (status === "CANCELLED" && b.lead.phoneE164) {
    await enqueue({ channel: "sms", to: b.lead.phoneE164, template: "booking.sms", payload: { text: `Zenorra: your inspection ${b.reference} on ${b.date.toISOString().slice(0, 10)} has been cancelled. Call us to rebook. Reply STOP to opt out.` }, leadId: b.leadId });
    processQueueSoon();
  }
  revalidatePath("/admin/inspections");
}
