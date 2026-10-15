import { v4 as uuidv4 } from 'uuid';
import { BaseConnector, SyncResult, ConnectorStatus } from './base.js';
import { getDb } from '../db/database.js';

/**
 * Manual Entry Connector
 * 
 * Handles user-submitted data like mood, energy, custom metrics.
 * No external API — data comes directly from the user via the API.
 * 
 * Entry types:
 * - mood: 1-10 scale
 * - energy: 1-10 scale
 * - sleep_hours: decimal hours
 * - weight: kg/lbs
 * - custom: any numeric metric with a label
 */

export interface ManualEntryInput {
  type: string;
  value: number;
  label?: string;
  notes?: string;
  tags?: string[];
  recorded_at?: string;
}

export class ManualEntryConnector extends BaseConnector {
  readonly id = 'manual';
  readonly name = 'Manual Entry';
  readonly type = 'manual';

  isConfigured(): boolean {
    return true; // Always available
  }

  async sync(): Promise<SyncResult> {
    // Manual entries don't need syncing — they're created directly
    return {
      source: this.id,
      success: true,
      itemsSynced: 0,
      errors: [],
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Add a new manual entry
   */
  addEntry(input: ManualEntryInput): Record<string, unknown> {
    const db = getDb();
    const id = uuidv4();
    const recordedAt = input.recorded_at || new Date().toISOString();

    db.prepare(`
      INSERT INTO manual_entries (id, type, value, label, notes, tags, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.type,
      input.value,
      input.label || null,
      input.notes || null,
      input.tags ? JSON.stringify(input.tags) : null,
      recordedAt
    );

    // Update streak for this entry type
    this.updateStreak(input.type);

    return { id, ...input, recorded_at: recordedAt };
  }

  /**
   * Add multiple entries at once (batch)
   */
  addBatch(entries: ManualEntryInput[]): Record<string, unknown>[] {
    return entries.map(e => this.addEntry(e));
  }

  /**
   * Get entries by type within a date range
   */
  getEntries(type?: string, from?: string, to?: string, limit: number = 50): Record<string, unknown>[] {
    const db = getDb();

    let query = 'SELECT * FROM manual_entries WHERE 1=1';
    const params: any[] = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (from) {
      query += ' AND recorded_at >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND recorded_at < ?';
      params.push(to);
    }

    query += ' ORDER BY recorded_at DESC LIMIT ?';
    params.push(limit);

    return db.prepare(query).all(...params) as Record<string, unknown>[];
  }

  /**
   * Delete an entry by ID
   */
  deleteEntry(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM manual_entries WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Get averages for a type over a period
   */
  getAverages(type: string, from?: string, to?: string): Record<string, unknown> {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const toDate = to || new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const stats = db.prepare(`
      SELECT 
        AVG(value) as average,
        MIN(value) as min_value,
        MAX(value) as max_value,
        COUNT(*) as entry_count
      FROM manual_entries 
      WHERE type = ? AND recorded_at >= ? AND recorded_at < ?
    `).get(type, fromDate, toDate) as any;

    // Daily averages for trend
    const dailyAvg = db.prepare(`
      SELECT 
        date(recorded_at) as date,
        AVG(value) as avg_value,
        COUNT(*) as entries
      FROM manual_entries 
      WHERE type = ? AND recorded_at >= ? AND recorded_at < ?
      GROUP BY date(recorded_at)
      ORDER BY date ASC
    `).all(type, fromDate, toDate);

    return {
      type,
      period: { from: fromDate, to: toDate },
      average: stats?.average ? Math.round(stats.average * 100) / 100 : null,
      min: stats?.min_value,
      max: stats?.max_value,
      total_entries: stats?.entry_count || 0,
      daily_trend: dailyAvg,
    };
  }

  private updateStreak(type: string): void {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const streak = db.prepare('SELECT * FROM streaks WHERE name = ?').get(type) as any;

    if (!streak) {
      // First entry of this type
      db.prepare(`
        INSERT INTO streaks (id, name, current_count, best_count, last_logged_date, updated_at)
        VALUES (?, ?, 1, 1, ?, datetime('now'))
      `).run(uuidv4(), type, today);
      return;
    }

    if (streak.last_logged_date === today) {
      // Already logged today
      return;
    }

    if (streak.last_logged_date === yesterday) {
      // Consecutive day
      const newCount = streak.current_count + 1;
      const newBest = Math.max(newCount, streak.best_count);
      db.prepare(`
        UPDATE streaks SET current_count = ?, best_count = ?, last_logged_date = ?, updated_at = datetime('now')
        WHERE name = ?
      `).run(newCount, newBest, today, type);
    } else {
      // Streak broken
      db.prepare(`
        UPDATE streaks SET current_count = 1, last_logged_date = ?, updated_at = datetime('now')
        WHERE name = ?
      `).run(today, type);
    }
  }

  getStatus(): ConnectorStatus {
    const db = getDb();
    const entryCount = db.prepare('SELECT COUNT(*) as count FROM manual_entries').get() as any;

    return {
      id: this.id,
      name: this.name,
      type: this.type,
      connected: true,
      lastSynced: null,
      itemCount: entryCount?.count || 0,
    };
  }

  getSummary(from?: string, to?: string): Record<string, unknown> {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const fromDate = from || today;
    const toDate = to || new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const todayMood = db.prepare(`
      SELECT AVG(value) as avg FROM manual_entries 
      WHERE type = 'mood' AND recorded_at >= ? AND recorded_at < ?
    `).get(fromDate, toDate) as any;

    const todayEnergy = db.prepare(`
      SELECT AVG(value) as avg FROM manual_entries 
      WHERE type = 'energy' AND recorded_at >= ? AND recorded_at < ?
    `).get(fromDate, toDate) as any;

    const recentEntries = db.prepare(`
      SELECT type, value, label, notes, recorded_at FROM manual_entries 
      WHERE recorded_at >= ? AND recorded_at < ?
      ORDER BY recorded_at DESC LIMIT 10
    `).all(fromDate, toDate);

    const streaks = db.prepare(`
      SELECT name, current_count, best_count, last_logged_date FROM streaks
      ORDER BY current_count DESC
    `).all();

    return {
      mood: todayMood?.avg ? Math.round(todayMood.avg * 10) / 10 : null,
      energy: todayEnergy?.avg ? Math.round(todayEnergy.avg * 10) / 10 : null,
      recent_entries: recentEntries,
      streaks,
    };
  }
}
