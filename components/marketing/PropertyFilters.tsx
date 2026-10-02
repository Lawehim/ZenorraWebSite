// Server-rendered filter chips: every state is a real, crawlable URL (FR-PROP-005, NFR-PERF-011).
import Link from "next/link";
import { BUDGET_BANDS, CORRIDORS, SORTS, serialiseFilters, type PropertyFilters as Filters } from "@/lib/properties/filters";

export interface PropertyFiltersProps {
  filters: Filters;
  total: number;
  shown: number;
}

function href(f: Filters) {
  const qs = serialiseFilters(f);
  return qs ? `/properties?${qs}` : "/properties";
}

export function PropertyFilters({ filters, total, shown }: PropertyFiltersProps) {
  return (
    <nav className="filters" aria-label="Filter properties">
      <div className="filter-group" role="group" aria-label="Location">
        <span className="label">Location</span>
        <Link className="chip" href={href({ ...filters, corridor: undefined })} aria-current={!filters.corridor ? "true" : undefined}>
          All locations
        </Link>
        {CORRIDORS.map((c) => (
          <Link key={c} className="chip" href={href({ ...filters, corridor: c })} aria-current={filters.corridor === c ? "true" : undefined}>
            {c === "Lekki-Ajah" ? "Lekki–Ajah" : c}
          </Link>
        ))}
      </div>
      <div className="filter-group" role="group" aria-label="Budget">
        <span className="label">Budget</span>
        <Link className="chip" href={href({ ...filters, budget: undefined })} aria-current={!filters.budget ? "true" : undefined}>
          Any budget
        </Link>
        {BUDGET_BANDS.map((b) => (
          <Link key={b.id} className="chip" href={href({ ...filters, budget: b.id })} aria-current={filters.budget === b.id ? "true" : undefined}>
            {b.label}
          </Link>
        ))}
      </div>
      <div className="filter-group" role="group" aria-label="Sort">
        <span className="label">Sort</span>
        {SORTS.map((s) => (
          <Link key={s.id} className="chip" href={href({ ...filters, sort: s.id })} aria-current={filters.sort === s.id ? "true" : undefined}>
            {s.label}
          </Link>
        ))}
      </div>
      <span className="count" aria-live="polite">
        {shown} of {total} shown
      </span>
    </nav>
  );
}
