import { db } from "@homeroom/db";
import { gatewayAuthMode } from "@/lib/ai";
import { report } from "@/lib/observe";

export const dynamic = "force-dynamic";

/**
 * "Is it up" with an answer that isn't clicking around.
 *
 * Point an uptime monitor at this: 200 when every check passes, 503 when one
 * doesn't, so a plain status-code probe is enough. The three checks are the
 * three things that have actually broken — the database, the migration state
 * that disagreed with the schema for a day, and the gateway auth that made
 * every model call a 500.
 *
 * Public by necessity (a probe can't hold a session), so it reports which
 * check failed and never why: the reasons carry connection strings and go to
 * Sentry instead.
 */
export async function GET() {
  const checks: Record<string, boolean> = {};
  let migration: string | null = null;

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (err) {
    report("health.database", err);
    checks.database = false;
  }

  // Only detects migrations that started and never finished, or were rolled
  // back — a deploy that half-applied. It cannot see a migration that exists
  // in the repo and was never run, because the migrations directory isn't in
  // the serverless bundle; `prisma migrate status` in CI is the check that
  // would catch that one (#68).
  //
  // `_prisma_migrations` keeps failed attempts as rows rather than replacing
  // them, so a migration that failed, was resolved and then re-applied has
  // two rows: the wreckage and the clean one. Only the absence of any clean
  // row means the schema is actually missing that migration. Matching on the
  // failed row alone reports the Aug 8 incident as ongoing forever, which is
  // how the first version of this check 503'd a healthy production.
  if (checks.database) {
    try {
      const broken = await db.$queryRaw<{ migration_name: string }[]>`
        SELECT m.migration_name FROM _prisma_migrations m
        WHERE (m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM _prisma_migrations ok
            WHERE ok.migration_name = m.migration_name
              AND ok.finished_at IS NOT NULL
              AND ok.rolled_back_at IS NULL
          )
        ORDER BY m.started_at DESC LIMIT 1`;
      checks.migrations = broken.length === 0;
      migration = broken[0]?.migration_name ?? null;
      if (!checks.migrations) {
        report("health.migrations", new Error(`Migration not applied cleanly: ${migration}`));
      }
    } catch (err) {
      report("health.migrations", err);
      checks.migrations = false;
    }
  } else {
    checks.migrations = false;
  }

  // Off Vercel there is no OIDC identity and no gateway key, and that is a
  // normal local setup rather than an outage — so this only counts deployed.
  const mode = await gatewayAuthMode();
  checks.gateway = process.env.VERCEL_ENV ? mode !== "none" : true;
  if (!checks.gateway) {
    report("health.gateway", new Error("No gateway auth resolved in a deployed function"));
  }

  const ok = Object.values(checks).every(Boolean);
  return Response.json(
    { ok, checks, gatewayAuth: mode, brokenMigration: migration },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
