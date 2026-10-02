import { scoreLead } from "@/lib/leads/score";
import { nextAdvisor, slaDueAt } from "@/lib/leads/assignment";
import { officeStatus, type OfficeHours } from "@/lib/chat/office-hours";

describe("scoreLead (FR-LEAD-018)", () => {
  it("ranks a high-budget, soon, diaspora, engaged lead above a researcher", () => {
    const hot = scoreLead({ budgetBand: "Above ₦50m", timeline: "Within 30 days", residency: "Diaspora", enquiries: 3, bookedInspection: true });
    const cold = scoreLead({ budgetBand: "Under ₦5m", timeline: "Just researching", residency: "Nigeria", enquiries: 1, bookedInspection: false });
    expect(hot).toBeGreaterThan(cold);
  });
  it("is bounded 0..100 and tolerates missing answers", () => {
    expect(scoreLead({})).toBeGreaterThanOrEqual(0);
    expect(scoreLead({ budgetBand: "Above ₦50m", timeline: "Within 30 days", residency: "Diaspora", enquiries: 99, bookedInspection: true })).toBeLessThanOrEqual(100);
  });
  it("gives an inspection booking a meaningful boost", () => {
    expect(scoreLead({ bookedInspection: true }) - scoreLead({ bookedInspection: false })).toBeGreaterThanOrEqual(15);
  });
});

describe("nextAdvisor round-robin (FR-ADM-041)", () => {
  const advisors = ["a", "b", "c"];
  it("starts with the first advisor", () => expect(nextAdvisor(advisors, null)).toBe("a"));
  it("rotates after the last one assigned", () => {
    expect(nextAdvisor(advisors, "a")).toBe("b");
    expect(nextAdvisor(advisors, "c")).toBe("a");
  });
  it("restarts when the last advisor is no longer active", () => expect(nextAdvisor(advisors, "zz")).toBe("a"));
  it("returns null when nobody can take leads", () => expect(nextAdvisor([], "a")).toBeNull());
});

describe("slaDueAt (FR-ADM-042)", () => {
  it("adds the SLA hours to the creation time", () => {
    expect(slaDueAt(new Date("2026-09-02T09:00:00Z"), 4).toISOString()).toBe("2026-09-02T13:00:00.000Z");
  });
});

describe("officeStatus — live chat online/offline in Africa/Lagos (FR-CHAT-001/002)", () => {
  const hours: OfficeHours = { days: [1, 2, 3, 4, 5, 6], open: "09:00", close: "18:00" };
  it("is online during office hours (Lagos time, not UTC)", () => {
    // 08:30 UTC = 09:30 WAT on a Wednesday
    expect(officeStatus(hours, new Date("2026-09-02T08:30:00Z")).online).toBe(true);
  });
  it("is offline before opening and says when it opens", () => {
    const s = officeStatus(hours, new Date("2026-09-02T07:30:00Z")); // 08:30 WAT
    expect(s.online).toBe(false);
    expect(s.nextOpen).toBe("Today at 09:00");
  });
  it("names the weekday when the next opening is more than a day away", () => {
    const weekdays: OfficeHours = { days: [1, 2, 3, 4, 5], open: "09:00", close: "18:00" };
    const s = officeStatus(weekdays, new Date("2026-09-05T12:00:00Z")); // Saturday
    expect(s).toEqual({ online: false, nextOpen: "Monday at 09:00" });
  });
  it("is offline on Sunday and points to tomorrow (Monday)", () => {
    expect(officeStatus(hours, new Date("2026-09-06T12:00:00Z")).nextOpen).toBe("Tomorrow at 09:00");
  });
  it("after close points to tomorrow", () => {
    expect(officeStatus(hours, new Date("2026-09-02T18:30:00Z")).nextOpen).toBe("Tomorrow at 09:00");
  });
});
