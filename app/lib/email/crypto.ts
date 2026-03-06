import crypto from 'crypto';
import { getEnv } from '@/lib/server/env';
const env = getEnv();

const ENCRYPTION_KEY = env.EMAIL_ENCRYPTION_KEY;

function getKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error('EMAIL_ENCRYPTION_KEY is missing. Set a 32-byte base64 key in the server environment.');
  }
  // Accept base64 (32 bytes), hex (32 bytes => 64 hex chars), or raw 32-char string.
  const base64 = Buffer.from(ENCRYPTION_KEY, 'base64');
  if (base64.length === 32) {
    return base64;
  }
  const hex = Buffer.from(ENCRYPTION_KEY, 'hex');
  if (hex.length === 32 && ENCRYPTION_KEY.length === 64) {
    return hex;
  }
  if (ENCRYPTION_KEY.length >= 32) {
    return Buffer.from(ENCRYPTION_KEY, 'utf8').subarray(0, 32);
  }
  throw new Error(
    'EMAIL_ENCRYPTION_KEY must be 32 bytes. Provide base64 (32 bytes), hex (64 chars), or a raw >32-character string.'
  );
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function encryptString(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };

  return JSON.stringify(payload);
}

export function decryptString(encrypted: string): string {
  const payload = JSON.parse(encrypted) as EncryptedPayload;
  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export function encryptState(data: Record<string, unknown>): string {
  return encryptString(JSON.stringify(data));
}

export function decryptState<T = Record<string, unknown>>(state: string): T {
  const json = decryptString(state);
  return JSON.parse(json) as T;
}

export function assertEmailEncryptionKey(): void {
  getKey();
}
