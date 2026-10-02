// Abandoned advisor form with contact details (FR-LEAD-007). Called via navigator.sendBeacon.
import { createPartialLead } from "@/server/services/leads";
import { requestCtx, sameOrigin, readJson, json } from "@/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false }, 403);
  const body = (await readJson(req)) as Parameters<typeof createPartialLead>[0] | null;
  if (!body) return json({ ok: false }, 400);
  const r = await createPartialLead(body, requestCtx(req));
  return json({ ok: r.ok }, r.ok ? 202 : 422);
}
