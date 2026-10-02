// Paystack webhook — the only source of truth for payment outcomes (FR-PAY-002/003, TC-SEC-014/015).
import { verifyPaystackSignature } from "@/lib/payments/paystack";
import { handlePaystackEvent } from "@/server/services/payments";
import { audit } from "@/server/services/audit";

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!verifyPaystackSignature(raw, req.headers.get("x-paystack-signature"), secret)) {
    await audit(null, "webhook.rejected", "Payment", null, { after: { provider: "paystack", reason: "signature" }, ip: req.headers.get("x-forwarded-for") ?? undefined });
    return new Response("Invalid signature", { status: 401 });
  }
  try {
    const result = await handlePaystackEvent(JSON.parse(raw));
    return Response.json({ ok: true, result });
  } catch (e) {
    console.error("paystack-webhook-failed", e instanceof Error ? e.message : e);
    return new Response("Retry", { status: 500 }); // Paystack retries on non-2xx
  }
}
