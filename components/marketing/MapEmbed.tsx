"use client";
// Click-to-load map: nothing from Google is fetched (and no cookie set) until asked (FR-PROP-016).
import { useState } from "react";

export function MapEmbed({ query, label }: { query: string; label: string }) {
  const [show, setShow] = useState(false);
  if (!show) {
    return (
      <div className="map-slot">
        <p className="muted" style={{ fontSize: ".86rem" }}>
          The map loads from Google only when you ask, to save your data.
        </p>
        <button type="button" className="btn btn-line btn-sm" onClick={() => setShow(true)}>
          Show map<span className="sr-only">: {label}</span>
        </button>
      </div>
    );
  }
  return <iframe className="map-frame" title={`Map: ${label}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=14&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />;
}
