import { subscribe } from "@/server/services/subscribers";
import { requestCtx, sameOrigin, readJson, json, FORBIDDEN_ORIGIN, BAD_JSON, SERVER_ERROR } from "@/server/http";
import { processQueueSoon } from "@/server/services/queue-trigger";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json(FORBIDDEN_ORIGIN, 403);
  const body = await readJson(req);
  if (!body) return json(BAD_JSON, 400);
  try {
    const r = await subscribe(body, requestCtx(req));
    if (r.ok) processQueueSoon();
    return json(r, r.ok ? 202 : r.status);
  } catch {
    return json(SERVER_ERROR, 500);
  }
}
