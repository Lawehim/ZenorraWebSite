import type { Metadata } from "next";

export const metadata: Metadata = { title: "You're offline", robots: { index: false } };
export const dynamic = "force-static";

export default function Offline() {
  return (
    <section className="phead" style={{ minHeight: "60svh" }}>
      <div className="wrap">
        <div className="eyebrow">Offline</div>
        <h1>You&apos;re offline</h1>
        <p className="lede" style={{ marginBottom: "1.4rem" }}>
          Pages you&apos;ve already opened are still available. Reconnect to browse new estates or send an enquiry — or call us directly.
        </p>
        <a className="btn btn-gold" href="tel:+2347032345179">
          Call Zenorra
        </a>
      </div>
    </section>
  );
}
