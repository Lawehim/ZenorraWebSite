import { renderMessage } from "@/server/services/templates";

const brief = { reference: "ZN-2026-04812", name: "Adaeze Okonkwo", phone: "+447700900812", email: "a@x.ng", objective: "Buy land to hold", locations: "Epe, Ogun", budget: "Under ₦5m", timeline: "1–3 months", residency: "Diaspora", note: "<script>x</script>", source: "advisor", page: "/properties/solara-ridge" };

describe("message templates (FR-NOTIF-001/002/007)", () => {
  it("enquirer email carries the reference and what happens next", () => {
    const m = renderMessage("lead.received", brief);
    expect(m.subject).toContain("ZN-2026-04812");
    expect(m.text).toMatch(/within one business day/);
    expect(m.text).toMatch(/unsubscribe|opt out/i);
  });
  it("internal email holds the full brief so the advisor need not open the portal", () => {
    const m = renderMessage("lead.internal", brief);
    for (const v of ["Adaeze Okonkwo", "+447700900812", "Epe, Ogun", "Under ₦5m", "1–3 months", "Diaspora", "/properties/solara-ridge"]) expect(m.text).toContain(v);
    expect(m.subject).toMatch(/Diaspora/);
  });
  it("escapes user content in HTML bodies (NFR-SEC-006)", () => {
    const m = renderMessage("lead.internal", brief);
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });
  it("newsletter confirmation includes a confirm link with the token", () => {
    const m = renderMessage("newsletter.confirm", { token: "abc123" });
    expect(m.text).toContain("/api/subscribe/confirm?token=abc123");
  });
  it("booking SMS is the pre-built text under 160 characters", () => {
    const m = renderMessage("booking.sms", { text: "Zenorra: seat booked" });
    expect(m.text).toBe("Zenorra: seat booked");
  });
  it("falls back gracefully for an unknown template", () => {
    expect(renderMessage("nope", {}).subject).toBe("Message from Zenorra");
  });
});
