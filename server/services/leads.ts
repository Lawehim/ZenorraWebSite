// The lead is sacred (SRS §7.1): persist first, notify second, never lose an enquiry.
import crypto from "node:crypto";
import type { LeadStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { normalisePhone } from "@/lib/phone";
import { normaliseEmail, isDisposableEmail } from "@/lib/email";
import { makeReference } from "@/lib/reference";
import { isBookableDate, BOOKING_REASON_TEXT } from "@/lib/bookings/dates";
import { leadInputSchema, bookingInputSchema, contactInputSchema, fieldErrors, ENQUIRY_TYPES } from "@/lib/validation/public";
import { resolveBlock } from "@/lib/content/registry";
import { getSettings } from "./settings";
import { enqueue } from "./notifications";
import { hitRateLimit, LIMITS } from "./rate-limit";
import { audit } from "./audit";
import { afterLeadSaved } from "./assignment";
import type { Actor, RequestCtx } from "./actor";

export const DUPLICATE_WINDOW_DAYS = 30;
export const CONSENT_TEXT_VERSION = "2026-10-v1";

type Tx = Prisma.TransactionClient;

export type SubmitResult =
  | { ok: true; reference: string; merged: boolean; firstName: string }
  | { ok: false; status: number; message: string; field?: string; errors?: Record<string, string> };

const REJECTED: SubmitResult = { ok: false, status: 400, message: "We couldn't accept that submission. Please try again." };
const RATE_LIMITED: SubmitResult = {
  ok: false,
  status: 429,
  message: "We've received several enquiries from this connection in the last hour. Please call or WhatsApp us instead, or try again later.",
};

function deviceClass(ua?: string): string {
  if (!ua) return "unknown";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

async function newReference(tx: Tx, prefix: "ZN" | "BK", year: number): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const ref = makeReference(prefix, year, crypto.randomInt(1, 99999));
    const taken = prefix === "ZN" ? await tx.lead.findUnique({ where: { reference: ref } }) : await tx.booking.findUnique({ where: { reference: ref } });
    if (!taken) return ref;
  }
  return makeReference(prefix, year, Number(String(Date.now()).slice(-5)));
}

interface LeadFields {
  source: string;
  name: string;
  phone?: string;
  email?: string;
  objective?: string;
  corridors?: string[];
  budgetBand?: string;
  timeline?: string;
  residency?: string;
  note?: string;
  enquiryType?: string;
  propertySlug?: string;
  marketingConsent?: boolean;
  pagePath?: string;
  landingPath?: string;
  referrer?: string;
  utm?: Record<string, string>;
  idempotencyKey?: string;
  status?: LeadStatus;
  callbackWindow?: string;
  whatsappOptIn?: boolean;
  referralCode?: string | null;
  partial?: boolean;
}

/** Create or merge a lead inside a transaction. Returns the lead row. */
async function upsertLead(tx: Tx, f: LeadFields, ctx: Required<Pick<RequestCtx, "now">> & RequestCtx) {
  const phoneE164 = normalisePhone(f.phone);
  const email = normaliseEmail(f.email);
  const now = ctx.now;
  const property = f.propertySlug ? await tx.property.findUnique({ where: { slug: f.propertySlug } }) : null;

  if (f.idempotencyKey) {
    const seen = await tx.leadActivity.findFirst({ where: { type: "enquiry", payload: { path: ["idempotencyKey"], equals: f.idempotencyKey } }, include: { lead: true } });
    if (seen) return { lead: seen.lead, merged: true, duplicateSubmit: true };
  }

  const since = new Date(now.getTime() - DUPLICATE_WINDOW_DAYS * 86400_000);
  const or: Prisma.LeadWhereInput[] = [];
  if (phoneE164) or.push({ phoneE164 });
  if (email) or.push({ email });
  const existing = or.length ? await tx.lead.findFirst({ where: { OR: or, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } }) : null;

  const answers = {
    source: f.source,
    objective: f.objective || undefined,
    corridors: f.corridors?.length ? f.corridors : undefined,
    budgetBand: f.budgetBand || undefined,
    timeline: f.timeline || undefined,
    residency: f.residency || undefined,
    note: f.note || undefined,
    enquiryType: f.enquiryType || undefined,
    property: property?.name,
    pagePath: f.pagePath || undefined,
    idempotencyKey: f.idempotencyKey || undefined,
  };

  if (existing) {
    const lead = await tx.lead.update({
      where: { id: existing.id },
      data: {
        name: existing.name || f.name,
        phoneE164: existing.phoneE164 ?? phoneE164,
        email: existing.email ?? email,
        objective: f.objective || existing.objective,
        corridors: f.corridors?.length ? f.corridors : existing.corridors,
        budgetBand: f.budgetBand || existing.budgetBand,
        timeline: f.timeline || existing.timeline,
        residency: f.residency || existing.residency,
        propertyId: property?.id ?? existing.propertyId,
        marketingConsent: existing.marketingConsent || Boolean(f.marketingConsent),
        status: f.status && existing.status === "NEW" ? f.status : existing.status,
        readAt: null,
        isPartial: f.partial ? existing.isPartial : false,
        callbackWindow: f.callbackWindow || existing.callbackWindow,
        whatsappOptIn: existing.whatsappOptIn || Boolean(f.whatsappOptIn),
      },
    });
    await tx.leadActivity.create({ data: { leadId: lead.id, type: "enquiry", payload: answers, createdAt: now } });
    return { lead, merged: true, duplicateSubmit: false };
  }

  const lead = await tx.lead.create({
    data: {
      reference: await newReference(tx, "ZN", Number(now.toISOString().slice(0, 4))),
      name: f.name,
      phoneE164,
      email,
      objective: f.objective || null,
      corridors: f.corridors ?? [],
      budgetBand: f.budgetBand || null,
      timeline: f.timeline || null,
      residency: f.residency || null,
      note: f.note || null,
      enquiryType: f.enquiryType || null,
      propertyId: property?.id ?? null,
      source: f.source,
      status: f.status ?? "NEW",
      utm: (f.utm ?? undefined) as Prisma.InputJsonValue | undefined,
      landingPath: f.landingPath || null,
      pagePath: f.pagePath || null,
      referrer: f.referrer || null,
      deviceClass: deviceClass(ctx.userAgent),
      marketingConsent: Boolean(f.marketingConsent),
      disposableEmail: email ? isDisposableEmail(email) : false,
      isPartial: Boolean(f.partial),
      callbackWindow: f.callbackWindow || null,
      whatsappOptIn: Boolean(f.whatsappOptIn),
      referralCode: f.referralCode ?? null,
      createdAt: now,
    },
  });
  await tx.leadActivity.create({ data: { leadId: lead.id, type: "enquiry", payload: answers, createdAt: now } });
  return { lead, merged: false, duplicateSubmit: false };
}

async function recordConsent(tx: Tx, leadId: string, granted: boolean, text: string, ctx: RequestCtx) {
  await tx.consent.create({
    data: { leadId, purpose: "marketing", granted, textVersion: CONSENT_TEXT_VERSION, textSnapshot: text, ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300), grantedAt: ctx.now },
  });
}

function advisorGroup(f: LeadFields): "property" | "solar" | "agency" | "diaspora" {
  if (f.residency && /diaspora|abroad/i.test(f.residency)) return "diaspora";
  if (f.enquiryType === "solar") return "solar";
  if (f.enquiryType === "agency" || f.enquiryType === "estate-marketing") return "agency";
  return "property";
}

function brief(f: LeadFields, reference: string) {
  return {
    reference,
    name: f.name,
    phone: f.phone || "",
    email: f.email || "",
    objective: f.objective || "",
    locations: (f.corridors ?? []).join(", "),
    budget: f.budgetBand || "",
    timeline: f.timeline || "",
    residency: f.residency || "",
    note: f.note || "",
    enquiryType: ENQUIRY_TYPES.find((e) => e.value === f.enquiryType)?.label ?? "",
    page: f.pagePath || "",
    source: f.source,
  };
}

async function consentText(): Promise<string> {
  const row = await db.contentBlock.findUnique({ where: { key: "site.advisor" } });
  return resolveBlock("site.advisor", row?.data).consentText;
}

async function submit(fields: LeadFields, ctx: RequestCtx, extra?: (tx: Tx, leadId: string, reference: string) => Promise<void>): Promise<SubmitResult> {
  const now = ctx.now ?? new Date();
  const settings = await getSettings();
  const text = await consentText();
  const result = await db.$transaction(async (tx) => {
    const r = await upsertLead(tx, fields, { ...ctx, now });
    if (!r.duplicateSubmit) {
      await recordConsent(tx, r.lead.id, Boolean(fields.marketingConsent), text, { ...ctx, now });
      if (extra) await extra(tx, r.lead.id, r.lead.reference);
    }
    return r;
  });

  // Notifications are queued only after the lead is committed (NFR-AVAIL-005).
  // Partial leads (abandoned forms) are followed up by advisors, not auto-emailed.
  if (!result.duplicateSubmit && !fields.partial) {
    const b = brief(fields, result.lead.reference);
    const email = normaliseEmail(fields.email);
    if (email) await enqueue({ channel: "email", to: email, template: "lead.received", payload: b, leadId: result.lead.id });
    await enqueue({ channel: "email", to: settings.advisorEmails[advisorGroup(fields)], template: "lead.internal", payload: { ...b, merged: result.merged }, leadId: result.lead.id });
  }
  if (!result.duplicateSubmit) {
    // Phase 2/3 follow-ups (scoring, assignment, SLA, referral) never block or lose the lead.
    try {
      await afterLeadSaved(result.lead.id, { isNew: !result.merged, now, referralCode: fields.referralCode ?? null });
    } catch (e) {
      console.error("lead-followup-failed", e instanceof Error ? e.message : e);
    }
  }
  return { ok: true, reference: result.lead.reference, merged: result.merged, firstName: fields.name.split(/\s+/)[0] };
}

/** An abandoned advisor form where contact details were already given (FR-LEAD-007). */
export async function createPartialLead(input: { name: string; phone?: string; email?: string; answers?: Record<string, unknown>; website?: string; referralCode?: string | null }, ctx: RequestCtx = {}): Promise<SubmitResult> {
  const now = ctx.now ?? new Date();
  if (input.website) return REJECTED;
  const name = (input.name ?? "").trim().slice(0, 120);
  const phone = normalisePhone(input.phone);
  const email = normaliseEmail(input.email);
  if (!name || (!phone && !email)) return { ok: false, status: 422, message: "Name and a phone or email are needed.", field: "phone" };
  if (!(await hitRateLimit(`lead:${ctx.ip ?? "unknown"}`, LIMITS.lead.limit, LIMITS.lead.window, now))) return RATE_LIMITED;
  const a = input.answers ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : undefined);
  return submit(
    {
      source: "advisor-partial",
      partial: true,
      name,
      phone: input.phone,
      email: input.email,
      objective: str(a.objective),
      corridors: Array.isArray(a.corridors) ? (a.corridors as unknown[]).filter((c): c is string => typeof c === "string").slice(0, 10) : [],
      budgetBand: str(a.budgetBand),
      timeline: str(a.timeline),
      residency: str(a.residency),
      referralCode: input.referralCode,
    },
    { ...ctx, now },
  );
}

export async function createLead(input: unknown, ctx: RequestCtx = {}): Promise<SubmitResult> {
  const now = ctx.now ?? new Date();
  const parsed = leadInputSchema.safeParse(input);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return REJECTED;
    const errors = fieldErrors(parsed.error);
    const field = Object.keys(errors)[0];
    return { ok: false, status: 422, message: errors[field], field, errors };
  }
  if (!(await hitRateLimit(`lead:${ctx.ip ?? "unknown"}`, LIMITS.lead.limit, LIMITS.lead.window, now))) return RATE_LIMITED;
  return submit(parsed.data, { ...ctx, now });
}

export async function createContactEnquiry(input: unknown, ctx: RequestCtx = {}): Promise<SubmitResult> {
  const now = ctx.now ?? new Date();
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return REJECTED;
    const errors = fieldErrors(parsed.error);
    const field = Object.keys(errors)[0];
    return { ok: false, status: 422, message: errors[field], field, errors };
  }
  if (!(await hitRateLimit(`lead:${ctx.ip ?? "unknown"}`, LIMITS.lead.limit, LIMITS.lead.window, now))) return RATE_LIMITED;
  const d = parsed.data;
  return submit({ ...d, source: "contact", note: d.message }, { ...ctx, now });
}

export async function createBooking(input: unknown, ctx: RequestCtx = {}): Promise<SubmitResult> {
  const now = ctx.now ?? new Date();
  const parsed = bookingInputSchema.safeParse(input);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return REJECTED;
    const errors = fieldErrors(parsed.error);
    const field = Object.keys(errors)[0];
    return { ok: false, status: 422, message: errors[field], field, errors };
  }
  const d = parsed.data;
  const settings = await getSettings();
  const check = isBookableDate(d.date, settings.inspectionDays, now);
  if (!check.ok) return { ok: false, status: 422, field: "date", message: BOOKING_REASON_TEXT[check.reason], errors: { date: BOOKING_REASON_TEXT[check.reason] } };
  if (!(await hitRateLimit(`booking:${ctx.ip ?? "unknown"}`, LIMITS.booking.limit, LIMITS.booking.window, now))) return RATE_LIMITED;

  let bookingRef = "";
  const property = d.propertySlug ? await db.property.findUnique({ where: { slug: d.propertySlug } }) : null;
  const r = await submit(
    { source: "booking", name: d.name, phone: d.phone, propertySlug: d.propertySlug, marketingConsent: d.marketingConsent, pagePath: d.pagePath, landingPath: d.landingPath, referrer: d.referrer, utm: d.utm, idempotencyKey: d.idempotencyKey, status: "BOOKED_INSPECTION", whatsappOptIn: d.whatsappOptIn, referralCode: d.referralCode },
    { ...ctx, now },
    async (tx, leadId) => {
      bookingRef = await newReference(tx, "BK", Number(now.toISOString().slice(0, 4)));
      await tx.booking.create({
        data: { reference: bookingRef, leadId, propertyId: property?.id ?? null, date: new Date(`${d.date}T00:00:00Z`), departurePoint: d.departurePoint, seats: d.seats, createdAt: now },
      });
      await tx.lead.update({ where: { id: leadId }, data: { status: "BOOKED_INSPECTION" } });
    },
  );
  if (!r.ok || !bookingRef) return r;

  const phone = normalisePhone(d.phone)!;
  const where = property?.name ?? "your chosen estate";
  const text = `Zenorra: seat${d.seats > 1 ? "s" : ""} booked for ${where} on ${d.date}. Ref ${bookingRef}. We'll confirm pick-up by WhatsApp. Reply STOP to opt out.`.slice(0, 160);
  const lead = await db.lead.findUnique({ where: { reference: r.reference } });
  await enqueue({ channel: "sms", to: phone, template: "booking.sms", payload: { text, reference: bookingRef }, leadId: lead?.id });
  return { ...r, reference: bookingRef };
}

// ------------------------------------------------------------------ admin side

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "BOOKED_INSPECTION", label: "Booked inspection" },
  { value: "NEGOTIATING", label: "Negotiating" },
  { value: "CLOSED_WON", label: "Closed — won" },
  { value: "CLOSED_LOST", label: "Closed — lost" },
];

export async function updateLeadStatus(actor: Actor, leadId: string, status: LeadStatus) {
  assertCan(actor.role, "leads.edit");
  await db.$transaction(async (tx) => {
    const before = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
    const now = new Date();
    await tx.lead.update({
      where: { id: leadId },
      data: { status, readAt: before.readAt ?? now, lastContactedAt: status !== "NEW" ? now : before.lastContactedAt },
    });
    await tx.leadActivity.create({ data: { leadId, type: "status", actorId: actor.id, payload: { from: before.status, to: status } } });
    await audit(actor, "lead.status", "Lead", leadId, { before: { status: before.status }, after: { status } }, tx);
  });
}

export async function addLeadNote(actor: Actor, leadId: string, text: string) {
  assertCan(actor.role, "leads.edit");
  const note = text.trim().slice(0, 4000);
  if (!note) return;
  await db.leadActivity.create({ data: { leadId, type: "note", actorId: actor.id, payload: { text: note } } });
}

export async function markLeadRead(leadId: string) {
  await db.lead.updateMany({ where: { id: leadId, readAt: null }, data: { readAt: new Date() } });
}

export interface LeadFilters {
  status?: LeadStatus;
  source?: string;
  q?: string;
  from?: string;
  to?: string;
  propertyId?: string;
}

export function leadWhere(f: LeadFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.source) where.source = f.source;
  if (f.propertyId) where.propertyId = f.propertyId;
  if (f.from || f.to) where.createdAt = { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(`${f.to}T23:59:59Z`) } : {}) };
  if (f.q) {
    const q = f.q.trim();
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q.toLowerCase() } }, { reference: { contains: q.toUpperCase() } }, { phoneE164: { contains: q.replace(/\D/g, "") || q } }];
  }
  return where;
}

export async function listLeads(f: LeadFilters, page = 1, pageSize = 50) {
  const where = leadWhere(f);
  const [rows, total] = await Promise.all([
    db.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { property: { select: { name: true } } } }),
    db.lead.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportLeadsCsv(actor: Actor, f: LeadFilters): Promise<string> {
  assertCan(actor.role, "leads.export");
  const rows = await db.lead.findMany({ where: leadWhere(f), orderBy: { createdAt: "desc" }, include: { property: { select: { name: true } } } });
  const header = ["Reference", "Created", "Name", "Phone", "Email", "Objective", "Locations", "Budget", "Timeline", "Residency", "Property", "Source", "Status", "Marketing consent", "UTM source", "UTM campaign"];
  const lines = rows.map((l) => {
    const utm = (l.utm ?? {}) as Record<string, string>;
    return [l.reference, l.createdAt.toISOString(), l.name, l.phoneE164, l.email, l.objective, l.corridors.join("; "), l.budgetBand, l.timeline, l.residency, l.property?.name, l.source, l.status, l.marketingConsent ? "yes" : "no", utm.utm_source, utm.utm_campaign].map(csvCell).join(",");
  });
  await audit(actor, "leads.export", "Lead", null, { after: { filters: f, count: rows.length } });
  const watermark = csvCell(`Exported by ${actor.email ?? actor.id} at ${new Date().toISOString()} — confidential personal data`);
  return "﻿" + [watermark, header.join(","), ...lines].join("\r\n");
}
