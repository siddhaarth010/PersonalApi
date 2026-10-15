# ⚠️ Step 12: Anomaly Detection Engine

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented (Rolling Z-Score Anomaly Detector & Personal Baseline Engine)  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
Detect deviations from personal baselines (not arbitrary population norms, but *your* personal rolling historical norms) to proactively warn about burnout, excessive screen time, or habit drop-offs.

---

## 📊 Statistical Method: Rolling Z-Score

For any metric $x$ on date $t$:

$$Z = \frac{x_t - \mu_{30}}{\sigma_{30}}$$

Where:
- $\mu_{30}$: Mean of metric over past 30 days.
- $\sigma_{30}$: Standard deviation over past 30 days.
- **Severity Flagging**:
  - $|Z| \ge 2.0$: **Warning** (Anomaly top ~5% rarity).
  - $|Z| \ge 3.0$: **Critical Alert** (Extreme outlier ~0.3% rarity).

---

## 🏗️ Anomaly Rule Examples

| Condition | Message | Severity |
|---|---|---|
| Screen Time $Z > 2.2$ | *"Screen time jumped to 11.2h (your baseline is 6.4h)."* | Warning |
| Commits $= 0$ for 4 days | *"Zero commits logged in 4 days (average is 1.2/day)."* | Warning |
| Sleep Duration $Z < -2.5$ | *"Sleep dropped below 5.2h for 2 consecutive nights."* | Critical |
| Mood $< 4$ for 2 days | *"Mood score dropped below 4 twice this week — unusual for you."* | Warning |

---

## 💻 Implementation (`src/analytics/anomalies.ts`)

```typescript
export function calculateBaseline(values: number[]): MetricBaseline | null;
export function detectMetricAnomaly(metricName: string, currentValue: number, history: number[]): AnomalyAlert | null;
export function runAnomalyDetector(days = 30): AnomalyAlert[];
```

---

## 🧪 Verification & Checklist
- [x] Implement rolling mean and standard deviation utilities.
- [x] Test with spiked inputs ($Z > 2.5$) and verify anomaly record generation.
- [x] Insert anomalies into `insights` table with `severity: 'warning'`.
- [x] Ensure alert appears with warning styling on the Dashboard.

---

## 🔮 Advanced Enhancements & Additions

### 1. Day-of-Week Seasonality Normalization
Prevent false-positive alerts on natural weekend vs weekday rhythm shifts:
- Calculate two separate baselines: **Weekday Baseline** (Mon–Fri) and **Weekend Baseline** (Sat–Sun).
- Zero commits or late wakeups on Sunday should not trigger a productivity anomaly warning.
- High screen time on Saturday night movie watching is benchmarked against Saturday norms, not Tuesday workday norms.

### 2. Multi-Metric Compound Burnout Index
Single outliers are common, but compound metric divergences indicate impending burnout:
```typescript
export interface BurnoutRiskAssessment {
  riskLevel: 'nominal' | 'elevated' | 'critical';
  riskScore: number; // 0 - 100
  contributingFactors: string[];
  recommendation: string;
}

export function evaluateBurnoutRisk(recentHistory: DayMetrics[]): BurnoutRiskAssessment {
  // Evaluates simultaneously:
  // 1. Resting Heart Rate trending upward (+5 bpm over baseline)
  // 2. HRV trending downward (-15% over baseline)
  // 3. Meeting load > 25 hrs/week
  // 4. Consecutive sleep duration < 6.5 hrs
}
```

### 3. Adaptive Z-Score Threshold Sensitivity
Allow the user to dial alert thresholds:
- Conservative (only alert when $|Z| > 3.0$ — ~0.3% rarity).
- Sensitive (alert when $|Z| > 1.8$ — ~7% rarity, early indicator mode).

