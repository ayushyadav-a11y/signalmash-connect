// ===========================================
// Cryptographic Utilities
// ===========================================

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { config } from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Encrypt sensitive data (e.g., OAuth tokens)
 */
export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(config.encryptionKey, salt, 32);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Combine: salt + iv + tag + encrypted
  return Buffer.concat([
    salt,
    iv,
    tag,
    Buffer.from(encrypted, 'hex'),
  ]).toString('base64');
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  const data = Buffer.from(encryptedData, 'base64');

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = scryptSync(config.encryptionKey, salt, 32);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a URL-safe random string
 */
export function generateUrlSafeToken(length = 32): string {
  return randomBytes(length)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .slice(0, length);
}

/**
 * Hash a password using scrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const hash = Buffer.from(hashHex, 'hex');
  const derivedHash = scryptSync(password, salt, 64);

  // Timing-safe comparison
  if (hash.length !== derivedHash.length) return false;

  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash[i] ^ derivedHash[i];
  }
  return result === 0;
}
