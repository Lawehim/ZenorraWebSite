import {
  BLOCKS,
  getBlockDef,
  listContentPages,
  validateBlockData,
  resolveBlock,
} from "@/lib/content/registry";

describe("content registry — every public section is editable (FR-ADM-048, FR-CORP-001/002, BO-5)", () => {
  it("covers every public page plus the shared site chrome", () => {
    expect(listContentPages().map((p) => p.page)).toEqual(
      expect.arrayContaining(["Home", "About", "Services", "Properties", "Insights", "Contact", "Site-wide"]),
    );
  });

  it("defines the homepage sections from the prototype", () => {
    const keys = BLOCKS.filter((b) => b.page === "Home").map((b) => b.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "home.hero",
        "home.stats",
        "home.trustStrip",
        "home.about",
        "home.why",
        "home.featured",
        "home.journey",
        "home.twoSolutions",
        "home.solar",
        "home.insights",
        "home.testimonials",
      ]),
    );
  });

  it("has unique keys", () => {
    const keys = BLOCKS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(BLOCKS.map((b) => [b.key]))("defaults for %s validate against its own field schema", (key) => {
    const def = getBlockDef(key)!;
    const result = validateBlockData(key, def.defaults);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.ok).toBe(true);
  });

  it("rejects a value of the wrong type with a field-level message", () => {
    const result = validateBlockData("home.hero", { ...getBlockDef("home.hero")!.defaults, headline: 42 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.headline).toBeDefined();
  });

  it("rejects an empty required field", () => {
    const result = validateBlockData("home.hero", { ...getBlockDef("home.hero")!.defaults, headline: "   " });
    expect(result.ok).toBe(false);
  });

  it("rejects text beyond the field's maximum length", () => {
    const result = validateBlockData("home.hero", { ...getBlockDef("home.hero")!.defaults, headline: "x".repeat(500) });
    expect(result.ok).toBe(false);
  });

  it("drops unknown keys instead of storing them", () => {
    const result = validateBlockData("home.hero", { ...getBlockDef("home.hero")!.defaults, evil: "<script>" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).not.toHaveProperty("evil");
  });

  it("validates repeatable item lists such as the why-choose cards", () => {
    const base = getBlockDef("home.why")!.defaults as { items: { title: string; body: string }[] };
    const bad = validateBlockData("home.why", { ...base, items: [{ title: "", body: "x" }] });
    expect(bad.ok).toBe(false);
    const good = validateBlockData("home.why", { ...base, items: [{ title: "Verified", body: "Checked", icon: "shield" }] });
    expect(good.ok).toBe(true);
  });

  it("resolveBlock falls back to defaults for missing fields and for unknown stored data", () => {
    const merged = resolveBlock("home.hero", { headline: "New headline" });
    expect(merged.headline).toBe("New headline");
    expect(merged.lede).toBe(getBlockDef("home.hero")!.defaults.lede);
    expect(resolveBlock("home.hero", null)).toEqual(getBlockDef("home.hero")!.defaults);
  });

  it("resolveBlock ignores stored values that no longer match the schema", () => {
    const merged = resolveBlock("home.hero", { headline: 123 });
    expect(merged.headline).toBe(getBlockDef("home.hero")!.defaults.headline);
  });

  it("returns undefined for an unknown block key", () => {
    expect(getBlockDef("nope.nope")).toBeUndefined();
    expect(validateBlockData("nope.nope", {}).ok).toBe(false);
  });
});
