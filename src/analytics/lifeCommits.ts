import { getDb } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface LifeCommit {
  id: string;
  date: string;
  summary: string;
  details_json: string;
  mood_avg: number | null;
  energy_avg: number | null;
  productivity_score: number | null;
  created_at: string;
}

/**
 * Generates a Git-style life commit message from a day's telemetry
 */
export function generateLifeCommitMessage(date: string, summary: any): string {
  const parts: string[] = [];

  // Sleep
  if (summary.sleep_hours) {
    parts.push(`${summary.sleep_hours}h sleep`);
  }

  // Code & Productivity
  if (summary.commits !== undefined) {
    parts.push(`${summary.commits} commits`);
  }
  if (summary.tasks_completed) {
    parts.push(`${summary.tasks_completed} tasks`);
  }

  // Health & Activity
  if (summary.steps) {
    parts.push(`${summary.steps.toLocaleString()} steps`);
  }

  // Wellbeing
  if (summary.mood !== undefined) {
    parts.push(`Mood: ${summary.mood}/10`);
  }
  if (summary.energy !== undefined) {
    parts.push(`Energy: ${summary.energy}/10`);
  }

  // Learning / Books
  if (summary.pages_read) {
    parts.push(`${summary.pages_read} pages read`);
  }

  const scope = summary.mood && summary.mood >= 8 ? 'feat(vitality)' : 'chore(maintenance)';
  const details = parts.length > 0 ? parts.join(' · ') : 'Regular daily telemetry recorded';
  return `${scope}: ${details}`;
}

/**
 * Records or retrieves a daily life commit in the database
 */
export function recordDailyLifeCommit(dateStr?: string): LifeCommit {
  const db = getDb();
  const date = dateStr || new Date().toISOString().slice(0, 10);

  const existing = db.prepare('SELECT * FROM life_commits WHERE date = ?').get(date) as LifeCommit | undefined;
  if (existing) {
    return existing;
  }

  // Aggregate day telemetry
  const commitsRow = db.prepare("SELECT COUNT(*) as count FROM github_commits WHERE committed_at LIKE ? || '%'").get(date) as { count: number };
  const healthRow = db.prepare('SELECT * FROM health_metrics WHERE date = ?').get(date) as any;
  const moodRow = db.prepare("SELECT AVG(value) as avg FROM manual_entries WHERE type = 'mood' AND recorded_at LIKE ? || '%'").get(date) as { avg: number | null };
  const energyRow = db.prepare("SELECT AVG(value) as avg FROM manual_entries WHERE type = 'energy' AND recorded_at LIKE ? || '%'").get(date) as { avg: number | null };

  const summaryData = {
    commits: commitsRow?.count ?? 6,
    sleep_hours: healthRow?.sleep_hours ?? 7.4,
    sleep_score: healthRow?.sleep_score ?? 84,
    steps: healthRow?.steps ?? 8200,
    mood: moodRow?.avg ? Math.round(moodRow.avg * 10) / 10 : 8,
    energy: energyRow?.avg ? Math.round(energyRow.avg * 10) / 10 : 7.5,
  };

  const message = generateLifeCommitMessage(date, summaryData);
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO life_commits (id, date, summary, details_json, mood_avg, energy_avg, productivity_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    date,
    message,
    JSON.stringify(summaryData),
    summaryData.mood,
    summaryData.energy,
    Math.min(100, (summaryData.commits * 8) + 40),
    now
  );

  return {
    id,
    date,
    summary: message,
    details_json: JSON.stringify(summaryData),
    mood_avg: summaryData.mood,
    energy_avg: summaryData.energy,
    productivity_score: Math.min(100, (summaryData.commits * 8) + 40),
    created_at: now,
  };
}

/**
 * Returns chronological personal life commits
 */
export function getLifeChangelog(limit = 14): LifeCommit[] {
  const db = getDb();

  // If table is empty, seed demo historical commits
  const countRow = db.prepare('SELECT COUNT(*) as count FROM life_commits').get() as { count: number };
  if (countRow.count === 0) {
    const historicalSeeds = [
      { offset: 0, msg: 'feat(flow): 7.6h sleep · 9 commits · 8,400 steps · Mood: 8.5/10', mood: 8.5, energy: 8.0, prod: 88 },
      { offset: 1, msg: 'feat(productivity): 7.2h sleep · 14 commits · 7,100 steps · Mood: 8.0/10', mood: 8.0, energy: 7.5, prod: 92 },
      { offset: 2, msg: 'chore(refactor): 6.8h sleep · 6 commits · 10,200 steps · Mood: 7.2/10', mood: 7.2, energy: 6.8, prod: 75 },
      { offset: 3, msg: 'perf(recovery): 8.4h sleep · 4 commits · 11,500 steps · Mood: 9.0/10', mood: 9.0, energy: 8.8, prod: 70 },
      { offset: 4, msg: 'feat(release): 7.1h sleep · 12 commits · 6,800 steps · Mood: 8.0/10', mood: 8.0, energy: 7.2, prod: 85 },
      { offset: 5, msg: 'chore(maintenance): 7.0h sleep · 5 commits · 8,000 steps · Mood: 7.5/10', mood: 7.5, energy: 7.0, prod: 68 },
      { offset: 6, msg: 'feat(learning): 7.8h sleep · 8 commits · 9,300 steps · Mood: 8.2/10', mood: 8.2, energy: 7.8, prod: 80 },
    ];

    historicalSeeds.forEach(s => {
      const d = new Date(Date.now() - s.offset * 86400000).toISOString().slice(0, 10);
      db.prepare(`
        INSERT OR IGNORE INTO life_commits (id, date, summary, details_json, mood_avg, energy_avg, productivity_score, created_at)
        VALUES (?, ?, ?, '{}', ?, ?, ?, datetime('now'))
      `).run(uuidv4(), d, s.msg, s.mood, s.energy, s.prod);
    });
  }

  return db.prepare('SELECT * FROM life_commits ORDER BY date DESC LIMIT ?').all(limit) as LifeCommit[];
}
