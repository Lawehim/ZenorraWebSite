import { getSiteChrome } from "@/server/queries/site";
import { nextInspectionDates } from "@/lib/bookings/dates";
import { SiteProvider } from "@/components/layout/SiteProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ActionRail } from "@/components/layout/ActionRail";
import { ConsentBanner } from "@/components/layout/ConsentBanner";
import { OrganizationJsonLd } from "@/components/seo/JsonLd";
import { LazyChat } from "@/components/chat/LazyChat";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { settings, content, bookableProperties } = await getSiteChrome();
  return (
    <SiteProvider
      advisorCopy={content["site.advisor"]}
      bookingCopy={content["site.booking"]}
      properties={bookableProperties}
      departurePoints={settings.departurePoints}
      inspectionDates={nextInspectionDates(settings.inspectionDays, new Date(), 10)}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header ctaLabel={content["site.nav"].ctaLabel} />
      <main id="main">{children}</main>
      <Footer settings={settings} copy={content["site.footer"]} />
      <ActionRail whatsappNumber={settings.whatsappNumber} whatsappLabel={content["site.rail"].whatsappLabel} inspectLabel={content["site.rail"].inspectLabel} defaultMessage={content["site.rail"].whatsappMessage} />
      <LazyChat />
      <ConsentBanner />
      <OrganizationJsonLd settings={settings} />
    </SiteProvider>
  );
}
