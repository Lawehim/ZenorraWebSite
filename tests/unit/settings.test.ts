import { DEFAULT_SETTINGS, resolveSettings, siteSettingsSchema } from "@/lib/settings/schema";

describe("site settings (FR-ADM-047)", () => {
  it("ships with Zenorra Limited's confirmed contact details", () => {
    expect(DEFAULT_SETTINGS.email).toBe("zenorralimited@gmail.com");
    expect(DEFAULT_SETTINGS.phone).toBe("+234 703 234 5179");
    expect(DEFAULT_SETTINGS.address).toMatch(/139 Ogunlana Drive/);
    expect(DEFAULT_SETTINGS.social.instagram).toBe("https://www.instagram.com/zenorraltd");
    expect(DEFAULT_SETTINGS.googleReviewsUrl).toBe("https://g.page/r/CWizvEMq3uuSEBM/review");
  });

  it("defaults validate against the schema", () => {
    expect(siteSettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });

  it("rejects an invalid phone number with a helpful message", () => {
    const r = siteSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, phone: "123" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/valid phone/);
  });

  it("rejects non-https social links", () => {
    const r = siteSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, social: { ...DEFAULT_SETTINGS.social, facebook: "javascript:alert(1)" } });
    expect(r.success).toBe(false);
  });

  it("resolveSettings merges a partial stored record over defaults", () => {
    const s = resolveSettings({ phone: "08039921140", social: { facebook: "https://facebook.com/zenorra" } });
    expect(s.phone).toBe("08039921140");
    expect(s.email).toBe(DEFAULT_SETTINGS.email);
    expect(s.social.facebook).toBe("https://facebook.com/zenorra");
    expect(s.social.instagram).toBe(DEFAULT_SETTINGS.social.instagram);
  });

  it("resolveSettings falls back to defaults when stored data is corrupt", () => {
    expect(resolveSettings({ email: "nope" })).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});
