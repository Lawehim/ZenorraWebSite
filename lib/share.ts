// Social share links carrying UTM attribution per channel (FR-CONT-008).
function withUtm(url: string, source: string) {
  const u = new URL(url);
  u.searchParams.set("utm_source", source);
  u.searchParams.set("utm_medium", "share");
  u.searchParams.set("utm_campaign", "article");
  return u.toString();
}

export function shareLinks(url: string, title: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${withUtm(url, "whatsapp")}`)}`,
    x: `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(withUtm(url, "x"))}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(withUtm(url, "facebook"))}`,
    copy: withUtm(url, "copy"),
  };
}
