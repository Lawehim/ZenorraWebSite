import { db } from "@/lib/db";
import { createLead, createPartialLead, createBooking } from "@/server/services/leads";
import { assignLead, escalateOverdueLeads } from "@/server/services/assignment";
import { sendInspectionReminders, sendDailyDigest } from "@/server/services/scheduled";
import { startChat, postVisitorMessage, staffReply, chatTranscript, closeChat } from "@/server/services/chat";
import { handleWhatsAppInbound, verifyWhatsAppSignature } from "@/server/services/whatsapp";
import { findPersonalData, erasePersonalData, exportPersonalData } from "@/server/services/dsr";
import { leadsReport } from "@/server/services/reports";
import { savePost, restoreRevision } from "@/server/services/posts";
import { renameCategory, mergeCategories, deleteCategory } from "@/server/services/categories";
import { updateSettings } from "@/server/services/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { ForbiddenError } from "@/lib/rbac";
import crypto from "node:crypto";
import { resetDb, makeUser } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const ctx = (now = new Date()) => ({ ip: `10.${Math.floor(Math.random() * 250)}.0.1`, userAgent: "jest", now });
const brief = { source: "advisor" as const, name: "Adaeze Okonkwo", phone: "08039921140", email: "", objective: "Buy land to hold", corridors: ["Epe"], budgetBand: "Above ₦50m", timeline: "Within 30 days", residency: "Diaspora", website: "" };

describe("scoring + round-robin assignment + SLA (FR-LEAD-018, FR-ADM-041/042)", () => {
  it("scores new leads and assigns them in rotation with an SLA deadline", async () => {
    const a = await makeUser("ADVISOR", "a@z.test");
    const b = await makeUser("ADVISOR", "b@z.test");
    const r1 = await createLead(brief, ctx());
    const r2 = await createLead({ ...brief, phone: "08039921141" }, ctx());
    if (!r1.ok || !r2.ok) throw new Error();
    const [l1, l2] = await Promise.all([db.lead.findUniqueOrThrow({ where: { reference: r1.reference } }), db.lead.findUniqueOrThrow({ where: { reference: r2.reference } })]);
    expect(l1.score).toBeGreaterThan(50);
    expect(new Set([l1.assignedToId, l2.assignedToId])).toEqual(new Set([a.id, b.id]));
    expect(l1.firstResponseDueAt!.getTime() - l1.createdAt.getTime()).toBe(4 * 3600_000);
    expect(await db.notification.count({ where: { template: "lead.assigned" } })).toBe(2);
  });

  it("allows manual assignment by an administrator only", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const adv = await makeUser("ADVISOR");
    const r = await createLead(brief, ctx());
    if (!r.ok) throw new Error();
    const lead = await db.lead.findUniqueOrThrow({ where: { reference: r.reference } });
    await expect(assignLead({ id: adv.id, role: "ADVISOR" }, lead.id, adv.id)).rejects.toThrow(ForbiddenError);
    await assignLead({ id: admin.id, role: "ADMINISTRATOR" }, lead.id, adv.id);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedToId).toBe(adv.id);
  });

  it("escalates leads not contacted within the SLA, once", async () => {
    await makeUser("ADMINISTRATOR");
    const r = await createLead(brief, ctx());
    if (!r.ok) throw new Error();
    const later = new Date(Date.now() + 5 * 3600_000);
    expect(await escalateOverdueLeads(later)).toBe(1);
    expect(await escalateOverdueLeads(later)).toBe(0);
    expect((await db.lead.findFirstOrThrow()).escalatedAt).not.toBeNull();
    expect(await db.notification.count({ where: { template: "lead.escalated" } })).toBe(1);
  });
});

describe("partial leads (FR-LEAD-007)", () => {
  it("creates a partial lead from contact details given before abandonment", async () => {
    const r = await createPartialLead({ name: "Chidi", phone: "08039921140", email: "", answers: { objective: "Buy to rent out" }, website: "" }, ctx());
    expect(r.ok).toBe(true);
    const lead = await db.lead.findFirstOrThrow();
    expect(lead).toMatchObject({ isPartial: true, source: "advisor-partial", objective: "Buy to rent out" });
  });
  it("is completed, not duplicated, when the full brief arrives", async () => {
    await createPartialLead({ name: "Chidi", phone: "08039921140", email: "", answers: {}, website: "" }, ctx());
    await createLead(brief, ctx());
    expect(await db.lead.count()).toBe(1);
    expect((await db.lead.findFirstOrThrow()).isPartial).toBe(false);
  });
  it("requires contact details", async () => {
    expect((await createPartialLead({ name: "Chidi", phone: "", email: "", answers: {}, website: "" }, ctx())).ok).toBe(false);
  });
});

describe("scheduled jobs (FR-NOTIF-004/010)", () => {
  it("sends one SMS reminder 24h before an inspection and skips cancelled ones", async () => {
    const now = new Date("2026-09-04T10:00:00+01:00"); // Friday
    await createBooking({ propertySlug: "", date: "2026-09-05", departurePoint: "Lekki", name: "Ada", phone: "08039921140", seats: 1, website: "" }, ctx(new Date("2026-09-02T10:00:00+01:00")));
    await createBooking({ propertySlug: "", date: "2026-09-05", departurePoint: "Lekki", name: "Bo", phone: "08039921150", seats: 1, website: "" }, ctx(new Date("2026-09-02T10:00:00+01:00")));
    await db.booking.updateMany({ where: { lead: { name: "Bo" } }, data: { status: "CANCELLED" } });
    expect(await sendInspectionReminders(now)).toBe(1);
    expect(await sendInspectionReminders(now)).toBe(0);
    expect(await db.notification.count({ where: { template: "booking.reminder" } })).toBe(1);
  });
  it("sends the daily digest once per day to the configured recipients", async () => {
    await createLead(brief, ctx());
    const at = new Date();
    at.setUTCHours(17, 30); // 18:30 WAT ≥ digest hour 18
    expect(await sendDailyDigest(at)).toBe(true);
    expect(await sendDailyDigest(at)).toBe(false);
    const n = await db.notification.findFirstOrThrow({ where: { template: "digest.daily" } });
    expect(n.to).toBe("zenorralimited@gmail.com");
  });
});

describe("live chat (FR-CHAT-001..003)", () => {
  it("lets a visitor chat and staff reply; the transcript attaches to the lead when identified", async () => {
    const adv = await makeUser("ADVISOR");
    await createLead(brief, ctx());
    const { token } = await startChat({ name: "Adaeze", contact: "+234 803 992 1140", pagePath: "/properties" });
    await postVisitorMessage(token, "Is Heritage Gardens still available?");
    const thread = await db.chatThread.findFirstOrThrow({ where: { visitorToken: token } });
    await staffReply({ id: adv.id, role: "ADVISOR" }, thread.id, "Yes — 6 plots left.");
    const t = await chatTranscript(token);
    expect(t.map((m) => m.sender)).toEqual(["VISITOR", "STAFF"]);
    expect(thread.leadId).not.toBeNull();
  });
  it("converts an out-of-hours chat with contact details into a lead", async () => {
    const { token } = await startChat({ name: "Night Owl", contact: "nightowl@example.com", pagePath: "/" });
    await postVisitorMessage(token, "Please call me tomorrow", { offline: true });
    const lead = await db.lead.findFirstOrThrow({ where: { email: "nightowl@example.com" } });
    expect(lead.source).toBe("chat");
  });
  it("rejects messages to a closed or unknown thread", async () => {
    const adv = await makeUser("ADVISOR");
    const { token } = await startChat({ name: "x", contact: "", pagePath: "/" });
    const thread = await db.chatThread.findFirstOrThrow();
    await closeChat({ id: adv.id, role: "ADVISOR" }, thread.id);
    await expect(postVisitorMessage(token, "hello")).rejects.toThrow();
    await expect(postVisitorMessage("nope", "hello")).rejects.toThrow();
  });
});

describe("WhatsApp inbound (FR-NOTIF-006)", () => {
  const secret = "app-secret";
  const payload = (from: string, text: string) => ({ entry: [{ changes: [{ value: { contacts: [{ profile: { name: "Ada" } }], messages: [{ from, id: crypto.randomUUID(), type: "text", text: { body: text } }] } }] }] });
  it("verifies the X-Hub-Signature-256 header", () => {
    const body = JSON.stringify(payload("2348039921140", "hi"));
    const sig = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWhatsAppSignature(body, sig, secret)).toBe(true);
    expect(verifyWhatsAppSignature(body, "sha256=bad", secret)).toBe(false);
  });
  it("captures replies on the matching lead's timeline", async () => {
    await createLead(brief, ctx());
    await handleWhatsAppInbound(payload("2348039921140", "I'd like to inspect on Saturday"));
    const lead = await db.lead.findFirstOrThrow({ include: { activities: true } });
    expect(lead.activities.some((a) => a.type === "whatsapp-in")).toBe(true);
  });
  it("creates a lead for an unknown sender and honours STOP", async () => {
    await handleWhatsAppInbound(payload("2348055555555", "Hello"));
    const lead = await db.lead.findFirstOrThrow({ where: { phoneE164: "+2348055555555" } });
    expect(lead.source).toBe("whatsapp");
    await db.lead.update({ where: { id: lead.id }, data: { whatsappOptIn: true } });
    await handleWhatsAppInbound(payload("2348055555555", "STOP"));
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).whatsappOptIn).toBe(false);
  });
});

describe("data subject requests (FR-ADM-053, US-ADM-03)", () => {
  it("finds, exports and erases a person's data while keeping aggregate counts", async () => {
    const sa = await makeUser("SUPER_ADMIN");
    const admin = await makeUser("ADMINISTRATOR");
    await createLead({ ...brief, email: "ada@example.com" }, ctx());
    await db.subscriber.create({ data: { email: "ada@example.com", status: "ACTIVE" } });
    const found = await findPersonalData({ id: admin.id, role: "ADMINISTRATOR" }, "0803 992 1140");
    expect(found.leads).toHaveLength(1);
    const exported = await exportPersonalData({ id: admin.id, role: "ADMINISTRATOR" }, "ada@example.com");
    expect(JSON.stringify(exported)).toContain("Adaeze Okonkwo");
    await expect(erasePersonalData({ id: admin.id, role: "ADMINISTRATOR" }, "ada@example.com")).rejects.toThrow(ForbiddenError);
    await erasePersonalData({ id: sa.id, role: "SUPER_ADMIN" }, "ada@example.com");
    const lead = await db.lead.findFirstOrThrow();
    expect(lead).toMatchObject({ name: "Erased", phoneE164: null, email: null });
    expect(await db.lead.count()).toBe(1); // aggregates survive
    expect(await db.subscriber.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: "dsr.erase" } })).toBe(1);
  });
});

describe("reports (FR-ANL-006)", () => {
  it("groups leads by source, property and advisor over a period", async () => {
    await makeUser("ADVISOR");
    await createLead(brief, ctx());
    await createLead({ ...brief, source: "contact", phone: "08039921141" }, ctx());
    const r = await leadsReport({ from: new Date(Date.now() - 86400_000), to: new Date(Date.now() + 86400_000) });
    expect(r.bySource).toEqual(expect.arrayContaining([{ key: "advisor", count: 1 }, { key: "contact", count: 1 }]));
    expect(r.total).toBe(2);
    expect(r.byAdvisor[0].count).toBe(2);
  });
});

describe("revisions and categories (FR-ADM-015/016)", () => {
  it("restores an earlier revision", async () => {
    const ed = await makeUser("EDITOR");
    const actor = { id: ed.id, role: "EDITOR" as const };
    const r = await savePost(actor, null, { title: "Draft", status: "DRAFT", bodyHtml: "<p>first</p>" });
    if (!r.ok) throw new Error();
    await savePost(actor, r.id, { title: "Draft", slug: "draft", status: "DRAFT", bodyHtml: "<p>second</p>" });
    const first = await db.postRevision.findFirstOrThrow({ where: { postId: r.id }, orderBy: { createdAt: "asc" } });
    await restoreRevision(actor, first.id);
    expect((await db.post.findUniqueOrThrow({ where: { id: r.id } })).bodyHtml).toBe("<p>first</p>");
  });
  it("renames, merges and refuses to delete a category in use", async () => {
    const ed = await makeUser("EDITOR");
    const actor = { id: ed.id, role: "EDITOR" as const };
    const a = await db.category.create({ data: { slug: "a", name: "A" } });
    const b = await db.category.create({ data: { slug: "b", name: "B" } });
    await db.post.create({ data: { slug: "p", title: "P", categoryId: a.id } });
    await renameCategory(actor, a.id, "Buyer guides");
    expect((await db.category.findUniqueOrThrow({ where: { id: a.id } })).name).toBe("Buyer guides");
    await expect(deleteCategory(actor, a.id)).resolves.toEqual({ ok: false, message: "1 article uses this category. Merge it into another category first." });
    await mergeCategories(actor, a.id, b.id);
    expect((await db.post.findFirstOrThrow()).categoryId).toBe(b.id);
    expect(await db.category.count()).toBe(1);
  });
});

describe("settings for phase 2 (office hours, assignment, FX)", () => {
  it("accepts new nested settings and rejects malformed times", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const actor = { id: admin.id, role: "ADMINISTRATOR" as const };
    expect((await updateSettings(actor, { ...DEFAULT_SETTINGS, officeHours: { days: [1], open: "9am", close: "18:00" } })).ok).toBe(false);
    expect((await updateSettings(actor, { ...DEFAULT_SETTINGS, fx: { enabled: true, GBP: 2050, USD: 1550, CAD: 1130, asOf: "2026-09-30" } })).ok).toBe(true);
  });
});
