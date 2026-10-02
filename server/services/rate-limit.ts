// Fixed-window limiter backed by Postgres (Redis/Upstash in production per SRS §7.3).
import { db } from "@/lib/db";

export async function hitRateLimit(key: string, limit: number, windowSeconds: number, now: Date = new Date()): Promise<boolean> {
  const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowEnd") VALUES (${key}, 1, ${windowEnd})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowEnd" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowEnd" = CASE WHEN "RateLimit"."windowEnd" <= ${now} THEN ${windowEnd} ELSE "RateLimit"."windowEnd" END
    RETURNING "count"`;
  return rows[0].count <= limit;
}

export const LIMITS = {
  lead: { limit: 10, window: 3600 },
  booking: { limit: 5, window: 3600 },
  subscribe: { limit: 5, window: 3600 },
  signIn: { limit: 5, window: 60 },
} as const;
