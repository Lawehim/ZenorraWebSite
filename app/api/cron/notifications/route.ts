// Called every minute by the platform scheduler (Vercel Cron). Delivers queued messages,
// purges stale newsletter sign-ups. Protected by CRON_SECRET.
import { processQueue, logTransport } from "@/server/services/notifications";
import { resolveTransport } from "@/server/services/transports";
import { purgeUnconfirmed } from "@/server/services/subscribers";
import { json } from "@/server/http";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return json({ ok: false }, 401);
  const result = await processQueue(resolveTransport() ?? logTransport);
  const purged = await purgeUnconfirmed();
  return json({ ok: true, ...result, purged: purged.count });
}
