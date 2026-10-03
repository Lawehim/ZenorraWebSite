// WhatsApp Cloud API webhook: GET verification handshake, POST inbound messages (FR-NOTIF-006).
import { handleWhatsAppInbound, verifyWhatsAppSignature } from "@/server/services/whatsapp";

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  if (u.get("hub.mode") === "subscribe" && u.get("hub.verify_token") && u.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(u.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWhatsAppSignature(raw, req.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET ?? "")) {
    return new Response("Invalid signature", { status: 401 });
  }
  try {
    await handleWhatsAppInbound(JSON.parse(raw));
  } catch (e) {
    console.error("whatsapp-webhook-failed", e instanceof Error ? e.message : e);
  }
  return new Response("ok"); // always 200 once verified, so Meta doesn't disable the hook
}
