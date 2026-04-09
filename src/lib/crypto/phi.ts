/**
 * PHI Field-Level Encryption
 *
 * AES-256-GCM authenticated encryption for Protected Health Information.
 * Every PHI field (patient names, DOBs, insurance member IDs) MUST be
 * encrypted with these functions before storage and decrypted after retrieval.
 *
 * Pattern:
 *   const encrypted = encryptPHI("Jane Doe");  // → base64 ciphertext
 *   const plain = decryptPHI(encrypted);         // → "Jane Doe"
 *
 * Storage format: base64( IV[12] + AuthTag[16] + Ciphertext[...] )
 *
 * Key management:
 *   - PHI_ENCRYPTION_KEY env var: 64 hex characters (32 bytes / 256 bits)
 *   - Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   - MUST be separate from Supabase keys
 *   - Sprint 9 compromise: env var is acceptable for development and sandbox.
 *     Production MUST source from a secrets manager (AWS Secrets Manager,
 *     Vercel encrypted env vars, or similar) before Toby goes live.
 *
 * @module
 */

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — NIST recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

let _keyBuffer: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (_keyBuffer) return _keyBuffer;

  const key = process.env.PHI_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "PHI_ENCRYPTION_KEY is not set. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error(
      `PHI_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got ${key.length} chars / ${buf.length} bytes.`
    );
  }

  _keyBuffer = buf;
  return _keyBuffer;
}

/**
 * Encrypt a plaintext PHI string with AES-256-GCM.
 *
 * Returns a base64 string containing IV + AuthTag + Ciphertext.
 * Each call generates a fresh random IV, so encrypting the same
 * plaintext twice produces different ciphertexts (as expected).
 */
export function encryptPHI(plaintext: string): string {
  if (!plaintext) {
    throw new Error("encryptPHI called with empty string. PHI fields must not be empty.");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Pack: IV (12) + AuthTag (16) + Ciphertext (variable)
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt a base64 PHI ciphertext produced by encryptPHI().
 *
 * Throws if:
 * - The ciphertext is too short (corrupt data)
 * - The auth tag doesn't verify (tampered data)
 * - The key doesn't match (wrong key)
 */
export function decryptPHI(ciphertext: string): string {
  if (!ciphertext) {
    throw new Error("decryptPHI called with empty string.");
  }

  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, "base64");

  const minLength = IV_LENGTH + AUTH_TAG_LENGTH + 1; // at least 1 byte of ciphertext
  if (combined.length < minLength) {
    throw new Error(
      `PHI ciphertext is too short (${combined.length} bytes). Minimum is ${minLength}. Data may be corrupt.`
    );
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Reset the cached encryption key. Only use in tests.
 * @internal
 */
export function _resetKeyCache(): void {
  _keyBuffer = null;
}
