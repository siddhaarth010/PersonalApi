# 🔌 Step 04: Core Connectors Implementation

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented (GitHub, Spotify, Manual, Wearable Health)  
> **Estimated Time:** 3–4 hours

---

## 🎯 Objective
Implement the first cluster of data source connectors across primary life domains:
1. **GitHub** — Productivity & Developer Activity
2. **Spotify** — Media & Mood Signifiers
3. **Manual Check-In** — Wellbeing, Energy & Subjective Metrics
4. **Wearable Health (Fitbit / Apple Health / Oura)** — Sleep & Vitality

---

## 💻 1. GitHub Connector (`src/connectors/github.ts`)

Pulls commit events, push counts, and repository language distributions using the GitHub REST API (`@octokit/rest` or raw fetch):

```typescript
export class GitHubConnector extends BaseConnector {
  readonly id = 'github';
  readonly name = 'GitHub';
  readonly type = 'productivity' as const;

  async sync(since?: Date): Promise<SyncResult> {
    if (!this.config.accessToken) {
      return { sourceId: this.id, status: 'success', itemsProcessed: 0 };
    }

    // 1. Fetch user authenticated events
    const res = await fetch(`https://api.github.com/users/${username}/events`, {
      headers: { Authorization: `token ${this.config.accessToken}` }
    });
    const events = await res.json();
    
    // 2. Filter PushEvent and parse commits
    const pushEvents = events.filter((e: any) => e.type === 'PushEvent');
    // Save to raw_events and update daily commits count...
    return { sourceId: this.id, status: 'success', itemsProcessed: pushEvents.length, timestamp: new Date().toISOString() };
  }
}
```

---

## 🎵 2. Spotify Connector (`src/connectors/spotify.ts`)

Tracks recent listening history and top artists to infer acoustic mood and focus music:

```typescript
export class SpotifyConnector extends BaseConnector {
  readonly id = 'spotify';
  readonly name = 'Spotify';
  readonly type = 'media' as const;

  async getRecentlyPlayed(limit = 20) {
    const res = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` }
    });
    return res.json();
  }
}
```

---

## 📝 3. Manual Entry Connector (`src/connectors/manual.ts`)

Provides subjective self-reported data:
- Mood (1–10)
- Energy (1–10)
- Sleep notes, gratitude tags, and reflections.

```typescript
export class ManualEntryConnector extends BaseConnector {
  readonly id = 'manual';
  readonly name = 'Manual Entry';
  readonly type = 'manual' as const;

  async addEntry(type: 'mood' | 'energy' | 'sleep', value: number, notes?: string, tags?: string[]) {
    // Inserts directly into metric_entries table
  }
}
```

---

## ⌚ 4. Wearable Health Connector (`src/connectors/health.ts`)

Implements sleep, vitality, and activity tracking across Apple Health, Oura, and Fitbit:
- **Sleep & Recovery**: Total sleep hours, deep sleep %, REM sleep, sleep quality score (0–100).
- **Vitals & Autonomic Nervous System**: Resting Heart Rate (RHR) and Heart Rate Variability (HRV rMSSD).
- **Activity & Burn**: Daily step counts and active calorie burn.
- **Audit Logging**: Persists each sync into `health_metrics`, records raw event payloads into `raw_events`, and maintains latency records in `sync_history`.

```typescript
export class HealthConnector extends BaseConnector {
  readonly id = 'health';
  readonly name = 'Wearable Health';
  readonly type = 'health';

  async sync(): Promise<SyncResult> {
    // Syncs today's sleep score, HRV, resting HR and steps into health_metrics table
  }

  ingestMetric(input: HealthMetricInput): HealthDayRecord {
    // Ingests external webhook payload (Apple Health Shortcuts / Oura Webhook)
  }

  getSummary(from?: string, to?: string) {
    // Computes today's vitals, period averages, and 7-day trend history
  }
}
```

---

## 🧪 Verification & Checklist
- [x] GitHub connector fetches commit history and parses active repos.
- [x] Spotify connector surfaces recent tracks, albums, and artist popularity.
- [x] Manual entry logs directly into `metric_entries` / `manual_entries` database.
- [x] Add wearable health connector for automated sleep & HRV sync.

---

## 🔮 Advanced Enhancements & Additions

### 1. Streaming Apple Health Export Parser (`export.xml` / `.zip`)
Enable importing years of historical health archives exported directly from iOS:
```typescript
import sax from 'sax'; // Fast streaming XML parser
import unzipper from 'unzipper';

export async function parseAppleHealthZip(zipStream: NodeJS.ReadableStream) {
  return new Promise((resolve, reject) => {
    zipStream
      .pipe(unzipper.ParseOne(/export\.xml$/))
      .pipe(sax.createStream(true))
      .on('opentag', (node) => {
        if (node.name === 'Record') {
          const type = node.attributes.type;
          const value = parseFloat(node.attributes.value);
          const startDate = node.attributes.startDate;
          
          if (type === 'HKQuantityTypeIdentifierStepCount') {
            // Aggregate steps by date...
          } else if (type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN') {
            // Store HRV sample...
          } else if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
            // Parse deep/rem/light sleep stages...
          }
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });
}
```

### 2. Deep GitHub Code Analytics
Beyond counting PushEvents, extract code quality and collaboration metrics:
- **Diff Breakdown**: Parse lines added vs removed per commit to separate major feature work from refactoring.
- **Review Work**: Capture PR reviews submitted and issue comments to quantify mentor/lead engineer cognitive overhead.
- **Language Heatmap**: Track evolving daily language distributions (e.g. 70% TypeScript, 30% Rust).

### 3. Spotify Acoustic Feature Mood Inference
Query Spotify's Track Audio Features API to infer mood and cognitive state from listening sessions:
- **Acoustic Metrics**: `valence` (0.0 sad/dark to 1.0 cheerful/happy), `energy` (speed, loudness), `instrumentalness` (focus vs vocal distraction).
- **Focus Music Tagging**: Automatically tag deep work blocks when instrumentalness $> 0.8$ coincides with coding activity.

