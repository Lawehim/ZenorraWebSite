import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentBuyer } from "@/server/auth/buyer-session";
import { BuyerLogin } from "@/components/account/BuyerLogin";

export const metadata: Metadata = { title: "Buyer sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountLogin({ searchParams }: { searchParams: Promise<{ next?: string; welcome?: string }> }) {
  const sp = await searchParams;
  if (await currentBuyer()) redirect(sp.next?.startsWith("/account") ? sp.next : "/account");
  return (
    <section className="phead" style={{ minHeight: "80svh" }}>
      <div className="wrap" style={{ maxWidth: 520 }}>
        <div className="eyebrow">Buyer portal</div>
        <h1>Sign in</h1>
        <p className="lede" style={{ marginBottom: "1.6rem" }}>
          {sp.welcome ? "Your password is set. Sign in to see your plot, payments and documents." : "Your plot, payment schedule, receipts and documents in one place. The portal is for Zenorra buyers — your advisor sends the invitation."}
        </p>
        <BuyerLogin next={sp.next ?? "/account"} />
      </div>
    </section>
  );
}
