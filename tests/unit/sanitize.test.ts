import { sanitizeRichHtml, escapeHtml } from "@/lib/richtext/sanitize";

describe("sanitizeRichHtml (FR-CONT-004, NFR-SEC-006, TC-ADM-011, TC-SEC-002)", () => {
  it("keeps the allow-listed structure", () => {
    const html = "<h2>Title</h2><p>Hello <strong>bold</strong> <em>it</em> <a href=\"https://x.ng\">link</a></p><ul><li>one</li></ul><blockquote>q</blockquote>";
    expect(sanitizeRichHtml(html)).toBe(
      '<h2>Title</h2><p>Hello <strong>bold</strong> <em>it</em> <a href="https://x.ng" rel="noopener noreferrer nofollow">link</a></p><ul><li>one</li></ul><blockquote>q</blockquote>',
    );
  });
  it("strips script tags entirely", () => {
    expect(sanitizeRichHtml("<p>ok</p><script>alert(1)</script>")).toBe("<p>ok</p>");
  });
  it("strips event-handler attributes", () => {
    expect(sanitizeRichHtml('<img src="/x.jpg" onerror="alert(1)" alt="a">')).toBe('<img src="/x.jpg" alt="a" loading="lazy" />');
  });
  it("removes javascript: URLs", () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a rel="noopener noreferrer nofollow">x</a>');
  });
  it("drops iframes except YouTube/Vimeo embeds", () => {
    expect(sanitizeRichHtml('<iframe src="https://evil.example/x"></iframe>')).toBe("");
    expect(sanitizeRichHtml('<iframe src="https://www.youtube.com/embed/abc"></iframe>')).toContain("youtube.com/embed/abc");
  });
  it("strips style attributes and unknown tags but keeps their text", () => {
    expect(sanitizeRichHtml('<p style="color:red"><span>txt</span><marquee>m</marquee></p>')).toBe("<p>txtm</p>");
  });
});

describe("escapeHtml", () => {
  it("escapes the five significant characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
