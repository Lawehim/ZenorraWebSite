import { matchesSearch, normaliseSearch, paginate } from "@/lib/properties/search";
import { indicativePrices } from "@/lib/fx";
import { shareLinks } from "@/lib/share";
import { lineDiff } from "@/lib/diff";

describe("free-text search (FR-PROP-006)", () => {
  const p = { name: "Ọ̀ṣunlolá Gardens", locationText: "Eleko, Ibeju-Lekki", blurb: "Dry land near the Free Trade Zone" };
  it("is case- and diacritic-insensitive", () => {
    expect(matchesSearch(p, "osunlola")).toBe(true);
    expect(matchesSearch(p, "IBEJU")).toBe(true);
  });
  it("matches partial words across fields, requiring every term", () => {
    expect(matchesSearch(p, "free trade")).toBe(true);
    expect(matchesSearch(p, "free abuja")).toBe(false);
  });
  it("treats an empty query as match-all", () => {
    expect(matchesSearch(p, "   ")).toBe(true);
  });
  it("normalises safely and caps length", () => {
    expect(normaliseSearch("  ÉPÉ  <b> ")).toBe("epe b");
    expect(normaliseSearch("x".repeat(500)).length).toBe(80);
  });
});

describe("paginate (FR-PROP-007)", () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  it("returns 24 per page with prev/next flags", () => {
    expect(paginate(items, 1, 24)).toMatchObject({ page: 1, pages: 3, hasPrev: false, hasNext: true });
    expect(paginate(items, 3, 24).items).toEqual([48, 49]);
  });
  it("clamps out-of-range pages", () => {
    expect(paginate(items, 99, 24).page).toBe(3);
    expect(paginate(items, -2, 24).page).toBe(1);
    expect(paginate([], 1, 24)).toMatchObject({ page: 1, pages: 1, items: [] });
  });
});

describe("indicativePrices (FR-GLOB-011)", () => {
  const rates = { GBP: 2050, USD: 1550, CAD: 1130, asOf: "2026-09-30" };
  it("converts naira to GBP/USD/CAD at the configured rate, rounded", () => {
    expect(indicativePrices(4_800_000, rates)).toEqual([
      { currency: "GBP", amount: 2341, label: "≈ £2,341" },
      { currency: "USD", amount: 3097, label: "≈ $3,097" },
      { currency: "CAD", amount: 4248, label: "≈ CA$4,248" },
    ]);
  });
  it("returns nothing when rates are missing or invalid", () => {
    expect(indicativePrices(4_800_000, null)).toEqual([]);
    expect(indicativePrices(4_800_000, { GBP: 0, USD: 0, CAD: 0, asOf: "" })).toEqual([]);
  });
});

describe("shareLinks (FR-CONT-008)", () => {
  it("adds UTM parameters naming the share channel", () => {
    const l = shareLinks("https://zenorra.ng/insights/avoid-land-scams", "How to avoid land scams");
    expect(l.whatsapp).toContain("wa.me/?text=");
    expect(decodeURIComponent(l.whatsapp)).toContain("utm_source=whatsapp&utm_medium=share");
    expect(decodeURIComponent(l.x)).toContain("utm_source=x");
    expect(decodeURIComponent(l.facebook)).toContain("utm_source=facebook");
    expect(l.copy).toBe("https://zenorra.ng/insights/avoid-land-scams?utm_source=copy&utm_medium=share&utm_campaign=article");
  });
});

describe("lineDiff (FR-ADM-015)", () => {
  it("marks added and removed lines", () => {
    expect(lineDiff("a\nb\nc", "a\nB\nc\nd")).toEqual([
      { op: "same", text: "a" },
      { op: "del", text: "b" },
      { op: "add", text: "B" },
      { op: "same", text: "c" },
      { op: "add", text: "d" },
    ]);
  });
});
