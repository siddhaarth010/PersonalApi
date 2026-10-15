import cron, { ScheduledTask } from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { connectorManager } from '../connectors/index.js';
import { getDb } from '../db/database.js';
import { generateDailyBriefing } from '../notifications/briefing.js';
import { dispatchBriefing } from '../notifications/dispatcher.js';

export interface SchedulerJobStatus {
  name: string;
  schedule: string;
  description: string;
  lastRun: string | null;
  lastStatus: 'success' | 'error' | 'idle' | 'running';
  runCount: number;
  lastError?: string;
}

export interface SyncHistoryEntry {
  id: string;
  source: string;
  status: string;
  items_synced: number;
  duration_ms: number;
  error?: string;
  started_at: string;
  completed_at: string;
}

class IngestionScheduler {
  private tasks = new Map<string, ScheduledTask>();
  private jobStatuses = new Map<string, SchedulerJobStatus>();
  private isRunning = false;

  constructor() {
    this.registerJobMetadata('spotify-sync', '*/30 * * * *', 'Fetch recently played Spotify tracks and top artists');
    this.registerJobMetadata('github-sync', '0 * * * *', 'Fetch GitHub commit push events and repository metadata');
    this.registerJobMetadata('health-sync', '0 */2 * * *', 'Sync wearable sleep, HRV, and daily step telemetry');
    this.registerJobMetadata('nightly-rollup', '5 0 * * *', 'Daily life aggregation, streak updates & life commit generation');
    this.registerJobMetadata('morning-briefing', '0 8 * * *', 'Daily morning life briefing compilation & notification dispatch');
  }

  private registerJobMetadata(name: string, schedule: string, description: string): void {
    this.jobStatuses.set(name, {
      name,
      schedule,
      description,
      lastRun: null,
      lastStatus: 'idle',
      runCount: 0,
    });
  }

  /**
   * Initializes all cron background jobs
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('⏰ Initializing background ingestion scheduler...');

    // 1. Spotify Sync — Every 30 minutes
    const spotifyTask = cron.schedule('*/30 * * * *', async () => {
      await this.runJob('spotify-sync', async () => {
        const spotify = connectorManager.get('spotify');
        if (spotify && spotify.isConfigured()) {
          await this.executeWithRetry('spotify', () => spotify.sync());
        }
      });
    });
    this.tasks.set('spotify-sync', spotifyTask);

    // 2. GitHub Sync — Every hour
    const githubTask = cron.schedule('0 * * * *', async () => {
      await this.runJob('github-sync', async () => {
        const github = connectorManager.get('github');
        if (github && github.isConfigured()) {
          await this.executeWithRetry('github', () => github.sync());
        }
      });
    });
    this.tasks.set('github-sync', githubTask);

    // 3. Wearable Health Sync — Every 2 hours
    const healthTask = cron.schedule('0 */2 * * *', async () => {
      await this.runJob('health-sync', async () => {
        const health = connectorManager.get('health');
        if (health) {
          await this.executeWithRetry('health', () => health.sync());
        }
      });
    });
    this.tasks.set('health-sync', healthTask);

    // 4. Nightly Life Rollup — 00:05 AM
    const rollupTask = cron.schedule('5 0 * * *', async () => {
      await this.runJob('nightly-rollup', async () => {
        await this.calculateDailyRollup();
      });
    });
    this.tasks.set('nightly-rollup', rollupTask);

    // 5. Morning Life Briefing Dispatch — 08:00 AM
    const briefingTask = cron.schedule('0 8 * * *', async () => {
      await this.runJob('morning-briefing', async () => {
        const briefing = generateDailyBriefing();
        await dispatchBriefing(briefing.markdownText);
      });
    });
    this.tasks.set('morning-briefing', briefingTask);

    console.log('✅ Background scheduler initialized with 5 automated routines.');
  }

  stop(): void {
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
    this.isRunning = false;
    console.log('🛑 Background scheduler stopped.');
  }

  /**
   * Executes a connector sync with exponential backoff on transient errors / rate limits
   */
  private async executeWithRetry<T>(sourceName: string, action: () => Promise<T>, maxRetries = 3): Promise<T> {
    let attempt = 0;
    let baseDelay = 1000;

    while (attempt < maxRetries) {
      try {
        return await action();
      } catch (err: any) {
        attempt++;
        const isRateLimit = err?.status === 429 || err?.message?.includes('rate limit');
        const delay = Math.min(baseDelay * Math.pow(2, attempt), 60000);

        console.warn(`⚠️ [${sourceName}] Sync attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms...`);

        if (attempt >= maxRetries) {
          throw err;
        }

        await new Promise(res => setTimeout(res, delay));
      }
    }

    throw new Error(`Exceeded max retries for source ${sourceName}`);
  }

  /**
   * Wrapper for job tracking and error logging
   */
  async runJob(name: string, jobFn: () => Promise<void>): Promise<{ success: boolean; error?: string }> {
    const meta = this.jobStatuses.get(name);
    if (meta) {
      meta.lastStatus = 'running';
      meta.lastRun = new Date().toISOString();
      meta.runCount++;
    }

    const startTime = Date.now();
    try {
      await jobFn();
      if (meta) {
        meta.lastStatus = 'success';
        meta.lastError = undefined;
      }
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error occurred';
      if (meta) {
        meta.lastStatus = 'error';
        meta.lastError = errorMsg;
      }
      console.error(`❌ Scheduler job "${name}" failed:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Computes the daily rollup for a given date (defaults to today)
   * and generates/updates the daily life commit entry.
   */
  async calculateDailyRollup(dateStr?: string): Promise<Record<string, unknown>> {
    const db = getDb();
    const date = dateStr || new Date().toISOString().split('T')[0];
    const fromDate = `${date}T00:00:00.000Z`;
    const toDate = `${date}T23:59:59.999Z`;

    // 1. Commits count
    const commitsRow = db.prepare(`
      SELECT COUNT(*) as count FROM github_commits
      WHERE committed_at >= ? AND committed_at <= ?
    `).get(fromDate, toDate) as { count: number } | undefined;
    const commitsCount = commitsRow?.count || 0;

    // 2. Tracks count
    const tracksRow = db.prepare(`
      SELECT COUNT(*) as count FROM spotify_recent_tracks
      WHERE played_at >= ? AND played_at <= ?
    `).get(fromDate, toDate) as { count: number } | undefined;
    const tracksCount = tracksRow?.count || 0;

    // 3. Mood & Energy
    const moodRow = db.prepare(`
      SELECT AVG(value) as avg FROM manual_entries
      WHERE type = 'mood' AND recorded_at >= ? AND recorded_at <= ?
    `).get(fromDate, toDate) as { avg: number | null } | undefined;
    const moodAvg = moodRow?.avg ? Math.round(moodRow.avg * 10) / 10 : 7.0;

    const energyRow = db.prepare(`
      SELECT AVG(value) as avg FROM manual_entries
      WHERE type = 'energy' AND recorded_at >= ? AND recorded_at <= ?
    `).get(fromDate, toDate) as { avg: number | null } | undefined;
    const energyAvg = energyRow?.avg ? Math.round(energyRow.avg * 10) / 10 : 7.0;

    // 4. Health
    const healthRow = db.prepare(`
      SELECT sleep_hours, sleep_score, steps, resting_hr, hrv_rmssd
      FROM health_metrics WHERE date = ?
    `).get(date) as Record<string, number> | undefined;

    const sleepHours = healthRow?.sleep_hours ?? 7.2;
    const sleepScore = healthRow?.sleep_score ?? 80;
    const steps = healthRow?.steps ?? 6500;

    // 5. Productivity score formula (0 - 100)
    // Based on commits, energy, sleep score and active steps
    const productivityScore = Math.min(
      100,
      Math.round(
        (Math.min(commitsCount, 8) / 8) * 40 +
        ((energyAvg / 10) * 30) +
        ((sleepScore / 100) * 20) +
        (Math.min(steps, 10000) / 10000) * 10
      )
    );

    // 6. Generate Life Commit message
    const summary = `${commitsCount} commits, ${tracksCount} tracks, mood ${moodAvg}/10, energy ${energyAvg}/10, ${sleepHours}h sleep. Productivity: ${productivityScore}%.`;
    const details = JSON.stringify({
      commits: commitsCount,
      tracks: tracksCount,
      sleep_hours: sleepHours,
      sleep_score: sleepScore,
      steps,
      mood: moodAvg,
      energy: energyAvg,
    });

    db.prepare(`
      INSERT OR REPLACE INTO life_commits (
        id, date, summary, details_json, mood_avg, energy_avg, productivity_score, created_at
      ) VALUES (
        COALESCE((SELECT id FROM life_commits WHERE date = ?), ?),
        ?, ?, ?, ?, ?, ?, datetime('now')
      )
    `).run(date, uuidv4(), date, summary, details, moodAvg, energyAvg, productivityScore);

    return {
      date,
      summary,
      productivity_score: productivityScore,
      mood_avg: moodAvg,
      energy_avg: energyAvg,
      commits: commitsCount,
      tracks: tracksCount,
      sleep_hours: sleepHours,
    };
  }

  /**
   * Status overview for /api/v1/scheduler/status
   */
  getStatus(): { isRunning: boolean; jobs: SchedulerJobStatus[]; recentHistory: SyncHistoryEntry[] } {
    const db = getDb();
    const recentHistory = db.prepare(`
      SELECT * FROM sync_history ORDER BY completed_at DESC LIMIT 10
    `).all() as SyncHistoryEntry[];

    return {
      isRunning: this.isRunning,
      jobs: Array.from(this.jobStatuses.values()),
      recentHistory,
    };
  }
}

export const ingestionScheduler = new IngestionScheduler();
