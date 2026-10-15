import { getDb } from '../db/database.js';

export interface Goal {
  id: string;
  name: string;
  description: string;
  target_value: number;
  current_value: number;
  unit: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  status: 'active' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
}

export interface GoalForecast {
  goalId: string;
  name: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  period: string;
  percentComplete: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyVelocity: number;
  projectedTotal: number;
  isOnTrack: boolean;
  deficitOrSurplus: number;
  recommendation: string;
}

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Calculates velocity and projected completion forecast for a goal
 */
export function forecastGoal(goal: Goal): GoalForecast {
  const now = new Date();
  let totalDays = 365;
  let elapsedDays = getDayOfYear();

  if (goal.period === 'daily') {
    totalDays = 1;
    elapsedDays = 1;
  } else if (goal.period === 'weekly') {
    totalDays = 7;
    elapsedDays = Math.max(1, now.getDay() === 0 ? 7 : now.getDay());
  } else if (goal.period === 'monthly') {
    totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    elapsedDays = Math.max(1, now.getDate());
  }

  const remainingDays = Math.max(1, totalDays - elapsedDays);
  const progressRatio = goal.current_value / Math.max(1, goal.target_value);
  const percentComplete = parseFloat((progressRatio * 100).toFixed(1));

  const dailyVelocity = parseFloat((goal.current_value / elapsedDays).toFixed(2));
  const projectedTotal = parseFloat((dailyVelocity * totalDays).toFixed(1));
  const isOnTrack = projectedTotal >= goal.target_value;
  const deficitOrSurplus = parseFloat((projectedTotal - goal.target_value).toFixed(1));

  const neededPerDay = parseFloat(((goal.target_value - goal.current_value) / remainingDays).toFixed(2));

  let recommendation = '';
  if (goal.current_value >= goal.target_value) {
    recommendation = `🎉 Goal Achieved! Target of ${goal.target_value} ${goal.unit} completed.`;
  } else if (isOnTrack) {
    recommendation = `🔥 On track! At current pace, you'll hit ${projectedTotal} ${goal.unit} (${deficitOrSurplus > 0 ? `+${deficitOrSurplus}` : 'exact'} over target).`;
  } else {
    recommendation = `⚠️ Pacing behind. Target pace needed: ${Math.max(0, neededPerDay)} ${goal.unit}/day over next ${remainingDays} days.`;
  }

  return {
    goalId: goal.id,
    name: goal.name,
    targetValue: goal.target_value,
    currentValue: goal.current_value,
    unit: goal.unit,
    period: goal.period,
    percentComplete,
    daysElapsed: elapsedDays,
    daysRemaining: remainingDays,
    dailyVelocity,
    projectedTotal,
    isOnTrack,
    deficitOrSurplus,
    recommendation,
  };
}

/**
 * Computes forecasts for all active goals
 */
export function getAllGoalForecasts(): GoalForecast[] {
  const db = getDb();
  const goals = db.prepare("SELECT * FROM goals WHERE status = 'active' ORDER BY created_at DESC").all() as Goal[];
  return goals.map(forecastGoal);
}
