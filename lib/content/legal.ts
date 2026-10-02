// Legal pages (FR-GLOB-008). Defaults are working drafts for Zenorra's counsel to review
// before launch (NFR-LEG-009); they are editable in Admin → Site content → Legal.

export const LEGAL_PAGES = {
  privacy: {
    title: "Privacy notice",
    body: `Zenorra Limited ("Zenorra", "we") respects your privacy. This notice explains what personal data we collect through this website, why, and your rights under the Nigeria Data Protection Act 2023.

## What we collect
- Contact details you give us: name, phone or WhatsApp number, email address.
- Your enquiry: what you are looking for, preferred locations, budget range, timeline and whether you are buying from Nigeria or abroad.
- Inspection bookings: preferred date, departure point and number of seats.
- Technical data: the page you were on, the campaign that brought you here (UTM tags), referrer and device type.

## Why we use it, and the lawful basis
- To respond to your enquiry and arrange inspections — legitimate interest and steps prior to a contract.
- To send market notes and new-estate alerts — only with your separate, explicit consent, which you can withdraw at any time.
- To measure which campaigns work — with your consent for analytics and marketing cookies.

## How long we keep it
- Enquiries: 36 months from our last contact with you.
- Unconfirmed newsletter sign-ups: 30 days.
- Records needed for a purchase contract: as long as the law requires.

## Who we share it with
Service providers who host this site and deliver our email, SMS and WhatsApp messages, under data processing agreements. We never sell your data.

## Your rights
You can ask to access, correct or erase your data, restrict or object to processing, withdraw consent, and receive a portable copy. Contact us using the details below and we will respond within 30 days. You may also complain to the Nigeria Data Protection Commission.

## Contact
Email zenorralimited@gmail.com or write to 139 Ogunlana Drive, Masha/Surulere, Lagos.`,
  },
  terms: {
    title: "Terms of use",
    body: `By using this website you agree to these terms.

## Information on this site
Property details, prices and payment plans are provided in good faith and may change as phases sell. Nothing on this site is an offer capable of acceptance; every purchase is governed by a written contract.

## Verification
We encourage every buyer to verify title documents independently. We will provide copies of the documents we hold for any property we market.

## Acceptable use
Do not misuse forms, attempt to access the admin area, or copy content for commercial use without permission.

## Liability
To the extent permitted by law, Zenorra is not liable for decisions made solely on the basis of website content without taking advice.`,
  },
  cookies: {
    title: "Cookie policy",
    body: `## Essential cookies
Needed to run the site and keep administrators signed in. These are always on.

## Analytics cookies
Google Analytics helps us understand which pages are useful. Only set if you choose "Accept all" or enable analytics.

## Marketing cookies
Meta Pixel measures our advertising. Only set if you consent.

## Changing your choice
Use "Cookie preferences" in the footer at any time.`,
  },
  disclaimer: {
    title: "Investment disclaimer",
    body: `Property values can go down as well as up. Appreciation figures shown on this site are historical averages for the period stated.

Past appreciation is not a guarantee of future returns. Zenorra does not promise or guarantee any return on any property.

Take independent legal and financial advice before committing funds.`,
  },
} as const;

export type LegalSlug = keyof typeof LEGAL_PAGES;

export type LegalBlock = { type: "h2"; text: string } | { type: "p"; text: string } | { type: "ul"; items: string[] };

/** Minimal, safe structure parser: "## " headings, "- " list items, blank-line paragraphs. Output is rendered as text, never HTML. */
export function parseLegal(body: string): LegalBlock[] {
  const out: LegalBlock[] = [];
  for (const chunk of body.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    let para: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (para.length) out.push({ type: "p", text: para.join(" ") });
      if (list.length) out.push({ type: "ul", items: list });
      para = [];
      list = [];
    };
    for (const l of lines) {
      if (l.startsWith("## ")) {
        flush();
        out.push({ type: "h2", text: l.slice(3) });
      } else if (l.startsWith("- ")) {
        if (para.length) flush();
        list.push(l.slice(2));
      } else {
        if (list.length) flush();
        para.push(l);
      }
    }
    flush();
  }
  return out;
}
