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
  // the serverless bundle; `prisma migrate status` in CI is still the check
  // that would catch that one (#52).
  if (checks.database) {
    try {
      const broken = await db.$queryRaw<{ migration_name: string }[]>`
        SELECT migration_name FROM _prisma_migrations
        WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
        ORDER BY started_at DESC LIMIT 1`;
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
