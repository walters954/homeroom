/**
 * Parsing and classification for the Circle migration importer.
 *
 * Pure on purpose — a migration is run once, against real people, and getting
 * it wrong means double-inviting a paying member or silently dropping someone.
 * All the judgement lives here so it can be tested without a database.
 */

export type RowAction =
  | "COMP" // was paying elsewhere — grant access without payment
  | "INVITE" // free or lapsed — let them in, no entitlement
  | "EXISTS" // already has an account here
  | "SKIP"; // nothing we can act on

export interface ImportRow {
  line: number;
  email: string;
  name: string;
  sourceStatus: string;
  action: RowAction;
  /** Why this row will be treated the way it will be. Always shown. */
  reason: string;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** Values a source system uses for "currently paying us". */
const PAYING = new Set([
  "active",
  "paid",
  "paying",
  "subscribed",
  "trialing",
  "trial",
  "comped",
  "complimentary",
]);

/** Values that mean "had access once, not now". Treated the same as free. */
const LAPSED = new Set([
  "canceled",
  "cancelled",
  "expired",
  "past_due",
  "past due",
  "churned",
  "inactive",
  "ended",
]);

const EMAIL_HEADERS = ["email", "email address", "e-mail", "email_address"];
const NAME_HEADERS = ["name", "full name", "full_name", "display name", "member"];
const FIRST_HEADERS = ["first name", "first_name", "firstname", "first"];
const LAST_HEADERS = ["last name", "last_name", "lastname", "last"];
const STATUS_HEADERS = [
  "status",
  "subscription status",
  "subscription_status",
  "member status",
  "plan",
  "state",
  "billing status",
];

/**
 * RFC-4180-ish: quoted fields, embedded commas, doubled quotes, CRLF. Not a
 * general CSV library — just enough for an export, and predictable about it.
 */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);

  const [headers = [], ...rest] = rows;
  return { headers: headers.map((h) => h.trim()), rows: rest };
}

function indexOfHeader(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c);
    if (i !== -1) return i;
  }
  // Fall back to a contains match so "Member Email" or "Status (billing)" work.
  for (const c of candidates) {
    const i = lower.findIndex((h) => h.includes(c));
    if (i !== -1) return i;
  }
  return -1;
}

export interface ColumnMap {
  email: number;
  name: number;
  first: number;
  last: number;
  status: number;
}

export function detectColumns(headers: string[]): ColumnMap {
  return {
    email: indexOfHeader(headers, EMAIL_HEADERS),
    name: indexOfHeader(headers, NAME_HEADERS),
    first: indexOfHeader(headers, FIRST_HEADERS),
    last: indexOfHeader(headers, LAST_HEADERS),
    status: indexOfHeader(headers, STATUS_HEADERS),
  };
}

/** Deliberately permissive — the source system already accepted the address. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** "someone@example.com" -> "Someone", so nobody is greeted as an empty string. */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "";
  if (!local) return "Member";
  return local
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function actionForStatus(status: string): {
  action: "COMP" | "INVITE";
  reason: string;
} {
  const s = status.trim().toLowerCase();
  if (!s) {
    return { action: "INVITE", reason: "No status column — invited without access." };
  }
  if (PAYING.has(s)) {
    return {
      action: "COMP",
      reason: `Paying elsewhere ("${status}") — access granted without payment.`,
    };
  }
  if (LAPSED.has(s)) {
    return {
      action: "INVITE",
      reason: `Lapsed ("${status}") — invited, no access granted.`,
    };
  }
  return {
    action: "INVITE",
    reason: `Status "${status}" not recognised as paying — invited, no access.`,
  };
}

/**
 * Classify every row against the emails that already exist here.
 *
 * Duplicates inside one file resolve to the first occurrence, because an export
 * that lists someone twice should not send them two links.
 */
export function classifyRows(
  parsed: ParsedCsv,
  columns: ColumnMap,
  existingEmails: Set<string>,
): ImportRow[] {
  const seen = new Set<string>();

  return parsed.rows.map((cells, i) => {
    const line = i + 2; // 1-indexed, plus the header row
    const raw = columns.email >= 0 ? (cells[columns.email] ?? "") : "";
    const email = normalizeEmail(raw);

    const base = { line, email, sourceStatus: "" };

    if (!email) {
      return { ...base, name: "", action: "SKIP" as const, reason: "No email in this row." };
    }
    if (!isEmail(email)) {
      return {
        ...base,
        name: "",
        action: "SKIP" as const,
        reason: `"${raw.trim()}" is not an email address.`,
      };
    }
    if (seen.has(email)) {
      return {
        ...base,
        name: "",
        action: "SKIP" as const,
        reason: "Duplicate of an earlier row in this file.",
      };
    }
    seen.add(email);

    const explicit = columns.name >= 0 ? (cells[columns.name] ?? "").trim() : "";
    const first = columns.first >= 0 ? (cells[columns.first] ?? "").trim() : "";
    const last = columns.last >= 0 ? (cells[columns.last] ?? "").trim() : "";
    const name = explicit || [first, last].filter(Boolean).join(" ") || nameFromEmail(email);

    const sourceStatus =
      columns.status >= 0 ? (cells[columns.status] ?? "").trim() : "";

    if (existingEmails.has(email)) {
      return {
        ...base,
        name,
        sourceStatus,
        action: "EXISTS" as const,
        reason: "Already has an account here — left untouched.",
      };
    }

    const { action, reason } = actionForStatus(sourceStatus);
    return { ...base, name, sourceStatus, action, reason };
  });
}

export function summarize(rows: ImportRow[]): Record<RowAction, number> {
  return rows.reduce(
    (acc, r) => ({ ...acc, [r.action]: acc[r.action] + 1 }),
    { COMP: 0, INVITE: 0, EXISTS: 0, SKIP: 0 } as Record<RowAction, number>,
  );
}
