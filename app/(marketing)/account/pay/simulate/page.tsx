// LOCAL DEVELOPMENT ONLY: stands in for the provider's hosted checkout when its keys aren't configured.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireBuyer } from "@/server/auth/buyer-session";
import { formatKobo } from "@/lib/payments/paystack";
import { providerConfigured, paymentProviderFor } from "@/lib/payments/provider";
import { simulatePaymentAction } from "@/server/actions/account";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Simulate({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const ref = (await searchParams).ref ?? "";
  const b = await requireBuyer();
  const pay = await db.payment.findFirst({ where: { providerRef: ref, instalment: { purchase: { buyerId: b.id } } } });
  const provider = paymentProviderFor({ provider: pay?.provider });
  if (!pay || providerConfigured(provider)) notFound();
  const name = provider === "flutterwave" ? "Flutterwave" : "Paystack";
  return (
    <section className="phead" style={{ minHeight: "70svh" }}>
      <div className="wrap" style={{ maxWidth: 560 }}>
        <div className="eyebrow">Test checkout — development only</div>
        <h1>{formatKobo(pay.amountKobo)}</h1>
        <p className="lede" style={{ marginBottom: "1.6rem" }}>
          {name} keys aren&apos;t configured, so this page simulates the provider&apos;s webhook. In production buyers go to {name}&apos;s secure checkout instead.
        </p>
        <div style={{ display: "flex", gap: ".8rem", flexWrap: "wrap" }}>
          <form action={simulatePaymentAction.bind(null, ref, "success")}>
            <button className="btn btn-gold" type="submit">
              Simulate successful payment
            </button>
          </form>
          <form action={simulatePaymentAction.bind(null, ref, "failed")}>
            <button className="btn btn-line" type="submit">
              Simulate declined card
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
