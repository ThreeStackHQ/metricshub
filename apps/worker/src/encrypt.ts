/**
 * AES-256-GCM decrypt helper.
 * Mirrors apps/web/src/lib/encrypt.ts — future: move to packages/core.
 */
import { createDecipheriv, createHash } from "crypto";

export interface EncryptedValue {
  enc: string;
  iv: string;
  tag: string;
}

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ENCRYPTION_KEY env var is not set");
  return createHash("sha256").update(secret).digest();
}

export function decrypt(value: EncryptedValue): string {
  const key = getKey();
  const iv = Buffer.from(value.iv, "base64");
  const tag = Buffer.from(value.tag, "base64");
  const ciphertext = Buffer.from(value.enc, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
