// Seeds sample inventory and articles from the approved prototype, plus the first Super Admin.
// SAMPLE DATA: estates, prices and testimonials are the prototype's illustrative content.
// Replace them with Zenorra's real inventory before launch (SRS A-1, A-2).
import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient, type TitleType } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { sanitizeRichHtml } from "../lib/richtext/sanitize";
import { readingMinutes } from "../lib/format";

const db = new PrismaClient();

const PROPERTIES: {
  ref: string; slug: string; name: string; corridor: string; loc: string; price: number; unit: string; title: TitleType; status: "AVAILABLE" | "SELLING_FAST";
  badges: string[]; size: string; sqm: number; plan: number; roi: string; shot: string; blurb: string; features: string[]; desc: string; featured?: number;
}[] = [
  { ref: "ZNR-001", slug: "heritage-gardens", name: "Heritage Gardens", corridor: "Ibeju-Lekki", loc: "Eleko, Ibeju-Lekki, Lagos", price: 4800000, unit: "per 500sqm plot", title: "REGISTERED_SURVEY", status: "AVAILABLE", badges: ["Registered survey", "Dry land"], size: "500 sqm", sqm: 500, plan: 24, roi: "32% p.a. (3-yr avg)", shot: "Aerial drone shot — fenced perimeter and internal roads", featured: 1,
    blurb: "Ten minutes from the Lekki Free Trade Zone gate, on tarred access with perimeter fencing already up.",
    features: ["Fully dry, fenced and gated", "Tarred internal road network", "Perimeter drainage and street lights", "Recreation park and green belt", "Allocation within 14 days of full payment"],
    desc: "Heritage Gardens sits on the Eleko axis, the stretch of Ibeju-Lekki that has absorbed the most infrastructure spending in the last five years. The Lekki Deep Sea Port, the Dangote Refinery and the Lekki Free Trade Zone all sit within a 20-minute drive, and the corridor's land values have followed." },
  { ref: "ZNR-002", slug: "coral-reserve", name: "Coral Reserve Estate", corridor: "Ibeju-Lekki", loc: "Akodo Ise, Ibeju-Lekki, Lagos", price: 7200000, unit: "per 600sqm plot", title: "EXCISION", status: "SELLING_FAST", badges: ["Excision", "Beachfront belt"], size: "600 sqm", sqm: 600, plan: 18, roi: "38% p.a. (3-yr avg)", shot: "Aerial drone shot — estate entrance toward the Atlantic", featured: 2,
    blurb: "Six plots left in Phase 2. Ten minutes to the Atlantic, on the government-excised side of Akodo.",
    features: ["Government excision in place", "Registered survey per plot", "Gated entrance with security post", "Water and electricity infrastructure laid", "Short-let and resort development permitted"],
    desc: "Coral Reserve is our closest estate to the Atlantic, on the excised side of Akodo Ise. Excision matters here: it means the land has been formally released by the Lagos State Government to the community, which is what makes a Registered Survey and later a Governor's Consent possible." },
  { ref: "ZNR-003", slug: "amberfield-court", name: "Amberfield Court", corridor: "Lekki-Ajah", loc: "Bogije, Lekki–Epe Expressway, Lagos", price: 12500000, unit: "per 300sqm plot", title: "REGISTERED_SURVEY", status: "AVAILABLE", badges: ["Serviced", "Build now"], size: "300 sqm", sqm: 300, plan: 12, roi: "24% p.a. (3-yr avg)", shot: "Street-level — paved road, drainage and street lights", featured: 3,
    blurb: "A fully serviced estate for buyers who want to build within the year, not hold for a decade.",
    features: ["Paved roads, drainage, street lighting", "Estate transformer and borehole", "Building approvals pre-processed", "Managed by a resident facility company"],
    desc: "Bogije is where the Lekki corridor stops being speculative and starts being residential. Amberfield Court is serviced to the plot boundary — you can break ground the month you take allocation." },
  { ref: "ZNR-004", slug: "solara-ridge", name: "Solara Ridge", corridor: "Epe", loc: "Itoikin Road, Epe, Lagos", price: 2900000, unit: "per 500sqm plot", title: "GAZETTE", status: "AVAILABLE", badges: ["Gazette", "Entry price"], size: "500 sqm", sqm: 500, plan: 36, roi: "41% p.a. (3-yr avg)", shot: "Wide land shot — cleared frontage on Itoikin Road",
    blurb: "Our lowest entry point. Epe is roughly where Ibeju-Lekki was in 2016.",
    features: ["Land under a published Gazette", "36-month instalment plan", "Close to the Lagos State Polytechnic campus", "Near the Epe Deep Sea axis and Alaro City", "Verified free of government acquisition"],
    desc: "Epe is the corridor most Lagos buyers will wish they had entered earlier. The Lagos–Epe expressway expansion, the new fishing terminal and the spillover from Alaro City are all pushing demand east." },
  { ref: "ZNR-005", slug: "cedar-terraces", name: "The Cedar Terraces", corridor: "Lekki-Ajah", loc: "Sangotedo, Ajah, Lagos", price: 145000000, unit: "4-bed terrace + BQ", title: "REGISTERED_SURVEY", status: "SELLING_FAST", badges: ["Built home"], size: "268 sqm built", sqm: 268, plan: 9, roi: "Rental yield 6.8%", shot: "Front elevation — finished terrace units",
    blurb: "Nine of twenty-four units remain. Finished, fitted and ready to move into.",
    features: ["Four bedrooms, all en-suite, plus BQ", "Fitted kitchen and wardrobes", "24-hour power via estate hybrid solar system", "Swimming pool, gym and children's play area"],
    desc: "Cedar Terraces answers a specific question: where do you put ₦145m and still sleep well. Sangotedo has the schools, the hospitals and the retail that make a home rentable." },
  { ref: "ZNR-006", slug: "vista-homes-mowe", name: "Zenorra Vista Homes", corridor: "Ogun", loc: "Mowe–Ofada, Ogun State", price: 3400000, unit: "per 464sqm plot", title: "REGISTERED_SURVEY", status: "AVAILABLE", badges: ["Registered survey", "Diaspora favourite"], size: "464 sqm", sqm: 464, plan: 24, roi: "27% p.a. (3-yr avg)", shot: "Gated entrance and manned gatehouse",
    blurb: "The corridor of choice for buyers who work in Lagos and want to own in Ogun.",
    features: ["Off the Lagos–Ibadan Expressway service lane", "Registered survey and deed of assignment", "Gated with a manned entrance", "Instalments accepted in GBP, USD and CAD", "Free video walkthrough for diaspora buyers"],
    desc: "Mowe sits on the Lagos–Ibadan Expressway, minutes from Redemption Camp and the growing Ofada industrial cluster. It is the most common first purchase for diaspora clients: small ticket, clean title, and a plot they can inspect by video before committing." },
  { ref: "ZNR-007", slug: "palm-haven", name: "Palm Haven Estate", corridor: "Ibeju-Lekki", loc: "Free Trade Zone Road, Ibeju-Lekki", price: 6500000, unit: "per 500sqm plot", title: "EXCISION_IN_PROGRESS", status: "AVAILABLE", badges: ["Commercial", "Corner plots"], size: "500 sqm", sqm: 500, plan: 18, roi: "35% p.a. (3-yr avg)", shot: "Corner plot with the Free Trade Zone road behind",
    blurb: "Mixed-use zoning. Buyers here are building short-lets, workers' housing and small retail.",
    features: ["Mixed residential and commercial use", "Corner and roadside plots available", "Direct access from the FTZ road", "Bulk purchase discounts from three plots"],
    desc: "The Free Trade Zone employs thousands of people who need somewhere to sleep, eat and shop. Palm Haven is zoned for that demand." },
  { ref: "ZNR-008", slug: "aurora-court-abuja", name: "Aurora Court", corridor: "Abuja", loc: "Kuje District, Abuja (FCT)", price: 9800000, unit: "per 500sqm plot", title: "REGISTERED_SURVEY", status: "AVAILABLE", badges: ["FCT"], size: "500 sqm", sqm: 500, plan: 15, roi: "22% p.a. (3-yr avg)", shot: "Aerial drone shot — Kuje district frontage",
    blurb: "Twenty minutes from the airport expressway, in the direction Abuja is actually growing.",
    features: ["Tarred access from the Abuja–Lokoja road", "Close to the airport and the new city districts", "Topographical survey available on request", "Fenced with a gatehouse"],
    desc: "Abuja's expansion is running south-west along the airport corridor, and Kuje has moved from farmland to district in under a decade." },
];

const CATEGORIES = ["Buyer protection", "Investment", "Education", "Market", "Solar energy"];

const POSTS: { slug: string; cat: string; title: string; date: string; author: string; excerpt: string; body: string }[] = [
  { slug: "avoid-land-scams", cat: "Buyer protection", title: "How to avoid land scams in Nigeria", date: "2026-08-12", author: "Zenorra Advisory", excerpt: "Omonile trouble, double allocation, fake surveys and government acquisition. The seven checks that separate a good buy from a costly one.",
    body: `<p>Almost every land dispute we are asked to untangle traces back to a check that took an afternoon and was skipped. Land fraud in Nigeria is rarely sophisticated — it survives on urgency, on a price that feels like a favour, and on buyers who pay before they verify.</p><h2>1. Confirm the land is not under government acquisition</h2><p>Land under a general or committed government acquisition cannot be sold to you, no matter who is holding the survey. A search at the Lagos State Land Bureau (or your state equivalent) tells you the status of the parcel.</p><h2>2. Understand which title you are actually buying</h2><ul><li><strong>Certificate of Occupancy (C of O)</strong> — the state has granted a leasehold interest over that parcel.</li><li><strong>Governor's Consent</strong> — the state has approved a transfer of an existing C of O.</li><li><strong>Excision and Gazette</strong> — the government has released the land back to the community and published it.</li><li><strong>Registered Survey and Deed of Assignment</strong> — evidence of your transaction, not of the land's status.</li></ul><blockquote>If a seller cannot name the title in one sentence, they do not have one.</blockquote><h2>3. Verify the survey at the Surveyor-General's office</h2><p>A survey plan carries a number. That number can be charted at the office of the Surveyor-General, which returns the parcel's true coordinates and whether it falls within an acquisition.</p><h2>4. Walk the land, physically</h2><p>Look for beacons, occupation, farming, and any structure with a "This land is not for sale" notice.</p><h2>5. Never pay cash, and never pay a person</h2><p>Pay into a corporate account in the name of the company on the contract. Every payment should leave a bank trail.</p><h3>The one-line version</h3><p>Verify the title, chart the survey, walk the land, pay a company.</p>` },
  { slug: "land-banking-wealth", cat: "Investment", title: "Why land banking builds wealth quietly", date: "2026-07-29", author: "Zenorra Advisory", excerpt: "Land does not pay you monthly, which is exactly why it works. A look at what the Lekki corridor did to patient buyers.",
    body: `<p>Land banking is the least exciting strategy in Nigerian real estate and, over a decade, one of the most effective. You buy land in the path of infrastructure, you hold it, and you let other people's spending do the work.</p><h2>Why it works here specifically</h2><ul><li><strong>No tenants, no maintenance.</strong></li><li><strong>Low entry.</strong> A plot in an emerging corridor can still start under ₦3m, with instalments.</li><li><strong>It is divisible.</strong> Several plots can be sold one at a time as needs arise.</li></ul><blockquote>The return did not come from the land. It came from the road that arrived next to it.</blockquote><h2>The discipline part</h2><p>Land banking fails for one reason — selling early. Past appreciation is not a guarantee of future returns; choose corridors where infrastructure is funded and under construction.</p>` },
  { slug: "five-checks-before-buying", cat: "Buyer protection", title: "Five things to check before you buy property", date: "2026-07-06", author: "Zenorra Advisory", excerpt: "A short pre-purchase checklist you can run on any offer, whether it comes from us or from anyone else.",
    body: `<p>Before money moves, five things should be true. Print this, and use it on every offer.</p><h2>1. The title is named, and the document exists</h2><p>A named instrument with a copy you can verify independently.</p><h2>2. The search result is fresh</h2><p>A land search older than six months is history, not status.</p><h2>3. The physical land matches the paper</h2><p>Chart the survey coordinates and then stand on the plot.</p><h2>4. The payment plan is written, with penalties both ways</h2><p>A fair contract answers what happens if either side misses a date.</p><h2>5. You have spoken to a previous buyer</h2><p>Ask the seller for two buyers from the last phase and call them.</p>` },
  { slug: "title-documents-explained", cat: "Education", title: "C of O, Excision, Gazette: what each one actually means", date: "2026-06-18", author: "Zenorra Advisory", excerpt: "Four documents, four different levels of protection. Plain-language definitions, and what each one lets you do.",
    body: `<p>Most title confusion in Nigeria comes from treating four very different documents as if they were interchangeable.</p><h2>Certificate of Occupancy</h2><p>Issued by the state governor, a C of O grants a leasehold — usually 99 years — over a specific parcel.</p><h2>Governor's Consent</h2><p>Transferring land that already carries a C of O requires the governor's approval.</p><h2>Excision</h2><p>Where land sits within a government acquisition, the state may release a portion back to the original community.</p><h2>Gazette</h2><p>The gazette is the official published record of that excision.</p><blockquote>Title tells you what the land is. Survey and deed tell you what happened to it. You need both.</blockquote>` },
  { slug: "lekki-port-land-values", cat: "Market", title: "What the Lekki Deep Sea Port did to land values", date: "2026-05-22", author: "Zenorra Advisory", excerpt: "Infrastructure moves land prices in a predictable sequence. Here is the sequence, and where the Epe corridor currently sits in it.",
    body: `<p>Infrastructure does not lift land values evenly. It moves them in stages.</p><h2>Stage one: announcement</h2><p>Prices move a little, on speculation.</p><h2>Stage two: contractors on site</h2><p>The first honest signal, and the last comfortable entry point.</p><h2>Stage three: commissioning</h2><p>Values step up sharply.</p><h2>Stage four: employment</h2><p>Demand shifts from speculators to residents.</p>` },
  { slug: "solar-cost-lagos-home", cat: "Solar energy", title: "Solar for a Lagos home: what it actually costs in 2026", date: "2026-04-30", author: "Zenorra Energy Desk", excerpt: "Three real system sizes, what each one runs, and how the payback compares to a year of petrol and generator servicing.",
    body: `<p>Most solar quotes arrive as a wall of specifications. Here is the version that answers what it will run, and when it pays for itself.</p><h2>The small system</h2><p>Around 3kVA with 5kWh of lithium storage. Runs lights, fans, a fridge, a television and laptops through the night.</p><h2>The family system</h2><p>Around 5kVA with 10kWh of storage. Adds an inverter air conditioner and a washing machine.</p><h2>The whole-house system</h2><p>10kVA and up with 15–20kWh of storage.</p><blockquote>Solar is not an environmental purchase in Lagos. It is a cost-of-living one that happens to be clean.</blockquote>` },
];

const TESTIMONIALS = [
  { name: "Adaeze Okonkwo", roleText: "Bought 2 plots · Ibeju-Lekki", initials: "AO", quote: "I was in Manchester and terrified of buying land from four thousand miles away. Zenorra sent me the search result, the survey charting and a walkthrough video before I paid a naira." },
  { name: "Engr. Tunde Bakare", roleText: "Bought 6 plots · Epe", initials: "TB", quote: "What sold me was that they talked me out of the first estate I asked about. Nobody in this market talks you out of a sale unless they intend to keep you." },
  { name: "Ngozi & Emeka Iheanacho", roleText: "Homeowners · Sangotedo", initials: "NI", quote: "We moved in eight days after final payment. The unit matched the sample house exactly." },
  { name: "Fatima Yusuf", roleText: "Solar + property client · Abuja", initials: "FY", quote: "One team, two problems solved — the land and the solar for the house." },
];

async function main() {
  // Staff: the first Super Admin. Password is random and written to .data/initial-admin.txt (git-ignored).
  const email = process.env.SEED_ADMIN_EMAIL ?? "zenorralimited@gmail.com";
  if (!(await db.user.findUnique({ where: { email } }))) {
    const password = process.env.SEED_ADMIN_PASSWORD ?? crypto.randomBytes(12).toString("base64url");
    await db.user.create({ data: { email, name: "Zenorra Admin", role: "SUPER_ADMIN", status: "ACTIVE", passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }) } });
    fs.mkdirSync(".data", { recursive: true });
    fs.writeFileSync(".data/initial-admin.txt", `Admin sign-in: http://localhost:3000/admin/login\nEmail: ${email}\nPassword: ${password}\nChange it under My account after first sign-in.\n`);
    console.log(`Created Super Admin ${email}. Credentials saved to .data/initial-admin.txt`);
  }

  const cats = new Map<string, string>();
  for (const name of CATEGORIES) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const c = await db.category.upsert({ where: { slug }, create: { slug, name }, update: {} });
    cats.set(name, c.id);
  }

  for (const [i, p] of PROPERTIES.entries()) {
    await db.property.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        reference: p.ref, slug: p.slug, name: p.name, corridor: p.corridor, locationText: p.loc, titleType: p.title, sizeText: p.size, sizeSqm: p.sqm,
        priceNaira: BigInt(p.price), priceUnit: p.unit, depositPercent: 30, planMonths: p.plan, appreciationNote: p.roi, blurb: p.blurb,
        description: p.desc.split("\n\n").map((x) => `<p>${x}</p>`).join(""), features: p.features, badges: p.badges, currencies: ["NGN", "GBP", "USD", "CAD"],
        availability: p.status, status: "PUBLISHED", publishedAt: new Date(Date.now() - (i + 1) * 86400_000), featured: Boolean(p.featured), featuredOrder: p.featured ?? null,
        curatedOrder: i + 1, heroBrief: p.shot,
      },
    });
  }

  for (const p of POSTS) {
    const html = sanitizeRichHtml(p.body);
    await db.post.upsert({
      where: { slug: p.slug },
      update: {},
      create: { slug: p.slug, title: p.title, excerpt: p.excerpt, bodyHtml: html, categoryId: cats.get(p.cat), authorName: p.author, status: "PUBLISHED", publishedAt: new Date(`${p.date}T08:00:00+01:00`), readingMinutes: readingMinutes(html) },
    });
  }

  if ((await db.testimonial.count()) === 0) {
    // Hidden by default: these are illustrative quotes from the prototype, not real clients.
    await db.testimonial.createMany({ data: TESTIMONIALS.map((t, i) => ({ ...t, order: i + 1, published: false })) });
  }

  fs.mkdirSync(".data", { recursive: true });
  fs.writeFileSync(".data/.seeded", new Date().toISOString());
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
