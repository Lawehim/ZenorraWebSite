// Every editable section of the public site. Defaults are the approved prototype copy;
// whatever an admin saves in ContentBlock overrides them field by field.
import { blockSchema, fieldSchema, type FieldDef } from "./fields";
import { LEGAL_PAGES } from "./legal";

export interface BlockDef<D extends Record<string, unknown> = Record<string, unknown>> {
  key: string;
  page: string;
  label: string;
  description?: string;
  fields: FieldDef[];
  defaults: D;
}

function block<D extends Record<string, unknown>>(def: BlockDef<D>): BlockDef<D> {
  return def;
}

const t = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, label, type: "text", ...extra });
const ta = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, label, type: "textarea", ...extra });
const href = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, label, type: "href", ...extra });
const list = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, label, type: "list", ...extra });
const img = (name: string, label: string): FieldDef => ({
  name,
  label,
  type: "image",
  optional: true,
  help: "Pick from the media library. Leave empty to show the labelled placeholder.",
});
const brief = (name = "imageBrief"): FieldDef => t(name, "Photo brief (shown on the placeholder)", { optional: true, max: 200 });

export const ICON_OPTIONS = [
  { value: "shield", label: "Shield (verification)" },
  { value: "person", label: "Person (guidance)" },
  { value: "card", label: "Card (payments)" },
  { value: "growth", label: "Chart (growth)" },
  { value: "sun", label: "Sun (solar)" },
  { value: "key", label: "Key (ownership)" },
];

// ---------------------------------------------------------------- Site-wide
const siteNav = block({
  key: "site.nav",
  page: "Site-wide",
  label: "Header",
  fields: [t("ctaLabel", "Header button label", { max: 40 })],
  defaults: { ctaLabel: "Talk to an Advisor" },
});

const siteCta = block({
  key: "site.cta",
  page: "Site-wide",
  label: "Closing call-to-action band",
  description: "The gold-edged band near the bottom of most pages.",
  fields: [t("eyebrow", "Eyebrow"), t("headline", "Headline"), ta("lede", "Supporting text"), t("primaryLabel", "Primary button"), href("primaryHref", "Primary button link"), t("secondaryLabel", "Secondary button (opens advisor form)"), img("image", "Background image"), brief()],
  defaults: {
    eyebrow: "Next step",
    headline: "Ready to make your next property investment?",
    lede: "Whether it is your first plot or your eleventh, an advisor will take you from shortlist to signed deed — and tell you plainly when a property is wrong for you.",
    primaryLabel: "View properties",
    primaryHref: "/properties",
    secondaryLabel: "Speak with an advisor",
    image: "",
    imageBrief: "Wide estate or Lagos skyline photograph",
  },
});

const siteFooter = block({
  key: "site.footer",
  page: "Site-wide",
  label: "Footer",
  fields: [ta("blurb", "Company summary", { max: 300 }), t("newsletterHeading", "Newsletter heading"), t("newsletterButton", "Newsletter button", { max: 20 }), t("newsletterNote", "Newsletter note", { optional: true })],
  defaults: {
    blurb: "Building Better Spaces. Powering a Brighter Future. Zenorra Limited brings real estate and solar energy solutions under one forward-thinking brand.",
    newsletterHeading: "Market notes, monthly",
    newsletterButton: "Join",
    newsletterNote: "We'll email you once to confirm. Unsubscribe any time.",
  },
});

const siteAdvisor = block({
  key: "site.advisor",
  page: "Site-wide",
  label: "Advisor form",
  description: "The five-question 'Talk to an advisor' pop-up.",
  fields: [
    t("title", "Title"),
    ta("intro", "Introduction", { max: 240 }),
    list("objectives", "Step 1 — objectives", { maxItems: 8 }),
    list("budgets", "Step 3 — budget bands", { maxItems: 8 }),
    list("timelines", "Step 4 — timelines", { maxItems: 8 }),
    t("successTitle", "Success title"),
    ta("successBody", "Success message", { max: 300 }),
    ta("consentText", "Marketing consent wording", { max: 400 }),
  ],
  defaults: {
    title: "Speak with an advisor",
    intro: "Five short questions. We match you to the right plots and call you back.",
    objectives: ["Buy land to hold", "Buy a home to live in", "Buy to rent out", "Still exploring"],
    budgets: ["Under ₦5m", "₦5m – ₦15m", "₦15m – ₦50m", "Above ₦50m"],
    timelines: ["Within 30 days", "1–3 months", "3–6 months", "Just researching"],
    successTitle: "Your advisor is assigned",
    successBody: "We have your brief. Expect a call within one business day.",
    consentText: "Yes, send me Zenorra market notes and new-estate alerts. I can unsubscribe at any time.",
  },
});

const siteBooking = block({
  key: "site.booking",
  page: "Site-wide",
  label: "Inspection booking form",
  fields: [t("title", "Title"), ta("intro", "Introduction", { max: 240 }), t("footnote", "Footnote", { max: 60 }), t("successTitle", "Success title"), ta("successBody", "Success message", { max: 300 })],
  defaults: {
    title: "Book a site inspection",
    intro: "Free coach pick-up from Lekki Phase 1 every Wednesday and Saturday.",
    footnote: "No cost · No obligation",
    successTitle: "See you on site",
    successBody: "We will confirm your pick-up point on WhatsApp the day before. Bring a photo ID — the estate gate requires it.",
  },
});

const siteRail = block({
  key: "site.rail",
  page: "Site-wide",
  label: "Floating buttons",
  fields: [t("whatsappLabel", "WhatsApp label", { max: 30 }), t("inspectLabel", "Inspection label", { max: 30 }), ta("whatsappMessage", "Default WhatsApp message", { max: 300 })],
  defaults: { whatsappLabel: "WhatsApp", inspectLabel: "Book Inspection", whatsappMessage: "Hello Zenorra, I'd like to speak with an advisor." },
});

const siteNotFound = block({
  key: "site.notFound",
  page: "Site-wide",
  label: "Page not found (404)",
  fields: [t("headline", "Headline"), ta("lede", "Supporting text", { max: 300 }), t("ctaLabel", "Button label", { max: 40 })],
  defaults: { headline: "We couldn't find that page", lede: "The link may be old, or the property may have moved. Start again from the homepage or browse current estates.", ctaLabel: "Back to the homepage" },
});

// ---------------------------------------------------------------- Home
const homeHero = block({
  key: "home.hero",
  page: "Home",
  label: "Hero",
  fields: [t("eyebrow", "Eyebrow"), t("eyebrowMeta", "Eyebrow detail", { optional: true }), t("headline", "Headline", { max: 120 }), t("headlineAccent", "Headline (gold line)", { max: 80 }), ta("lede", "Supporting text", { max: 400 }), t("primaryLabel", "View properties button", { max: 40 }), t("secondaryLabel", "Book inspection button", { max: 40 }), t("tertiaryLabel", "Advisor link", { max: 40 }), img("image", "Hero image"), { name: "video", label: "Background video (optional)", type: "video", optional: true, help: "Muted, looping, shown only on wide screens and never to visitors saving data — the hero image is used otherwise and as the poster. Upload in Media → Videos." }, brief()],
  defaults: {
    eyebrow: "Real estate & solar energy",
    eyebrowMeta: "/ Lagos · Ogun · FCT",
    headline: "Invest smart. Build wealth.",
    headlineAccent: "Own your future.",
    lede: "Helping Nigerians at home and abroad buy genuine land and property with confidence — every title verified, every survey charted, every buyer guided by one advisor from first call to signed deed.",
    primaryLabel: "View properties",
    secondaryLabel: "Book inspection",
    tertiaryLabel: "Talk to an advisor →",
    image: "",
    video: "",
    imageBrief: "Hero — aerial drone still or 12-second loop",
  },
});

const homeStats = block({
  key: "home.stats",
  page: "Home",
  label: "Trust statistics",
  description: "Four figures under the hero. They count up on first view.",
  fields: [{ name: "items", label: "Statistics", type: "items", maxItems: 4, fields: [{ name: "value", label: "Number", type: "number" }, t("suffix", "Suffix (e.g. + or %)", { optional: true, max: 4 }), t("label", "Label", { max: 40 })] }],
  defaults: {
    items: [
      { value: 1400, suffix: "+", label: "Plots allocated" },
      { value: 9, suffix: "", label: "Estates marketed" },
      { value: 6, suffix: "", label: "Countries served" },
      { value: 100, suffix: "%", label: "Titles verified" },
    ],
  },
});

const homeTrust = block({
  key: "home.trustStrip",
  page: "Home",
  label: "Scrolling trust strip",
  fields: [list("items", "Claims", { maxItems: 12, max: 60 })],
  defaults: {
    items: ["Certificate of Occupancy verified", "Excision & Gazette checked", "Surveyor-General charting", "Free site inspections weekly", "Diaspora video walkthroughs", "Instalments from 9 months", "CAC-registered · RC 7788412"],
  },
});

const homeAbout = block({
  key: "home.about",
  page: "Home",
  label: "About summary",
  fields: [t("eyebrow", "Eyebrow"), t("headline", "Headline", { max: 120 }), list("paragraphs", "Paragraphs", { max: 600, maxItems: 4 }), list("checks", "Checklist", { maxItems: 6, max: 120 }), t("ctaLabel", "Button label", { max: 40 }), img("image", "Image"), brief(), t("caption", "Image caption", { optional: true })],
  defaults: {
    eyebrow: "About Zenorra",
    headline: "Own strategically. Invest wisely. Embrace smarter solutions.",
    paragraphs: [
      "Zenorra Limited is a forward-thinking company providing solutions across Real Estate and Solar Energy. We help individuals, families, businesses and investors make smarter decisions about property ownership, real estate investment and sustainable energy.",
      "Our approach combines market knowledge, professional service, innovation and a strong commitment to helping our clients create lasting value.",
    ],
    checks: ["Trusted developer partnerships across Lagos, Ogun and the FCT", "Every property verified before it is ever marketed", "Buyer education as standard, not as an upsell"],
    ctaLabel: "More about us",
    image: "",
    imageBrief: "Advisor with a client on site",
    caption: "Estate layout study · Zenorra · 2026",
  },
});

const homeWhy = block({
  key: "home.why",
  page: "Home",
  label: "Why choose Zenorra",
  fields: [t("eyebrow", "Eyebrow"), t("headline", "Headline", { max: 140 }), { name: "items", label: "Reasons", type: "items", maxItems: 8, fields: [t("title", "Title", { max: 60 }), ta("body", "Description", { max: 300 }), { name: "icon", label: "Icon", type: "select", options: ICON_OPTIONS, optional: true }] }],
  defaults: {
    eyebrow: "Why choose Zenorra",
    headline: "Four reasons buyers trust us with the biggest cheque they will write",
    items: [
      { title: "Verified Properties", body: "Every parcel we market is charted at the Surveyor-General's office and searched at the Land Bureau before it reaches you.", icon: "shield" },
      { title: "Expert Guidance", body: "One advisor from first enquiry to the day your deed is signed — not a call centre and four handovers.", icon: "person" },
      { title: "Flexible Payment Plans", body: "Instalments from 9 to 36 months, accepted in naira, pounds, dollars and Canadian dollars.", icon: "card" },
      { title: "Investment Growth", body: "We select for the corridors where infrastructure is already funded and under construction, not merely announced.", icon: "growth" },
    ],
  },
});

const homeFeatured = block({
  key: "home.featured",
  page: "Home",
  label: "Featured properties heading",
  description: "Which properties appear is set on each property (Featured + order).",
  fields: [t("eyebrow", "Eyebrow"), t("headline", "Headline"), ta("lede", "Supporting text", { max: 300 }), t("ctaLabel", "Button label", { max: 40 })],
  defaults: {
    eyebrow: "Available now",
    headline: "Featured properties",
    lede: "Prices shown are current asking prices for the phase now selling. Instalment figures assume a 30% initial deposit.",
    ctaLabel: "All properties",
  },
});

const homeJourney = block({
  key: "home.journey",
  page: "Home",
  label: "Investment journey",
  fields: [t("eyebrow", "Eyebrow"), t("headline", "Headline"), { name: "items", label: "Steps", type: "items", maxItems: 6, fields: [t("title", "Title", { max: 60 }), ta("body", "Description", { max: 300 })] }],
  defaults: {
    eyebrow: "Your investment journey",
    headline: "Four steps, and you own it",
    items: [
      { title: "Browse verified properties", body: "Shortlist from estates that have already passed title verification, charting and a physical site visit by our team." },
      { title: "Inspect the land yourself", body: "Join a free inspection coach, or take a live video walkthrough if you are buying from abroad. Never buy what you have not seen." },
      { title: "Secure your plot", body: "Pay through the corporate account in full or on a plan. You receive a contract, receipts and an allocation timeline in writing." },
      { title: "Hold, build, or let it earn", body: "Take allocation, collect your deed and survey, and decide whether to hold for appreciation, build, or put it to work as rental income." },
    ],
  },
});

const homeTwoSolutions = block({
  key: "home.twoSolutions",
  page: "Home",
  label: "One Vision. Two Solutions.",
  fields: [t("eyebrow", "Eyebrow"), t("headline", "Headline", { max: 120 }), t("subheadline", "Sub-headline", { max: 120 }), ta("body", "Body", { max: 500 }), t("tagline", "Tagline", { max: 120 }), list("pillars", "Pillars", { maxItems: 4, max: 40 })],
  defaults: {
    eyebrow: "Zenorra Limited",
    headline: "One Vision. Two Solutions.",
    subheadline: "Real Estate + Solar Energy",
    body: "We bring property and sustainable energy solutions under one forward-thinking brand—helping our clients build better spaces and power a better future.",
    tagline: "Building Better Spaces. Powering a Brighter Future.",
    pillars: ["Real Estate", "Solar Energy"],
  },
});

const homeSolar = block({
  key: "home.solar",
  page: "Home",
  label: "Solar energy pillar",
  fields: [t("eyebrow", "Eyebrow"), t("headline", "Headline", { max: 140 }), ta("lede", "Supporting text", { max: 500 }), list("checks", "Checklist", { maxItems: 6, max: 120 }), t("ctaLabel", "Button label", { max: 40 }), img("image", "Image"), brief()],
  defaults: {
    eyebrow: "Second pillar",
    headline: "Solar energy marketing, for the businesses powering the switch",
    lede: "Renewable energy sells on trust and arithmetic. We build both — running awareness campaigns, customer education and lead generation for solar providers serving homes, estates and commercial sites across Nigeria.",
    checks: ["Residential and commercial lead pipelines", "Customer education that closes the knowledge gap", "Product promotions and installer co-marketing", "Renewable energy advocacy and content"],
    ctaLabel: "Explore our services",
    image: "",
    imageBrief: "Rooftop solar installation",
  },
});

const homeInsights = block({
  key: "home.insights",
  page: "Home",
  label: "Insights teaser",
  fields: [t("eyebrow", "Eyebrow"), t("headline", "Headline"), ta("lede", "Supporting text", { max: 300 }), t("ctaLabel", "Button label", { max: 40 })],
  defaults: { eyebrow: "Learn real estate", headline: "Know before you buy", lede: "We would rather you walked away informed than bought in a hurry. Start with these.", ctaLabel: "Read more" },
});

const homeTestimonials = block({
  key: "home.testimonials",
  page: "Home",
  label: "Testimonials heading",
  description: "The quotes themselves are managed under Testimonials.",
  fields: [t("eyebrow", "Eyebrow")],
  defaults: { eyebrow: "Client experience" },
});

// ---------------------------------------------------------------- About
const aboutHeader = block({
  key: "about.header",
  page: "About",
  label: "Page header",
  fields: [list("headlineLines", "Headline lines", { maxItems: 4, max: 60 }), t("headlineAccent", "Gold headline line", { optional: true, max: 60 }), img("image", "Header image"), brief(), t("seoTitle", "SEO title", { optional: true, max: 60 }), t("seoDescription", "SEO description", { optional: true, max: 155 })],
  defaults: {
    headlineLines: ["Building Better Spaces."],
    headlineAccent: "Powering a Brighter Future.",
    image: "",
    imageBrief: "The Zenorra team at work",
    seoTitle: "About Zenorra Limited",
    seoDescription: "Zenorra Limited provides real estate and solar energy solutions for individuals, families, businesses and investors in Nigeria.",
  },
});

const aboutWho = block({
  key: "about.who",
  page: "About",
  label: "Who we are",
  fields: [t("eyebrow", "Eyebrow"), ta("lead", "Lead paragraph", { max: 500 }), ta("body", "Paragraph", { max: 600 }), { name: "stats", label: "Facts", type: "items", maxItems: 4, fields: [t("value", "Value", { max: 20 }), t("label", "Label", { max: 40 })] }],
  defaults: {
    eyebrow: "Who we are",
    lead: "Zenorra Limited is a forward-thinking company providing solutions across Real Estate and Solar Energy. We help individuals, families, businesses, and investors make smarter decisions about property ownership, real estate investment, and sustainable energy solutions.",
    body: "Our approach combines market knowledge, professional service, innovation, and a strong commitment to helping our clients create lasting value. At Zenorra, we believe the future belongs to people who own strategically, invest wisely, and embrace smarter solutions.",
    stats: [
      { value: "2019", label: "Founded" },
      { value: "1,400+", label: "Plots allocated" },
      { value: "6", label: "Countries served" },
      { value: "RC 7788412", label: "CAC registered" },
    ],
  },
});

const aboutMission = block({
  key: "about.missionVision",
  page: "About",
  label: "Mission and vision",
  fields: [ta("mission", "Mission", { max: 500 }), ta("vision", "Vision", { max: 500 })],
  defaults: {
    mission: "To deliver credible real estate opportunities and practical solar solutions that create measurable value for our clients.",
    vision: "To become Africa's leading marketing and advertising company, recognised for transforming businesses through creativity, technology, strategic partnerships and measurable results.",
  },
});

const aboutWhy = block({
  key: "about.why",
  page: "About",
  label: "Why choose Zenorra",
  fields: [t("eyebrow", "Eyebrow"), t("headline", "Headline"), { name: "items", label: "Reasons", type: "items", maxItems: 9, fields: [t("title", "Title", { max: 60 }), ta("body", "Description", { max: 240 })] }],
  defaults: {
    eyebrow: "Why choose Zenorra?",
    headline: "Confidence, value and a professional experience from start to finish",
    items: [
      { title: "Trust", body: "We believe every successful transaction starts with confidence. We prioritize transparency and clear communication." },
      { title: "Value", body: "Our focus goes beyond making a transaction. We help clients identify opportunities with long-term value and practical benefits." },
      { title: "Innovation", body: "We combine traditional property solutions with modern technology and sustainable energy solutions." },
      { title: "Professional Service", body: "From the first conversation to completion, we aim to provide a structured and professional client experience." },
    ],
  },
});

const aboutCommitment = block({
  key: "about.commitment",
  page: "About",
  label: "Our commitment",
  fields: [t("eyebrow", "Eyebrow"), t("headline", "Headline", { max: 120 }), list("paragraphs", "Paragraphs", { max: 600, maxItems: 4 }), t("ctaLabel", "Button label", { max: 40 }), href("ctaHref", "Button link"), img("image", "Image"), brief()],
  defaults: {
    eyebrow: "Our commitment",
    headline: "Professionalism, integrity, innovation and excellence",
    paragraphs: [
      "As a CAC-registered Nigerian company, every campaign we create and every brand we represent is guided by our promise to build trust, create value and deliver measurable growth.",
      "Whether you are buying property, exploring solar solutions or growing your business, Zenorra is here to help you make smarter decisions and achieve better results.",
    ],
    ctaLabel: "Work with us",
    ctaHref: "/contact",
    image: "",
    imageBrief: "Leadership portrait",
  },
});

// ---------------------------------------------------------------- Services
const servicesHeader = block({
  key: "services.header",
  page: "Services",
  label: "Page header",
  fields: [t("headline", "Headline"), ta("lede", "Supporting text", { max: 400 }), img("image", "Header image"), brief(), t("seoTitle", "SEO title", { optional: true, max: 60 }), t("seoDescription", "SEO description", { optional: true, max: 155 })],
  defaults: {
    headline: "Our core services",
    lede: "Real estate and solar energy are our flagship industries. The studio behind them serves any business that needs to be seen, trusted and chosen.",
    image: "",
    imageBrief: "Campaign or brand photography",
    seoTitle: "Services — real estate, solar and marketing",
    seoDescription: "Real estate marketing, solar energy marketing and a full marketing and media studio from Zenorra.",
  },
});

const servicesPillars = block({
  key: "services.pillars",
  page: "Services",
  label: "Service pillars",
  description: "Each pillar with its list of sub-services, in display order.",
  fields: [
    {
      name: "items",
      label: "Pillars",
      type: "items",
      maxItems: 6,
      fields: [t("title", "Title", { max: 60 }), ta("body", "Description", { max: 400 }), list("subServices", "Sub-services", { maxItems: 12, max: 80 }), t("ctaLabel", "Button label", { max: 40 }), img("image", "Image"), brief()],
    },
  ],
  defaults: {
    items: [
      {
        title: "Real Estate Marketing",
        body: "We take an estate from unknown to sold out — positioning, campaign, content and a lead pipeline your sales team can actually work.",
        subServices: ["Property advertising and campaign management", "Qualified lead generation and routing", "Paid social and search campaigns", "Investment awareness and buyer education", "Estate branding and naming", "Video walkthroughs, drone and photography"],
        ctaLabel: "Discuss this service",
        image: "",
        imageBrief: "Property campaign in market",
      },
      {
        title: "Solar Energy Marketing",
        body: "Renewable energy sells on trust and arithmetic. We build both — explaining the savings clearly enough that customers arrive ready to buy.",
        subServices: ["Solar awareness campaigns", "Product and package promotions", "Customer education content", "Residential lead generation", "Commercial and industrial pipelines", "Renewable energy advocacy"],
        ctaLabel: "Discuss this service",
        image: "",
        imageBrief: "Solar installation in progress",
      },
      {
        title: "Marketing & Media",
        body: "The full studio: strategy, brand, content and campaigns for businesses that need to be seen, trusted and chosen.",
        subServices: ["Digital marketing and paid media", "Social media management", "Brand strategy and identity", "Video production and editing", "Graphic design and print", "Campaign planning and reporting"],
        ctaLabel: "Discuss this service",
        image: "",
        imageBrief: "Studio and production work",
      },
    ],
  },
});

// ---------------------------------------------------------------- Properties
const propertiesHeader = block({
  key: "properties.header",
  page: "Properties",
  label: "Catalogue header",
  fields: [t("headline", "Headline"), ta("lede", "Supporting text", { max: 400 }), ta("emptyMessage", "No-results message", { max: 200 }), img("image", "Header image"), brief(), t("seoTitle", "SEO title", { optional: true, max: 60 }), t("seoDescription", "SEO description", { optional: true, max: 155 })],
  defaults: {
    headline: "Verified properties",
    lede: "Estates across Lagos, Ogun and the FCT. Every one searched at the Land Bureau and charted at the Surveyor-General's office before it appeared on this page.",
    emptyMessage: "No properties match that combination yet.",
    image: "",
    imageBrief: "Wide estate photograph",
    seoTitle: "Verified land and property for sale",
    seoDescription: "Verified plots and homes in Ibeju-Lekki, Epe, Lekki–Ajah, Ogun and Abuja with prices and instalment plans.",
  },
});

const propertiesDetail = block({
  key: "properties.detail",
  page: "Properties",
  label: "Property page wording",
  description: "Shared wording on every property detail page.",
  fields: [
    t("featuresHeading", "Features heading"),
    t("allocationDefault", "Default allocation timeline", { max: 60 }),
    ta("diasporaNote", "Note under the price panel", { max: 300 }),
    ta("appreciationDisclaimer", "Appreciation disclaimer", { max: 300 }),
    t("relatedHeading", "Related properties heading"),
    t("soldOutHeadline", "Sold-out message"),
    ta("soldOutBody", "Sold-out explanation", { max: 300 }),
  ],
  defaults: {
    featuresHeading: "What comes with the plot",
    allocationDefault: "14 days after payment",
    diasporaNote: "Buying from abroad? We run a live video walkthrough of your exact plot before you pay a naira.",
    appreciationDisclaimer: "Appreciation figures are historical averages for the period stated. Past appreciation is not a guarantee of future returns.",
    relatedHeading: "Other estates you may like",
    soldOutHeadline: "This phase is sold out",
    soldOutBody: "Leave your details and we will tell you first when the next phase opens.",
  },
});

// ---------------------------------------------------------------- Insights
const insightsHeader = block({
  key: "insights.header",
  page: "Insights",
  label: "Insights header",
  fields: [t("headline", "Headline"), ta("lede", "Supporting text", { max: 400 }), img("image", "Header image"), brief(), t("seoTitle", "SEO title", { optional: true, max: 60 }), t("seoDescription", "SEO description", { optional: true, max: 155 })],
  defaults: {
    headline: "Learn real estate",
    lede: "Practical guidance on titles, corridors, scams and solar — written for buyers, not for search engines.",
    image: "",
    imageBrief: "Editorial photograph",
    seoTitle: "Insights — buying land in Nigeria",
    seoDescription: "Plain-language guidance on Nigerian land titles, corridors, scams and solar energy.",
  },
});

const insightsArticleCta = block({
  key: "insights.articleCta",
  page: "Insights",
  label: "End-of-article prompt",
  fields: [t("headline", "Headline"), ta("body", "Body", { max: 300 }), t("ctaLabel", "Button label", { max: 40 }), t("moreHeading", "Keep-reading heading")],
  defaults: {
    headline: "Want this checked on your own deal?",
    body: "Send us the survey number. We will chart it and tell you what we find.",
    ctaLabel: "Talk to an advisor",
    moreHeading: "More from the desk",
  },
});

// ---------------------------------------------------------------- Contact
const contactHeader = block({
  key: "contact.header",
  page: "Contact",
  label: "Contact header",
  fields: [t("headline", "Headline"), ta("lede", "Supporting text", { max: 400 }), img("image", "Header image"), brief(), t("seoTitle", "SEO title", { optional: true, max: 60 }), t("seoDescription", "SEO description", { optional: true, max: 155 })],
  defaults: {
    headline: "Talk to Zenorra",
    lede: "Property enquiry, solar project or a marketing brief — tell us which, and the right person calls you back.",
    image: "",
    imageBrief: "Head office exterior",
    seoTitle: "Contact Zenorra",
    seoDescription: "Call, WhatsApp or send an enquiry to Zenorra's Lekki head office.",
  },
});

const contactForm = block({
  key: "contact.form",
  page: "Contact",
  label: "Contact form",
  fields: [t("submitLabel", "Submit button", { max: 40 }), t("successTitle", "Success title"), ta("successBody", "Success message", { max: 300 }), t("officeHeading", "Office panel heading")],
  defaults: {
    submitLabel: "Send enquiry",
    successTitle: "Message received",
    successBody: "Thank you. The right advisor will call you within one business day.",
    officeHeading: "Head office",
  },
});

// ---------------------------------------------------------------- Legal
const legalBlock = (slug: keyof typeof LEGAL_PAGES) =>
  block({
    key: `legal.${slug}`,
    page: "Legal",
    label: LEGAL_PAGES[slug].title,
    description: "Start a line with “## ” for a heading and “- ” for a bullet. Leave a blank line between paragraphs.",
    fields: [t("title", "Page title", { max: 80 }), ta("body", "Text", { max: 20000 })],
    defaults: { title: LEGAL_PAGES[slug].title as string, body: LEGAL_PAGES[slug].body as string },
  });
const legalPrivacy = legalBlock("privacy");
const legalTerms = legalBlock("terms");
const legalCookies = legalBlock("cookies");
const legalDisclaimer = legalBlock("disclaimer");

export const BLOCKS: BlockDef[] = [
  siteNav,
  siteCta,
  siteFooter,
  siteAdvisor,
  siteBooking,
  siteRail,
  siteNotFound,
  homeHero,
  homeStats,
  homeTrust,
  homeAbout,
  homeWhy,
  homeFeatured,
  homeJourney,
  homeTwoSolutions,
  homeSolar,
  homeInsights,
  homeTestimonials,
  aboutHeader,
  aboutWho,
  aboutMission,
  aboutWhy,
  aboutCommitment,
  servicesHeader,
  servicesPillars,
  propertiesHeader,
  propertiesDetail,
  insightsHeader,
  insightsArticleCta,
  contactHeader,
  contactForm,
  legalPrivacy,
  legalTerms,
  legalCookies,
  legalDisclaimer,
] as BlockDef[];

const DEFAULTS = {
  "site.nav": siteNav.defaults,
  "site.cta": siteCta.defaults,
  "site.footer": siteFooter.defaults,
  "site.advisor": siteAdvisor.defaults,
  "site.booking": siteBooking.defaults,
  "site.rail": siteRail.defaults,
  "site.notFound": siteNotFound.defaults,
  "home.hero": homeHero.defaults,
  "home.stats": homeStats.defaults,
  "home.trustStrip": homeTrust.defaults,
  "home.about": homeAbout.defaults,
  "home.why": homeWhy.defaults,
  "home.featured": homeFeatured.defaults,
  "home.journey": homeJourney.defaults,
  "home.twoSolutions": homeTwoSolutions.defaults,
  "home.solar": homeSolar.defaults,
  "home.insights": homeInsights.defaults,
  "home.testimonials": homeTestimonials.defaults,
  "about.header": aboutHeader.defaults,
  "about.who": aboutWho.defaults,
  "about.missionVision": aboutMission.defaults,
  "about.why": aboutWhy.defaults,
  "about.commitment": aboutCommitment.defaults,
  "services.header": servicesHeader.defaults,
  "services.pillars": servicesPillars.defaults,
  "properties.header": propertiesHeader.defaults,
  "properties.detail": propertiesDetail.defaults,
  "insights.header": insightsHeader.defaults,
  "insights.articleCta": insightsArticleCta.defaults,
  "contact.header": contactHeader.defaults,
  "contact.form": contactForm.defaults,
  "legal.privacy": legalPrivacy.defaults,
  "legal.terms": legalTerms.defaults,
  "legal.cookies": legalCookies.defaults,
  "legal.disclaimer": legalDisclaimer.defaults,
};

export type ContentKey = keyof typeof DEFAULTS;
export type ContentOf<K extends ContentKey> = (typeof DEFAULTS)[K];

const BY_KEY = new Map(BLOCKS.map((b) => [b.key, b]));

export function getBlockDef(key: string): BlockDef | undefined {
  return BY_KEY.get(key);
}

export function listContentPages(): { page: string; blocks: BlockDef[] }[] {
  const pages = new Map<string, BlockDef[]>();
  for (const b of BLOCKS) pages.set(b.page, [...(pages.get(b.page) ?? []), b]);
  return [...pages.entries()].map(([page, blocks]) => ({ page, blocks }));
}

export type ValidationResult = { ok: true; data: Record<string, unknown> } | { ok: false; errors: Record<string, string> };

export function validateBlockData(key: string, data: unknown): ValidationResult {
  const def = getBlockDef(key);
  if (!def) return { ok: false, errors: { _: "Unknown content section." } };
  const parsed = blockSchema(def.fields).safeParse(data);
  if (parsed.success) return { ok: true, data: parsed.data as Record<string, unknown> };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join(".") || "_";
    if (!errors[path]) errors[path] = issue.message;
    const top = String(issue.path[0] ?? "_");
    if (!errors[top]) errors[top] = issue.message;
  }
  return { ok: false, errors };
}

/** Field-by-field merge: any stored value that fails its field schema falls back to the default. */
export function resolveBlock<K extends ContentKey>(key: K, stored: unknown): ContentOf<K> {
  const def = getBlockDef(key)!;
  const defaults = def.defaults as Record<string, unknown>;
  if (!stored || typeof stored !== "object") return clone(defaults) as ContentOf<K>;
  const out: Record<string, unknown> = clone(defaults);
  for (const f of def.fields) {
    const v = (stored as Record<string, unknown>)[f.name];
    if (v === undefined) continue;
    const schema = f.optional ? fieldSchema(f).optional() : fieldSchema(f);
    const r = schema.safeParse(v);
    if (r.success) out[f.name] = r.data;
  }
  return out as ContentOf<K>;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
