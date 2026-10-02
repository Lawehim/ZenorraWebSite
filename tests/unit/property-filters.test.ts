import {
  parseFilters,
  serialiseFilters,
  applyFilters,
  sortProperties,
  BUDGET_BANDS,
  CORRIDORS,
  type FilterableProperty,
} from "@/lib/properties/filters";
import { selectFeatured, relatedProperties } from "@/lib/properties/selection";

const P = (o: Partial<FilterableProperty> & { slug: string }): FilterableProperty => ({
  slug: o.slug,
  corridor: o.corridor ?? "Ibeju-Lekki",
  priceNaira: o.priceNaira ?? 5_000_000,
  titleType: o.titleType ?? "C_OF_O",
  sizeSqm: o.sizeSqm ?? 500,
  curatedOrder: o.curatedOrder ?? 0,
  publishedAt: o.publishedAt ?? new Date("2026-01-01"),
  featured: o.featured ?? false,
  featuredOrder: o.featuredOrder ?? null,
});

const catalogue = [
  P({ slug: "heritage", corridor: "Ibeju-Lekki", priceNaira: 4_800_000, curatedOrder: 1 }),
  P({ slug: "coral", corridor: "Ibeju-Lekki", priceNaira: 7_200_000, curatedOrder: 2 }),
  P({ slug: "amberfield", corridor: "Lekki-Ajah", priceNaira: 12_500_000, curatedOrder: 3, titleType: "GOVERNORS_CONSENT" }),
  P({ slug: "solara", corridor: "Epe", priceNaira: 2_900_000, curatedOrder: 4, titleType: "GAZETTE" }),
  P({ slug: "cedar", corridor: "Lekki-Ajah", priceNaira: 145_000_000, curatedOrder: 5 }),
  P({ slug: "aurora", corridor: "Abuja", priceNaira: 9_800_000, curatedOrder: 6 }),
];

describe("parseFilters / serialiseFilters (FR-PROP-005)", () => {
  it("reads corridor, budget, title and sort from search params", () => {
    const f = parseFilters({ corridor: "Epe", budget: "under-5m", title: "GAZETTE", sort: "price-asc" });
    expect(f).toEqual({ corridor: "Epe", budget: "under-5m", title: "GAZETTE", size: undefined, sort: "price-asc" });
  });
  it("ignores unknown values instead of trusting raw input (TC-SEC-003)", () => {
    const f = parseFilters({ corridor: "<script>", budget: "lots", sort: "drop table" });
    expect(f).toEqual({ corridor: undefined, budget: undefined, title: undefined, size: undefined, sort: "curated" });
  });
  it("round-trips through a query string", () => {
    const f = parseFilters({ corridor: "Ibeju-Lekki", budget: "under-5m" });
    const qs = serialiseFilters(f);
    expect(qs).toBe("corridor=Ibeju-Lekki&budget=under-5m");
    expect(parseFilters(Object.fromEntries(new URLSearchParams(qs)))).toEqual(f);
  });
  it("serialises the default state as an empty string", () => {
    expect(serialiseFilters(parseFilters({}))).toBe("");
  });
  it("exposes the known corridors and budget bands", () => {
    expect(CORRIDORS).toEqual(expect.arrayContaining(["Ibeju-Lekki", "Epe", "Lekki-Ajah", "Ogun", "Abuja"]));
    expect(BUDGET_BANDS.map((b) => b.id)).toEqual(["under-5m", "5m-15m", "15m-50m", "above-50m"]);
  });
});

describe("applyFilters (FR-PROP-002, TC-PROP-002..004)", () => {
  it("filters by corridor", () => {
    expect(applyFilters(catalogue, { corridor: "Ibeju-Lekki", sort: "curated" }).map((p) => p.slug)).toEqual(["heritage", "coral"]);
  });
  it("filters by budget band: under ₦5m means strictly below 5,000,000", () => {
    expect(applyFilters(catalogue, { budget: "under-5m", sort: "curated" }).map((p) => p.slug)).toEqual(["heritage", "solara"]);
  });
  it("combines filters with AND", () => {
    expect(applyFilters(catalogue, { corridor: "Ibeju-Lekki", budget: "under-5m", sort: "curated" }).map((p) => p.slug)).toEqual(["heritage"]);
  });
  it("returns an empty list when nothing matches", () => {
    expect(applyFilters(catalogue, { corridor: "Abuja", budget: "under-5m", sort: "curated" })).toEqual([]);
  });
  it("filters by title type", () => {
    expect(applyFilters(catalogue, { title: "GAZETTE", sort: "curated" }).map((p) => p.slug)).toEqual(["solara"]);
  });
});

describe("sortProperties (FR-PROP-004, TC-PROP-007)", () => {
  it("defaults to curated order", () => {
    expect(sortProperties([...catalogue].reverse(), "curated")[0].slug).toBe("heritage");
  });
  it("sorts by price ascending and descending, stable on ties", () => {
    const tie = [P({ slug: "a", priceNaira: 1, curatedOrder: 2 }), P({ slug: "b", priceNaira: 1, curatedOrder: 1 })];
    expect(sortProperties(catalogue, "price-asc").map((p) => p.slug)[0]).toBe("solara");
    expect(sortProperties(catalogue, "price-desc").map((p) => p.slug)[0]).toBe("cedar");
    expect(sortProperties(tie, "price-asc").map((p) => p.slug)).toEqual(["b", "a"]);
  });
  it("sorts by newest publish date", () => {
    const list = [P({ slug: "old", publishedAt: new Date("2025-01-01") }), P({ slug: "new", publishedAt: new Date("2026-05-01") })];
    expect(sortProperties(list, "newest").map((p) => p.slug)).toEqual(["new", "old"]);
  });
  it("handles bigint prices", () => {
    const list = [P({ slug: "big", priceNaira: 999_999_999_999n }), P({ slug: "small", priceNaira: 1n })];
    expect(sortProperties(list, "price-asc").map((p) => p.slug)).toEqual(["small", "big"]);
  });
});

describe("selectFeatured (FR-HOME-007, TC-ADM-022/023)", () => {
  it("returns featured properties in their admin-defined order", () => {
    const list = [
      P({ slug: "a", featured: true, featuredOrder: 2 }),
      P({ slug: "b", featured: true, featuredOrder: 1 }),
      P({ slug: "c", featured: true, featuredOrder: 3 }),
      P({ slug: "d" }),
    ];
    expect(selectFeatured(list, 3).map((p) => p.slug)).toEqual(["b", "a", "c"]);
  });
  it("fills the gap with the newest published properties when fewer than three are featured", () => {
    const list = [
      P({ slug: "feat", featured: true, featuredOrder: 1, publishedAt: new Date("2024-01-01") }),
      P({ slug: "older", publishedAt: new Date("2025-01-01") }),
      P({ slug: "newest", publishedAt: new Date("2026-06-01") }),
      P({ slug: "newer", publishedAt: new Date("2026-03-01") }),
    ];
    expect(selectFeatured(list, 3).map((p) => p.slug)).toEqual(["feat", "newest", "newer"]);
  });
  it("returns an empty list for an empty catalogue (TC-EDGE-005)", () => {
    expect(selectFeatured([], 3)).toEqual([]);
  });
});

describe("relatedProperties (FR-PROP-017, TC-PROP-012)", () => {
  it("prefers the same corridor, then the same price band, never the current one", () => {
    const current = catalogue[0]; // heritage, Ibeju-Lekki, under 5m
    const related = relatedProperties(current, catalogue, 3).map((p) => p.slug);
    expect(related).not.toContain("heritage");
    expect(related[0]).toBe("coral");
    expect(related[1]).toBe("solara"); // same price band
    expect(related).toHaveLength(3);
  });
});
