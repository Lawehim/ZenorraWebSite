// Catalogue free-text search and crawlable pagination (FR-PROP-006/007).
export function normaliseSearch(q: string): string {
  return q
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function matchesSearch(p: { name: string; locationText: string; blurb?: string | null; description?: string | null }, q: string): boolean {
  const terms = normaliseSearch(q).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const hay = normaliseSearch(`${p.name} ${p.locationText} ${p.blurb ?? ""} ${(p.description ?? "").replace(/<[^>]+>/g, " ")}`.slice(0, 5000));
  return terms.every((t) => hay.includes(t));
}

export function paginate<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  return { items: items.slice((p - 1) * size, p * size), page: p, pages, hasPrev: p > 1, hasNext: p < pages, total: items.length };
}
