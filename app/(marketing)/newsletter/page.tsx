import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Newsletter", robots: { index: false } };

const MESSAGES: Record<string, { title: string; body: string }> = {
  confirmed: { title: "You're subscribed", body: "Thank you for confirming. Market notes arrive once a month — unsubscribe from any email." },
  expired: { title: "That link has expired", body: "Confirmation links last 7 days. Sign up again from the footer and we'll send a fresh one." },
  unsubscribed: { title: "You've been unsubscribed", body: "You won't receive further marketing email from Zenorra. Enquiries you make will still be answered." },
  invalid: { title: "We couldn't process that link", body: "It may have been copied incompletely. Email zenorralimited@gmail.com and we'll remove you by hand." },
};

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const m = MESSAGES[(await searchParams).status ?? ""] ?? MESSAGES.invalid;
  return (
    <section className="phead" style={{ minHeight: "60svh" }}>
      <div className="wrap">
        <div className="eyebrow">Newsletter</div>
        <h1>{m.title}</h1>
        <p className="lede" style={{ marginBottom: "2rem" }}>
          {m.body}
        </p>
        <Button href="/" variant="gold">
          Back to the homepage
        </Button>
      </div>
    </section>
  );
}
