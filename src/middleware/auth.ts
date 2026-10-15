import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

/**
 * API Key authentication middleware
 * 
 * Checks for the API key in:
 * 1. x-api-key header
 * 2. Authorization: Bearer <key> header
 * 3. ?api_key= query parameter
 * 
 * In development mode, authentication is optional.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for OAuth callbacks, health checks, and API documentation
  const publicPaths = [
    '/api/v1/auth/',
    '/api/v1/health',
    '/api/v1/auth/spotify/callback',
    '/api/docs',
    '/api/v1/docs',
    '/api/v1/openapi.json',
    '/',
  ];
  if (publicPaths.some(p => req.path === p || req.path.startsWith(p))) {
    next();
    return;
  }

  const apiKey =
    req.headers['x-api-key'] as string ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null) ||
    req.query.api_key as string;

  // In development, allow unauthenticated requests
  if (config.nodeEnv === 'development' && !apiKey) {
    next();
    return;
  }

  if (!apiKey || apiKey !== config.apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key. Provide via x-api-key header, Authorization: Bearer, or ?api_key= query param.',
    });
    return;
  }

  next();
}

/**
 * CORS configuration for the dashboard
 */
export function corsConfig() {
  return {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  };
}
