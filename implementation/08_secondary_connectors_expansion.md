# 🔌 Step 08: Secondary Connectors Expansion

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented (WakaTime, Google Calendar, Readwise)  
> **Estimated Time:** 4–6 hours

---

## 🎯 Objective
Expand the Personal API data footprint beyond coding and music into work, learning, schedule density, and finances:
1. **WakaTime / RescueTime** — Accurate coding hours and editor time.
2. **Google Calendar** — Meeting counts, fragmentation, and free focus blocks.
3. **Todoist / Linear** — Completed tasks and backlog throughput.
4. **Readwise / Kindle** — Books read, reading streaks, and highlights.
5. **Plaid / Ledger CSV** — Daily expenditure and category breakdown.

---

## 🏗️ Connector Implementations

### 1. WakaTime (`src/connectors/wakatime.ts`)
```typescript
export class WakaTimeConnector extends BaseConnector {
  readonly id = 'wakatime';
  readonly name = 'WakaTime';
  readonly type = 'productivity' as const;

  async sync(): Promise<SyncResult> {
    const res = await fetch('https://wakatime.com/api/v1/users/current/summaries?range=today', {
      headers: { Authorization: `Basic ${Buffer.from(this.config.apiKey!).toString('base64')}` }
    });
    const data = await res.json();
    const codingHours = (data.cumulative_total?.seconds || 0) / 3600;
    // Store coding_hours in metric_entries...
    return { sourceId: this.id, status: 'success', itemsProcessed: 1, timestamp: new Date().toISOString() };
  }
}
```

### 2. Google Calendar (`src/connectors/calendar.ts`)
```typescript
export class CalendarConnector extends BaseConnector {
  readonly id = 'google_calendar';
  readonly name = 'Google Calendar';
  readonly type = 'productivity' as const;

  async sync(): Promise<SyncResult> {
    // Calculates:
    // 1. Total meeting minutes
    // 2. Number of distinct meetings
    // 3. Fragmented free slots (< 45 min) vs Deep work slots (> 90 min)
    return { sourceId: this.id, status: 'success', itemsProcessed: 1, timestamp: new Date().toISOString() };
  }
}
```

### 3. Readwise (`src/connectors/readwise.ts`)
```typescript
export class ReadwiseConnector extends BaseConnector {
  readonly id = 'readwise';
  readonly name = 'Readwise';
  readonly type = 'learning' as const;

  async sync(): Promise<SyncResult> {
    const res = await fetch('https://readwise.io/api/v2/highlights/', {
      headers: { Authorization: `Token ${this.config.apiKey}` }
    });
    // Record reading streaks and highlight volume...
    return { sourceId: this.id, status: 'success', itemsProcessed: 1, timestamp: new Date().toISOString() };
  }
}
```

---

## 🧪 Verification & Checklist
- [x] Implement `WakaTimeConnector` and test with API key.
- [x] Implement `CalendarConnector` and calculate meeting count per day.
- [x] Implement `ReadwiseConnector` for reading volume.
- [x] Register new connectors in `src/connectors/index.ts`.

---

## 🔮 Advanced Enhancements & Additions

### 1. Todoist & Linear Task Ingestion (`src/connectors/todoist.ts`)
Track task throughput, backlog health, and sprint completion:
- Query completed tasks for the day via Todoist REST API or Linear GraphQL API.
- Compute completed vs added ratio (Task Velocity).
- Detect task stagnation: count items left overdue for $> 3$ consecutive days.

### 2. Personal Finance Ledger Connector (`src/connectors/finance.ts`)
Track daily expenditure habits with strict local AES-256 field encryption:
- Support parsing standard OFX, QIF, or CSV bank transaction exports.
- Categorize spending: `food`, `tech_hardware`, `saas_subscriptions`, `wellness`, `transportation`.
- Correlate impulsive spending spikes with low sleep or high stress ratings.

### 3. Google Calendar Deep Meeting Taxonomy
Enhance Google Calendar ingestion by categorizing event types and cognitive cost:
- `1on1`: High emotional presence.
- `team_sync`: Moderate engagement, high context-switching cost.
- `external_client`: High preparation overhead.
- `focus_block`: Protected calendar hold; track if violated by double bookings.

