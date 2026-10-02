// Shared client/server schemas for public forms. The server re-parses every
// submission with these — client validation is a courtesy (NFR-SEC-008).
import { z } from "zod";
import { normalisePhone } from "@/lib/phone";
import { normaliseEmail } from "@/lib/email";

const honeypot = z.string().max(0, "Rejected").optional().default("");
const optionalText = (max: number) => z.string().trim().optional().default("").transform((v) => v.slice(0, max));
const phoneField = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine((v) => v === "" || normalisePhone(v) !== null, "Enter a full phone number, e.g. 0803 992 1140.");
const emailField = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine((v) => v === "" || normaliseEmail(v) !== null, "Enter a valid email address.");

export const LEAD_SOURCES = ["advisor", "contact", "property", "article", "notify-next-phase", "whatsapp"] as const;

export const leadInputSchema = z
  .object({
    source: z.enum(LEAD_SOURCES),
    name: z.string().trim().min(1, "Enter your full name.").max(120),
    phone: phoneField,
    email: emailField,
    objective: optionalText(120),
    corridors: z.array(z.string().trim().max(60)).max(10).optional().default([]),
    budgetBand: optionalText(60),
    timeline: optionalText(60),
    residency: optionalText(60),
    note: optionalText(2000),
    propertySlug: optionalText(120),
    marketingConsent: z.boolean().optional().default(false),
    pagePath: optionalText(300),
    landingPath: optionalText(300),
    referrer: optionalText(500),
    utm: z.record(z.string(), z.string().max(200)).optional(),
    callbackWindow: optionalText(60),
    whatsappOptIn: z.boolean().optional().default(false),
    referralCode: optionalText(12),
    idempotencyKey: optionalText(64),
    website: honeypot,
  })
  .refine((v) => v.phone !== "" || v.email !== "", { message: "Add a phone number or an email address so we can reach you.", path: ["phone"] });

export type LeadInput = z.infer<typeof leadInputSchema>;

export const bookingInputSchema = z.object({
  propertySlug: optionalText(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an inspection date."),
  departurePoint: z.string().trim().min(1, "Choose a departure point.").max(80),
  name: z.string().trim().min(1, "Enter your full name.").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "Enter a phone or WhatsApp number.")
    .refine((v) => normalisePhone(v) !== null, "Enter a full phone number, e.g. 0803 992 1140."),
  seats: z.coerce.number().int().min(1, "Choose at least one seat.").max(10, "For groups above 10, call us."),
  marketingConsent: z.boolean().optional().default(false),
  pagePath: optionalText(300),
  landingPath: optionalText(300),
  referrer: optionalText(500),
  utm: z.record(z.string(), z.string().max(200)).optional(),
  callbackWindow: optionalText(60),
  whatsappOptIn: z.boolean().optional().default(false),
  referralCode: optionalText(12),
  idempotencyKey: optionalText(64),
  website: honeypot,
});

export type BookingInput = z.infer<typeof bookingInputSchema>;

export const ENQUIRY_TYPES = [
  { value: "property", label: "Buying property" },
  { value: "estate-marketing", label: "Selling or marketing my estate" },
  { value: "solar", label: "Solar energy enquiry" },
  { value: "agency", label: "Marketing & advertising brief" },
  { value: "other", label: "Something else" },
] as const;

export const contactInputSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your full name.").max(120),
    phone: phoneField,
    email: emailField,
    enquiryType: z.enum(ENQUIRY_TYPES.map((e) => e.value) as [string, ...string[]], { error: "Choose what your enquiry is about." }),
    message: optionalText(2000),
    marketingConsent: z.boolean().optional().default(false),
    pagePath: optionalText(300),
    landingPath: optionalText(300),
    referrer: optionalText(500),
    utm: z.record(z.string(), z.string().max(200)).optional(),
    callbackWindow: optionalText(60),
    whatsappOptIn: z.boolean().optional().default(false),
    referralCode: optionalText(12),
    idempotencyKey: optionalText(64),
    website: honeypot,
  })
  .refine((v) => v.phone !== "" || v.email !== "", { message: "Add a phone number or an email address so we can reach you.", path: ["phone"] });

export type ContactInput = z.infer<typeof contactInputSchema>;

export const subscribeInputSchema = z.object({
  email: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const e = normaliseEmail(v);
      if (!e) ctx.addIssue({ code: "custom", message: "Enter a valid email address." });
      return e ?? "";
    }),
  website: honeypot,
});

/** Flatten a Zod error to {field: message} for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
