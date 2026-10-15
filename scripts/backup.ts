import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DB_PATH = process.env.DB_PATH || path.join(rootDir, 'data', 'personal-api.db');
const BACKUPS_DIR = path.join(rootDir, 'backups');
const PASSPHRASE = process.env.BACKUP_PASSPHRASE || 'personal-api-backup-secure-passphrase-2026';

function getKey(): Buffer {
  return crypto.createHash('sha256').update(PASSPHRASE).digest();
}

/**
 * Creates an AES-256-GCM encrypted backup of the SQLite database
 */
export function createEncryptedBackup(): string {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database file not found at ${DB_PATH}`);
  }

  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `personal-api-backup-${timestamp}.db.enc`;
  const backupPath = path.join(BACKUPS_DIR, backupFileName);

  const dbBuffer = fs.readFileSync(DB_PATH);
  const iv = crypto.randomBytes(16);
  const key = getKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(dbBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // File structure: [16 bytes IV][16 bytes AuthTag][Encrypted Data]
  const finalPayload = Buffer.concat([iv, authTag, encrypted]);
  fs.writeFileSync(backupPath, finalPayload);

  console.log(`🔒 Encrypted backup created successfully!`);
  console.log(`   Path: ${backupPath}`);
  console.log(`   Size: ${(finalPayload.length / 1024).toFixed(1)} KB`);

  return backupPath;
}

/**
 * Restores an encrypted backup file back into the active SQLite database
 */
export function restoreEncryptedBackup(backupFilePath: string): void {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found at ${backupFilePath}`);
  }

  const payload = fs.readFileSync(backupFilePath);
  const iv = payload.subarray(0, 16);
  const authTag = payload.subarray(16, 32);
  const encryptedData = payload.subarray(32);

  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  fs.writeFileSync(DB_PATH, decrypted);

  console.log(`🔓 Successfully decrypted and restored database from ${backupFilePath}`);
}

// CLI runner
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  if (args[0] === '--restore' && args[1]) {
    restoreEncryptedBackup(args[1]);
  } else {
    createEncryptedBackup();
  }
}
