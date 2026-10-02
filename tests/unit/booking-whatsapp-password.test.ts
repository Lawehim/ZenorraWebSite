import { isBookableDate, nextInspectionDates, lagosDateString } from "@/lib/bookings/dates";
import { whatsappLink } from "@/lib/whatsapp";
import { checkPasswordPolicy } from "@/lib/auth/password-policy";

describe("isBookableDate (FR-LEAD-008, TC-LEAD-016/017, TC-EDGE-022)", () => {
  const days = [3, 6]; // Wednesday, Saturday
  const serverNow = new Date("2026-09-02T10:00:00+01:00"); // Wednesday in Lagos

  it("accepts a future operating day", () => {
    expect(isBookableDate("2026-09-05", days, serverNow)).toEqual({ ok: true }); // Saturday
  });
  it("rejects past dates using server time", () => {
    expect(isBookableDate("2026-08-29", days, serverNow)).toEqual({ ok: false, reason: "past" });
  });
  it("rejects non-operating days", () => {
    expect(isBookableDate("2026-09-04", days, serverNow)).toEqual({ ok: false, reason: "not-inspection-day" });
  });
  it("rejects today's date (bookings close the day before)", () => {
    expect(isBookableDate("2026-09-02", days, serverNow)).toEqual({ ok: false, reason: "past" });
  });
  it("rejects malformed dates", () => {
    expect(isBookableDate("2026-13-45", days, serverNow)).toEqual({ ok: false, reason: "invalid" });
  });
  it("lists the next N inspection dates", () => {
    expect(nextInspectionDates(days, serverNow, 3)).toEqual(["2026-09-05", "2026-09-09", "2026-09-12"]);
  });
  it("formats a date in Lagos time", () => {
    expect(lagosDateString(new Date("2026-09-01T23:30:00Z"))).toBe("2026-09-02");
  });
});

describe("whatsappLink (FR-LEAD-011, TC-LEAD-019)", () => {
  it("builds a wa.me link with the number digits and an encoded pre-filled message", () => {
    const url = whatsappLink("+234 801 234 5678", "Hello about Heritage Gardens (ZNR-001)");
    expect(url).toBe("https://wa.me/2348012345678?text=Hello%20about%20Heritage%20Gardens%20(ZNR-001)");
  });
  it("omits the text parameter when there is no message", () => {
    expect(whatsappLink("08012345678")).toBe("https://wa.me/2348012345678");
  });
});

describe("checkPasswordPolicy (FR-ADM-002, TC-SEC-009)", () => {
  it("rejects passwords under 12 characters", () => {
    expect(checkPasswordPolicy("Short1!")).toEqual({ ok: false, reason: "Use at least 12 characters." });
  });
  it("rejects known breached passwords", () => {
    expect(checkPasswordPolicy("password1234")).toEqual({ ok: false, reason: "This password appears in known data breaches. Choose another." });
  });
  it("accepts a long, uncommon passphrase", () => {
    expect(checkPasswordPolicy("gold-leaf-over-epe-2026")).toEqual({ ok: true });
  });
});
