import { chatTranscript, postVisitorMessage } from "@/server/services/chat";
import { hitRateLimit } from "@/server/services/rate-limit";
import { json, readJson, requestCtx, sameOrigin, FORBIDDEN_ORIGIN, BAD_JSON } from "@/server/http";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  try {
    const messages = await chatTranscript(token);
    return json({ messages });
  } catch {
    return json({ ok: false }, 404);
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json(FORBIDDEN_ORIGIN, 403);
  const body = (await readJson(req)) as { token?: string; body?: string; offline?: boolean } | null;
  if (!body?.token || !body.body) return json(BAD_JSON, 400);
  if (!(await hitRateLimit(`chatmsg:${requestCtx(req).ip}`, 60, 600))) return json({ ok: false, message: "You're sending messages too quickly." }, 429);
  try {
    await postVisitorMessage(body.token, body.body, { offline: Boolean(body.offline) });
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, message: e instanceof Error ? e.message : "Chat unavailable" }, 410);
  }
}
