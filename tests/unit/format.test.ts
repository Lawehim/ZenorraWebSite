import { formatNaira, monthlyInstalment, depositAmount, formatDateLagos, readingMinutes } from "@/lib/format";

describe("formatNaira (FR-GLOB-010)", () => {
  it("renders full values with the naira symbol and Nigerian digit grouping", () => {
    expect(formatNaira(4_800_000)).toBe("₦4,800,000");
    expect(formatNaira(1)).toBe("₦1");
    expect(formatNaira(0)).toBe("₦0");
  });

  it("accepts bigint values above 32-bit without overflow (TC-EDGE-003)", () => {
    expect(formatNaira(2_147_483_648n)).toBe("₦2,147,483,648");
    expect(formatNaira(999_999_999_999n)).toBe("₦999,999,999,999");
  });

  it("abbreviates millions and billions when asked", () => {
    expect(formatNaira(4_800_000, { abbreviate: true })).toBe("₦4.8m");
    expect(formatNaira(12_500_000, { abbreviate: true })).toBe("₦12.5m");
    expect(formatNaira(145_000_000, { abbreviate: true })).toBe("₦145m");
    expect(formatNaira(2_000_000_000, { abbreviate: true })).toBe("₦2bn");
    expect(formatNaira(950_000, { abbreviate: true })).toBe("₦950,000");
  });

  it("never produces ₦1000m — rolls up to billions (TC-EDGE-003)", () => {
    expect(formatNaira(999_999_999, { abbreviate: true })).toBe("₦1bn");
    expect(formatNaira(999_999_999_999n, { abbreviate: true })).toBe("₦1,000bn");
  });
});

describe("monthlyInstalment (FR-PROP-012, US-BUY-02, TC-PROP-010)", () => {
  it("derives ₦140,000 from ₦4.8m, 30% deposit, 24 months", () => {
    expect(monthlyInstalment(4_800_000, 30, 24)).toBe(140_000);
  });

  it("rounds up to the nearest naira so the plan never under-collects", () => {
    expect(monthlyInstalment(1_000_000, 30, 9)).toBe(77_778);
  });

  it("returns the full balance when the plan is zero or one month", () => {
    expect(monthlyInstalment(1_000_000, 30, 0)).toBe(700_000);
    expect(monthlyInstalment(1_000_000, 30, 1)).toBe(700_000);
  });

  it("works with bigint prices", () => {
    expect(monthlyInstalment(4_800_000n, 30, 24)).toBe(140_000);
  });
});

describe("depositAmount", () => {
  it("computes the initial deposit", () => {
    expect(depositAmount(4_800_000, 30)).toBe(1_440_000);
  });
});

describe("formatDateLagos", () => {
  it("formats in Africa/Lagos as day month year", () => {
    expect(formatDateLagos(new Date("2026-08-12T00:00:00+01:00"))).toBe("12 August 2026");
  });
  it("uses Lagos time, not UTC, near midnight", () => {
    // 23:30 UTC on 11 Aug is 00:30 on 12 Aug in Lagos (UTC+1)
    expect(formatDateLagos(new Date("2026-08-11T23:30:00Z"))).toBe("12 August 2026");
  });
});

describe("readingMinutes (FR-CONT-003)", () => {
  it("computes at 200 words per minute, rounded up", () => {
    expect(readingMinutes("word ".repeat(200))).toBe(1);
    expect(readingMinutes("word ".repeat(201))).toBe(2);
    expect(readingMinutes("word ".repeat(1500))).toBe(8);
  });
  it("ignores HTML tags and never returns zero", () => {
    expect(readingMinutes("<p>Hello <b>there</b></p>")).toBe(1);
    expect(readingMinutes("")).toBe(1);
  });
});
