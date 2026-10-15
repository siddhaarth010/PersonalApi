# 🛠️ Step 01: Project Scaffolding & Architecture

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented  
> **Estimated Time:** 1–2 hours

---

## 🎯 Objective
Establish the monorepo foundation, TypeScript environment configuration, package management, build tooling, and directory structure for the Personal API project.

---

## 📂 Directory Layout

```
d:\Personal API project\
├── .env                     # Local environment secrets & port definitions
├── .env.example             # Safe template for secrets
├── package.json             # Root monorepo scripts & dependencies
├── tsconfig.json            # Node.js ESM TypeScript compilation options
├── src/
│   ├── config.ts            # Strongly-typed environment schema (dotenv)
│   ├── server.ts            # HTTP server entry point (Express)
│   ├── seed.ts              # Demo seed data generator
│   ├── db/                  # Database connections & table initialization
│   ├── middleware/          # Security (Helmet, CORS, API Key Auth)
│   ├── routes/              # REST endpoint handlers
│   └── connectors/          # Data ingestion plugins
└── dashboard/               # Vite + React 19 Frontend Dashboard
```

---

## ⚙️ Key Configurations

### 1. `package.json` Scripts
Ensure the root scripts allow concurrent development of backend and frontend:
```json
{
  "name": "personal-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run dashboard\"",
    "build": "tsc",
    "start": "node dist/server.js",
    "dashboard": "cd dashboard && npm run dev",
    "seed": "tsx src/seed.ts"
  }
}
```

### 2. Environment Schema (`src/config.ts`)
```typescript
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.PERSONAL_API_KEY || 'dev_secret_key_123',
  githubToken: process.env.GITHUB_TOKEN || '',
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  dbPath: process.env.DB_PATH || './data/personal_api.db',
};
```

---

## 🧪 Verification & Checklist
- [x] Run `npm install` without errors.
- [x] Create `.env` from `.env.example`.
- [x] Run `npm run build` to verify `tsc` compilation succeeds without type errors.
- [x] Verify `npx tsx src/server.ts` starts the development server on `:3001`.

---

## 🔮 Advanced Enhancements & Additions

### 1. Type-Safe Environment Validation with Zod
Replace unchecked `process.env` lookups with a strict `zod` schema to fail-fast during boot if critical environment variables are absent or incorrectly typed:
```typescript
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PERSONAL_API_KEY: z.string().min(16, 'API key must be at least 16 chars'),
  ENCRYPTION_MASTER_KEY: z.string().min(32, 'AES-256 key required in production').optional(),
  DB_PATH: z.string().default('./data/personal_api.db'),
  GITHUB_TOKEN: z.string().optional(),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OLLAMA_HOST: z.string().url().default('http://localhost:11434'),
});

export const config = envSchema.parse(process.env);
```

### 2. Formal Monorepo Workspaces (`npm workspaces` / `pnpm`)
Split the project into modular packages to isolate concerns and share type definitions:
```
d:\Personal API project\
├── packages/
│   ├── core/              # Shared types, Zod schemas, math utilities
│   ├── server/            # Express REST API, connectors, scheduler, SQLite DB
│   ├── cli/               # Terminal binary (`me`)
│   └── dashboard/         # React 19 + Vite web frontend
└── package.json           # Root workspace configuration
```

### 3. Automated Code Quality & Git Hooks
- **Linter & Formatter**: Integrate `@biomejs/biome` for sub-millisecond linting and formatting across TS and TSX.
- **Pre-commit Automation**: Add `husky` and `lint-staged` to enforce zero type errors and clean formatting before commits are created.
- **CI/CD Pipeline**: GitHub Actions workflow running `tsc --noEmit`, linting, and master QC test suite on pull requests.

