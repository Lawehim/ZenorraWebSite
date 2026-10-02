import type { Metadata } from "next";
import { getAllContent, getContent } from "@/server/services/content";
import { imageFromUrl } from "@/server/queries/mappers";
import { assetsByUrl, getSiteChrome } from "@/server/queries/site";
import { whatsappLink } from "@/lib/whatsapp";
import { ContactForm } from "@/components/forms/ContactForm";
import { OpenModalButton } from "@/components/layout/SiteProvider";
import { PageHeader, Eyebrow } from "@/components/sections";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent("contact.header");
  return { title: c.seoTitle || c.headline, description: c.seoDescription || c.lede, alternates: { canonical: "/contact" } };
}

export default async function ContactPage() {
  const [c, chrome] = await Promise.all([getAllContent(["contact.header", "contact.form"]), getSiteChrome()]);
  const s = chrome.settings;
  const h = c["contact.header"];
  const assets = await assetsByUrl([h.image]);
  const mapQuery = encodeURIComponent(s.address);
  return (
    <>
      <PageHeader crumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]} title={h.headline} lede={h.lede} image={imageFromUrl(h.image, assets)} brief={h.imageBrief} />
      <section className="sec">
        <div className="wrap">
          <div className="split" style={{ alignItems: "start" }}>
            <ContactForm copy={c["contact.form"]} />
            <div className="rv">
              <div className="panel brackets" style={{ marginBottom: "1.4rem" }}>
                <Eyebrow>{c["contact.form"].officeHeading}</Eyebrow>
                <address style={{ fontStyle: "normal", fontSize: "1.05rem", marginBottom: "1rem" }}>{s.address}</address>
                <div className="pay">
                  <div className="payrow">
                    <span>Phone</span>
                    <b>
                      <a href={`tel:${s.phone.replace(/\s/g, "")}`}>{s.phone}</a>
                    </b>
                  </div>
                  <div className="payrow">
                    <span>WhatsApp</span>
                    <b>
                      <a href={whatsappLink(s.whatsappNumber, "Hello Zenorra, I'd like to make an enquiry.")} target="_blank" rel="noopener noreferrer">
                        Chat on WhatsApp
                      </a>
                    </b>
                  </div>
                  <div className="payrow">
                    <span>Email</span>
                    <b>
                      <a href={`mailto:${s.email}`}>{s.email}</a>
                    </b>
                  </div>
                  <div className="payrow">
                    <span>Open</span>
                    <b>{s.hours}</b>
                  </div>
                  {s.registration && (
                    <div className="payrow">
                      <span>Registration</span>
                      <b>{s.registration}</b>
                    </div>
                  )}
                </div>
              </div>
              <div className="panel brackets" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <span className="muted" style={{ fontSize: ".9rem" }}>
                  Map loads only when you ask, to save your data.
                </span>
                <a className="btn btn-line btn-sm" href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer">
                  Open in Google Maps
                </a>
                {s.googleReviewsUrl && (
                  <a className="btn btn-ghost btn-sm" href={s.googleReviewsUrl} target="_blank" rel="noopener noreferrer">
                    Read our Google reviews
                  </a>
                )}
              </div>
              <div style={{ display: "flex", gap: ".7rem", marginTop: "1.4rem", flexWrap: "wrap" }}>
                <OpenModalButton kind="booking" className="btn btn-line btn-sm">
                  Book an inspection
                </OpenModalButton>
                <OpenModalButton kind="advisor" className="btn btn-line btn-sm">
                  Talk to an advisor
                </OpenModalButton>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
