"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useShortlist } from "@/components/hooks/useShortlist";
import { PropertyCard, type PropertyCardData } from "./PropertyCard";

export function ShortlistView() {
  const { list, clear } = useShortlist();
  const [cards, setCards] = useState<PropertyCardData[] | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const key = list.join(",");

  useEffect(() => {
    if (!key) return;
    let live = true;
    fetch(`/api/properties/cards?slugs=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((d: { cards: PropertyCardData[] }) => live && setCards(d.cards))
      .catch(() => live && setCards([]));
    return () => {
      live = false;
    };
  }, [key]);

  if (!list.length) {
    return (
      <div className="empty" role="status">
        <span>Your shortlist is empty. Tap the heart on any estate to save it here.</span>
        <Link className="btn btn-gold btn-sm" href="/properties">
          Browse properties
        </Link>
      </div>
    );
  }
  if (!cards) return <p className="muted">Loading your shortlist…</p>;
  return (
    <>
      <div className="search-row" style={{ alignItems: "center" }}>
        <span className="muted" aria-live="polite">
          {compare.length ? `${compare.length} selected for comparison` : "Select up to three to compare"}
        </span>
        <Link className="btn btn-gold btn-sm" aria-disabled={compare.length < 2} href={compare.length >= 2 ? `/compare?slugs=${compare.join(",")}` : "#"} onClick={(e) => compare.length < 2 && e.preventDefault()}>
          Compare
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
          Clear shortlist
        </button>
      </div>
      <div className="plots">
        {cards.map((c) => (
          <div key={c.slug}>
            <PropertyCard property={c} />
            <label className="consent" style={{ marginTop: ".6rem" }}>
              <input
                type="checkbox"
                checked={compare.includes(c.slug)}
                disabled={!compare.includes(c.slug) && compare.length >= 3}
                onChange={(e) => setCompare((x) => (e.target.checked ? [...x, c.slug] : x.filter((s) => s !== c.slug)))}
              />
              Compare {c.name}
            </label>
          </div>
        ))}
      </div>
    </>
  );
}
