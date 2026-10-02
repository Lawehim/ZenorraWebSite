import { renderMessage } from "@/server/services/templates";

describe("phase 2–3 message templates", () => {
  it("assignment email names the lead and links to it", () => {
    const m = renderMessage("lead.assigned", { advisor: "Emeka", reference: "ZN-2026-00001", name: "Ada", leadId: "abc" });
    expect(m.subject).toContain("ZN-2026-00001");
    expect(m.text).toContain("/admin/leads/abc");
  });
  it("escalation lists overdue references", () => {
    expect(renderMessage("lead.escalated", { count: 2, references: ["ZN-1", "ZN-2"] }).text).toContain("ZN-1, ZN-2");
  });
  it("booking reminder SMS uses the pre-built text", () => {
    expect(renderMessage("booking.reminder", { text: "Zenorra: reminder" }).text).toBe("Zenorra: reminder");
  });
  it("daily digest summarises the day", () => {
    const m = renderMessage("digest.daily", { date: "2026-10-02", leads: 5, bookings: 2, won: 1, overdue: 0, bySource: "advisor: 3" });
    expect(m.subject).toContain("2026-10-02");
    expect(m.text).toMatch(/5 new leads/);
  });
  it("buyer invite links to the portal acceptance page", () => {
    expect(renderMessage("buyer.invite", { name: "Ada", token: "tok" }).text).toContain("/account/accept-invite?token=tok");
  });
  it("OTP message carries the code and expiry and fits an SMS", () => {
    const m = renderMessage("buyer.otp", { code: "123456", minutes: 10 });
    expect(m.text).toContain("123456");
    expect(m.text.length).toBeLessThanOrEqual(160);
  });
  it("receipt states amount, balance and any carried-forward overpayment", () => {
    const m = renderMessage("payment.receipt", { name: "Ada", receiptNumber: "RC-2026-00001", amount: "₦1,000", balance: "₦0", property: "Heritage", overpayment: "", carried: "₦200" });
    expect(m.text).toContain("RC-2026-00001");
    expect(m.text).toMatch(/applied to your next instalment/);
  });
  it("payment reminder says when and how much", () => {
    expect(renderMessage("payment.reminder", { name: "Ada", label: "Instalment 1 of 24", amount: "₦140,000", due: "2026-11-01", property: "Heritage", when: "tomorrow" }).text).toMatch(/₦140,000.*tomorrow/s);
  });
  it("ticket and referral notifications render", () => {
    expect(renderMessage("ticket.reply", { reference: "ST-1", subject: "Deed", reply: "Ready" }).text).toContain("Ready");
    expect(renderMessage("referral.qualified", { referrer: "Tunde", purchase: "PU-1" }).subject).toMatch(/referral/i);
  });
});
