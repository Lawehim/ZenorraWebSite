// Allow-list sanitiser for article and property rich text (FR-CONT-004, NFR-SEC-006).
// Applied on write AND on render — the only dangerouslySetInnerHTML sources pass through here.
import sanitizeHtml from "sanitize-html";

const EMBED_HOSTS = ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["h2", "h3", "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "img", "iframe", "figure", "figcaption", "hr", "code"],
  allowedAttributes: {
    a: ["href", "rel"],
    img: ["src", "alt", "width", "height", "loading"],
    iframe: ["src", "title", "allow", "allowfullscreen", "loading"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https", "http"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: EMBED_HOSTS,
  nonTextTags: ["script", "style", "textarea", "noscript", "title"],
  disallowedTagsMode: "discard",
  selfClosing: ["img", "br", "hr"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...(attribs.href ? { href: attribs.href } : {}), rel: "noopener noreferrer nofollow" },
    }),
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    iframe: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
  exclusiveFilter: (frame) => frame.tag === "iframe" && !frame.attribs.src,
};

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html ?? "", OPTIONS);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function htmlToText(html: string): string {
  return sanitizeHtml(html ?? "", { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
