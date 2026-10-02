import { db } from "@/lib/db";
import { createLead, createBooking, updateLeadStatus, addLeadNote, exportLeadsCsv, DUPLICATE_WINDOW_DAYS } from "@/server/services/leads";
import { subscribe, confirmSubscription, unsubscribe } from "@/server/services/subscribers";
import { ForbiddenError } from "@/lib/rbac";
import { resetDb, makeUser } from "./helpers";

const ctx = { ip: "102.89.1.1", userAgent: "jest", now: new Date("2026-09-02T10:00:00+01:00") };
const advisorBrief = {
  source: "advisor" as const,
  name: "Adaeze Okonkwo",
  phone: "+44 7700 900 812",
  email: "Adaeze@Example.com ",
  objective: "Buy land to hold",
  corridors: ["Epe", "Ibeju-Lekki", "Ogun"],
  budgetBand: "Under ₦5m",
  timeline: "1–3 months",
  residency: "Diaspora",
  marketingConsent: true,
  pagePath: "/properties/solara-ridge",
  landingPath: "/?utm_source=meta",
  utm: { utm_source: "meta", utm_campaign: "epe" },
  website: "",
};

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("createLead (FR-LEAD-004/005, TC-LEAD-001/003/018)", () => {
  it("persists every qualification answer, attribution and a ZN reference", async () => {
    const r = await createLead(advisorBrief, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reference).toMatch(/^ZN-2026-\d{5}$/);
    const lead = await db.lead.findUniqueOrThrow({ where: { reference: r.reference } });
    expect(lead).toMatchObject({
      name: "Adaeze Okonkwo",
      phoneE164: "+447700900812",
      email: "adaeze@example.com",
      corridors: ["Epe", "Ibeju-Lekki", "Ogun"],
      budgetBand: "Under ₦5m",
      residency: "Diaspora",
      source: "advisor",
      landingPath: "/?utm_source=meta",
      pagePath: "/properties/solara-ridge",
      status: "NEW",
      marketingConsent: true,
    });
    expect(lead.utm).toEqual({ utm_source: "meta", utm_campaign: "epe" });
  });

  it("stores consent evidence: text version, snapshot, IP and timestamp (TC-LEAD-012)", async () => {
    const r = await createLead(advisorBrief, ctx);
    if (!r.ok) throw new Error("expected ok");
    const consent = await db.consent.findFirstOrThrow({ where: { lead: { reference: r.reference } } });
    expect(consent).toMatchObject({ purpose: "marketing", granted: true, ip: "102.89.1.1" });
    expect(consent.textSnapshot.length).toBeGreaterThan(10);
    expect(consent.textVersion).toBeTruthy();
  });

  it("flags a lead without consent as non-consented (TC-LEAD-011)", async () => {
    const r = await createLead({ ...advisorBrief, marketingConsent: false }, ctx);
    if (!r.ok) throw new Error("expected ok");
    const lead = await db.lead.findUniqueOrThrow({ where: { reference: r.reference }, include: { consents: true } });
    expect(lead.marketingConsent).toBe(false);
    expect(lead.consents[0]).toMatchObject({ granted: false });
  });

  it("queues enquirer and internal notifications after the lead is saved (FR-NOTIF-001/002, NFR-AVAIL-005)", async () => {
    const r = await createLead(advisorBrief, ctx);
    if (!r.ok) throw new Error("expected ok");
    const notes = await db.notification.findMany({ orderBy: { createdAt: "asc" } });
    expect(notes.map((n) => n.template).sort()).toEqual(["lead.internal", "lead.received"]);
    const internal = notes.find((n) => n.template === "lead.internal")!;
    expect(JSON.stringify(internal.payload)).toContain("Epe, Ibeju-Lekki, Ogun");
  });

  it("merges a repeat enquiry from the same phone in another format (FR-LEAD-014, TC-LEAD-009)", async () => {
    const first = await createLead({ ...advisorBrief, phone: "08039921140", email: "" }, ctx);
    const second = await createLead({ ...advisorBrief, source: "contact", phone: "+234 803 992 1140", email: "" }, ctx);
    if (!first.ok || !second.ok) throw new Error("expected ok");
    expect(second.merged).toBe(true);
    expect(second.reference).toBe(first.reference);
    expect(await db.lead.count()).toBe(1);
    expect(await db.leadActivity.count({ where: { type: "enquiry" } })).toBe(2);
  });

  it("creates a separate lead beyond the duplicate window (TC-LEAD-010)", async () => {
    await createLead({ ...advisorBrief, phone: "08039921140", email: "" }, ctx);
    const later = new Date(ctx.now.getTime() + (DUPLICATE_WINDOW_DAYS + 1) * 86400_000);
    await createLead({ ...advisorBrief, phone: "08039921140", email: "" }, { ...ctx, now: later });
    expect(await db.lead.count()).toBe(2);
  });

  it("is idempotent for a double-submit with the same key (TC-EDGE-018/019)", async () => {
    const a = await createLead({ ...advisorBrief, idempotencyKey: "k-1" }, ctx);
    const b = await createLead({ ...advisorBrief, idempotencyKey: "k-1" }, ctx);
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(b.reference).toBe(a.reference);
    expect(await db.leadActivity.count({ where: { type: "enquiry" } })).toBe(1);
  });

  it("rejects a honeypot submission without creating anything (TC-LEAD-013)", async () => {
    const r = await createLead({ ...advisorBrief, website: "http://spam.example" }, ctx);
    expect(r.ok).toBe(false);
    expect(await db.lead.count()).toBe(0);
  });

  it("rate-limits the 11th submission in an hour from one IP (TC-LEAD-014)", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await createLead({ ...advisorBrief, phone: `080399211${String(i).padStart(2, "0")}`, email: "" }, ctx);
      expect(r.ok).toBe(true);
    }
    const r = await createLead({ ...advisorBrief, phone: "08039921199", email: "" }, ctx);
    expect(r).toMatchObject({ ok: false, status: 429 });
  });

  it("flags disposable email domains for the advisor (TC-EDGE-016)", async () => {
    const r = await createLead({ ...advisorBrief, email: "x@mailinator.com" }, ctx);
    if (!r.ok) throw new Error("expected ok");
    expect((await db.lead.findUniqueOrThrow({ where: { reference: r.reference } })).disposableEmail).toBe(true);
  });

  it("stores diacritics, apostrophes and emoji intact (TC-EDGE-007/008)", async () => {
    const r = await createLead({ ...advisorBrief, name: "Chinwe Ọ̀ṣunlolá O'Brien", note: "Corner plot please 🌴" }, ctx);
    if (!r.ok) throw new Error("expected ok");
    const lead = await db.lead.findUniqueOrThrow({ where: { reference: r.reference } });
    expect(lead.name).toBe("Chinwe Ọ̀ṣunlolá O'Brien");
    expect(lead.note).toBe("Corner plot please 🌴");
  });
});

describe("createBooking (FR-LEAD-008, US-BUY-12)", () => {
  const booking = { propertySlug: "", date: "2026-09-05", departurePoint: "7:30 AM — Surulere head office", name: "Chidi Anyanwu", phone: "0803 992 1140", seats: 2, website: "" };

  it("creates a booking, a lead in BOOKED_INSPECTION, and queues email + SMS", async () => {
    const r = await createBooking(booking, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reference).toMatch(/^BK-2026-\d{5}$/);
    const b = await db.booking.findUniqueOrThrow({ where: { reference: r.reference }, include: { lead: true } });
    expect(b.seats).toBe(2);
    expect(b.lead.status).toBe("BOOKED_INSPECTION");
    const sms = await db.notification.findFirst({ where: { channel: "sms" } });
    expect(sms).not.toBeNull();
    expect(String((sms!.payload as { text: string }).text).length).toBeLessThanOrEqual(160);
  });

  it("rejects past dates using server time (TC-LEAD-016, TC-EDGE-022)", async () => {
    const r = await createBooking({ ...booking, date: "2026-08-29" }, ctx);
    expect(r).toMatchObject({ ok: false, field: "date" });
  });

  it("rejects days the client does not operate (TC-LEAD-017)", async () => {
    const r = await createBooking({ ...booking, date: "2026-09-04" }, ctx);
    expect(r).toMatchObject({ ok: false, field: "date" });
  });

  it("merges into an existing advisor lead with the same phone", async () => {
    await createLead({ ...advisorBrief, phone: "08039921140", email: "" }, ctx);
    await createBooking(booking, ctx);
    expect(await db.lead.count()).toBe(1);
    expect(await db.booking.count()).toBe(1);
  });
});

describe("lead workflow (FR-ADM-039/043, TC-ADM-024/025, TC-SEC-004)", () => {
  it("advances status, writes the timeline with actor and time, and audits", async () => {
    const advisor = await makeUser("ADVISOR");
    const r = await createLead(advisorBrief, ctx);
    if (!r.ok) throw new Error("expected ok");
    const lead = await db.lead.findUniqueOrThrow({ where: { reference: r.reference } });
    await updateLeadStatus({ id: advisor.id, role: "ADVISOR" }, lead.id, "CONTACTED");
    const updated = await db.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { activities: true } });
    expect(updated.status).toBe("CONTACTED");
    expect(updated.lastContactedAt).not.toBeNull();
    expect(updated.activities.find((a) => a.type === "status")).toMatchObject({ actorId: advisor.id });
    expect(await db.auditLog.count({ where: { entityType: "Lead", entityId: lead.id } })).toBe(1);
  });

  it("refuses status changes from a Viewer at the service layer", async () => {
    const viewer = await makeUser("VIEWER");
    const r = await createLead(advisorBrief, ctx);
    if (!r.ok) throw new Error("expected ok");
    const lead = await db.lead.findUniqueOrThrow({ where: { reference: r.reference } });
    await expect(updateLeadStatus({ id: viewer.id, role: "VIEWER" }, lead.id, "CONTACTED")).rejects.toThrow(ForbiddenError);
  });

  it("adds notes to the timeline", async () => {
    const advisor = await makeUser("ADVISOR");
    const r = await createLead(advisorBrief, ctx);
    if (!r.ok) throw new Error("expected ok");
    const lead = await db.lead.findUniqueOrThrow({ where: { reference: r.reference } });
    await addLeadNote({ id: advisor.id, role: "ADVISOR" }, lead.id, "Called, wants a Saturday visit");
    expect(await db.leadActivity.count({ where: { leadId: lead.id, type: "note" } })).toBe(1);
  });

  it("exports CSV for admins only, watermarked and audited, with valid quoting", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const advisor = await makeUser("ADVISOR");
    await createLead({ ...advisorBrief, name: 'Chinwe "Ọ̀ṣunlolá", O\'Brien' }, ctx);
    await expect(exportLeadsCsv({ id: advisor.id, role: "ADVISOR" }, {})).rejects.toThrow(ForbiddenError);
    const csv = await exportLeadsCsv({ id: admin.id, role: "ADMINISTRATOR", email: admin.email }, {});
    expect(csv).toContain(`"Chinwe ""Ọ̀ṣunlolá"", O'Brien"`);
    expect(csv).toContain(`Exported by ${admin.email}`);
    expect(await db.auditLog.count({ where: { action: "leads.export" } })).toBe(1);
  });
});

describe("newsletter double opt-in (FR-LEAD-010, TC-LEAD-020/021/022)", () => {
  it("creates a pending subscriber and queues a confirmation email", async () => {
    const r = await subscribe({ email: "ada@example.com", website: "" }, ctx);
    expect(r.ok).toBe(true);
    const s = await db.subscriber.findUniqueOrThrow({ where: { email: "ada@example.com" } });
    expect(s.status).toBe("PENDING");
    expect(await db.notification.count({ where: { template: "newsletter.confirm" } })).toBe(1);
  });

  it("confirms with a single-use token", async () => {
    await subscribe({ email: "ada@example.com", website: "" }, ctx);
    const s = await db.subscriber.findUniqueOrThrow({ where: { email: "ada@example.com" } });
    expect(await confirmSubscription(s.confirmToken!, ctx.now)).toBe(true);
    expect((await db.subscriber.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("ACTIVE");
    expect(await confirmSubscription(s.confirmToken!, ctx.now)).toBe(false);
  });

  it("rejects an expired confirmation token (7 days)", async () => {
    await subscribe({ email: "ada@example.com", website: "" }, ctx);
    const s = await db.subscriber.findUniqueOrThrow({ where: { email: "ada@example.com" } });
    const late = new Date(ctx.now.getTime() + 8 * 86400_000);
    expect(await confirmSubscription(s.confirmToken!, late)).toBe(false);
  });

  it("unsubscribes by signed token", async () => {
    await subscribe({ email: "ada@example.com", website: "" }, ctx);
    const s = await db.subscriber.findUniqueOrThrow({ where: { email: "ada@example.com" } });
    await confirmSubscription(s.confirmToken!, ctx.now);
    const { unsubscribeToken } = await import("@/server/services/subscribers");
    expect(await unsubscribe(unsubscribeToken(s.email))).toBe(true);
    expect((await db.subscriber.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("UNSUBSCRIBED");
    expect(await unsubscribe("forged.token")).toBe(false);
  });
});
