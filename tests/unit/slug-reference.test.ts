import { slugify, uniqueSlug } from "@/lib/slug";
import { makeReference, isReference } from "@/lib/reference";

describe("slugify", () => {
  it("lowercases, hyphenates and strips punctuation", () => {
    expect(slugify("Heritage Gardens")).toBe("heritage-gardens");
    expect(slugify(`O'Brien & Sons "Phase II"`)).toBe("obrien-sons-phase-ii");
  });
  it("transliterates diacritics (TC-EDGE-007)", () => {
    expect(slugify("Ọ̀ṣunlolá Court")).toBe("osunlola-court");
  });
  it("strips emoji safely (TC-EDGE-008)", () => {
    expect(slugify("Solar 🌞 savings")).toBe("solar-savings");
  });
  it("collapses repeated separators and trims hyphens", () => {
    expect(slugify("  --Lekki – Ajah--  ")).toBe("lekki-ajah");
  });
  it("falls back to a placeholder when nothing survives", () => {
    expect(slugify("🌞🌞")).toBe("untitled");
  });
  it("caps length at 80 characters without a trailing hyphen", () => {
    const s = slugify("word ".repeat(40));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug (TC-ADM-010, TC-EDGE-010)", () => {
  it("returns the base slug when free", async () => {
    await expect(uniqueSlug("Heritage Gardens", async () => false)).resolves.toBe("heritage-gardens");
  });
  it("appends a counter until the slug is free", async () => {
    const taken = new Set(["heritage-gardens", "heritage-gardens-2"]);
    await expect(uniqueSlug("Heritage Gardens", async (s) => taken.has(s))).resolves.toBe("heritage-gardens-3");
  });
});

describe("makeReference (FR-LEAD-005)", () => {
  it("produces a short human-readable reference like ZN-2026-04812", () => {
    expect(makeReference("ZN", 2026, 4812)).toBe("ZN-2026-04812");
    expect(makeReference("BK", 2026, 7)).toBe("BK-2026-00007");
  });
  it("recognises its own format", () => {
    expect(isReference("ZN-2026-04812")).toBe(true);
    expect(isReference("L-2481")).toBe(false);
  });
});
