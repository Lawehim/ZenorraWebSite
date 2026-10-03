// Site settings (FR-ADM-047). One record, edited in Admin → Settings; the footer,
// contact page, structured data and WhatsApp links all read from here.
import { z } from "zod";
import { normalisePhone } from "@/lib/phone";

const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\//.test(v), "Use a full https:// link, or leave empty.");

export const siteSettingsSchema = z.object({
  companyName: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => normalisePhone(v) !== null, "Enter a valid phone number, e.g. +234 703 234 5179."),
  whatsappNumber: z
    .string()
    .trim()
    .refine((v) => normalisePhone(v) !== null, "Enter a valid WhatsApp number."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  address: z.string().trim().min(1).max(200),
  hours: z.string().trim().max(120),
  registration: z.string().trim().max(60),
  googleReviewsUrl: url,
  social: z.object({
    instagram: url,
    facebook: url,
    tiktok: url,
    linkedin: url,
    youtube: url,
    x: url,
  }),
  inspectionDays: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one inspection day."),
  departurePoints: z.array(z.string().trim().min(1).max(80)).min(1, "Add at least one departure point."),
  advisorEmails: z.object({
    property: z.string().trim().toLowerCase().email(),
    solar: z.string().trim().toLowerCase().email(),
    agency: z.string().trim().toLowerCase().email(),
    diaspora: z.string().trim().toLowerCase().email(),
  }),
  currencies: z.array(z.string().trim().min(3).max(3)).min(1),
  // ---- Phase 2
  officeHours: z.object({
    days: z.array(z.number().int().min(0).max(6)),
    open: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM, e.g. 09:00"),
    close: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM, e.g. 18:00"),
  }),
  assignment: z.object({
    mode: z.enum(["manual", "round-robin"]),
    slaHours: z.number().int().min(1).max(168),
  }),
  digest: z.object({
    enabled: z.boolean(),
    recipients: z.array(z.string().trim().toLowerCase().email()),
    hour: z.number().int().min(0).max(23),
  }),
  fx: z.object({
    enabled: z.boolean(),
    GBP: z.number().min(0),
    USD: z.number().min(0),
    CAD: z.number().min(0),
    asOf: z.string().max(20),
  }),
  whatsappMessaging: z.object({ enabled: z.boolean() }),
  // ---- Phase 3
  referrals: z.object({
    enabled: z.boolean(),
    thresholdPercent: z.number().min(1).max(100),
    commissionPercent: z.number().min(0).max(20),
  }),
  bankTransfer: z.object({
    bankName: z.string().trim().max(80),
    accountName: z.string().trim().max(120),
    accountNumber: z.string().trim().max(20),
  }),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const DEFAULT_SETTINGS: SiteSettings = {
  companyName: "Zenorra Limited",
  phone: "+234 703 234 5179",
  whatsappNumber: "+234 703 234 5179",
  email: "zenorralimited@gmail.com",
  address: "139 Ogunlana Drive, opposite Mr Biggs, Masha/Surulere, Lagos, Nigeria",
  hours: "Mon–Fri 9:00–18:00 · Sat 10:00–15:00",
  registration: "",
  googleReviewsUrl: "https://g.page/r/CWizvEMq3uuSEBM/review",
  social: {
    instagram: "https://www.instagram.com/zenorraltd",
    facebook: "",
    tiktok: "https://www.tiktok.com/@zenorraltd",
    linkedin: "",
    youtube: "https://www.youtube.com/@zenorralimited",
    x: "",
  },
  inspectionDays: [3, 6],
  departurePoints: ["7:30 AM — Surulere head office", "8:00 AM — Ikeja (Alausa)", "9:00 AM — Lekki Phase 1", "I'll meet you on site"],
  advisorEmails: {
    property: "zenorralimited@gmail.com",
    solar: "zenorralimited@gmail.com",
    agency: "zenorralimited@gmail.com",
    diaspora: "zenorralimited@gmail.com",
  },
  currencies: ["NGN", "GBP", "USD", "CAD"],
  officeHours: { days: [1, 2, 3, 4, 5, 6], open: "09:00", close: "18:00" },
  assignment: { mode: "round-robin", slaHours: 4 },
  digest: { enabled: true, recipients: ["zenorralimited@gmail.com"], hour: 18 },
  fx: { enabled: false, GBP: 0, USD: 0, CAD: 0, asOf: "" },
  whatsappMessaging: { enabled: false },
  referrals: { enabled: true, thresholdPercent: 30, commissionPercent: 2 },
  bankTransfer: { bankName: "", accountName: "Zenorra Limited", accountNumber: "" },
};

/** Merge stored settings over defaults, ignoring anything that no longer validates. */
export function resolveSettings(stored: unknown): SiteSettings {
  if (!stored || typeof stored !== "object") return clone(DEFAULT_SETTINGS);
  const base = clone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...base, ...(stored as object) };
  // One-level deep merge so new nested settings get defaults on old records.
  for (const [k, v] of Object.entries(base)) {
    const sv = (stored as Record<string, unknown>)[k];
    if (v && typeof v === "object" && !Array.isArray(v) && sv && typeof sv === "object" && !Array.isArray(sv)) merged[k] = { ...v, ...sv };
  }
  const r = siteSettingsSchema.safeParse(merged);
  return r.success ? r.data : clone(DEFAULT_SETTINGS);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
