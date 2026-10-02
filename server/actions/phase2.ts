"use server";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/auth/session";
import { assignLead } from "@/server/services/assignment";
import { staffReply, closeChat, linkChatToLead } from "@/server/services/chat";
import { findPersonalData, exportPersonalData, erasePersonalData } from "@/server/services/dsr";
import { restoreRevision } from "@/server/services/posts";
import { renameCategory, mergeCategories, deleteCategory } from "@/server/services/categories";
import { updateMediaMeta } from "@/server/services/media";
import { attachPropertyDocument, setPropertyDocumentVisibility, removePropertyDocument } from "@/server/services/properties";
import { saveTeamMember, deleteTeamMember, savePartner, deletePartner } from "@/server/services/people";
import { db } from "@/lib/db";

export async function assignLeadAction(leadId: string, userId: string) {
  const actor = await requireActor("leads.assign");
  await assignLead(actor, leadId, userId || null);
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
}

export async function chatReplyAction(threadId: string, body: string) {
  const actor = await requireActor("leads.edit");
  await staffReply(actor, threadId, body);
  revalidatePath(`/admin/chat/${threadId}`);
}

export async function chatCloseAction(threadId: string) {
  const actor = await requireActor("leads.edit");
  await closeChat(actor, threadId);
  revalidatePath("/admin/chat");
}

export async function chatLinkAction(threadId: string, leadReference: string) {
  const actor = await requireActor("leads.edit");
  const lead = await db.lead.findUnique({ where: { reference: leadReference.trim().toUpperCase() } });
  if (!lead) return { ok: false, message: "No lead with that reference." };
  await linkChatToLead(actor, threadId, lead.id);
  revalidatePath(`/admin/chat/${threadId}`);
  return { ok: true };
}

export async function dsrSearchAction(identifier: string) {
  const actor = await requireActor("leads.export");
  const r = await findPersonalData(actor, identifier);
  return { leads: r.leads.map((l) => ({ id: l.id, reference: l.reference, name: l.name, createdAt: l.createdAt.toISOString() })), subscribers: r.subscribers.length, buyers: r.buyers.length, chats: r.chats.length };
}

export async function dsrExportAction(identifier: string) {
  const actor = await requireActor("leads.export");
  return JSON.stringify(await exportPersonalData(actor, identifier), null, 2);
}

export async function dsrEraseAction(identifier: string, confirmText: string) {
  const actor = await requireActor("dsr.erase");
  if (confirmText.trim().toUpperCase() !== "ERASE") return { ok: false as const, message: "Type ERASE to confirm.", leads: 0 };
  const r = await erasePersonalData(actor, identifier);
  return { ok: true as const, message: "", ...r };
}

export async function restoreRevisionAction(revisionId: string) {
  const actor = await requireActor("posts.edit");
  const postId = await restoreRevision(actor, revisionId);
  revalidatePath(`/admin/posts/${postId}`);
  revalidatePath("/insights", "layout");
}

export async function renameCategoryAction(id: string, name: string) {
  const actor = await requireActor("posts.edit");
  await renameCategory(actor, id, name);
  revalidatePath("/admin/categories");
  revalidatePath("/insights");
}

export async function mergeCategoryAction(fromId: string, intoId: string) {
  const actor = await requireActor("posts.edit");
  await mergeCategories(actor, fromId, intoId);
  revalidatePath("/admin/categories");
  revalidatePath("/insights", "layout");
}

export async function deleteCategoryAction(id: string) {
  const actor = await requireActor("posts.edit");
  const r = await deleteCategory(actor, id);
  revalidatePath("/admin/categories");
  return r;
}

export async function setFocalPointAction(id: string, focalX: number, focalY: number) {
  const actor = await requireActor("media.upload");
  await updateMediaMeta(actor, id, { focalX, focalY });
  revalidatePath("/admin/media");
  revalidatePath("/", "layout");
}

export async function attachDocumentAction(propertyId: string, input: { mediaAssetId: string; label: string; kind: string; isPublic: boolean }) {
  const actor = await requireActor("properties.edit");
  await attachPropertyDocument(actor, propertyId, input);
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/properties", "layout");
}

export async function documentVisibilityAction(documentId: string, isPublic: boolean, propertyId: string) {
  const actor = await requireActor("properties.edit");
  await setPropertyDocumentVisibility(actor, documentId, isPublic);
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/properties", "layout");
}

export async function removeDocumentAction(documentId: string, propertyId: string) {
  const actor = await requireActor("properties.edit");
  await removePropertyDocument(actor, documentId);
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/properties", "layout");
}

export async function saveTeamAction(id: string | null, data: Record<string, unknown>) {
  const actor = await requireActor("testimonials.manage");
  try {
    await saveTeamMember(actor, id, data);
  } catch {
    return { ok: false, message: "Check the name and role." };
  }
  revalidatePath("/admin/team");
  revalidatePath("/about");
  return { ok: true };
}

export async function deleteTeamAction(id: string) {
  const actor = await requireActor("testimonials.manage");
  await deleteTeamMember(actor, id);
  revalidatePath("/admin/team");
  revalidatePath("/about");
}

export async function savePartnerAction(id: string | null, data: Record<string, unknown>) {
  const actor = await requireActor("testimonials.manage");
  try {
    await savePartner(actor, id, data);
  } catch {
    return { ok: false, message: "Check the name and use a full https:// link." };
  }
  revalidatePath("/admin/team");
  revalidatePath("/about");
  return { ok: true };
}

export async function deletePartnerAction(id: string) {
  const actor = await requireActor("testimonials.manage");
  await deletePartner(actor, id);
  revalidatePath("/admin/team");
  revalidatePath("/about");
}
