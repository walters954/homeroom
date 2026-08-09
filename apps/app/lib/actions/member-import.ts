"use server";

import { auth } from "@homeroom/auth";
import { db } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { COMP_PREFIX } from "../comp";
import {
  classifyRows,
  detectColumns,
  parseCsv,
  summarize,
  type ImportRow,
} from "../members/import";
import { APP_URL } from "../notify";
import { requireAdmin } from "../session";

export interface ImportPreview {
  headers: string[];
  /** Which header each field was read from, so a wrong guess is visible. */
  matched: { email: string | null; name: string | null; status: string | null };
  rows: ImportRow[];
  summary: ReturnType<typeof summarize>;
}

async function existingEmails(): Promise<Set<string>> {
  const users = await db.user.findMany({ select: { email: true } });
  return new Set(users.map((u) => u.email.toLowerCase()));
}

/** Read-only. Nothing here writes, so it is safe to run as often as you like. */
export async function previewImport(csvText: string): Promise<ImportPreview> {
  await requireAdmin();
  const parsed = parseCsv(csvText);
  const columns = detectColumns(parsed.headers);
  const rows = classifyRows(parsed, columns, await existingEmails());

  const at = (i: number) => (i >= 0 ? (parsed.headers[i] ?? null) : null);
  return {
    headers: parsed.headers,
    matched: {
      email: at(columns.email),
      name: at(columns.name) ?? at(columns.first),
      status: at(columns.status),
    },
    rows,
    summary: summarize(rows),
  };
}

export interface ImportResult {
  invited: number;
  comped: number;
  skipped: number;
  /** Rows that failed on the way in, with the reason. Never silently dropped. */
  failures: { email: string; reason: string }[];
}

/**
 * Create the accounts, grant access to anyone who was already paying, then
 * send each of them a magic link.
 *
 * Accounts are created here rather than left to the magic link, because a
 * link only creates a user when it is clicked — which would leave no record of
 * who was invited, no way to resume a partial run, and nowhere to hang the
 * comped subscription. The trade is that Better Auth's "first user becomes
 * admin" hook does not fire for these rows; that is correct, since an admin
 * has to already exist to reach this action.
 *
 * Re-reads the existing addresses instead of trusting the preview, so running
 * this twice invites nobody twice.
 */
export async function commitImport(
  csvText: string,
  productId: string | null,
): Promise<ImportResult> {
  await requireAdmin();

  const parsed = parseCsv(csvText);
  const rows = classifyRows(parsed, detectColumns(parsed.headers), await existingEmails());
  const actionable = rows.filter((r) => r.action === "COMP" || r.action === "INVITE");

  const result: ImportResult = {
    invited: 0,
    comped: 0,
    skipped: rows.length - actionable.length,
    failures: [],
  };

  const requestHeaders = await headers();

  for (const row of actionable) {
    try {
      const user = await db.user.create({
        data: { email: row.email, name: row.name, emailVerified: false },
      });

      if (row.action === "COMP" && productId) {
        await db.subscription.create({
          data: {
            userId: user.id,
            productId,
            stripeCustomerId: `${COMP_PREFIX}${user.id}`,
            stripeSubscriptionId: `${COMP_PREFIX}${user.id}_${productId}`,
            status: "ACTIVE",
          },
        });
        result.comped++;
      }

      // One at a time: a burst of a few hundred trips Resend's rate limit, and
      // a member who never got their link is worse than an import that took a
      // minute longer.
      await auth.api.signInMagicLink({
        body: { email: row.email, callbackURL: `${APP_URL}/courses` },
        headers: requestHeaders,
      });
      result.invited++;
    } catch (err) {
      result.failures.push({
        email: row.email,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  revalidatePath("/admin/members");
  return result;
}
