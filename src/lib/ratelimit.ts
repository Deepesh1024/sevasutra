import { db } from "./db";

/** Fixed-window rate limit backed by Postgres (swap for Redis at scale). Returns true when allowed. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = new Date();
  const windowStartCutoff = new Date(now.getTime() - windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < ${windowStartCutoff} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${windowStartCutoff} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  return (rows[0]?.count ?? 0) <= limit;
}
