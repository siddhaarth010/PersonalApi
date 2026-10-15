# 🔒 Step 20: Security, Encryption & Self-Hosting

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented  
> **Estimated Time:** 3–4 hours

---

## 🎯 Objective
Guarantee complete data sovereignty, zero telemetry, AES-256 encryption at rest for sensitive life data, encrypted off-site backups, and reproducible one-command self-hosting via Docker Compose.

---

## 🛡️ Security Architecture

| Vector | Protection Mechanism |
|---|---|
| **Data at Rest** | Sensitive fields (finance amounts, health notes) encrypted with `AES-256-GCM`. |
| **Data in Transit** | HTTPS / TLS forced via Caddy or Nginx reverse proxy. |
| **Authentication** | Scoped API Keys (e.g. `read:health`, `write:entries`, `admin`). |
| **Telemetry** | 0 external analytics scripts, 0 Google Analytics, 0 third-party trackers. |
| **Data Wipe** | Cryptographic zero-fill deletion endpoint (`POST /api/v1/privacy/wipe`). |

---

## 🐳 Production `docker-compose.yml`

```yaml
version: '3.8'

services:
  api:
    build: .
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - PERSONAL_API_KEY=${PERSONAL_API_KEY}
      - DB_PATH=/data/personal_api.db
    volumes:
      - personal_data:/data

  dashboard:
    build:
      context: ./dashboard
    restart: unless-stopped
    ports:
      - "5173:80"
    depends_on:
      - api

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data

volumes:
  personal_data:
  caddy_data:
```

---

## 💾 Encrypted Backup Script (`scripts/backup.sh` / `scripts/backup.ts`)
```bash
# Cross-platform TypeScript backup tool
npm run build && npx tsx scripts/backup.ts
```

---

## 🧪 Verification & Checklist
- [x] Implement field-level encryption helper in `src/utils/crypto.ts`.
- [x] Create `Dockerfile` and `docker-compose.yml`.
- [x] Verify container boots cleanly with `docker compose up -d`.
- [x] Verify automated encrypted backup creation.

---

## 🔮 Advanced Enhancements & Additions

### 1. Argon2id Key Derivation from User Passphrase
Strengthen encryption key generation to resist offline brute-force attacks:
- Derive the 256-bit symmetric encryption key using `argon2id` with memory-hard parameters ($m=65536, t=3, p=4$) from a user master password and a persistent salt.
- Store no plaintext master keys in environment files on shared VPS instances.

### 2. Automated Encrypted Cloud Sync (S3 / Backblaze B2 / Cloudflare R2)
Extend `scripts/backup.ts` to push encrypted snapshots off-site automatically:
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function uploadEncryptedBackup(backupFilePath: string) {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.BACKUP_S3_ENDPOINT, // e.g. Backblaze B2 or Cloudflare R2
    credentials: {
      accessKeyId: process.env.BACKUP_S3_KEY_ID!,
      secretAccessKey: process.env.BACKUP_S3_SECRET_KEY!,
    }
  });

  // Upload encrypted tarball with 30-day lifecycle retention
}
```

### 3. Complete Zero-Knowledge Export & Instant Wipe
- **GDPR / Sovereign Export**: `GET /api/v1/privacy/export` packages the full SQLite database, decrypted audit trails, and uploads into a single password-protected ZIP.
- **Cryptographic Zero-Fill Wipe**: `POST /api/v1/privacy/wipe` requires physical confirmation phrase (`"PERMANENTLY_DELETE_MY_DATA"`), overwrites the database file with random noise, and unlinks it from the file system.

