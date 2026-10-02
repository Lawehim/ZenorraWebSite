import type { Metadata } from "next";
import { PageHeader } from "@/components/sections";
import { ShortlistView } from "@/components/marketing/ShortlistView";

export const metadata: Metadata = { title: "My shortlist", robots: { index: false } };

export default function ShortlistPage() {
  return (
    <>
      <PageHeader crumbs={[{ label: "Home", href: "/" }, { label: "Properties", href: "/properties" }, { label: "Shortlist" }]} title="My shortlist" lede="Estates you've saved on this device. Pick up to three to compare side by side." brief="Wide estate photograph" />
      <section className="sec" style={{ paddingTop: "clamp(2.5rem,5vw,4rem)" }}>
        <div className="wrap">
          <ShortlistView />
        </div>
      </section>
    </>
  );
}
