// Flutterwave webhook — with Paystack's, the only source of truth for payment outcomes (FR-PAY-002/003).
import { verifyFlutterwaveHash } from "@/lib/payments/flutterwave";
import { handleFlutterwaveEvent } from "@/server/services/payments";
import { audit } from "@/server/services/audit";

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyFlutterwaveHash(req.headers.get("verif-hash"), process.env.FLW_SECRET_HASH ?? "")) {
    await audit(null, "webhook.rejected", "Payment", null, { after: { provider: "flutterwave", reason: "signature" }, ip: req.headers.get("x-forwarded-for") ?? undefined });
    return new Response("Invalid signature", { status: 401 });
  }
  try {
    const result = await handleFlutterwaveEvent(JSON.parse(raw));
    return Response.json({ ok: true, result });
  } catch (e) {
    console.error("flutterwave-webhook-failed", e instanceof Error ? e.message : e);
    return new Response("Retry", { status: 500 }); // Flutterwave retries on non-2xx
  }
}
