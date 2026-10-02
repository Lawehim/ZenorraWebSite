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
};

/** Merge stored settings over defaults, ignoring anything that no longer validates. */
export function resolveSettings(stored: unknown): SiteSettings {
  if (!stored || typeof stored !== "object") return clone(DEFAULT_SETTINGS);
  const merged = { ...clone(DEFAULT_SETTINGS), ...(stored as object) };
  merged.social = { ...DEFAULT_SETTINGS.social, ...((stored as Partial<SiteSettings>).social ?? {}) };
  merged.advisorEmails = { ...DEFAULT_SETTINGS.advisorEmails, ...((stored as Partial<SiteSettings>).advisorEmails ?? {}) };
  const r = siteSettingsSchema.safeParse(merged);
  return r.success ? r.data : clone(DEFAULT_SETTINGS);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
