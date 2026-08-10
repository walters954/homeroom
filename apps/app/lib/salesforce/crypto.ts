/**
 * Encryption for the one secret Homeroom holds on a learner's behalf: the
 * refresh token to their Salesforce org.
 *
 * That token is the ability to act as them in their org, so it does not sit in
 * the database in the clear. AES-256-GCM, key from the environment, and the
 * access token is deliberately never stored at all — it is short-lived and
 * cheap to mint again from the refresh token.
 *
 * `node:crypto` only, so `crypto.test.mjs` can load this directly.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Derive a 32-byte key from whatever length the environment supplies, so a
 * deployment isn't broken by a key that happens to be 31 characters. Not a KDF
 * with a work factor on purpose: this protects data at rest against a database
 * leak, and the secret is already high-entropy.
 */
function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function isEncryptionConfigured(secret = process.env.SALESFORCE_TOKEN_KEY): boolean {
  return typeof secret === "string" && secret.length >= 16;
}

/** `iv.ciphertext.tag`, base64url, so it round-trips through a text column. */
export function encryptToken(plaintext: string, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyFrom(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag].map((b) => b.toString("base64url")).join(".");
}

/**
 * Returns null rather than throwing on anything malformed — a rotated key or a
 * corrupted row should read as "not connected", which the learner can fix by
 * reconnecting, not as a crash on a page they were only passing through.
 */
export function decryptToken(payload: string, secret: string): string | null {
  const parts = payload.split(".");
  if (parts.length !== 3) return null;

  try {
    const [iv, ciphertext, tag] = parts.map((p) => Buffer.from(p, "base64url"));
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;

    const decipher = createDecipheriv(ALGORITHM, keyFrom(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key, or a tampered payload failing its auth tag.
    return null;
  }
}
