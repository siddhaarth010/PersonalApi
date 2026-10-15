import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { initializeDatabase } from './db/database.js';
import { authenticate, corsConfig } from './middleware/auth.js';
import { ingestionScheduler } from './scheduler/index.js';
import apiRoutes from './routes/api.js';

const app = express();

// Security & parsing
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsConfig()));
app.use(express.json());

// Authentication
app.use(authenticate);

// API documentation direct redirects
app.get('/api/docs', (_req, res) => res.redirect('/api/v1/docs'));
app.get('/api/docs/json', (_req, res) => res.redirect('/api/v1/docs/json'));

// API routes
app.use('/api/v1', apiRoutes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Personal API',
    version: '1.0.0',
    description: 'The operating system for your life',
    endpoints: {
      me: '/api/v1/me',
      summary: '/api/v1/me/summary?period=week',
      health: '/api/v1/health',
      health_metrics: '/api/v1/health-metrics',
      health_today: '/api/v1/health-metrics/today',
      sources: '/api/v1/sources',
      entries: '/api/v1/entries',
      goals: '/api/v1/goals',
      streaks: '/api/v1/streaks',
      insights: '/api/v1/insights',
      scheduler: '/api/v1/scheduler/status',
      docs: '/api/docs',
      openapi_json: '/api/docs/json',
    },
    auth: 'Use x-api-key header, Authorization: Bearer, or ?api_key= query param',
  });
});

// Initialize database
initializeDatabase();

// Initialize background ingestion scheduler
ingestionScheduler.start();

app.listen(config.port, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║     🧬 Personal API v1.0.0                               ║
  ║     The Operating System for Your Life                   ║
  ║                                                          ║
  ║     API Server:  http://localhost:${config.port}                    ║
  ║     Swagger UI:  http://localhost:${config.port}/api/docs           ║
  ║     Environment: ${config.nodeEnv.padEnd(38)}║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
  `);
});

export default app;
