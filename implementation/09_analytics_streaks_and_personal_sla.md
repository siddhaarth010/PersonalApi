# 📈 Step 09: Analytics, Streaks & Personal SLA Engine

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented (Habit Streaks & 30-Day Personal SLA Engine)  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
1. Calculate daily consecutive streaks and personal best records for key life habits.
2. Introduce the novel **Personal SLA (Service Level Agreement)** concept: borrowing DevOps uptime metrics to measure personal health and productivity reliability.

---

## 🔁 1. Habit Streaks Engine (`src/analytics/streaks.ts`)

Calculates consecutive active days:
```typescript
export function updateStreak(name: string, date: string = new Date().toISOString().slice(0, 10)) {
  const streak = db.prepare('SELECT * FROM streaks WHERE name = ?').get(name);
  if (!streak) return;

  const yesterday = getYesterdayDateString();
  let newCount = streak.current_count;

  if (streak.last_logged_date === yesterday) {
    newCount += 1;
  } else if (streak.last_logged_date !== date) {
    newCount = 1; // Reset streak
  }

  const bestCount = Math.max(newCount, streak.best_count);
  db.prepare(`
    UPDATE streaks 
    SET current_count = ?, best_count = ?, last_logged_date = ? 
    WHERE name = ?
  `).run(newCount, bestCount, date, name);
}
```

---

## ⏱️ 2. Personal SLA (Uptime Monitoring for Life)

Treat habits like high-availability web services:

| Personal SLA | Target Uptime | Threshold | Current Status |
|---|---|---|---|
| **Sleep SLA** | **95.0%** | ≥ 7.0 hours / night | 87.2% ⚠️ (Degraded) |
| **Exercise SLA** | **90.0%** | ≥ 4 workouts / week | 92.5% ✅ (Operational) |
| **Deep Work SLA** | **85.0%** | ≥ 3.0 focus hours / day | 91.0% ✅ (Operational) |
| **Reading SLA** | **80.0%** | ≥ 20 pages / day | 82.0% ✅ (Operational) |

### SLA Calculation Formula:
$$\text{SLA Uptime} = \left(\frac{\text{Days Meeting Target in Last 30 Days}}{30}\right) \times 100\%$$

---

## 🧪 Verification & Checklist
- [x] Streak records update accurately on new log entries.
- [x] Implement SLA calculation function in `src/analytics/sla.ts`.
- [x] Expose `GET /api/v1/analytics/sla` endpoint.
- [x] Render SLA Uptime status badges on Dashboard UI.

---

## 🔮 Advanced Enhancements & Additions

### 1. Habit Streak Freezes & Grace Day Policies
Prevent habit abandonment when legitimate travel or illness occurs:
- Support configurable "freeze tokens" (e.g. 2 streak freezes per month).
- Weekend allowances: Allow habits to be designated as "Workday only" (Monday–Friday) so Saturday and Sunday do not reset coding or deep work streaks.
- Add `streak_events` audit table logging when freezes are consumed.

### 2. Multi-Tier SLA Agreements (Gold / Silver / Bronze)
Expand binary SLA thresholds into tiered service levels:
- **Sleep SLA**:
  * 🥇 Gold: $\ge 8.0\text{h}$
  * 🥈 Silver: $\ge 7.0\text{h}$
  * 🥉 Bronze: $\ge 6.0\text{h}$
- Calculate weighted SLA score:
  $$\text{Weighted Score} = 1.0 \times \text{Gold Days} + 0.7 \times \text{Silver Days} + 0.3 \times \text{Bronze Days}$$

### 3. MTTR (Mean Time to Recover) Resilience Metric
Borrow the Site Reliability Engineering (SRE) concept to measure psychological resilience:
- **MTTR Definition**: Average number of days elapsed between a broken habit/slump day and the next streak re-establishment.
- An MTTR $< 1.5\text{ days}$ indicates high antifragility and rapid rebounding from off-track days.

