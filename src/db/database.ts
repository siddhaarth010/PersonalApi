import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

let db: Database.Database;
let isInitialized = false;

export function getDb(): Database.Database {
  if (!db) {
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    if (!isInitialized) {
      initializeDatabase();
    }
  }
  return db;
}

export function initializeDatabase(): void {
  if (isInitialized) return;
  isInitialized = true;
  const db = getDb();

  // --- Data Sources Registry ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'disconnected',
      last_synced_at TEXT,
      config_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // --- GitHub Data ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS github_commits (
      id TEXT PRIMARY KEY,
      repo TEXT NOT NULL,
      message TEXT NOT NULL,
      sha TEXT NOT NULL,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      files_changed INTEGER DEFAULT 0,
      committed_at TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS github_repos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      description TEXT,
      language TEXT,
      stars INTEGER DEFAULT 0,
      forks INTEGER DEFAULT 0,
      is_private INTEGER DEFAULT 0,
      updated_at TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // --- Spotify Data ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS spotify_recent_tracks (
      id TEXT PRIMARY KEY,
      track_name TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      album_name TEXT,
      album_image_url TEXT,
      duration_ms INTEGER,
      played_at TEXT NOT NULL,
      track_url TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS spotify_top_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      image_url TEXT,
      genres TEXT,
      popularity INTEGER,
      time_range TEXT NOT NULL,
      rank INTEGER NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS spotify_auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // --- Manual Entries (Mood, Energy, Custom Metrics) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS manual_entries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      label TEXT,
      notes TEXT,
      tags TEXT,
      recorded_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // --- Life Commits (Daily Summaries) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS life_commits (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      details_json TEXT DEFAULT '{}',
      mood_avg REAL,
      energy_avg REAL,
      productivity_score REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // --- Streaks ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      current_count INTEGER DEFAULT 0,
      best_count INTEGER DEFAULT 0,
      last_logged_date TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // --- Goals ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      target_value REAL NOT NULL,
      current_value REAL DEFAULT 0,
      unit TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // --- Insights / Anomalies ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      confidence REAL,
      data_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      dismissed INTEGER DEFAULT 0
    )
  `);

  // --- Raw Ingestion Events Log (Audit Trail) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS raw_events (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // --- Wearable Health & Vitality Metrics ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_metrics (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      sleep_hours REAL DEFAULT 0,
      deep_sleep_hours REAL DEFAULT 0,
      rem_sleep_hours REAL DEFAULT 0,
      sleep_score INTEGER DEFAULT 0,
      resting_hr INTEGER DEFAULT 0,
      hrv_rmssd REAL DEFAULT 0,
      steps INTEGER DEFAULT 0,
      active_calories INTEGER DEFAULT 0,
      source TEXT DEFAULT 'wearable',
      raw_json TEXT DEFAULT '{}',
      recorded_at TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // --- Background Sync Job History ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_history (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      items_synced INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      error TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL
    )
  `);

  // --- Energy Transactions (Energy Accounting) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS energy_transactions (
      id TEXT PRIMARY KEY,
      activity TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      impact REAL NOT NULL,
      tags TEXT DEFAULT '[]',
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create indexes for time-based queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_github_commits_date ON github_commits(committed_at);
    CREATE INDEX IF NOT EXISTS idx_spotify_tracks_date ON spotify_recent_tracks(played_at);
    CREATE INDEX IF NOT EXISTS idx_manual_entries_date ON manual_entries(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_manual_entries_type ON manual_entries(type);
    CREATE INDEX IF NOT EXISTS idx_health_metrics_date ON health_metrics(date);
    CREATE INDEX IF NOT EXISTS idx_raw_events_source ON raw_events(source_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_sync_history_date ON sync_history(completed_at);
    CREATE INDEX IF NOT EXISTS idx_life_commits_date ON life_commits(date);
    CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(type);
    CREATE INDEX IF NOT EXISTS idx_energy_transactions_date ON energy_transactions(recorded_at);
  `);

  console.log('✅ Database initialized successfully');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
