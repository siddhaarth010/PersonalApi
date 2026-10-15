# 🎯 Step 13: Goal Tracking & Progress Engine

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented (Goal Velocity, Pace Forecasting & Adaptive Recommendations)  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
Define custom life goals across multiple cadences (daily, weekly, monthly, yearly) and calculate real-time completion velocity and year-end forecasts.

---

## 📋 Goal Data Model (`goals` Table)

```typescript
export interface Goal {
  id: string;
  name: string;
  target_value: number;
  current_value: number;
  unit: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  status: 'active' | 'completed' | 'paused';
}
```

### Goal Examples
- Read 24 books / year
- Exercise 4 sessions / week
- Sleep 7+ hours / day
- Commit daily (1 commit / day)
- Meditate 10 min / day

---

## 🔮 Goal Velocity & Predictive Forecasting

Calculates projected completion based on days elapsed vs pace:

```typescript
export function forecastGoal(goal: Goal): GoalForecast;
export function getAllGoalForecasts(): GoalForecast[];
```

---

## 🧪 Verification & Checklist
- [x] Goals rendered with percentage progress bars in Dashboard UI.
- [x] Implement `forecastGoal()` engine.
- [x] Add `PATCH /api/v1/goals/:id` to dynamically increment goal progress.
- [x] Show predictive advice badge on goal card.

---

## 🔮 Advanced Enhancements & Additions

### 1. Automated Connector-Linked Goal Progress
Eliminate manual scorekeeping by binding goals directly to data sources:
```typescript
export interface BoundGoal extends Goal {
  sourceBinding?: {
    connectorId: string;       // 'github', 'readwise', 'health'
    metricKey: string;         // 'commits', 'books_completed', 'steps'
    aggregation: 'sum' | 'count' | 'avg';
  };
}
```
Whenever a sync runs (e.g. GitHub returns 8 commits), the corresponding "1,000 Commits This Year" goal automatically increments by 8.

### 2. Milestone Unlocks & Celebratory Badges
- Celebrate pacing milestones: 25%, 50%, 75%, 90%, and 100%.
- Generate instant milestone cards with achievement timestamps.
- Dispatch celebration notifications to Telegram and log into the life changelog.

### 3. Adaptive Pace Re-Balancing
When falling behind on a goal, calculate the required catch-up velocity:
- *"To hit 24 books by Dec 31, your pace must increase from 1.2 books/month to 2.1 books/month."*
- Proactively suggest whether to increase effort or pause/re-scope the target realistically.

