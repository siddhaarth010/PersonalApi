# 💾 Step 02: Database & Time-Series Storage

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented (SQLite) / 🔄 Extendable to PostgreSQL + TimescaleDB  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
Design and implement the persistent storage layer capable of handling both relational metadata (sources, goals, streaks, raw payloads) and high-velocity time-series personal events (sleep metrics, coding time, heart rate, mood check-ins).

---

## 🗄️ Database Schemas

### 1. SQLite Implementation (`./data/personal_api.db`)
Using `better-sqlite3` with WAL mode for zero-latency local development:

```sql
-- 1. Connected Sources Registry
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected',
  config TEXT,
  last_synced_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Raw Ingestion Events Log (JSON audit trail)
CREATE TABLE IF NOT EXISTS raw_events (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  recorded_at DATETIME NOT NULL,
  ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES data_sources(id)
);
CREATE INDEX IF NOT EXISTS idx_raw_events_source_time ON raw_events(source_id, recorded_at);

-- 3. Metric Entries (Time-Series Data Points)
CREATE TABLE IF NOT EXISTS metric_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'mood', 'energy', 'sleep_hours', 'screen_time'
  value REAL NOT NULL,
  label TEXT,
  notes TEXT,
  tags TEXT,                    -- JSON array of tags
  recorded_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_metric_type_time ON metric_entries(type, recorded_at);

-- 4. Daily Aggregated Summaries
CREATE TABLE IF NOT EXISTS daily_summaries (
  date TEXT PRIMARY KEY,        -- 'YYYY-MM-DD'
  data TEXT NOT NULL,           -- Aggregated daily JSON object
  life_commit TEXT,             -- Auto-generated daily commit message
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Habits & Streaks
CREATE TABLE IF NOT EXISTS streaks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  current_count INTEGER DEFAULT 0,
  best_count INTEGER DEFAULT 0,
  last_logged_date TEXT
);

-- 6. Life Goals
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_value REAL NOT NULL,
  current_value REAL DEFAULT 0,
  unit TEXT NOT NULL,
  period TEXT DEFAULT 'yearly',  -- 'daily', 'weekly', 'monthly', 'yearly'
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Discovered Insights & Anomalies
CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'correlation', 'anomaly', 'prediction'
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
  confidence REAL DEFAULT 1.0,
  metadata TEXT,
  dismissed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 Scaling to PostgreSQL + TimescaleDB (Production)

For production with millions of time-series records:
```sql
-- Convert metric_entries to a hypertable
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE metric_entries (
  recorded_at TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  metadata JSONB
);

SELECT create_hypertable('metric_entries', 'recorded_at');
```

---

## 🧪 Verification & Checklist
- [x] Run `npx tsx src/seed.ts` to execute migrations and seed data.
- [x] Verify database file created at `./data/personal_api.db`.
- [x] Check query latency is `< 5ms` for daily summaries.

---

## 🔮 Advanced Enhancements & Additions

### 1. Automated WAL Checkpointing & Data Pruning Lifecycle
When ingesting real-time IoT or high-frequency wearable data, SQLite WAL files can grow excessively. Implement an automated maintenance routine:
```typescript
export function performDatabaseMaintenance(db: Database.Database) {
  // Truncate WAL journal to keep disk footprint minimal
  db.pragma('wal_checkpoint(TRUNCATE)');
  
  // Prune raw event payloads older than 90 days to conserve space while preserving metric_entries
  const pruneDate = new Date(Date.now() - 90 * 86400 * 1000).toISOString();
  db.prepare('DELETE FROM raw_events WHERE ingested_at < ?').run(pruneDate);
  
  // Re-index periodically
  db.pragma('optimize');
}
```

### 2. Versioned Migration Engine
Replace inline `CREATE TABLE IF NOT EXISTS` with a deterministic, bidirectional migration runner:
- Store applied migrations in a `schema_migrations (version TEXT PRIMARY KEY, applied_at DATETIME)` table.
- Up/Down scripts: `001_initial_schema.sql`, `002_add_energy_accounting.sql`, `003_add_vector_embeddings.sql`.
- Run migrations automatically on server boot before initializing routes or schedulers.

### 3. Dual Storage Driver: SQLite (Local) & TimescaleDB (Cloud)
Define a generic repository interface:
```typescript
export interface ITimeSeriesRepository {
  insertMetric(entry: MetricEntry): Promise<void>;
  queryRange(metric: string, from: Date, to: Date): Promise<MetricEntry[]>;
  getDailyAggregates(date: string): Promise<DailySummary | null>;
}
```
- Implement `SQLiteTimeSeriesRepository` using `better-sqlite3`.
- Implement `TimescaleDBTimeSeriesRepository` utilizing continuous aggregates and compression policies:
  ```sql
  -- Automatic 7-day compression policy
  ALTER TABLE metric_entries SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'type'
  );
  SELECT add_compression_policy('metric_entries', INTERVAL '7 days');
  ```

