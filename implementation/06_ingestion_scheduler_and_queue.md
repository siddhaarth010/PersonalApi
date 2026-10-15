# ⏱️ Step 06: Ingestion Scheduler & Queue

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented (`node-cron`, exponential backoff, daily life rollup, `/scheduler/status`)  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
Automate scheduled data pulls from external APIs, handle API rate limiting gracefully with exponential backoff, and orchestrate nightly life data rollups.

---

## 🏗️ Architecture & Scheduling Patterns

### 1. Ingestion Schedules
Different sources require different poll cadences:
- **Spotify Recently Played**: Every 30 minutes (`*/30 * * * *`).
- **GitHub Events**: Every 1 hour (`0 * * * *`).
- **Wearable Sleep / Readiness**: Every 2 hours (`0 */2 * * *`).
- **Nightly Aggregation & Life Commit**: Every night at 00:05 AM (`5 0 * * *`).

### 2. Implementation in `src/scheduler/index.ts`

The `IngestionScheduler` class manages cron tasks, tracks status and error rates, handles retries, and computes daily rollups:

```typescript
export class IngestionScheduler {
  start(): void;
  stop(): void;
  calculateDailyRollup(dateStr?: string): Promise<Record<string, unknown>>;
  getStatus(): { isRunning: boolean; jobs: SchedulerJobStatus[]; recentHistory: SyncHistoryEntry[] };
}

export const ingestionScheduler = new IngestionScheduler();
```

---

## 🛡️ Rate Limit & Backoff Strategy
For sources with strict rate limits (Spotify, GitHub):
1. Wrap sync invocations in `executeWithRetry(sourceName, action, maxRetries = 3)`.
2. Detect 429 status and rate limit errors.
3. Apply exponential backoff delay: `delay = Math.min(baseDelay * Math.pow(2, attempt), 60000)`.
4. Log all execution timestamps, items synced, and durations in the `sync_history` SQLite table.

---

## 🧪 Verification & Checklist
- [x] Install `node-cron` with `@types/node-cron`.
- [x] Implement `src/scheduler/index.ts` and initialize in `src/server.ts`.
- [x] Verify scheduled runs trigger sync events without memory leaks.
- [x] Add manual `/api/v1/sources/sync-all` trigger endpoint for testing.

---

## 🔮 Advanced Enhancements & Additions

### 1. Dynamic Cron Configuration via API
Allow users to dynamically adjust poll frequencies without touching configuration files or rebuilding TypeScript code:
- Expose `PATCH /api/v1/scheduler/jobs/:jobId` taking `{ cronExpression: "*/15 * * * *" }`.
- Validate syntax with `cron-parser` before applying.
- Stop and reschedule existing node-cron task instances in memory on update.

### 2. Isolated Worker Threads for Batch Sync
Keep the Express main thread responsive during expensive multi-month data backfills:
```typescript
import { Worker } from 'worker_threads';

export function runWorkerSync(sourceId: string, options: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./dist/scheduler/syncWorker.js', {
      workerData: { sourceId, options }
    });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}
```

### 3. Event-Driven Adaptive Syncing
Instead of blind polling on a fixed clock:
- **Wake-up Triggered**: Trigger wearable health sync 10 minutes after user dismisses morning alarm (via iOS Shortcut webhook).
- **Post-Work Rollup**: Trigger GitHub, WakaTime, and Calendar sync at 18:00 on weekdays to capture workday close.
- **Sleep Quality Polling**: Poll Oura/Apple Health in 1-hour increments starting at 06:00 until sleep score is returned, then pause until next morning.

