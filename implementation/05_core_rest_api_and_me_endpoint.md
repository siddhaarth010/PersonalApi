# 🌐 Step 05: Core REST API & `/me` Endpoint

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented (REST API, /me Crown Jewel, Auth Middleware & Swagger Docs)  
> **Estimated Time:** 2–3 hours

---

## 🎯 Objective
Expose a clean, versioned REST API (`/api/v1/*`) with security middleware, API key authentication, and the centerpiece `/me` endpoint that returns a complete unified snapshot of today's life data.

---

## 💎 The Crown Jewel: `GET /api/v1/me`

Returns the real-time aggregated snapshot:

```json
{
  "timestamp": "2026-10-13T00:00:00.000Z",
  "today": {
    "productivity": {
      "commits": 6,
      "recent_commits": [ ... ],
      "active_repos": [ ... ],
      "top_languages": [ ... ]
    },
    "wellbeing": {
      "mood": 6.5,
      "energy": 7,
      "recent_entries": [ ... ]
    },
    "media": {
      "recent_tracks": [ ... ],
      "top_artists": [ ... ],
      "total_tracks_played": 177
    }
  },
  "streaks": [
    { "name": "coding", "current_count": 23, "best_count": 23 },
    { "name": "mood", "current_count": 12, "best_count": 28 }
  ],
  "goals": [
    { "name": "Read 24 books", "target_value": 24, "current_value": 18, "unit": "books" }
  ],
  "insights": [
    { "type": "correlation", "message": "Productivity is 35% higher when sleep > 7h", "confidence": 0.89 }
  ],
  "sources": [
    { "id": "github", "name": "GitHub", "status": "connected" },
    { "id": "spotify", "name": "Spotify", "status": "demo" }
  ]
}
```

---

## 🛣️ Endpoint Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/me` | Unified life snapshot for today (productivity, wellbeing, media, health) |
| `GET` | `/api/v1/me/summary?period=week` | Weekly or monthly aggregated summary |
| `GET` | `/api/v1/health` | System health & database connection status |
| `GET` | `/api/v1/health-metrics` | Historical wearable health metrics (sleep, HRV, RHR, steps) |
| `GET` | `/api/v1/health-metrics/today` | Today's sleep & vitality vitals snapshot |
| `POST` | `/api/v1/health-metrics` | Ingest wearable health data point (Apple Health / Oura) |
| `GET` | `/api/v1/productivity/code` | Commits, active repos, language breakdown |
| `GET` | `/api/v1/media/music` | Spotify tracks, top artists, listening counts |
| `POST` | `/api/v1/entries` | Log manual metric (mood, energy, sleep, workout) |
| `GET` | `/api/v1/streaks` | Current & all-time best streaks |
| `GET` | `/api/v1/goals` | All active life goals & targets |
| `GET` | `/api/v1/insights` | Discovered correlations & anomalies |
| `GET` | `/api/v1/sources` | Connected data source plugins and their health status |
| `POST` | `/api/v1/sources/:id/sync` | Force instant synchronization of a source |
| `POST` | `/api/v1/sources/sync-all` | Batch synchronization of all registered sources |
| `GET` | `/api/v1/scheduler/status` | Ingestion scheduler cron jobs & recent sync run logs |
| `GET` | `/api/v1/life-commits` | Daily life commit message history |
| `GET` | `/api/docs` | Interactive Swagger UI API documentation explorer |
| `GET` | `/api/docs/json` | Raw OpenAPI 3.0 specification JSON |

---

## 🔒 Authentication Middleware (`src/middleware/auth.ts`)
Supports three credential passing styles:
1. Header: `x-api-key: your_key`
2. Header: `Authorization: Bearer your_key`
3. Query Param: `?api_key=your_key`

Public whitelisted routes (`/api/docs`, `/api/v1/health`, OAuth callback) bypass authentication.

---

## 🧪 Verification & Checklist
- [x] `curl http://localhost:3001/api/v1/me` returns 200 OK with formatted JSON.
- [x] Authentication works with valid key and rejects invalid keys when in production mode.
- [x] Implement Swagger/OpenAPI interactive docs UI at `/api/docs`.

---

## 🔮 Advanced Enhancements & Additions

### 1. In-Memory Response Caching & ETag Validation
Optimize high-traffic `/api/v1/me` requests to avoid repeated database assembly:
- Cache aggregated JSON in memory with a short 30-to-60 second TTL.
- Invalidate cache immediately on new entries (`POST /api/v1/entries`, webhooks, or manual sync triggers).
- Generate HTTP `ETag` headers based on daily summary hashes so clients can receive `304 Not Modified` on unchanged polls.

### 2. Fine-Grained API Key Permissions & Scopes
Transition from a single monolithic secret to role-based scoped access:
```typescript
export interface ApiKeyRecord {
  id: string;
  name: string;             // 'iOS Shortcut', 'Public Read-Only Widget', 'Telegram Bot'
  keyHash: string;          // bcrypt or sha256 hash
  scopes: string[];         // ['read:public', 'write:entries', 'read:health', 'admin']
  expiresAt?: string;
  lastUsedAt?: string;
}
```
Enforce granular middleware:
```typescript
app.post('/api/v1/entries', requireScope('write:entries'), handleCreateEntry);
app.get('/api/v1/health-metrics', requireScope('read:health'), handleGetHealth);
```

### 3. Server-Sent Events (SSE) Live Feed (`GET /api/v1/stream`)
Enable zero-latency, unidirectional event streaming to connected dashboard tabs and CLI listeners:
```typescript
app.get('/api/v1/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const listener = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  eventEmitter.on('life_event', listener);
  req.on('close', () => eventEmitter.off('life_event', listener));
});
```

