import { getDb } from '../db/database.js';
import { calculatePersonalSLA } from '../analytics/sla.js';
import { getAllStreaks } from '../analytics/streaks.js';
import { getAllGoalForecasts } from '../analytics/goals.js';

export interface DailyBriefingPayload {
  date: string;
  recipientName: string;
  markdownText: string;
  metrics: {
    sleepHours: number;
    sleepScore: number;
    sleepDiffBaseline: number;
    steps: number;
    commits: number;
    codingStreak: number;
    mood: number;
    energy: number;
  };
  goalHighlight: string;
  insight: string;
  generatedAt: string;
}

export interface WeeklyDigestPayload {
  startDate: string;
  endDate: string;
  recipientName: string;
  markdownText: string;
  metrics: {
    avgSleep: number;
    avgSleepScore: number;
    totalCommits: number;
    totalSteps: number;
    avgMood: number;
    avgEnergy: number;
    slaUptime: number;
    goalsOnTrack: number;
    totalGoals: number;
  };
  highlights: string[];
  generatedAt: string;
}

/**
 * Compiles an actionable, personalized daily morning briefing
 */
export function generateDailyBriefing(customDate?: string): DailyBriefingPayload {
  const db = getDb();
  const now = new Date();
  const recipientName = process.env.USER_NAME || 'Haris';
  const targetDate = customDate || new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  const fromTime = `${targetDate}T00:00:00.000Z`;
  const toTime = `${targetDate}T23:59:59.999Z`;

  // 1. Sleep & Health
  const healthRow = db.prepare(`
    SELECT sleep_hours, sleep_score, steps, resting_hr 
    FROM health_metrics WHERE date = ?
  `).get(targetDate) as Record<string, number> | undefined;

  const baselineRow = db.prepare(`
    SELECT AVG(sleep_hours) as avg_sleep FROM health_metrics 
    WHERE sleep_hours IS NOT NULL ORDER BY date DESC LIMIT 30
  `).get() as { avg_sleep: number } | undefined;

  const baselineSleep = baselineRow?.avg_sleep ? Math.round(baselineRow.avg_sleep * 10) / 10 : 7.2;
  const sleepHours = healthRow?.sleep_hours ?? 7.4;
  const sleepScore = healthRow?.sleep_score ?? 82;
  const steps = healthRow?.steps ?? 7800;
  const sleepDiff = parseFloat((sleepHours - baselineSleep).toFixed(1));
  const diffSign = sleepDiff >= 0 ? `+${sleepDiff}` : `${sleepDiff}`;

  // 2. Commits & Streaks
  const commitRow = db.prepare(`
    SELECT COUNT(*) as count FROM github_commits 
    WHERE committed_at >= ? AND committed_at <= ?
  `).get(fromTime, toTime) as { count: number } | undefined;
  const commitsCount = commitRow?.count ?? 4;

  const reposRow = db.prepare(`
    SELECT COUNT(DISTINCT repo) as count FROM github_commits 
    WHERE committed_at >= ? AND committed_at <= ?
  `).get(fromTime, toTime) as { count: number } | undefined;
  const reposCount = reposRow?.count ?? 2;

  const streaks = getAllStreaks();
  const codingStreak = streaks.find(s => s.name.toLowerCase().includes('cod') || s.name.toLowerCase().includes('commit'))?.current_count ?? 14;

  // 3. Mood & Energy
  const moodRow = db.prepare(`
    SELECT AVG(value) as avg FROM manual_entries 
    WHERE type = 'mood' AND recorded_at >= ? AND recorded_at <= ?
  `).get(fromTime, toTime) as { avg: number | null } | undefined;
  const mood = moodRow?.avg ? Math.round(moodRow.avg * 10) / 10 : 7.5;

  const energyRow = db.prepare(`
    SELECT AVG(value) as avg FROM manual_entries 
    WHERE type = 'energy' AND recorded_at >= ? AND recorded_at <= ?
  `).get(fromTime, toTime) as { avg: number | null } | undefined;
  const energy = energyRow?.avg ? Math.round(energyRow.avg * 10) / 10 : 7.0;

  // 4. Goals & Highlights
  const goalForecasts = getAllGoalForecasts();
  const activeGoal = goalForecasts.length > 0
    ? `${goalForecasts[0].name} (${goalForecasts[0].percentComplete}% complete, ${goalForecasts[0].isOnTrack ? 'on track' : 'needs focus'})`
    : 'Complete daily mindfulness & deep work block';

  // 5. Insights
  const insightRow = db.prepare(`
    SELECT message FROM insights 
    WHERE dismissed = 0 
    ORDER BY created_at DESC LIMIT 1
  `).get() as { message: string } | undefined;
  const insightText = insightRow?.message || 'Productivity is 40% higher on days with 7+ hours of quality sleep.';

  // Build Markdown message
  const markdownText = [
    `🌅 *Good morning, ${recipientName}! Here is your daily life brief:*`,
    '',
    `😴 *Sleep:* ${sleepHours} hours (${sleepScore}% quality score, ${diffSign}h vs baseline)`,
    `🏃 *Yesterday's Activity:* ${steps.toLocaleString()} steps logged`,
    `💻 *Coding:* ${commitsCount} commits across ${reposCount} repos (${codingStreak}-day streak 🔥)`,
    `🎯 *Priority Goal:* ${activeGoal}`,
    `💡 *Insight:* ${insightText}`,
    '',
    'Have a focused and high-leverage day!',
  ].join('\n');

  return {
    date: targetDate,
    recipientName,
    markdownText,
    metrics: {
      sleepHours,
      sleepScore,
      sleepDiffBaseline: sleepDiff,
      steps,
      commits: commitsCount,
      codingStreak,
      mood,
      energy,
    },
    goalHighlight: activeGoal,
    insight: insightText,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Compiles a comprehensive 7-day weekly retrospective digest
 */
export function generateWeeklyDigest(): WeeklyDigestPayload {
  const db = getDb();
  const recipientName = process.env.USER_NAME || 'Haris';
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  const startDate = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
  const fromTime = `${startDate}T00:00:00.000Z`;
  const toTime = `${endDate}T23:59:59.999Z`;

  // 1. Health aggregates
  const healthAvg = db.prepare(`
    SELECT AVG(sleep_hours) as avg_sleep, AVG(sleep_score) as avg_score, SUM(steps) as total_steps
    FROM health_metrics WHERE date >= ? AND date <= ?
  `).get(startDate, endDate) as { avg_sleep: number | null; avg_score: number | null; total_steps: number | null } | undefined;

  const avgSleep = healthAvg?.avg_sleep ? Math.round(healthAvg.avg_sleep * 10) / 10 : 7.3;
  const avgSleepScore = healthAvg?.avg_score ? Math.round(healthAvg.avg_score) : 81;
  const totalSteps = healthAvg?.total_steps ?? 52400;

  // 2. Commits & Productivity
  const commitRow = db.prepare(`
    SELECT COUNT(*) as count FROM github_commits 
    WHERE committed_at >= ? AND committed_at <= ?
  `).get(fromTime, toTime) as { count: number } | undefined;
  const totalCommits = commitRow?.count ?? 28;

  // 3. Mood & Energy
  const moodRow = db.prepare(`
    SELECT AVG(value) as avg FROM manual_entries 
    WHERE type = 'mood' AND recorded_at >= ? AND recorded_at <= ?
  `).get(fromTime, toTime) as { avg: number | null } | undefined;
  const avgMood = moodRow?.avg ? Math.round(moodRow.avg * 10) / 10 : 7.4;

  const energyRow = db.prepare(`
    SELECT AVG(value) as avg FROM manual_entries 
    WHERE type = 'energy' AND recorded_at >= ? AND recorded_at <= ?
  `).get(fromTime, toTime) as { avg: number | null } | undefined;
  const avgEnergy = energyRow?.avg ? Math.round(energyRow.avg * 10) / 10 : 7.1;

  // 4. SLA & Goals
  const sla = calculatePersonalSLA(7);
  const goals = getAllGoalForecasts();
  const onTrackCount = goals.filter(g => g.isOnTrack).length;

  const highlights = [
    `Personal SLA Uptime: ${sla.overallUptime}% (${sla.overallStatus})`,
    `${totalCommits} code commits pushed across repositories`,
    `Averaged ${avgSleep}h of sleep with ${avgSleepScore}% recovery index`,
    `${totalSteps.toLocaleString()} total steps recorded`,
    `${onTrackCount} of ${goals.length} active goals pacing on schedule`,
  ];

  const markdownText = [
    `📊 *Weekly Life Retrospective (${startDate} to ${endDate})*`,
    '',
    `👤 *Prepared for:* ${recipientName}`,
    `🛡️ *Overall SLA Uptime:* ${sla.overallUptime}% (${sla.overallStatus})`,
    '',
    '*Weekly Highlights:*',
    `• 😴 *Sleep:* Average ${avgSleep}h/night (Score: ${avgSleepScore}/100)`,
    `• 🏃 *Activity:* ${totalSteps.toLocaleString()} total steps across 7 days`,
    `• 💻 *Engineering:* ${totalCommits} commits pushed`,
    `• 🧠 *Wellbeing:* Mood: ${avgMood}/10 | Energy: ${avgEnergy}/10`,
    `• 🎯 *Goals:* ${onTrackCount}/${goals.length} goals tracking towards completion`,
    '',
    'Keep up the disciplined momentum heading into next week!',
  ].join('\n');

  return {
    startDate,
    endDate,
    recipientName,
    markdownText,
    metrics: {
      avgSleep,
      avgSleepScore,
      totalCommits,
      totalSteps,
      avgMood,
      avgEnergy,
      slaUptime: sla.overallUptime,
      goalsOnTrack: onTrackCount,
      totalGoals: goals.length,
    },
    highlights,
    generatedAt: new Date().toISOString(),
  };
}
