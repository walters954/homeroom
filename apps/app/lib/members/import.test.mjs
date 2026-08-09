/**
 * The importer runs once, against real people. A wrong classification here
 * either double-invites somebody or silently drops a paying member, and
 * neither is visible until after the migration — so it gets tested.
 *
 * Run with Node 24: `pnpm --filter @homeroom/app test`.
 */

import assert from "node:assert";
import test from "node:test";

import {
  actionForStatus,
  classifyRows,
  detectColumns,
  isEmail,
  nameFromEmail,
  normalizeEmail,
  parseCsv,
  summarize,
} from "./import.ts";

test("parses quoted fields, embedded commas and doubled quotes", () => {
  const csv = 'Email,Name\n"a@b.com","Doe, Jane"\n"c@d.com","He said ""hi"""\n';
  const { headers, rows } = parseCsv(csv);
  assert.deepStrictEqual(headers, ["Email", "Name"]);
  assert.deepStrictEqual(rows[0], ["a@b.com", "Doe, Jane"]);
  assert.deepStrictEqual(rows[1], ["c@d.com", 'He said "hi"']);
});

test("handles CRLF and ignores blank lines", () => {
  const { rows } = parseCsv("Email\r\na@b.com\r\n\r\nc@d.com\r\n");
  assert.strictEqual(rows.length, 2);
});

test("finds columns by exact name and by contains", () => {
  const c = detectColumns(["Member Email", "First Name", "Last Name", "Billing Status"]);
  assert.strictEqual(c.email, 0);
  assert.strictEqual(c.first, 1);
  assert.strictEqual(c.last, 2);
  assert.strictEqual(c.status, 3);
});

test("paying statuses comp, everything else only invites", () => {
  assert.strictEqual(actionForStatus("active").action, "COMP");
  assert.strictEqual(actionForStatus("Trialing").action, "COMP");
  assert.strictEqual(actionForStatus("canceled").action, "INVITE");
  assert.strictEqual(actionForStatus("").action, "INVITE");
  // An unrecognised status must never grant access by accident.
  assert.strictEqual(actionForStatus("weird-plan-name").action, "INVITE");
});

test("an unrecognised status says so, rather than pretending", () => {
  assert.match(actionForStatus("weird-plan-name").reason, /not recognised as paying/);
});

test("existing members are left untouched", () => {
  const parsed = parseCsv("Email,Status\nold@x.com,active\nnew@x.com,active\n");
  const rows = classifyRows(parsed, detectColumns(parsed.headers), new Set(["old@x.com"]));
  assert.strictEqual(rows[0].action, "EXISTS");
  assert.strictEqual(rows[1].action, "COMP");
});

test("a duplicate inside one file is only acted on once", () => {
  const parsed = parseCsv("Email\na@x.com\nA@X.com\n");
  const rows = classifyRows(parsed, detectColumns(parsed.headers), new Set());
  assert.strictEqual(rows[0].action, "INVITE");
  assert.strictEqual(rows[1].action, "SKIP");
  assert.match(rows[1].reason, /Duplicate/);
});

test("rows without a usable email are skipped, with the reason", () => {
  const parsed = parseCsv("Email,Name\n,Nobody\nnot-an-email,Someone\n");
  const rows = classifyRows(parsed, detectColumns(parsed.headers), new Set());
  assert.strictEqual(rows[0].action, "SKIP");
  assert.match(rows[0].reason, /No email/);
  assert.strictEqual(rows[1].action, "SKIP");
  assert.match(rows[1].reason, /not an email/);
});

test("names come from a name column, first+last, then the address", () => {
  const parsed = parseCsv(
    "Email,Full Name,First Name,Last Name\na@x.com,Ada L,,\nb@x.com,,Grace,Hopper\njean.luc@x.com,,,\n",
  );
  const rows = classifyRows(parsed, detectColumns(parsed.headers), new Set());
  assert.strictEqual(rows[0].name, "Ada L");
  assert.strictEqual(rows[1].name, "Grace Hopper");
  assert.strictEqual(rows[2].name, "Jean Luc");
});

test("line numbers point at the file, header included", () => {
  const parsed = parseCsv("Email\na@x.com\nb@x.com\n");
  const rows = classifyRows(parsed, detectColumns(parsed.headers), new Set());
  assert.strictEqual(rows[0].line, 2);
  assert.strictEqual(rows[1].line, 3);
});

test("emails normalise so casing cannot create a second account", () => {
  assert.strictEqual(normalizeEmail("  Ada@Example.COM "), "ada@example.com");
  assert.ok(isEmail("a@b.co"));
  assert.ok(!isEmail("a@b"));
  assert.strictEqual(nameFromEmail("first_last@x.com"), "First Last");
});

test("summary counts every row exactly once", () => {
  const parsed = parseCsv(
    "Email,Status\nold@x.com,active\nnew@x.com,active\nfree@x.com,canceled\nbad,\n",
  );
  const rows = classifyRows(parsed, detectColumns(parsed.headers), new Set(["old@x.com"]));
  const s = summarize(rows);
  assert.deepStrictEqual(s, { COMP: 1, INVITE: 1, EXISTS: 1, SKIP: 1 });
  assert.strictEqual(s.COMP + s.INVITE + s.EXISTS + s.SKIP, rows.length);
});

test("a file with no status column invites everyone, comps nobody", () => {
  const parsed = parseCsv("Email\na@x.com\nb@x.com\n");
  const rows = classifyRows(parsed, detectColumns(parsed.headers), new Set());
  assert.strictEqual(summarize(rows).COMP, 0);
  assert.strictEqual(summarize(rows).INVITE, 2);
});
