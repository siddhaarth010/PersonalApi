/**
 * OpenAPI 3.0 Specification & Swagger UI Generator
 * 
 * Provides an interactive API explorer for the Personal API
 * accessible at /api/docs and raw JSON spec at /api/docs/json.
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Personal API — The Operating System for Your Life',
    version: '1.0.0',
    description: `A self-hosted, unified API engine aggregating personal telemetry across:
- 💻 **Productivity**: GitHub commits, repositories, active languages
- 🎵 **Media**: Spotify listening habits, recently played tracks, top artists
- ⌚ **Health & Vitality**: Apple Health / Oura / Fitbit sleep duration, HRV, RHR, steps
- 📝 **Subjective Wellbeing**: Mood, energy, reflections, gratitude
- 🎯 **Life Targets**: Streaks, goals, auto-generated daily Life Commits, AI insights`,
    contact: {
      name: 'Personal API Maintainer',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local Personal API Server',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Provide your personal API key via header `x-api-key: your_key`',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Provide your personal API key via `Authorization: Bearer your_key`',
      },
      QueryAuth: {
        type: 'apiKey',
        in: 'query',
        name: 'api_key',
        description: 'Provide your personal API key via URL query parameter `?api_key=your_key`',
      },
    },
    schemas: {
      LifeSnapshot: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          today: {
            type: 'object',
            properties: {
              productivity: { type: 'object' },
              wellbeing: { type: 'object' },
              media: { type: 'object' },
              health: { type: 'object' },
            },
          },
          streaks: { type: 'array', items: { type: 'object' } },
          goals: { type: 'array', items: { type: 'object' } },
          insights: { type: 'array', items: { type: 'object' } },
          sources: { type: 'array', items: { type: 'object' } },
        },
      },
      MetricEntryInput: {
        type: 'object',
        required: ['type', 'value'],
        properties: {
          type: { type: 'string', example: 'mood', enum: ['mood', 'energy', 'sleep', 'workout', 'screen_time', 'focus'] },
          value: { type: 'number', example: 8.5 },
          label: { type: 'string', example: 'Morning review' },
          notes: { type: 'string', example: 'Felt very energized after 8h sleep' },
          tags: { type: 'array', items: { type: 'string' }, example: ['deep-work', 'morning'] },
          recorded_at: { type: 'string', format: 'date-time' },
        },
      },
      HealthMetricInput: {
        type: 'object',
        properties: {
          date: { type: 'string', example: '2026-10-13' },
          sleep_hours: { type: 'number', example: 7.5 },
          deep_sleep_hours: { type: 'number', example: 1.8 },
          rem_sleep_hours: { type: 'number', example: 1.6 },
          sleep_score: { type: 'integer', example: 85 },
          resting_hr: { type: 'integer', example: 56 },
          hrv_rmssd: { type: 'number', example: 68 },
          steps: { type: 'integer', example: 8240 },
          active_calories: { type: 'integer', example: 450 },
          source: { type: 'string', example: 'wearable' },
        },
      },
      GoalInput: {
        type: 'object',
        required: ['name', 'target_value', 'unit'],
        properties: {
          name: { type: 'string', example: 'Read 24 books' },
          description: { type: 'string', example: 'Read daily for 20 mins' },
          target_value: { type: 'number', example: 24 },
          unit: { type: 'string', example: 'books' },
          period: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'], default: 'monthly' },
        },
      },
    },
  },
  security: [
    { ApiKeyAuth: [] },
    { BearerAuth: [] },
  ],
  paths: {
    '/api/v1/me': {
      get: {
        summary: 'Crown Jewel: Aggregated Life Snapshot',
        description: 'Returns real-time aggregated metrics across productivity, wellbeing, media, and wearable health.',
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string' }, description: 'Start date filter (YYYY-MM-DD)' },
          { name: 'to', in: 'query', schema: { type: 'string' }, description: 'End date filter (YYYY-MM-DD)' },
        ],
        responses: {
          '200': {
            description: 'Unified life telemetry snapshot',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LifeSnapshot' } } },
          },
        },
      },
    },
    '/api/v1/me/summary': {
      get: {
        summary: 'Aggregated summary for a time horizon',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['today', 'week', 'month', 'year'] }, default: 'today' },
        ],
        responses: {
          '200': { description: 'Aggregated period summary' },
        },
      },
    },
    '/api/v1/health': {
      get: {
        summary: 'Service health check',
        responses: {
          '200': { description: 'Server status, uptime, and timestamp' },
        },
      },
    },
    '/api/v1/health-metrics': {
      get: {
        summary: 'Get historical wearable health & sleep metrics',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 30 } },
        ],
        responses: {
          '200': { description: 'List of historical health entries and averages' },
        },
      },
      post: {
        summary: 'Ingest wearable health data point',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthMetricInput' } } },
        },
        responses: {
          '201': { description: 'Metric entry saved' },
        },
      },
    },
    '/api/v1/health-metrics/today': {
      get: {
        summary: "Get today's health, sleep, HRV, and activity vitals",
        responses: {
          '200': { description: "Today's health metrics and recent trends" },
        },
      },
    },
    '/api/v1/productivity/code': {
      get: {
        summary: 'Productivity and coding telemetry',
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string' } },
          { name: 'to', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'GitHub commits, repos, and language distribution' },
        },
      },
    },
    '/api/v1/productivity/code/commits': {
      get: {
        summary: 'Recent commit stream',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'from', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'List of recent git commits' },
        },
      },
    },
    '/api/v1/productivity/code/repos': {
      get: {
        summary: 'Tracked git repositories',
        responses: {
          '200': { description: 'Active repositories list' },
        },
      },
    },
    '/api/v1/media/music': {
      get: {
        summary: 'Spotify listening summary',
        responses: {
          '200': { description: 'Recent listening history and top artists' },
        },
      },
    },
    '/api/v1/media/music/recent': {
      get: {
        summary: 'Recently played tracks',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 30 } },
        ],
        responses: {
          '200': { description: 'Recent track history' },
        },
      },
    },
    '/api/v1/media/music/top': {
      get: {
        summary: 'Top Spotify artists or tracks',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['artist', 'track'], default: 'artist' } },
          { name: 'time_range', in: 'query', schema: { type: 'string', enum: ['short_term', 'medium_term', 'long_term'], default: 'short_term' } },
        ],
        responses: {
          '200': { description: 'Top items' },
        },
      },
    },
    '/api/v1/entries': {
      get: {
        summary: 'Query subjective metric entries',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string' } },
          { name: 'to', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          '200': { description: 'Filtered metric entries' },
        },
      },
      post: {
        summary: 'Log a new manual metric entry (mood, energy, sleep, reflection)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MetricEntryInput' } } },
        },
        responses: {
          '201': { description: 'Entry created successfully' },
        },
      },
    },
    '/api/v1/entries/batch': {
      post: {
        summary: 'Batch insert multiple metric entries',
        responses: {
          '201': { description: 'Batch inserted entries count' },
        },
      },
    },
    '/api/v1/entries/averages/{type}': {
      get: {
        summary: 'Get rolling averages for a metric type',
        parameters: [
          { name: 'type', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Rolling metric averages' },
        },
      },
    },
    '/api/v1/streaks': {
      get: {
        summary: 'Habits and active streaks',
        responses: {
          '200': { description: 'Active and best streaks' },
        },
      },
    },
    '/api/v1/goals': {
      get: {
        summary: 'Active life goals and progress',
        responses: {
          '200': { description: 'List of goals' },
        },
      },
      post: {
        summary: 'Create a new life goal',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/GoalInput' } } },
        },
        responses: {
          '201': { description: 'Goal created' },
        },
      },
    },
    '/api/v1/insights': {
      get: {
        summary: 'Discovered correlations and anomaly alerts',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['correlation', 'anomaly', 'prediction'] } },
          { name: 'include_dismissed', in: 'query', schema: { type: 'boolean', default: false } },
        ],
        responses: {
          '200': { description: 'List of AI life insights' },
        },
      },
    },
    '/api/v1/sources': {
      get: {
        summary: 'List connected data source plugins and their health status',
        responses: {
          '200': { description: 'Source statuses' },
        },
      },
    },
    '/api/v1/sources/{id}/sync': {
      post: {
        summary: 'Trigger instantaneous synchronization for a single source',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', enum: ['github', 'spotify', 'manual', 'health'] } },
        ],
        responses: {
          '200': { description: 'Sync execution result' },
        },
      },
    },
    '/api/v1/sources/sync-all': {
      post: {
        summary: 'Trigger batch synchronization of all connected sources',
        responses: {
          '200': { description: 'Batch synchronization results' },
        },
      },
    },
    '/api/v1/scheduler/status': {
      get: {
        summary: 'Get background ingestion scheduler status & sync queue history',
        responses: {
          '200': { description: 'Scheduler cron schedule and recent job logs' },
        },
      },
    },
    '/api/v1/life-commits': {
      get: {
        summary: 'Chronological life commit changelog',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 30 } },
        ],
        responses: {
          '200': { description: 'Daily life commit messages' },
        },
      },
    },
  },
};

/**
 * Returns a standalone dark cybernetic Swagger UI HTML document.
 */
export function getSwaggerHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Personal API — Interactive API Explorer</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧬</text></svg>" />
  <style>
    body {
      margin: 0;
      background: #0b0f19;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .top-banner {
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9));
      border-bottom: 1px solid rgba(56, 189, 248, 0.2);
      padding: 18px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }
    .top-banner h1 {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .top-banner .badge {
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #38bdf8;
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 9999px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .top-banner a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.85rem;
      transition: color 0.2s;
    }
    .top-banner a:hover {
      color: #38bdf8;
    }
    /* Dark cybernetic theme overrides for Swagger UI */
    .swagger-ui {
      filter: invert(88%) hue-rotate(180deg);
    }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .wrapper {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .swagger-ui .info {
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="top-banner">
    <h1>🧬 Personal API <span class="badge">v1.0.0 OpenAPI 3.0</span></h1>
    <div>
      <a href="/api/docs/json" target="_blank" style="margin-right: 16px;">📄 Raw JSON Spec</a>
      <a href="/api/v1/me" target="_blank">💎 /me Snapshot</a>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: 'BaseLayout',
      });
    };
  </script>
</body>
</html>`;
}
