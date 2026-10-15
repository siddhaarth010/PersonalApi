import { getDb } from '../db/database.js';

export interface StreakInfo {
  id: string;
  name: string;
  current_count: number;
  best_count: number;
  last_logged_date: string | null;
  status: 'active' | 'at_risk' | 'broken';
}

/**
 * Updates or advances a consecutive habit streak.
 */
export function updateStreak(name: string, date: string = new Date().toISOString().slice(0, 10)): StreakInfo | null {
  const db = getDb();
  const streak = db.prepare('SELECT * FROM streaks WHERE name = ?').get(name) as any;
  if (!streak) return null;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let newCount = streak.current_count;

  if (streak.last_logged_date === yesterday) {
    newCount += 1;
  } else if (streak.last_logged_date === date) {
    // Already logged today, keep streak
    newCount = streak.current_count;
  } else {
    // Missed yesterday, reset streak to 1
    newCount = 1;
  }

  const bestCount = Math.max(newCount, streak.best_count);
  db.prepare(`
    UPDATE streaks 
    SET current_count = ?, best_count = ?, last_logged_date = ?, updated_at = datetime('now')
    WHERE name = ?
  `).run(newCount, bestCount, date, name);

  return {
    id: streak.id,
    name,
    current_count: newCount,
    best_count: bestCount,
    last_logged_date: date,
    status: 'active',
  };
}

/**
 * Recalculates all habit streaks against database history.
 */
export function getAllStreaks(): StreakInfo[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM streaks ORDER BY current_count DESC').all() as any[];
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return rows.map(r => {
    let status: 'active' | 'at_risk' | 'broken' = 'broken';
    if (r.last_logged_date === today) {
      status = 'active';
    } else if (r.last_logged_date === yesterday) {
      status = 'at_risk';
    }

    return {
      id: r.id,
      name: r.name,
      current_count: r.current_count,
      best_count: r.best_count,
      last_logged_date: r.last_logged_date,
      status,
    };
  });
}
