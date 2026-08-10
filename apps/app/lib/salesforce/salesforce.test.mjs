/**
 * The two decisions in the BYO-org flow that must not be wrong: which orgs are
 * allowed, and that a stored refresh token is unreadable without the key.
 * Run with Node 24: `pnpm --filter @homeroom/app test`.
 */

import assert from "node:assert";
import test from "node:test";

import { orgVerdict } from "./org.ts";
import { decryptToken, encryptToken, isEncryptionConfigured } from "./crypto.ts";

const KEY = "a-test-key-that-is-long-enough-to-pass";

test("developer orgs and playgrounds are accepted", () => {
  for (const organizationType of ["Developer Edition", "Trailhead Playground"]) {
    const verdict = orgVerdict({ organizationType, isSandbox: false });
    assert.equal(verdict.allowed, true, `${organizationType} was refused`);
  }
});

test("a scratch org is recognised by its expiry", () => {
  const verdict = orgVerdict({
    organizationType: "Developer Edition",
    isSandbox: false,
    trialExpirationDate: "2026-09-01T00:00:00.000+0000",
  });
  assert.deepEqual(verdict, { allowed: true, kind: "scratch" });
});

test("a sandbox is accepted whatever edition it is a sandbox of", () => {
  const verdict = orgVerdict({ organizationType: "Enterprise Edition", isSandbox: true });
  assert.deepEqual(verdict, { allowed: true, kind: "sandbox" });
});

test("production is refused, and the message says which edition", () => {
  for (const organizationType of [
    "Enterprise Edition",
    "Unlimited Edition",
    "Professional Edition",
    "Base Edition",
  ]) {
    const verdict = orgVerdict({ organizationType, isSandbox: false });
    assert.equal(verdict.allowed, false, `${organizationType} was allowed`);
    assert.match(verdict.reason, new RegExp(organizationType));
  }
});

test("an org we cannot classify is refused rather than assumed safe", () => {
  const verdict = orgVerdict({ organizationType: "", isSandbox: false });
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /couldn't tell/);
});

test("a token round-trips", () => {
  const token = "5Aep861_refresh_token_value";
  assert.equal(decryptToken(encryptToken(token, KEY), KEY), token);
});

test("the same token encrypts differently every time", () => {
  const a = encryptToken("same", KEY);
  const b = encryptToken("same", KEY);
  assert.notEqual(a, b, "reused IV");
  assert.equal(decryptToken(a, KEY), "same");
  assert.equal(decryptToken(b, KEY), "same");
});

test("the wrong key, a tampered payload, or junk all read as not connected", () => {
  const sealed = encryptToken("secret", KEY);
  assert.equal(decryptToken(sealed, "a-different-key-of-sufficient-length"), null);
  assert.equal(decryptToken(`${sealed}x`, KEY), null);
  assert.equal(decryptToken("nonsense", KEY), null);
  assert.equal(decryptToken("", KEY), null);
});

test("a short or missing key counts as unconfigured", () => {
  assert.equal(isEncryptionConfigured(undefined), false);
  assert.equal(isEncryptionConfigured("short"), false);
  assert.equal(isEncryptionConfigured(KEY), true);
});
