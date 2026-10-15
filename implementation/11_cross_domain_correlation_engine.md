# 🧠 Step 11: Cross-Domain Correlation Engine

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented (Pearson & Spearman Correlation Engine & Discovery Pipeline)  
> **Estimated Time:** 3–4 hours

---

## 🎯 Objective
Transform raw data into genuine intelligence by running statistical correlation algorithms across disparate life domains (e.g., Sleep vs Productivity, Spotify Tempo vs Coding Commits, Meeting Volume vs Mood).

---

## 📐 Mathematical Formulation

### 1. Pearson Correlation Coefficient ($r$)
Measures linear correlation between two continuous metric series $X$ and $Y$:

$$r = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum (x_i - \bar{x})^2 \sum (y_i - \bar{y})^2}}$$

Where:
- $r > +0.6$: Strong positive correlation (e.g., Higher sleep $\rightarrow$ More commits).
- $r < -0.6$: Strong inverse correlation (e.g., More meetings $\rightarrow$ Lower deep sleep).
- Statistical Significance: Calculate two-tailed p-value; only accept when $p < 0.05$.

---

## 🏗️ Implementation (`src/analytics/correlations.ts`)

```typescript
export interface CorrelationDiscovery {
  metricA: string;
  metricB: string;
  coefficient: number;
  sampleSize: number;
  insightText: string;
  confidence: number;
}

export function computeCorrelations(dailyData: DailyRecord[]): CorrelationDiscovery[];
export function runCorrelationEngine(days = 30): CorrelationDiscovery[];
```

---

## 🧪 Verification & Checklist
- [x] Implement Pearson and Spearman correlation functions in TypeScript.
- [x] Test on 30-day synthetic dataset with known correlations.
- [x] Persist high-confidence discoveries into the `insights` database table.
- [x] Surface live insights on the dashboard.

---

## 🔮 Advanced Enhancements & Additions

### 1. Time-Lagged Cross-Correlation (TLCC)
Real physiological and cognitive effects frequently exhibit a 24-to-48 hour delay rather than instantaneous manifestation:
```typescript
export function computeTimeLaggedCorrelation(seriesA: number[], seriesB: number[], maxLagDays = 3) {
  // Test lags from t-3 to t+3
  // Discovers: Sleep duration on Sunday correlates strongest with Tuesday morning coding velocity (lag = +2)
}
```
- Quantify cumulative sleep debt: a 3-day trailing average sleep metric often predicts mood far better than the single prior night.

### 2. Non-Linear Curve Fitting (Inverted-U Inferences)
Linear correlation models miss optimal thresholds (e.g., Yerkes-Dodson arousal curve):
- **Caffeine vs Sleep Quality**: 100mg caffeine enhances alertness; 350mg tanks deep sleep.
- **Meeting Density vs Energy**: 1–2 check-ins energize team alignment; $>4$ meetings induce severe mental exhaustion.
- Fit quadratic polynomials ($y = ax^2 + bx + c$) to identify the mathematical peak vertex ($x = -b / 2a$).

### 3. Multi-Variable Linear Regression Predictor
Predict today's expected cognitive performance or energy level before the workday begins:
$$\widehat{\text{Energy}} = \beta_0 + \beta_1 \cdot \text{Sleep} + \beta_2 \cdot \text{HRV} + \beta_3 \cdot \text{Prior Day Workout} - \beta_4 \cdot \text{Meetings Today}$$
Display predicted energy capacity in the morning briefing to help pace the day.

