# Zenorra Limited — website & admin portal

Public marketing site (real estate + solar energy), lead engine and admin portal for **Zenorra Limited**, built to the *Zenorra Platform Requirements* SRS v1.0 (Phase 1) and the approved prototype design.

- **Stack:** Next.js 16 (App Router, React 19 Server Components), TypeScript strict, Tailwind CSS 4 tokens + ported prototype styles, Prisma 6 + PostgreSQL, Tiptap rich text, Zod validation, Argon2id auth, Jest + Testing Library. **No Vite anywhere** (Jest runs via `next/jest`/SWC).
- **Built test-first:** every business rule, service and interactive component has tests written before the implementation — see [`tests/`](tests/).

## Quick start (Windows, macOS or Linux)

Requires Node.js 20+ (built on 24). No database install is needed — an embedded PostgreSQL server is downloaded with the npm packages.

```bash
npm install            # also runs `prisma generate`
npm run db:setup       # starts embedded Postgres, creates tables, seeds sample content + first admin
npm run dev            # starts Postgres + Next.js at http://localhost:3000
```

- Website: http://localhost:3000
- Admin portal: http://localhost:3000/admin — the first Super Admin's email and generated password are written to **`.data/initial-admin.txt`** (git-ignored). Change the password under *My account* and switch on two-factor authentication.

To use your own PostgreSQL instead, set `DATABASE_URL` in `.env` and run `npx prisma db push && npx prisma db execute --file prisma/sql/audit-immutable.sql --schema prisma/schema.prisma && npm run db:seed`.

## Tests

```bash
npm test                    # everything
npm run test:unit           # pure logic + React components (fast, no database)
npm run test:integration    # services against a real throwaway Postgres (embedded, port 54339)
npm run typecheck
```

| Suite | What it covers (SRS references in each test name) |
|---|---|
| `tests/unit` | Naira formatting & instalment maths, phone/email normalisation & dedupe keys, slugs & references, RBAC matrix (every role × capability), catalogue filters/sort/featured/related, article visibility & scheduling, inspection dates in Africa/Lagos, password policy, HTML sanitisation (XSS), image magic-byte sniffing, editable-content registry, form schemas, message templates, legal-page parser |
| `tests/components` | Button, Field (label/error association), Modal (focus trap, Escape, focus return, scroll lock), PropertyCard, PropertyFilters (crawlable URLs), ArticleCard, TestimonialCarousel (7s, pause, keyboard), StatCounter (reduced motion), AdvisorWizard (5 steps, aria-disabled, back, restore, validation, retry), ContentBlockForm (admin content editor) |
| `tests/integration` | Lead capture, consent evidence, dedupe within 30 days, idempotent double-submit, honeypot, rate limiting, bookings (past/non-operating days), newsletter double opt-in & unsubscribe, lead status/notes/CSV export with RBAC, content & settings editing with audit, audit-log immutability (DB trigger), sign-in/lockout/idle & absolute session expiry/invites/removal, properties (slugs, 301 redirects without chains, sold-out, price RBAC), posts (scheduling, sanitisation, revisions, soft delete), media upload (type sniffing, 15MB, EXIF strip, derivatives, in-use protection), notification outbox retries |

## What the admin can change (no developer needed)

| Area | Where | Notes |
|---|---|---|
| **All page copy** — every headline, paragraph, list, button label, page header, CTA band, footer text, form wording, legal pages | Admin → **Site content** | Each section has a form generated from its field definitions in [`lib/content/registry.ts`](lib/content/registry.ts). Validated server-side, audited, *Restore original text* available. |
| Images on any section | Site content → image fields → *Choose* | Picks from the Media library; empty = labelled placeholder showing the photo brief. |
| Insights / blog | Admin → Insights | Rich text editor, categories, cover image, schedule for a future time (WAT), preview, duplicate, soft delete + restore, SEO fields, local draft recovery. |
| Properties | Admin → Properties | Price/deposit/plan with live instalment preview, title type (C of O / Governor's Consent require a document reference), features, badges, gallery ordering, featured order, sold-out state, 301 redirect on slug change. |
| Media | Admin → Media library | Drag-and-drop batches, type checked by content, EXIF/GPS stripped, WebP/AVIF/JPEG derivatives, alt text required before public use, can't delete images in use. |
| Testimonials | Admin → Testimonials | Order, hide/show. |
| Contact details, socials, Google reviews, WhatsApp, inspection days & departure points, lead routing emails | Admin → Settings | Propagates everywhere (footer, contact page, WhatsApp buttons, structured data). |
| Leads, inspections, subscribers, users & roles, audit log, notifications | Admin sidebar | Inline status changes, timeline & notes, CSV export (audited, watermarked), printable coach manifest, invitations, 2FA. |
| Lead scoring, assignment & SLA | Leads list, Settings → Assignment | Score column/sort, round-robin or manual assignment, first-response SLA with overdue flag and escalation. |
| Live chat | Admin → Live chat | Visitor chat widget on every public page; office hours in Settings; offline messages become leads; WhatsApp threads appear here too. |
| Reports & privacy | Admin → Reports, Privacy | Funnel/source reports with CSV export, daily trend on the dashboard, data-subject export & erasure. |
| Team, partners, categories, shot list, post history | Admin sidebar | About-page team/partners, insight categories, photo shot list, revision diff + restore. |
| Property documents | Property → Documents | PDF survey/brochure uploads, public or buyer-only. |
| Buyers, purchases, payments | Admin → Buyers group | Create a purchase with an instalment schedule, invite the buyer, record offline (bank) payments, statements & receipts (PDF), document vault, support tickets, referral approvals. |
| Bank details, referrals, FX, digest | Admin → Settings | Bank transfer account, referral threshold/commission, indicative GBP/USD/CAD rates, daily digest recipients. |

Roles follow the SRS RBAC matrix exactly ([`lib/rbac.ts`](lib/rbac.ts)) and are enforced on the server for every action — hidden buttons are a courtesy, not the control.

## Buyer portal (`/account`)

Buyers are invited from Admin → Purchases. They sign in with a password or a one-time code (email/SMS, 10 minutes, 5 attempts) and can see each plot's schedule and arrears, pay an instalment through Paystack, download statements/receipts and vault documents (signed links valid 15 minutes), open support tickets, and share a referral code (`ZN` + 6 characters). Buyer sessions never grant admin access.

## Architecture (where things live)

```
app/(marketing)/      public pages — server components, revalidated on admin change (ISR, 60s fallback)
app/admin/            login, invite acceptance, and the (portal) behind the session guard
app/api/              public form endpoints (origin-checked, rate-limited), admin uploads/exports, cron
app/media/[...key]    uploaded images, served sandboxed with nosniff from outside the web root
components/ui         primitives (Button, Field, Modal, Placeholder, Icon, StatusPill)
components/marketing  composites (PropertyCard, Filters, Gallery, Carousel…)
components/sections   page sections (PageHeader, CtaBand, FeatureGrid, Journey…)
components/forms      AdvisorWizard, BookingForm, ContactForm, Newsletter
components/admin      ContentBlockForm, PostEditor (Tiptap), PropertyForm, MediaLibrary…
lib/                  framework-free business rules (all unit-tested)
server/services       domain services (leads, auth, content, media, notifications…) — integration-tested
server/actions        Next.js server actions: authorise → call service → revalidate
prisma/               schema, seed, SQL guard making AuditLog append-only
```

## Integrations (stubbed until keys are provided)

Messages are written to an outbox table first (a lead is never lost to a provider outage) and delivered by adapters in [`server/services/transports.ts`](server/services/transports.ts):

| Env var | Effect |
|---|---|
| `RESEND_API_KEY`, `MAIL_FROM` | Transactional + internal email via Resend |
| `TERMII_API_KEY`, `TERMII_SENDER_ID` | Booking SMS via Termii (registered alphanumeric sender) |
| `CRON_SECRET` | Protects `/api/cron/notifications` — `vercel.json` calls it every 5 minutes (deliveries + retries, lead SLA escalation, inspection & payment reminders 09:00–20:00 WAT, daily digest, purges) |
| `PAYSTACK_SECRET_KEY` | Buyer card/transfer payments. Register `{APP_URL}/api/webhooks/paystack` in Paystack; the signed webhook (not the browser redirect) marks a payment successful, and is idempotent. Without a key, *Pay now* opens a local simulator (dev only). |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | Two-way WhatsApp via Meta Cloud API. Register `{APP_URL}/api/webhooks/whatsapp`. Inbound messages land in Admin → Live chat; `STOP` opts out. Outbound reminders need Meta-approved templates (e.g. `booking_reminder`). |
| `APP_URL` | Absolute links in emails, sitemap, structured data |

Without keys, every message is visible in **Admin → Notifications**.

## Deviations from the SRS (and why)

- **Auth:** self-hosted sessions (hashed opaque tokens in Postgres) instead of Auth.js — same guarantees (Argon2id, TOTP, 8h absolute / 60min idle, immediate revocation, lockout) with fewer moving parts on Next 16.
- **Redis / R2 / QStash:** replaced locally by Postgres rate-limit counters, local disk media storage and an outbox table. Each sits behind a small module so the production service can be swapped in.
- **Analytics (GA4/Meta Pixel):** consent banner and storage are implemented; tags are not loaded until IDs are provided.
- **Video uploads/transcoding (FR-ADM-028):** not built — video testimonials use YouTube/Vimeo embed URLs.
- **Partner-developer read-only access:** not built; partners are shown on the About page only.
- **Payments:** Paystack only (no Flutterwave). Money is stored as kobo (BigInt); overpayments carry forward to the next instalment.
