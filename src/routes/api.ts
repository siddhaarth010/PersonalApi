import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  connectorManager,
  GitHubConnector,
  SpotifyConnector,
  ManualEntryConnector,
  HealthConnector,
  WakaTimeConnector,
  CalendarConnector,
  ReadwiseConnector,
} from '../connectors/index.js';
import { ingestionScheduler } from '../scheduler/index.js';
import { calculatePersonalSLA } from '../analytics/sla.js';
import { updateStreak, getAllStreaks } from '../analytics/streaks.js';
import { runCorrelationEngine } from '../analytics/correlations.js';
import { runAnomalyDetector } from '../analytics/anomalies.js';
import { getAllGoalForecasts } from '../analytics/goals.js';
import { askPersonalAI } from '../ai/agent.js';
import { generateDailyBriefing, generateWeeklyDigest } from '../notifications/briefing.js';
import { dispatchBriefing } from '../notifications/dispatcher.js';
import { handleTelegramWebhook } from '../bot/telegram.js';
import { generatePdfReport, generateHtmlReport, generateLifeWrapped } from '../reports/pdf.js';
import { executeSecurePrivacyWipe } from '../utils/crypto.js';
import { calculateFragmentationScore, logEnergyTransaction, getEnergyAccountingSummary } from '../analytics/energy.js';
import { getLifeChangelog, recordDailyLifeCommit } from '../analytics/lifeCommits.js';
import { getOnThisDayCapsule, analyzePeakPeriods, compareHistoricalHorizons } from '../analytics/archaeology.js';
import { openApiSpec, getSwaggerHtml } from '../docs/openapi.js';
import { getDb } from '../db/database.js';

const router = Router();

const github = connectorManager.get<GitHubConnector>('github')!;
const spotify = connectorManager.get<SpotifyConnector>('spotify')!;
const manual = connectorManager.get<ManualEntryConnector>('manual')!;
const health = connectorManager.get<HealthConnector>('health')!;
const wakatime = connectorManager.get<WakaTimeConnector>('wakatime')!;
const calendar = connectorManager.get<CalendarConnector>('google_calendar')!;
const readwise = connectorManager.get<ReadwiseConnector>('readwise')!;

// ============================================================
// Interactive OpenAPI / Swagger Documentation
// ============================================================
router.get('/docs', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(getSwaggerHtml());
});

router.get('/docs/json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// ============================================================
// GET /api/v1/me — The Crown Jewel
// Returns a complete life snapshot across all domains
// ============================================================
router.get('/me', (req: Request, res: Response) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const githubSummary = github.getSummary(from, to);
  const spotifySummary = spotify.getSummary(from, to);
  const manualSummary = manual.getSummary(from, to);
  const healthSummary = health.getSummary(from, to);
  const wakatimeSummary = wakatime.getSummary(from, to);
  const calendarSummary = calendar.getSummary(from, to);
  const readwiseSummary = readwise.getSummary(from, to);
  const slaReport = calculatePersonalSLA(30);

  const db = getDb();

  // Get active goals
  const goals = db.prepare(`
    SELECT id, name, description, target_value, current_value, unit, period, status 
    FROM goals WHERE status = 'active'
  `).all();

  // Get recent insights
  const insights = db.prepare(`
    SELECT id, type, message, severity, confidence, created_at 
    FROM insights WHERE dismissed = 0 
    ORDER BY created_at DESC LIMIT 5
  `).all();

  // Get all streaks with status computation
  const streaks = getAllStreaks();

  // Get registered sources and statuses
  const sources = connectorManager.getStatusAll();

  res.json({
    timestamp: new Date().toISOString(),
    today: {
      productivity: {
        commits: githubSummary.commits_today,
        recent_commits: githubSummary.recent_commits,
        active_repos: githubSummary.active_repos,
        top_languages: githubSummary.top_languages,
        coding_hours: wakatimeSummary.coding_hours,
        projects: wakatimeSummary.projects,
        meeting_count: calendarSummary.meeting_count,
        meeting_minutes: calendarSummary.meeting_minutes,
        focus_minutes: calendarSummary.focus_minutes,
      },
      wellbeing: {
        mood: manualSummary.mood,
        energy: manualSummary.energy,
        recent_entries: manualSummary.recent_entries,
      },
      media: {
        recent_tracks: spotifySummary.recent_tracks,
        top_artists: spotifySummary.top_artists,
        total_tracks_played: spotifySummary.total_tracks_played,
      },
      health: healthSummary.today,
      learning: {
        pages_read_today: readwiseSummary.pages_read_today,
        reading_streak_days: readwiseSummary.reading_streak_days,
        active_books: readwiseSummary.active_books,
      },
    },
    streaks,
    goals,
    insights,
    sources,
    sla: {
      overall_uptime: slaReport.overallUptime,
      overall_status: slaReport.overallStatus,
      system_state: slaReport.systemState,
      slas: slaReport.slas,
    },
    health_trends: healthSummary.trends,
  });
});

// ============================================================
// GET /api/v1/me/summary — Quick summary for a period
// ============================================================
router.get('/me/summary', (req: Request, res: Response) => {
  const period = (req.query.period as string) || 'today';
  const db = getDb();

  let from: string;
  const now = new Date();

  switch (period) {
    case 'week':
      from = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
      break;
    case 'month':
      from = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
      break;
    case 'year':
      from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      break;
    default: // today
      from = now.toISOString().split('T')[0];
  }

  const to = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

  const commitCount = db.prepare(`
    SELECT COUNT(*) as count FROM github_commits WHERE committed_at >= ? AND committed_at < ?
  `).get(from, to) as any;

  const trackCount = db.prepare(`
    SELECT COUNT(*) as count FROM spotify_recent_tracks WHERE played_at >= ? AND played_at < ?
  `).get(from, to) as any;

  const moodAvg = db.prepare(`
    SELECT AVG(value) as avg FROM manual_entries WHERE type = 'mood' AND recorded_at >= ? AND recorded_at < ?
  `).get(from, to) as any;

  const energyAvg = db.prepare(`
    SELECT AVG(value) as avg FROM manual_entries WHERE type = 'energy' AND recorded_at >= ? AND recorded_at < ?
  `).get(from, to) as any;

  const entryCount = db.prepare(`
    SELECT COUNT(*) as count FROM manual_entries WHERE recorded_at >= ? AND recorded_at < ?
  `).get(from, to) as any;

  const healthAvg = db.prepare(`
    SELECT AVG(sleep_hours) as avg_sleep, AVG(sleep_score) as avg_sleep_score, AVG(steps) as avg_steps
    FROM health_metrics WHERE date >= ? AND date <= ?
  `).get(from, to) as any;

  res.json({
    period,
    from,
    to,
    summary: {
      commits: commitCount?.count || 0,
      tracks_played: trackCount?.count || 0,
      avg_mood: moodAvg?.avg ? Math.round(moodAvg.avg * 10) / 10 : null,
      avg_energy: energyAvg?.avg ? Math.round(energyAvg.avg * 10) / 10 : null,
      avg_sleep_hours: healthAvg?.avg_sleep ? Math.round(healthAvg.avg_sleep * 10) / 10 : null,
      avg_sleep_score: healthAvg?.avg_sleep_score ? Math.round(healthAvg.avg_sleep_score) : null,
      avg_steps: healthAvg?.avg_steps ? Math.round(healthAvg.avg_steps) : null,
      total_entries: entryCount?.count || 0,
    },
  });
});

// ============================================================
// Personal SLA Analytics Route
// ============================================================
router.get('/analytics/sla', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  res.json(calculatePersonalSLA(days));
});

router.get('/analytics/correlations', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const correlations = runCorrelationEngine(days);
  res.json({ correlations, total: correlations.length });
});

router.get('/analytics/anomalies', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const anomalies = runAnomalyDetector(days);
  res.json({ anomalies, total: anomalies.length });
});

// ============================================================
// Wearable Health Routes
// ============================================================
router.get('/health-metrics', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 30;
  res.json({
    metrics: health.getHistory(limit),
    summary: health.getSummary(),
  });
});

router.get('/health-metrics/today', (_req: Request, res: Response) => {
  res.json(health.getSummary());
});

router.post('/health-metrics', (req: Request, res: Response) => {
  const {
    date,
    sleep_hours,
    deep_sleep_hours,
    rem_sleep_hours,
    sleep_score,
    resting_hr,
    hrv_rmssd,
    steps,
    active_calories,
    source,
    raw_json,
  } = req.body;

  const record = health.ingestMetric({
    date,
    sleep_hours: sleep_hours !== undefined ? Number(sleep_hours) : undefined,
    deep_sleep_hours: deep_sleep_hours !== undefined ? Number(deep_sleep_hours) : undefined,
    rem_sleep_hours: rem_sleep_hours !== undefined ? Number(rem_sleep_hours) : undefined,
    sleep_score: sleep_score !== undefined ? Number(sleep_score) : undefined,
    resting_hr: resting_hr !== undefined ? Number(resting_hr) : undefined,
    hrv_rmssd: hrv_rmssd !== undefined ? Number(hrv_rmssd) : undefined,
    steps: steps !== undefined ? Number(steps) : undefined,
    active_calories: active_calories !== undefined ? Number(active_calories) : undefined,
    source,
    raw_json,
  });

  res.status(201).json(record);
});

// ============================================================
// GitHub Routes
// ============================================================
router.get('/productivity/code', (req: Request, res: Response) => {
  const from = req.query.from as string;
  const to = req.query.to as string;
  res.json(github.getSummary(from, to));
});

router.get('/productivity/code/repos', (_req: Request, res: Response) => {
  const db = getDb();
  const repos = db.prepare(`
    SELECT * FROM github_repos ORDER BY updated_at DESC
  `).all();
  res.json({ repos, total: repos.length });
});

router.get('/productivity/code/commits', (req: Request, res: Response) => {
  const db = getDb();
  const limit = parseInt(req.query.limit as string) || 50;
  const from = req.query.from as string;

  let query = 'SELECT * FROM github_commits';
  const params: any[] = [];

  if (from) {
    query += ' WHERE committed_at >= ?';
    params.push(from);
  }

  query += ' ORDER BY committed_at DESC LIMIT ?';
  params.push(limit);

  const commits = db.prepare(query).all(...params);
  res.json({ commits, total: commits.length });
});

// ============================================================
// Secondary Connectors Routes (WakaTime, Calendar, Readwise)
// ============================================================
router.get('/productivity/wakatime', (_req: Request, res: Response) => {
  res.json(wakatime.getSummary());
});

router.get('/productivity/calendar', (_req: Request, res: Response) => {
  res.json(calendar.getSummary());
});

router.get('/learning/readwise', (_req: Request, res: Response) => {
  res.json(readwise.getSummary());
});

// ============================================================
// Spotify Routes
// ============================================================
router.get('/media/music', (req: Request, res: Response) => {
  const from = req.query.from as string;
  const to = req.query.to as string;
  res.json(spotify.getSummary(from, to));
});

router.get('/media/music/recent', (req: Request, res: Response) => {
  const db = getDb();
  const limit = parseInt(req.query.limit as string) || 30;
  const tracks = db.prepare(`
    SELECT * FROM spotify_recent_tracks ORDER BY played_at DESC LIMIT ?
  `).all(limit);
  res.json({ tracks, total: tracks.length });
});

router.get('/media/music/top', (req: Request, res: Response) => {
  const db = getDb();
  const type = (req.query.type as string) || 'artist';
  const timeRange = (req.query.time_range as string) || 'short_term';

  const items = db.prepare(`
    SELECT * FROM spotify_top_items 
    WHERE type = ? AND time_range = ?
    ORDER BY rank ASC
  `).all(type, timeRange);

  res.json({ items, type, time_range: timeRange });
});

// ============================================================
// Manual Entry Routes
// ============================================================
router.post('/entries', (req: Request, res: Response) => {
  const { type, value, label, notes, tags, recorded_at } = req.body;

  if (!type || value === undefined) {
    res.status(400).json({ error: 'type and value are required' });
    return;
  }

  // Validate mood/energy range
  if ((type === 'mood' || type === 'energy') && (value < 1 || value > 10)) {
    res.status(400).json({ error: `${type} must be between 1 and 10` });
    return;
  }

  const entry = manual.addEntry({ type, value, label, notes, tags, recorded_at });
  updateStreak(type);

  res.status(201).json(entry);
});

router.post('/entries/batch', (req: Request, res: Response) => {
  const { entries } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: 'entries array is required' });
    return;
  }

  const results = manual.addBatch(entries);
  res.status(201).json({ created: results.length, entries: results });
});

router.get('/entries', (req: Request, res: Response) => {
  const type = req.query.type as string;
  const from = req.query.from as string;
  const to = req.query.to as string;
  const limit = parseInt(req.query.limit as string) || 50;

  const entries = manual.getEntries(type, from, to, limit);
  res.json({ entries, total: entries.length });
});

router.get('/entries/averages/:type', (req: Request, res: Response) => {
  const type = String(req.params.type);
  const from = req.query.from as string;
  const to = req.query.to as string;

  const averages = manual.getAverages(type, from, to);
  res.json(averages);
});

router.delete('/entries/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const deleted = manual.deleteEntry(id);
  if (!deleted) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }
  res.json({ deleted: true });
});

// ============================================================
// Inbound Webhook Listener
// ============================================================
router.post('/webhooks/:source', (req: Request, res: Response) => {
  const source = String(req.params.source);
  const payload = req.body;
  const db = getDb();
  const eventId = uuidv4();
  const recordedAt = new Date().toISOString();

  // 1. Audit trail in raw_events
  db.prepare(`
    INSERT INTO raw_events (id, source_id, event_type, payload, recorded_at)
    VALUES (?, ?, 'webhook_push', ?, ?)
  `).run(eventId, source, JSON.stringify(payload), recordedAt);

  // 2. Auto-dispatch recognizable metric payloads
  let recognizedType: string | null = null;
  if (payload.type && payload.value !== undefined) {
    manual.addEntry({
      type: payload.type,
      value: Number(payload.value),
      label: payload.label || `Webhook from ${source}`,
      notes: payload.notes,
      tags: payload.tags || ['webhook', source],
      recorded_at: payload.recorded_at || recordedAt,
    });
    updateStreak(payload.type);
    recognizedType = payload.type;
  } else if (payload.sleep_hours !== undefined || payload.steps !== undefined) {
    health.ingestMetric({
      date: payload.date,
      sleep_hours: payload.sleep_hours !== undefined ? Number(payload.sleep_hours) : undefined,
      deep_sleep_hours: payload.deep_sleep_hours !== undefined ? Number(payload.deep_sleep_hours) : undefined,
      rem_sleep_hours: payload.rem_sleep_hours !== undefined ? Number(payload.rem_sleep_hours) : undefined,
      sleep_score: payload.sleep_score !== undefined ? Number(payload.sleep_score) : undefined,
      resting_hr: payload.resting_hr !== undefined ? Number(payload.resting_hr) : undefined,
      hrv_rmssd: payload.hrv_rmssd !== undefined ? Number(payload.hrv_rmssd) : undefined,
      steps: payload.steps !== undefined ? Number(payload.steps) : undefined,
      active_calories: payload.active_calories !== undefined ? Number(payload.active_calories) : undefined,
      source: source || 'webhook',
      raw_json: payload,
    });
    recognizedType = 'health';
  }

  res.status(202).json({
    status: 'accepted',
    event_id: eventId,
    source,
    recognized_type: recognizedType,
    recorded_at: recordedAt,
  });
});

router.get('/webhooks/history', (req: Request, res: Response) => {
  const db = getDb();
  const limit = parseInt(req.query.limit as string) || 20;
  const events = db.prepare(`
    SELECT * FROM raw_events 
    WHERE event_type = 'webhook_push'
    ORDER BY recorded_at DESC LIMIT ?
  `).all(limit);
  res.json({ events, total: events.length });
});

// ============================================================
// Streaks
// ============================================================
router.get('/streaks', (_req: Request, res: Response) => {
  res.json({ streaks: getAllStreaks() });
});

// ============================================================
// Goals
// ============================================================
router.get('/goals', (_req: Request, res: Response) => {
  const db = getDb();
  const goals = db.prepare('SELECT * FROM goals ORDER BY created_at DESC').all();
  res.json({ goals });
});

router.post('/goals', (req: Request, res: Response) => {
  const { name, description, target_value, unit, period } = req.body;

  if (!name || !target_value || !unit) {
    res.status(400).json({ error: 'name, target_value, and unit are required' });
    return;
  }

  const db = getDb();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO goals (id, name, description, target_value, unit, period)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, description || '', target_value, unit, period || 'monthly');

  res.status(201).json({ id, name, target_value, unit, period: period || 'monthly' });
});

router.patch('/goals/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { current_value, status } = req.body;
  const db = getDb();

  if (current_value !== undefined) {
    db.prepare("UPDATE goals SET current_value = ?, updated_at = datetime('now') WHERE id = ?").run(current_value, id);
  }
  if (status) {
    db.prepare("UPDATE goals SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  }

  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
  if (!goal) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }
  res.json(goal);
});

router.get('/goals/forecasts', (_req: Request, res: Response) => {
  const forecasts = getAllGoalForecasts();
  res.json({ forecasts, total: forecasts.length });
});

// ============================================================
// Data Sources Management & Manual Sync Triggers
// ============================================================
router.get('/sources', (_req: Request, res: Response) => {
  res.json({ sources: connectorManager.getStatusAll() });
});

router.post('/sources/:id/sync', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const connector = connectorManager.get(id);

  if (!connector) {
    res.status(404).json({ error: `Unknown source connector: ${id}` });
    return;
  }

  try {
    const result = await connector.sync();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ source: id, success: false, error: err.message });
  }
});

// Sync ALL registered sources simultaneously
router.post('/sources/sync-all', async (_req: Request, res: Response) => {
  const results = await connectorManager.syncAll();
  res.json({ results });
});

// ============================================================
// Ingestion Scheduler & Queue Status
// ============================================================
router.get('/scheduler/status', (_req: Request, res: Response) => {
  res.json(ingestionScheduler.getStatus());
});

router.post('/scheduler/rollup', async (_req: Request, res: Response) => {
  const result = await ingestionScheduler.calculateDailyRollup();
  res.json({ success: true, rollup: result });
});

// ============================================================
// Spotify OAuth Routes
// ============================================================
router.get('/auth/spotify', (_req: Request, res: Response) => {
  if (!spotify.isConfigured()) {
    res.status(400).json({
      error: 'Spotify not configured',
      message: 'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your .env file',
    });
    return;
  }
  res.redirect(spotify.getAuthUrl());
});

router.get('/auth/spotify/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    res.status(400).json({ error: `Spotify auth denied: ${error}` });
    return;
  }

  if (!code) {
    res.status(400).json({ error: 'No authorization code received' });
    return;
  }

  try {
    await spotify.handleCallback(code);
    res.redirect('http://localhost:5173?spotify=connected');
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Insights
// ============================================================
router.get('/insights', (req: Request, res: Response) => {
  const db = getDb();
  const type = req.query.type as string;
  const includeDismissed = req.query.include_dismissed === 'true';

  let query = 'SELECT * FROM insights WHERE 1=1';
  const params: any[] = [];

  if (!includeDismissed) {
    query += ' AND dismissed = 0';
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC LIMIT 20';

  const insights = db.prepare(query).all(...params);
  res.json({ insights });
});

router.patch('/insights/:id/dismiss', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const db = getDb();
  db.prepare('UPDATE insights SET dismissed = 1 WHERE id = ?').run(id);
  res.json({ dismissed: true });
});

router.post('/insights/ask', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'query parameter is required' });
    return;
  }
  const answer = await askPersonalAI(query);
  res.json(answer);
});

// ============================================================
// Automated Briefings & Notification Dispatcher
// ============================================================
router.get('/briefings/today', (req: Request, res: Response) => {
  const date = req.query.date as string | undefined;
  const briefing = generateDailyBriefing(date);
  res.json(briefing);
});

router.get('/briefings/weekly', (_req: Request, res: Response) => {
  const digest = generateWeeklyDigest();
  res.json(digest);
});

router.post('/briefings/dispatch', async (req: Request, res: Response) => {
  const { channel, text, date } = req.body;
  const content = text || generateDailyBriefing(date).markdownText;
  const result = await dispatchBriefing(content, channel);
  res.json(result);
});

// ============================================================
// Telegram Bot Webhook & Integration
// ============================================================
router.post('/bot/telegram/webhook', async (req: Request, res: Response) => {
  const result = await handleTelegramWebhook(req.body);
  res.json(result);
});

router.get('/bot/telegram/status', (_req: Request, res: Response) => {
  const isConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'demo_token');
  res.json({
    configured: isConfigured,
    chat_id_configured: Boolean(process.env.TELEGRAM_CHAT_ID),
  });
});

// ============================================================
// Life Commits & Personal Changelog (Step 16)
// ============================================================
router.get('/life-commits', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 30;
  const commits = getLifeChangelog(limit);
  res.json({ commits, total: commits.length });
});

router.post('/life-commits', (req: Request, res: Response) => {
  const date = req.body?.date as string | undefined;
  const commit = recordDailyLifeCommit(date);
  res.status(201).json(commit);
});

// ============================================================
// Executive Reports & Annual Life Wrapped Export
// ============================================================
router.get('/export/report', async (req: Request, res: Response) => {
  const period = (req.query.period as 'week' | 'month' | 'year') || 'week';
  const format = (req.query.format as string) || 'pdf';

  if (format === 'html') {
    res.setHeader('Content-Type', 'text/html');
    res.send(generateHtmlReport(period));
    return;
  }

  if (format === 'pdf') {
    const pdfBuffer = await generatePdfReport(period);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="executive-life-report-${period}.pdf"`);
    res.send(pdfBuffer);
    return;
  }

  res.status(400).json({ error: 'Unsupported format. Use format=pdf or format=html' });
});

router.get('/export/life-wrapped', (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string) || 2026;
  const wrapped = generateLifeWrapped(year);
  res.json(wrapped);
});

// ============================================================
// Cryptographic Zero-Fill Privacy Wipe
// ============================================================
router.post('/privacy/wipe', (req: Request, res: Response) => {
  const { confirm } = req.body;
  if (confirm !== 'PERMANENT_WIPE') {
    res.status(400).json({
      error: 'Confirmation required',
      message: 'To permanently wipe personal data, send { confirm: "PERMANENT_WIPE" }',
    });
    return;
  }

  const result = executeSecurePrivacyWipe();
  res.json(result);
});

// ============================================================
// Context-Switching & Energy Accounting (Step 21)
// ============================================================
router.get('/analytics/fragmentation', (req: Request, res: Response) => {
  const date = req.query.date as string | undefined;
  const report = calculateFragmentationScore(date);
  res.json(report);
});

router.post('/analytics/energy-transactions', (req: Request, res: Response) => {
  const { activity, impact, category, tags } = req.body;
  if (!activity || impact === undefined) {
    res.status(400).json({ error: 'activity and impact (-5 to +5) are required' });
    return;
  }
  const transaction = logEnergyTransaction(activity, Number(impact), category, tags);
  res.status(201).json(transaction);
});

router.get('/analytics/energy-accounting', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 14;
  const summary = getEnergyAccountingSummary(days);
  res.json(summary);
});

// ============================================================
// Data Archaeology & Retrospective Engine (Step 22)
// ============================================================
router.get('/archaeology/on-this-day', (req: Request, res: Response) => {
  const date = req.query.date as string | undefined;
  const memories = getOnThisDayCapsule(date);
  res.json({ memories, total: memories.length });
});

router.get('/archaeology/peaks', (req: Request, res: Response) => {
  const metric = (req.query.metric as 'mood' | 'productivity' | 'energy') || 'mood';
  const top = parseInt(req.query.top as string) || 7;
  const analysis = analyzePeakPeriods(metric, top);
  res.json(analysis);
});

router.get('/archaeology/compare', (req: Request, res: Response) => {
  const fromA = (req.query.fromA as string) || '2026-10-01';
  const toA = (req.query.toA as string) || '2026-10-07';
  const labelA = (req.query.labelA as string) || 'Period A';

  const fromB = (req.query.fromB as string) || '2026-10-08';
  const toB = (req.query.toB as string) || '2026-10-14';
  const labelB = (req.query.labelB as string) || 'Period B';

  const comparison = compareHistoricalHorizons(
    { from: fromA, to: toA, label: labelA },
    { from: fromB, to: toB, label: labelB }
  );
  res.json(comparison);
});

// ============================================================
// System Health check
// ============================================================
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

export default router;
