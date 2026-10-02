import { leadInputSchema, bookingInputSchema, contactInputSchema, subscribeInputSchema } from "@/lib/validation/public";
import { propertyInputSchema, postInputSchema } from "@/lib/validation/admin";

describe("leadInputSchema (FR-LEAD-001/003/013)", () => {
  const base = {
    source: "advisor",
    name: "Adaeze Okonkwo",
    phone: "+44 7700 900 812",
    email: "",
    objective: "Buy land to hold",
    corridors: ["Epe"],
    budgetBand: "Under ₦5m",
    timeline: "1–3 months",
    residency: "Diaspora",
    marketingConsent: false,
    website: "",
  };
  it("accepts a complete advisor brief", () => {
    expect(leadInputSchema.safeParse(base).success).toBe(true);
  });
  it("requires phone or email", () => {
    expect(leadInputSchema.safeParse({ ...base, phone: "", email: "" }).success).toBe(false);
  });
  it("rejects a filled honeypot (TC-LEAD-013)", () => {
    expect(leadInputSchema.safeParse({ ...base, website: "http://spam" }).success).toBe(false);
  });
  it("defaults marketing consent to false (unticked)", () => {
    const { marketingConsent: _omit, ...rest } = base;
    const parsed = leadInputSchema.parse(rest);
    expect(parsed.marketingConsent).toBe(false);
  });
  it("truncates the note at 2,000 characters (TC-EDGE-017)", () => {
    const parsed = leadInputSchema.parse({ ...base, note: "x".repeat(5000) });
    expect(parsed.note!.length).toBe(2000);
  });
});

describe("bookingInputSchema (FR-LEAD-008)", () => {
  it("requires name, phone, date, departure and seats between 1 and 10", () => {
    const ok = { propertySlug: "heritage-gardens", date: "2026-09-05", departurePoint: "Lekki Phase 1", name: "Chidi", phone: "08039921140", seats: 2, website: "" };
    expect(bookingInputSchema.safeParse(ok).success).toBe(true);
    expect(bookingInputSchema.safeParse({ ...ok, seats: 0 }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...ok, phone: "" }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...ok, date: "yesterday" }).success).toBe(false);
  });
});

describe("contactInputSchema (FR-LEAD-009)", () => {
  it("requires a known enquiry type for routing", () => {
    const ok = { name: "Sola", phone: "08039921140", email: "", enquiryType: "property", message: "Hi", website: "" };
    expect(contactInputSchema.safeParse(ok).success).toBe(true);
    expect(contactInputSchema.safeParse({ ...ok, enquiryType: "other-thing" }).success).toBe(false);
  });
});

describe("subscribeInputSchema (FR-LEAD-010)", () => {
  it("normalises the email", () => {
    expect(subscribeInputSchema.parse({ email: " A@B.NG ", website: "" }).email).toBe("a@b.ng");
  });
});

describe("propertyInputSchema (FR-ADM-032, US-MKT-01, TC-ADM-020, NFR-LEG-013)", () => {
  const ok = {
    name: "Heritage Gardens",
    slug: "",
    reference: "ZNR-001",
    corridor: "Ibeju-Lekki",
    locationText: "Eleko, Ibeju-Lekki, Lagos",
    titleType: "REGISTERED_SURVEY",
    titleDocRef: "",
    priceNaira: "4800000",
    depositPercent: "30",
    planMonths: "24",
  };
  it("accepts a valid property and coerces numeric strings", () => {
    const r = propertyInputSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.priceNaira).toBe(4_800_000n);
  });
  it("rejects negative and non-numeric prices with specific messages", () => {
    const neg = propertyInputSchema.safeParse({ ...ok, priceNaira: "-500" });
    const txt = propertyInputSchema.safeParse({ ...ok, priceNaira: "abc" });
    expect(neg.success).toBe(false);
    expect(txt.success).toBe(false);
    if (!neg.success) expect(neg.error.issues[0].message).toMatch(/whole number of naira above zero/);
  });
  it("requires a document reference before claiming C of O or Governor's Consent", () => {
    const r = propertyInputSchema.safeParse({ ...ok, titleType: "C_OF_O", titleDocRef: "" });
    expect(r.success).toBe(false);
    expect(propertyInputSchema.safeParse({ ...ok, titleType: "C_OF_O", titleDocRef: "LS/CofO/2019/0042" }).success).toBe(true);
  });
  it("keeps deposit percentage between 0 and 100", () => {
    expect(propertyInputSchema.safeParse({ ...ok, depositPercent: "120" }).success).toBe(false);
  });
});

describe("postInputSchema (FR-ADM-011)", () => {
  it("requires a headline and accepts an optional future publish date", () => {
    expect(postInputSchema.safeParse({ title: "", status: "DRAFT" }).success).toBe(false);
    expect(postInputSchema.safeParse({ title: "Hello", status: "SCHEDULED", publishedAt: "2026-12-01T09:00" }).success).toBe(true);
  });
  it("requires a publish date when scheduling", () => {
    expect(postInputSchema.safeParse({ title: "Hello", status: "SCHEDULED" }).success).toBe(false);
  });
});
