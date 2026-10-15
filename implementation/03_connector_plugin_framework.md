# 🔌 Step 03: Connector Plugin Framework

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
Establish an extensible, plugin-based architecture for external data ingestion. Any new data source (GitHub, Spotify, Oura, Health, Plaid) can be added by implementing a standardized interface without modifying core application routing.

---

## 🏗️ Architecture & Base Interface

All connectors inherit from `BaseConnector` in `src/connectors/base.ts`:

```typescript
export interface ConnectorConfig {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  [key: string]: any;
}

export interface SyncResult {
  sourceId: string;
  status: 'success' | 'partial' | 'error';
  itemsProcessed: number;
  timestamp: string;
  error?: string;
}

export abstract class BaseConnector {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly type: 'health' | 'productivity' | 'learning' | 'finance' | 'media' | 'manual';

  protected config: ConnectorConfig;

  constructor(config: ConnectorConfig = {}) {
    this.config = config;
  }

  // Mandatory sync method
  abstract sync(since?: Date): Promise<SyncResult>;

  // Check if API credentials are valid
  abstract testConnection(): Promise<boolean>;

  // Current connection state
  async getStatus(): Promise<'connected' | 'disconnected' | 'demo' | 'error'> {
    const isWorking = await this.testConnection().catch(() => false);
    return isWorking ? 'connected' : 'disconnected';
  }
}
```

---

## 📦 Connector Registry (`src/connectors/index.ts`)

Central registry providing discovery, status queries, and batch synchronization:

```typescript
import { BaseConnector } from './base.js';
import { GitHubConnector } from './github.js';
import { SpotifyConnector } from './spotify.js';
import { ManualEntryConnector } from './manual.js';

class ConnectorManager {
  private connectors = new Map<string, BaseConnector>();

  register(connector: BaseConnector) {
    this.connectors.set(connector.id, connector);
  }

  get(id: string): BaseConnector | undefined {
    return this.connectors.get(id);
  }

  getAll(): BaseConnector[] {
    return Array.from(this.connectors.values());
  }

  async syncAll() {
    const results = [];
    for (const connector of this.connectors.values()) {
      try {
        const res = await connector.sync();
        results.push(res);
      } catch (err: any) {
        results.push({ sourceId: connector.id, status: 'error', error: err.message });
      }
    }
    return results;
  }
}

export const connectorManager = new ConnectorManager();
```

---

## 🧪 Verification & Checklist
- [x] Abstract base class enforces `sync()`, `testConnection()`, and metadata types.
- [x] Registry successfully registers connectors at runtime.
- [x] Triggering `syncAll()` executes all registered sources and returns structured results.

---

## 🔮 Advanced Enhancements & Additions

### 1. Incremental Sync Cursors & State Persistence
Prevent redundant full-range queries by saving high-water mark cursors per connector directly into the database:
```typescript
export interface SyncState {
  cursor?: string;          // e.g. last commit SHA, or Spotify track timestamp
  lastSuccessTimestamp?: string;
  consecutiveFailures: number;
}

// In BaseConnector:
protected async getSyncState(): Promise<SyncState> {
  const row = db.prepare('SELECT state_json FROM connector_states WHERE source_id = ?').get(this.id);
  return row ? JSON.parse(row.state_json) : { consecutiveFailures: 0 };
}

protected async saveSyncState(state: SyncState): Promise<void> {
  db.prepare(`
    INSERT INTO connector_states (source_id, state_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source_id) DO UPDATE SET state_json = excluded.state_json, updated_at = CURRENT_TIMESTAMP
  `).run(this.id, JSON.stringify(state));
}
```

### 2. Dead Letter Queue (DLQ) & Circuit Breaker
- **Circuit Breaker Pattern**: If an external API returns 5xx or connection timeouts 3 consecutive times, trip the circuit to `open` for 15 minutes, skipping unnecessary network requests and preventing log spam.
- **Dead Letter Queue**: Malformed payloads or unparseable webhook responses are routed to a `dead_letter_events` table for developer inspection rather than crashing the ingestion pipeline.

### 3. Dynamic Plugin Hot-Loading
Support user-written community connectors without server restarts:
- Monitor a `./plugins/` directory using `chokidar` or Node.js `fs.watch`.
- Dynamically import custom ES modules matching `*.plugin.ts` or `*.plugin.js` using `import()`.
- Validate that each dynamically loaded class implements `BaseConnector` before registering in `ConnectorManager`.

