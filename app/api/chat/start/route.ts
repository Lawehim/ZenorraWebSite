import { startChat } from "@/server/services/chat";
import { hitRateLimit } from "@/server/services/rate-limit";
import { json, readJson, requestCtx, sameOrigin, FORBIDDEN_ORIGIN, BAD_JSON } from "@/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json(FORBIDDEN_ORIGIN, 403);
  const body = (await readJson(req)) as { name?: string; contact?: string; pagePath?: string } | null;
  if (!body) return json(BAD_JSON, 400);
  if (!(await hitRateLimit(`chat:${requestCtx(req).ip}`, 10, 3600))) return json({ ok: false, message: "Too many chats from this connection. Please call or WhatsApp us." }, 429);
  const { token } = await startChat(body);
  return json({ ok: true, token });
}
