import type { Metadata } from "next";
import { BuyerInviteForm } from "@/components/account/BuyerInviteForm";

export const metadata: Metadata = { title: "Set up your buyer portal", robots: { index: false } };

export default async function AcceptBuyerInvite({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <section className="phead" style={{ minHeight: "80svh" }}>
      <div className="wrap" style={{ maxWidth: 520 }}>
        <div className="eyebrow">Buyer portal</div>
        <h1>Welcome to Zenorra</h1>
        <p className="lede" style={{ marginBottom: "1.6rem" }}>
          Choose a password (at least 12 characters). You can also sign in later with a one-time code sent to your phone.
        </p>
        <BuyerInviteForm token={token ?? ""} />
      </div>
    </section>
  );
}
