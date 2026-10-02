// Structured data (FR-SEO-003). JSON is escaped so content can never break out of the script tag.
import type { SiteSettings } from "@/lib/settings/schema";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function OrganizationJsonLd({ settings }: { settings: SiteSettings }) {
  const sameAs = [...Object.values(settings.social), settings.googleReviewsUrl].filter(Boolean);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "RealEstateAgent",
        name: settings.companyName,
        url: APP_URL,
        logo: `${APP_URL}/brand/lockup.webp`,
        email: settings.email,
        telephone: settings.phone,
        address: { "@type": "PostalAddress", streetAddress: settings.address, addressLocality: "Lagos", addressCountry: "NG" },
        sameAs,
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${APP_URL}${it.path}` })),
      }}
    />
  );
}
