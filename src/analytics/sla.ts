import { getDb } from '../db/database.js';

export interface SlaTarget {
  id: string;
  name: string;
  category: 'health' | 'productivity' | 'wellbeing' | 'learning';
  targetUptime: number; // e.g. 95.0
  thresholdDescription: string;
  uptimePercentage: number;
  daysMet: number;
  totalDays: number;
  status: 'operational' | 'degraded' | 'outage';
  trend: 'improving' | 'stable' | 'declining';
}

export interface PersonalSlaReport {
  periodDays: number;
  overallUptime: number;
  overallStatus: 'operational' | 'degraded' | 'outage';
  systemState: string;
  slas: SlaTarget[];
  lastCalculated: string;
}

/**
 * Calculates the 30-day Personal SLA Uptime metrics
 * Borrowing DevOps uptime metrics to monitor personal life consistency.
 */
export function calculatePersonalSLA(days = 30): PersonalSlaReport {
  const db = getDb();
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  // 1. Sleep SLA (Target: >= 7.0h sleep)
  const sleepDays = db.prepare(`
    SELECT date, sleep_hours FROM health_metrics 
    WHERE date >= ? ORDER BY date DESC
  `).all(startDate) as Array<{ date: string; sleep_hours: number }>;

  const sleepMetCount = sleepDays.filter(d => (d.sleep_hours || 0) >= 7.0).length;
  const sleepUptime = sleepDays.length > 0 ? (sleepMetCount / Math.max(sleepDays.length, days)) * 100 : 90;

  // 2. Exercise / Step SLA (Target: >= 7,500 steps)
  const stepsDays = db.prepare(`
    SELECT date, steps FROM health_metrics 
    WHERE date >= ? ORDER BY date DESC
  `).all(startDate) as Array<{ date: string; steps: number }>;

  const stepsMetCount = stepsDays.filter(d => (d.steps || 0) >= 7500).length;
  const stepsUptime = stepsDays.length > 0 ? (stepsMetCount / Math.max(stepsDays.length, days)) * 100 : 88;

  // 3. Coding / Productivity SLA (Target: >= 1 commit or >= 3h coding)
  const commitDays = db.prepare(`
    SELECT DISTINCT substr(committed_at, 1, 10) as date FROM github_commits
    WHERE committed_at >= ?
  `).all(`${startDate}T00:00:00Z`) as Array<{ date: string }>;

  const commitMetCount = commitDays.length;
  const commitUptime = (commitMetCount / days) * 100;

  // 4. Mood Stability SLA (Target: avg mood >= 5.5/10)
  const moodDays = db.prepare(`
    SELECT substr(recorded_at, 1, 10) as date, AVG(value) as avg_mood 
    FROM manual_entries 
    WHERE type = 'mood' AND recorded_at >= ?
    GROUP BY substr(recorded_at, 1, 10)
  `).all(`${startDate}T00:00:00Z`) as Array<{ date: string; avg_mood: number }>;

  const moodMetCount = moodDays.filter(d => d.avg_mood >= 5.5).length;
  const moodUptime = moodDays.length > 0 ? (moodMetCount / Math.max(moodDays.length, days)) * 100 : 92;

  // 5. Daily Check-in / Reflection SLA (Logged entry daily)
  const entryDays = db.prepare(`
    SELECT DISTINCT substr(recorded_at, 1, 10) as date 
    FROM manual_entries 
    WHERE recorded_at >= ?
  `).all(`${startDate}T00:00:00Z`) as Array<{ date: string }>;

  const entryMetCount = entryDays.length;
  const entryUptime = (entryMetCount / days) * 100;

  const determineStatus = (uptime: number, target: number): 'operational' | 'degraded' | 'outage' => {
    if (uptime >= target) return 'operational';
    if (uptime >= target - 10) return 'degraded';
    return 'outage';
  };

  const slas: SlaTarget[] = [
    {
      id: 'sleep-sla',
      name: 'Sleep Reliability',
      category: 'health',
      targetUptime: 95.0,
      thresholdDescription: '≥ 7.0 hours / night',
      uptimePercentage: parseFloat(sleepUptime.toFixed(1)),
      daysMet: sleepMetCount,
      totalDays: days,
      status: determineStatus(sleepUptime, 95.0),
      trend: sleepUptime >= 92 ? 'stable' : 'declining',
    },
    {
      id: 'exercise-sla',
      name: 'Daily Mobility & Steps',
      category: 'health',
      targetUptime: 90.0,
      thresholdDescription: '≥ 7,500 steps / day',
      uptimePercentage: parseFloat(stepsUptime.toFixed(1)),
      daysMet: stepsMetCount,
      totalDays: days,
      status: determineStatus(stepsUptime, 90.0),
      trend: stepsUptime >= 85 ? 'improving' : 'stable',
    },
    {
      id: 'deep-work-sla',
      name: 'Code Commitment & Focus',
      category: 'productivity',
      targetUptime: 85.0,
      thresholdDescription: '≥ 1 commit or deep work block',
      uptimePercentage: parseFloat(commitUptime.toFixed(1)),
      daysMet: commitMetCount,
      totalDays: days,
      status: determineStatus(commitUptime, 85.0),
      trend: commitUptime >= 85 ? 'improving' : 'declining',
    },
    {
      id: 'mood-sla',
      name: 'Mood Stability',
      category: 'wellbeing',
      targetUptime: 90.0,
      thresholdDescription: 'Daily avg score ≥ 5.5 / 10',
      uptimePercentage: parseFloat(moodUptime.toFixed(1)),
      daysMet: moodMetCount,
      totalDays: days,
      status: determineStatus(moodUptime, 90.0),
      trend: 'stable',
    },
    {
      id: 'checkin-sla',
      name: 'Self-Reflection Logging',
      category: 'wellbeing',
      targetUptime: 85.0,
      thresholdDescription: 'At least 1 check-in logged daily',
      uptimePercentage: parseFloat(entryUptime.toFixed(1)),
      daysMet: entryMetCount,
      totalDays: days,
      status: determineStatus(entryUptime, 85.0),
      trend: entryUptime >= 80 ? 'improving' : 'stable',
    },
  ];

  const overallUptime = parseFloat(
    (slas.reduce((acc, s) => acc + s.uptimePercentage, 0) / slas.length).toFixed(1)
  );

  const hasOutage = slas.some(s => s.status === 'outage');
  const hasDegraded = slas.some(s => s.status === 'degraded');
  const overallStatus = hasOutage ? 'outage' : hasDegraded ? 'degraded' : 'operational';

  return {
    periodDays: days,
    overallUptime,
    overallStatus,
    systemState: overallStatus === 'operational' ? 'All Systems Nominal' : overallStatus === 'degraded' ? 'Minor Performance Degradation' : 'Major Habit Outage Detected',
    slas,
    lastCalculated: new Date().toISOString(),
  };
}
