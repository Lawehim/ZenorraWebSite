import { normalisePhone, isValidPhone } from "@/lib/phone";
import { normaliseEmail, isDisposableEmail } from "@/lib/email";

describe("normalisePhone (TC-EDGE-013, US-ADV-03)", () => {
  it.each([
    "08039921140",
    "+2348039921140",
    "234 803 992 1140",
    "0803-992-1140",
    "+234 803 992 1140",
    "(0803) 992 1140",
    "2348039921140",
    "+234 (0) 803 992 1140",
  ])("normalises %s to a single E.164 value", (input) => {
    expect(normalisePhone(input)).toBe("+2348039921140");
  });

  it("keeps international numbers that already carry a country code", () => {
    expect(normalisePhone("+44 7700 900 812")).toBe("+447700900812");
  });

  it("rejects nine- and fifteen-digit numbers (TC-EDGE-014)", () => {
    expect(normalisePhone("080399211")).toBeNull();
    expect(normalisePhone("080399211401234")).toBeNull();
    expect(isValidPhone("080399211")).toBe(false);
  });

  it("returns null for empty or non-numeric input", () => {
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone("call me")).toBeNull();
  });
});

describe("normaliseEmail (TC-EDGE-015)", () => {
  it("trims and lowercases", () => {
    expect(normaliseEmail("  USER@Example.COM ")).toBe("user@example.com");
  });
  it("returns null for invalid addresses", () => {
    expect(normaliseEmail("not-an-email")).toBeNull();
    expect(normaliseEmail("")).toBeNull();
  });
});

describe("isDisposableEmail (TC-EDGE-016)", () => {
  it("flags known disposable domains", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@10minutemail.com")).toBe(true);
  });
  it("does not flag ordinary domains", () => {
    expect(isDisposableEmail("ada@gmail.com")).toBe(false);
  });
});
