import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';

export interface AnomalyAlert {
  id: string;
  metric: string;
  currentValue: number;
  baselineMean: number;
  stdDev: number;
  zScore: number;
  severity: 'warning' | 'critical' | 'info';
  message: string;
  recommendation?: string;
  detectedAt: string;
}

export interface MetricBaseline {
  metric: string;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  sampleSize: number;
}

/**
 * Calculates rolling baseline statistics (mean, variance, standard deviation)
 */
export function calculateBaseline(values: number[]): MetricBaseline | null {
  if (values.length < 5) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    metric: '',
    mean: parseFloat(mean.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    min: Math.min(...values),
    max: Math.max(...values),
    sampleSize: values.length,
  };
}

/**
 * Evaluates whether a current data point deviates significantly from personal baseline
 */
export function detectMetricAnomaly(
  metricName: string,
  currentValue: number,
  history: number[],
  customMessageTemplate?: (z: number, curr: number, mean: number) => string
): AnomalyAlert | null {
  const baseline = calculateBaseline(history);
  if (!baseline || baseline.stdDev === 0) return null;

  const zScore = (currentValue - baseline.mean) / baseline.stdDev;
  const absZ = Math.abs(zScore);

  if (absZ >= 1.8) {
    const severity: 'warning' | 'critical' = absZ >= 2.8 ? 'critical' : 'warning';
    const direction = zScore > 0 ? 'spiked above' : 'dropped below';

    let message = customMessageTemplate
      ? customMessageTemplate(zScore, currentValue, baseline.mean)
      : `${metricName} ${direction} your personal baseline (${currentValue} vs 30-day mean of ${baseline.mean}, Z = ${zScore.toFixed(1)}).`;

    let recommendation: string | undefined;
    if (metricName.toLowerCase().includes('sleep') && zScore < 0) {
      recommendation = 'Prioritize an early wind-down routine tonight. Chronic sleep deficits reduce cognitive output by 30%.';
    } else if (metricName.toLowerCase().includes('mood') && zScore < 0) {
      recommendation = 'Take a 20-minute outdoor walk or take a break from screen time to reset.';
    }

    return {
      id: uuidv4(),
      metric: metricName,
      currentValue,
      baselineMean: baseline.mean,
      stdDev: baseline.stdDev,
      zScore: parseFloat(zScore.toFixed(2)),
      severity,
      message,
      recommendation,
      detectedAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Runs anomaly detection across today's telemetry vs past 30 days
 */
export function runAnomalyDetector(days = 30): AnomalyAlert[] {
  const db = getDb();
  const alerts: AnomalyAlert[] = [];

  // 1. Sleep Duration Anomaly
  const sleepHistory = db.prepare(`
    SELECT sleep_hours FROM health_metrics 
    WHERE sleep_hours IS NOT NULL ORDER BY date DESC LIMIT ?
  `).all(days) as Array<{ sleep_hours: number }>;

  if (sleepHistory.length >= 7) {
    const todaySleep = sleepHistory[0]?.sleep_hours;
    const pastSleep = sleepHistory.slice(1).map(s => s.sleep_hours);
    const alert = detectMetricAnomaly('Sleep Duration', todaySleep, pastSleep, (z, curr, mean) =>
      z < 0
        ? `Sleep dropped to ${curr}h (your personal 30-day baseline is ${mean}h, Z = ${z.toFixed(1)}).`
        : `Longer sleep logged: ${curr}h vs your usual ${mean}h baseline.`
    );
    if (alert) alerts.push(alert);
  }

  // 2. Resting Heart Rate Anomaly
  const rhrHistory = db.prepare(`
    SELECT resting_hr FROM health_metrics 
    WHERE resting_hr IS NOT NULL AND resting_hr > 0 ORDER BY date DESC LIMIT ?
  `).all(days) as Array<{ resting_hr: number }>;

  if (rhrHistory.length >= 7) {
    const todayRhr = rhrHistory[0]?.resting_hr;
    const pastRhr = rhrHistory.slice(1).map(r => r.resting_hr);
    const alert = detectMetricAnomaly('Resting Heart Rate', todayRhr, pastRhr, (z, curr, mean) =>
      z > 0
        ? `Resting HR elevated to ${curr} bpm (${(curr - mean).toFixed(0)} bpm above baseline). Potential fatigue or illness indicator.`
        : `Resting HR is low and healthy at ${curr} bpm (${mean} bpm baseline).`
    );
    if (alert) alerts.push(alert);
  }

  // 3. Mood Drop Anomaly
  const moodHistory = db.prepare(`
    SELECT value FROM manual_entries 
    WHERE type = 'mood' ORDER BY recorded_at DESC LIMIT ?
  `).all(days) as Array<{ value: number }>;

  if (moodHistory.length >= 7) {
    const recentMood = moodHistory[0]?.value;
    const pastMood = moodHistory.slice(1).map(m => m.value);
    const alert = detectMetricAnomaly('Mood Rating', recentMood, pastMood, (z, curr, mean) =>
      z < 0
        ? `Mood score dropped to ${curr}/10 (usual baseline is ${mean}/10).`
        : `Mood score elevated to ${curr}/10!`
    );
    if (alert) alerts.push(alert);
  }

  // 4. Inactivity / Steps Drop Anomaly
  const stepsHistory = db.prepare(`
    SELECT steps FROM health_metrics 
    WHERE steps IS NOT NULL ORDER BY date DESC LIMIT ?
  `).all(days) as Array<{ steps: number }>;

  if (stepsHistory.length >= 7) {
    const todaySteps = stepsHistory[0]?.steps;
    const pastSteps = stepsHistory.slice(1).map(s => s.steps);
    const alert = detectMetricAnomaly('Daily Steps', todaySteps, pastSteps, (z, curr, mean) =>
      z < -1.8
        ? `Daily step count unusually low (${curr.toLocaleString()} steps vs ${Math.round(mean).toLocaleString()} baseline).`
        : `High activity recorded: ${curr.toLocaleString()} steps!`
    );
    if (alert) alerts.push(alert);
  }

  // Persist anomalies into insights table
  for (const alert of alerts) {
    const existing = db.prepare("SELECT id FROM insights WHERE message = ? AND type = 'anomaly'").get(alert.message);
    if (!existing) {
      db.prepare(`
        INSERT INTO insights (id, type, message, severity, confidence, data_json, created_at)
        VALUES (?, 'anomaly', ?, ?, 0.92, ?, datetime('now'))
      `).run(alert.id, alert.message, alert.severity, JSON.stringify(alert));
    }
  }

  return alerts;
}
