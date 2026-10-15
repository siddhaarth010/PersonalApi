import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY || 'dev-key',
  dbPath: process.env.DB_PATH || './data/personal-api.db',

  github: {
    username: process.env.GITHUB_USERNAME || '',
    token: process.env.GITHUB_TOKEN || '',
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/spotify/callback',
  },
} as const;
