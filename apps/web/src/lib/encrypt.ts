/**
 * AES-256-GCM encryption helpers for sensitive values (e.g. Stripe tokens).
 * Key is derived from ENCRYPTION_KEY env var (must be 32+ chars).
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY env var is not set");
  }
  // Derive a 32-byte key from the secret using SHA-256
  return createHash("sha256").update(secret).digest();
}

export interface EncryptedValue {
  enc: string;  // base64 ciphertext
  iv: string;   // base64 12-byte IV
  tag: string;  // base64 16-byte auth tag
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns base64-encoded ciphertext, IV, and auth tag.
 */
export function encrypt(plaintext: string): EncryptedValue {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV (recommended for GCM)
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    enc: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypt a value previously encrypted with `encrypt()`.
 */
export function decrypt(value: EncryptedValue): string {
  const key = getKey();
  const iv = Buffer.from(value.iv, "base64");
  const tag = Buffer.from(value.tag, "base64");
  const ciphertext = Buffer.from(value.enc, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
