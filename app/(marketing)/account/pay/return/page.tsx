// Where Paystack sends the buyer back. A redirect is never proof of payment (FR-PAY-002):
// we show what the webhook has confirmed, and keep checking while it's pending.
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireBuyer } from "@/server/auth/buyer-session";
import { formatKobo } from "@/lib/payments/paystack";
import { failureMessageFor } from "@/server/services/payments";
import { AutoRefresh } from "@/components/admin/AutoRefresh";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PayReturn({ searchParams }: { searchParams: Promise<{ ref?: string; reference?: string }> }) {
  const sp = await searchParams;
  const ref = sp.ref ?? sp.reference ?? "";
  const b = await requireBuyer();
  const pay = await db.payment.findFirst({ where: { providerRef: ref, instalment: { purchase: { buyerId: b.id } } }, include: { instalment: { include: { purchase: true } } } });
  const back = pay ? `/account/plots/${pay.instalment.purchaseId}` : "/account";
  return (
    <section className="phead" style={{ minHeight: "70svh" }}>
      <div className="wrap" style={{ maxWidth: 640 }}>
        {pay?.status === "PENDING" && <AutoRefresh seconds={4} />}
        <div className="eyebrow">Payment</div>
        {!pay ? (
          <h1>We couldn&apos;t find that payment</h1>
        ) : pay.status === "SUCCESS" ? (
          <>
            <h1>Payment received</h1>
            <p className="lede">
              {formatKobo(pay.amountKobo)} has been applied to your schedule. Receipt <span className="mono">{pay.receiptNumber}</span> is in your documents.
            </p>
          </>
        ) : pay.status === "PENDING" ? (
          <>
            <h1>Confirming your payment…</h1>
            <p className="lede" role="status">
              We&apos;re waiting for the bank to confirm. This usually takes a few seconds — this page updates by itself. If you leave, your payment is still processed and your receipt will appear in your portal.
            </p>
          </>
        ) : (
          <>
            <h1>The payment didn&apos;t go through</h1>
            <p className="lede">{failureMessageFor(pay.reasonCode)}</p>
          </>
        )}
        <Link className="btn btn-gold" href={back} style={{ marginTop: "1.6rem" }}>
          Back to my plot
        </Link>
      </div>
    </section>
  );
}
