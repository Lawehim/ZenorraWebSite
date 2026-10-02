import { budgetBandOf, type FilterableProperty } from "./filters";

const byNewest = (a: FilterableProperty, b: FilterableProperty) =>
  (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);

/** Featured set in admin order, topped up with the newest published (FR-HOME-007). */
export function selectFeatured<T extends FilterableProperty>(list: T[], count: number): T[] {
  const featured = list
    .filter((p) => p.featured)
    .sort((a, b) => (a.featuredOrder ?? 9999) - (b.featuredOrder ?? 9999))
    .slice(0, count);
  if (featured.length >= count) return featured;
  const fill = list
    .filter((p) => !featured.includes(p))
    .sort(byNewest)
    .slice(0, count - featured.length);
  return [...featured, ...fill];
}

/** Same corridor first, then same price band, then the rest by curation (FR-PROP-017). */
export function relatedProperties<T extends FilterableProperty>(current: T, list: T[], count: number): T[] {
  const band = budgetBandOf(current.priceNaira);
  const rank = (p: T) => (p.corridor === current.corridor ? 0 : budgetBandOf(p.priceNaira) === band ? 1 : 2);
  return list
    .filter((p) => p.slug !== current.slug)
    .sort((a, b) => rank(a) - rank(b) || a.curatedOrder - b.curatedOrder)
    .slice(0, count);
}
