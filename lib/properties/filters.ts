// Catalogue filter/sort model. State lives in the URL (FR-PROP-005); parsing is
// allow-list based so raw query input never reaches rendering or queries.
import type { TitleType } from "@prisma/client";

export const CORRIDORS = ["Ibeju-Lekki", "Epe", "Lekki-Ajah", "Ogun", "Abuja"] as const;
export type Corridor = (typeof CORRIDORS)[number];

export const BUDGET_BANDS = [
  { id: "under-5m", label: "Under ₦5m", min: 0, max: 5_000_000 },
  { id: "5m-15m", label: "₦5m – ₦15m", min: 5_000_000, max: 15_000_000 },
  { id: "15m-50m", label: "₦15m – ₦50m", min: 15_000_000, max: 50_000_000 },
  { id: "above-50m", label: "Above ₦50m", min: 50_000_000, max: Number.POSITIVE_INFINITY },
] as const;
export type BudgetBandId = (typeof BUDGET_BANDS)[number]["id"];

export const SIZE_BANDS = [
  { id: "under-400", label: "Under 400 sqm", min: 0, max: 400 },
  { id: "400-600", label: "400–600 sqm", min: 400, max: 601 },
  { id: "above-600", label: "Above 600 sqm", min: 601, max: Number.POSITIVE_INFINITY },
] as const;
export type SizeBandId = (typeof SIZE_BANDS)[number]["id"];

export const TITLE_TYPES: TitleType[] = [
  "C_OF_O",
  "GOVERNORS_CONSENT",
  "EXCISION",
  "GAZETTE",
  "REGISTERED_SURVEY",
  "EXCISION_IN_PROGRESS",
  "OTHER",
];

export const SORTS = [
  { id: "curated", label: "Recommended" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "newest", label: "Newest" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];

export interface PropertyFilters {
  corridor?: Corridor;
  budget?: BudgetBandId;
  title?: TitleType;
  size?: SizeBandId;
  sort: SortId;
}

export interface FilterableProperty {
  slug: string;
  corridor: string;
  priceNaira: number | bigint;
  titleType: TitleType;
  sizeSqm: number | null;
  curatedOrder: number;
  publishedAt: Date | null;
  featured: boolean;
  featuredOrder: number | null;
}

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function parseFilters(params: Params): PropertyFilters {
  return {
    corridor: pick(first(params.corridor), CORRIDORS),
    budget: pick(first(params.budget), BUDGET_BANDS.map((b) => b.id)),
    title: pick(first(params.title), TITLE_TYPES),
    size: pick(first(params.size), SIZE_BANDS.map((b) => b.id)),
    sort: pick(first(params.sort), SORTS.map((s) => s.id)) ?? "curated",
  };
}

export function serialiseFilters(f: PropertyFilters): string {
  const q = new URLSearchParams();
  if (f.corridor) q.set("corridor", f.corridor);
  if (f.budget) q.set("budget", f.budget);
  if (f.title) q.set("title", f.title);
  if (f.size) q.set("size", f.size);
  if (f.sort && f.sort !== "curated") q.set("sort", f.sort);
  return q.toString();
}

export function hasActiveFilters(f: PropertyFilters): boolean {
  return Boolean(f.corridor || f.budget || f.title || f.size);
}

export function applyFilters<T extends FilterableProperty>(list: T[], f: Partial<PropertyFilters>): T[] {
  const band = f.budget ? BUDGET_BANDS.find((b) => b.id === f.budget) : undefined;
  const size = f.size ? SIZE_BANDS.find((b) => b.id === f.size) : undefined;
  return list.filter((p) => {
    if (f.corridor && p.corridor !== f.corridor) return false;
    if (f.title && p.titleType !== f.title) return false;
    if (band) {
      const price = Number(p.priceNaira);
      if (price < band.min || price >= band.max) return false;
    }
    if (size) {
      if (p.sizeSqm == null || p.sizeSqm < size.min || p.sizeSqm >= size.max) return false;
    }
    return true;
  });
}

function cmpBig(a: number | bigint, b: number | bigint): number {
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function sortProperties<T extends FilterableProperty>(list: T[], sort: SortId): T[] {
  const curated = (a: T, b: T) => a.curatedOrder - b.curatedOrder;
  const copy = [...list];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => cmpBig(a.priceNaira, b.priceNaira) || curated(a, b));
    case "price-desc":
      return copy.sort((a, b) => cmpBig(b.priceNaira, a.priceNaira) || curated(a, b));
    case "newest":
      return copy.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) || curated(a, b));
    default:
      return copy.sort(curated);
  }
}

export function budgetBandOf(price: number | bigint): BudgetBandId {
  const n = Number(price);
  return (BUDGET_BANDS.find((b) => n >= b.min && n < b.max) ?? BUDGET_BANDS[3]).id;
}

export const TITLE_LABELS: Record<TitleType, string> = {
  C_OF_O: "Certificate of Occupancy",
  GOVERNORS_CONSENT: "Governor's Consent",
  EXCISION: "Excision",
  GAZETTE: "Gazette",
  REGISTERED_SURVEY: "Registered Survey",
  EXCISION_IN_PROGRESS: "Excision in progress",
  OTHER: "Other",
};
