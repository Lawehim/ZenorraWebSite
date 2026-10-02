import { z } from "zod";

const optional = (max: number) => z.string().trim().max(max).optional().default("");
const lines = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .default([])
  .transform((v) => (Array.isArray(v) ? v : v.split("\n")).map((s) => s.trim()).filter(Boolean).slice(0, 30));

const STRONG_TITLES = ["C_OF_O", "GOVERNORS_CONSENT"];

export const propertyInputSchema = z
  .object({
    name: z.string().trim().min(1, "Give the property a name.").max(120),
    slug: optional(80),
    reference: z.string().trim().min(1, "Add a reference, e.g. ZNR-009.").max(20),
    corridor: z.string().trim().min(1, "Choose a corridor."),
    locationText: z.string().trim().min(1, "Add the location.").max(160),
    titleType: z.enum(["C_OF_O", "GOVERNORS_CONSENT", "EXCISION", "GAZETTE", "REGISTERED_SURVEY", "EXCISION_IN_PROGRESS", "OTHER"]),
    titleLabel: optional(80),
    titleDocRef: optional(120),
    sizeText: optional(40),
    sizeSqm: z
      .union([z.literal(""), z.coerce.number().int().min(1).max(1_000_000)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    priceNaira: z
      .string()
      .trim()
      .regex(/^[1-9]\d{0,14}$/, "Price must be a whole number of naira above zero, with no commas or symbols.")
      .transform((v) => BigInt(v)),
    priceUnit: optional(60),
    depositPercent: z.coerce.number().int("Deposit must be a whole percentage.").min(0).max(100, "Deposit cannot exceed 100%."),
    planMonths: z.coerce.number().int().min(0).max(120, "Plans longer than 120 months aren't supported."),
    allocationText: optional(60),
    appreciationNote: optional(120),
    blurb: optional(400),
    description: optional(20000),
    features: lines,
    badges: lines,
    currencies: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .default([])
      .transform((v) => (Array.isArray(v) ? v : v.split(/[\n,]/)).map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{3}$/.test(s)).slice(0, 8)),
    availability: z.enum(["AVAILABLE", "SELLING_FAST", "SOLD_OUT"]).optional().default("AVAILABLE"),
    featured: z.coerce.boolean().optional().default(false),
    featuredOrder: z
      .union([z.literal(""), z.coerce.number().int().min(1).max(99)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    curatedOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
    heroBrief: optional(200),
    seoTitle: optional(70),
    seoDescription: optional(170),
  })
  .refine((v) => !STRONG_TITLES.includes(v.titleType) || v.titleDocRef.length > 0, {
    path: ["titleDocRef"],
    message: "Add the title document reference before claiming C of O or Governor's Consent.",
  });

export type PropertyInput = z.infer<typeof propertyInputSchema>;

export const postInputSchema = z
  .object({
    title: z.string().trim().min(1, "Add a headline.").max(160),
    slug: optional(80),
    excerpt: optional(400),
    bodyHtml: optional(200_000),
    body: z.unknown().optional(),
    categoryId: optional(40),
    authorName: optional(80),
    coverMediaId: optional(40),
    status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
    publishedAt: optional(40),
    readingMinutes: z
      .union([z.literal(""), z.coerce.number().int().min(1).max(120)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    seoTitle: optional(70),
    seoDescription: optional(170),
  })
  .refine((v) => v.status !== "SCHEDULED" || (v.publishedAt !== "" && !Number.isNaN(Date.parse(v.publishedAt))), {
    path: ["publishedAt"],
    message: "Choose the date and time this article should go live.",
  });

export type PostInput = z.infer<typeof postInputSchema>;

export const testimonialInputSchema = z.object({
  name: z.string().trim().min(1, "Add the client's name.").max(80),
  roleText: z.string().trim().min(1, "Add context, e.g. 'Bought 2 plots · Ibeju-Lekki'.").max(120),
  quote: z.string().trim().min(1, "Add the quote.").max(600),
  initials: optional(4),
  videoUrl: optional(300),
  order: z.coerce.number().int().min(0).max(999).optional().default(0),
  published: z.coerce.boolean().optional().default(true),
});

export const userInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  name: z.string().trim().min(1, "Enter a name.").max(80),
  role: z.enum(["SUPER_ADMIN", "ADMINISTRATOR", "EDITOR", "ADVISOR", "VIEWER"]),
});
