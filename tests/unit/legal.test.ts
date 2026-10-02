import { parseLegal, LEGAL_PAGES } from "@/lib/content/legal";

describe("parseLegal", () => {
  it("parses headings, paragraphs and lists", () => {
    expect(parseLegal("Intro line\ncontinues.\n\n## Heading\n- one\n- two\n\nAfter.")).toEqual([
      { type: "p", text: "Intro line continues." },
      { type: "h2", text: "Heading" },
      { type: "ul", items: ["one", "two"] },
      { type: "p", text: "After." },
    ]);
  });
  it("treats HTML as plain text (it is rendered escaped)", () => {
    expect(parseLegal("<script>x</script>")).toEqual([{ type: "p", text: "<script>x</script>" }]);
  });
  it("every default legal page parses to at least one block", () => {
    for (const p of Object.values(LEGAL_PAGES)) expect(parseLegal(p.body).length).toBeGreaterThan(0);
  });
  it("the investment disclaimer carries the no-guarantee wording (NFR-LEG-012)", () => {
    expect(LEGAL_PAGES.disclaimer.body).toMatch(/Past appreciation is not a guarantee of future returns/);
  });
});
