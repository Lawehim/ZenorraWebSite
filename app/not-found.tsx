// Fallback for routes outside the marketing group (FR-GLOB-006). Static so it never depends on the database.
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="phead" style={{ minHeight: "80svh", display: "flex", alignItems: "center", paddingTop: "4rem" }}>
      <div className="wrap">
        <div className="eyebrow">404</div>
        <h1>We couldn&apos;t find that page</h1>
        <p className="lede" style={{ marginBottom: "2rem" }}>
          The link may be old, or the page may have moved.
        </p>
        <Link className="btn btn-gold" href="/">
          Back to the homepage
        </Link>
      </div>
    </main>
  );
}
