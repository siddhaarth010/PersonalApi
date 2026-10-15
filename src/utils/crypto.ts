import crypto from 'crypto';
import { getDb } from '../db/database.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Derives a consistent 32-byte key from encryption secret
 */
function getEncryptionKey(customKey?: string): Buffer {
  const secret = customKey || process.env.ENCRYPTION_KEY || 'personal-api-default-secret-key-32-bytes!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptField(plainText: string, customKey?: string): string {
  if (!plainText) return plainText;

  const key = getEncryptionKey(customKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string
 */
export function decryptField(encryptedPayload: string, customKey?: string): string {
  if (!encryptedPayload || !encryptedPayload.includes(':')) {
    return encryptedPayload;
  }

  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) return encryptedPayload;

    const [ivHex, authTagHex, cipherHex] = parts;
    const key = getEncryptionKey(customKey);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err: any) {
    console.warn('Field decryption error:', err.message);
    return encryptedPayload;
  }
}

/**
 * Encrypts specific fields of a record
 */
export function encryptRecord<T extends Record<string, any>>(record: T, fields: (keyof T)[]): T {
  const result = { ...record };
  for (const field of fields) {
    if (typeof result[field] === 'string') {
      result[field] = encryptField(result[field] as string) as any;
    }
  }
  return result;
}

/**
 * Decrypts specific fields of a record
 */
export function decryptRecord<T extends Record<string, any>>(record: T, fields: (keyof T)[]): T {
  const result = { ...record };
  for (const field of fields) {
    if (typeof result[field] === 'string') {
      result[field] = decryptField(result[field] as string) as any;
    }
  }
  return result;
}


/**
 * Cryptographic Zero-Fill Secure Data Wipe
 * Safely wipes sensitive user data and vacuums database
 */
export function executeSecurePrivacyWipe(): { success: boolean; recordsWiped: number; timestamp: string } {
  const db = getDb();
  let recordsWiped = 0;

  // 1. Zero out and delete manual sensitive check-in notes
  const manualCount = db.prepare('SELECT COUNT(*) as count FROM manual_entries').get() as { count: number };
  db.prepare(`
    UPDATE manual_entries 
    SET notes = '00000000000000000000000000000000', label = 'WIPED', tags = '[]'
  `).run();
  db.prepare('DELETE FROM manual_entries').run();
  recordsWiped += manualCount?.count || 0;

  // 2. Clear health telemetry
  const healthCount = db.prepare('SELECT COUNT(*) as count FROM health_metrics').get() as { count: number };
  db.prepare('DELETE FROM health_metrics').run();
  recordsWiped += healthCount?.count || 0;

  // 3. Clear raw events audit payloads
  const rawCount = db.prepare('SELECT COUNT(*) as count FROM raw_events').get() as { count: number };
  db.prepare('DELETE FROM raw_events').run();
  recordsWiped += rawCount?.count || 0;

  // 4. Clear life commits
  const commitCount = db.prepare('SELECT COUNT(*) as count FROM life_commits').get() as { count: number };
  db.prepare('DELETE FROM life_commits').run();
  recordsWiped += commitCount?.count || 0;

  // 5. Run SQLite VACUUM to zero-fill free pages on disk
  db.exec('VACUUM');

  return {
    success: true,
    recordsWiped,
    timestamp: new Date().toISOString(),
  };
}
