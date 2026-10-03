import Link from "next/link";
import type { SiteSettings } from "@/lib/settings/schema";
import type { ContentOf } from "@/lib/content/registry";
import { SocialIcon } from "@/components/ui/Icon";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { OpenModalButton } from "./SiteProvider";
import { CookiePreferencesLink } from "./ConsentBanner";

const SOCIAL_LABELS: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube", x: "X (Twitter)" };

export function Footer({ settings, copy }: { settings: SiteSettings; copy: ContentOf<"site.footer"> }) {
  const socials = Object.entries(settings.social).filter(([, url]) => url);
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="fgrid">
          <div className="fcol">
            <img src="/brand/lockup.webp" alt={settings.companyName} width={150} height={74} style={{ height: 74, width: "auto", marginBottom: "1.3rem" }} />
            <p style={{ fontSize: ".9rem", color: "var(--ink-2)", maxWidth: "34ch" }}>{copy.blurb}</p>
            <div className="socials">
              {socials.map(([k, url]) => (
                <a key={k} href={url} target="_blank" rel="noopener noreferrer" aria-label={`${settings.companyName} on ${SOCIAL_LABELS[k] ?? k}`}>
                  <SocialIcon name={k} />
                </a>
              ))}
              {settings.googleReviewsUrl && (
                <a href={settings.googleReviewsUrl} target="_blank" rel="noopener noreferrer" aria-label="Read and leave Google reviews">
                  <SocialIcon name="google" />
                </a>
              )}
            </div>
          </div>
          <div className="fcol">
            <h2>Explore</h2>
            <ul>
              <li><Link href="/properties">Properties</Link></li>
              <li><Link href="/services">Services</Link></li>
              <li><Link href="/about">About Zenorra</Link></li>
              <li><Link href="/insights">Insights</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>
          <div className="fcol">
            <h2>Buyers</h2>
            <ul>
              <li><OpenModalButton kind="booking" className="">Book an inspection</OpenModalButton></li>
              <li><OpenModalButton kind="advisor" className="">Talk to an advisor</OpenModalButton></li>
              <li><Link href="/insights/avoid-land-scams">Verify a title</Link></li>
              <li><Link href="/shortlist">My shortlist</Link></li>
              <li><Link href="/account">Buyer portal</Link></li>
              {settings.googleReviewsUrl && (
                <li>
                  <a href={settings.googleReviewsUrl} target="_blank" rel="noopener noreferrer">
                    Google reviews
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div className="fcol">
            <h2>Head office</h2>
            <ul>
              <li>{settings.address}</li>
              <li><a href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a></li>
              <li><a href={`mailto:${settings.email}`}>{settings.email}</a></li>
              <li>{settings.hours}</li>
            </ul>
            <h2 style={{ marginTop: "1.8rem" }}>{copy.newsletterHeading}</h2>
            <NewsletterForm buttonLabel={copy.newsletterButton} note={copy.newsletterNote} />
          </div>
        </div>
        <div className="fbot">
          <span>
            © {new Date().getFullYear()} {settings.companyName.toUpperCase()}
            {settings.registration ? ` · ${settings.registration}` : ""}
          </span>
          <span style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/cookies">Cookies</Link>
            <Link href="/legal/disclaimer">Investment disclaimer</Link>
            <CookiePreferencesLink />
          </span>
        </div>
      </div>
    </footer>
  );
}
