import { v4 as uuidv4 } from 'uuid';
import { BaseConnector, SyncResult, ConnectorStatus } from './base.js';
import { config } from '../config.js';
import { getDb } from '../db/database.js';

/**
 * Spotify Connector
 * 
 * Uses OAuth2 flow for authentication. The user must:
 * 1. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env
 * 2. Visit /api/v1/auth/spotify to start the OAuth flow
 * 3. After authorization, the connector stores tokens and syncs automatically
 */
export class SpotifyConnector extends BaseConnector {
  readonly id = 'spotify';
  readonly name = 'Spotify';
  readonly type = 'media';

  private readonly AUTH_URL = 'https://accounts.spotify.com/authorize';
  private readonly TOKEN_URL = 'https://accounts.spotify.com/api/token';
  private readonly API_BASE = 'https://api.spotify.com/v1';
  private readonly SCOPES = [
    'user-read-recently-played',
    'user-top-read',
    'user-read-currently-playing',
  ].join(' ');

  isConfigured(): boolean {
    return !!(config.spotify.clientId && config.spotify.clientSecret);
  }

  isAuthenticated(): boolean {
    const db = getDb();
    const auth = db.prepare('SELECT * FROM spotify_auth WHERE id = 1').get() as any;
    return !!auth?.access_token;
  }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: config.spotify.clientId,
      response_type: 'code',
      redirect_uri: config.spotify.redirectUri,
      scope: this.SCOPES,
      show_dialog: 'true',
    });
    return `${this.AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<void> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.spotify.redirectUri,
    });

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Spotify token exchange failed: ${response.status}`);
    }

    const data = await response.json() as any;
    const db = getDb();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO spotify_auth (id, access_token, refresh_token, expires_at, updated_at)
      VALUES (1, ?, ?, ?, datetime('now'))
    `).run(data.access_token, data.refresh_token, expiresAt);
  }

  private async refreshToken(): Promise<string> {
    const db = getDb();
    const auth = db.prepare('SELECT * FROM spotify_auth WHERE id = 1').get() as any;

    if (!auth) throw new Error('Spotify not authenticated');

    // Check if token is still valid
    if (new Date(auth.expires_at) > new Date()) {
      return auth.access_token;
    }

    // Refresh the token
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: auth.refresh_token,
    });

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Spotify token refresh failed: ${response.status}`);
    }

    const data = await response.json() as any;
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    db.prepare(`
      UPDATE spotify_auth SET access_token = ?, expires_at = ?, updated_at = datetime('now') WHERE id = 1
    `).run(data.access_token, expiresAt);

    if (data.refresh_token) {
      db.prepare('UPDATE spotify_auth SET refresh_token = ? WHERE id = 1').run(data.refresh_token);
    }

    return data.access_token;
  }

  private async apiRequest(endpoint: string): Promise<any> {
    const token = await this.refreshToken();
    const response = await fetch(`${this.API_BASE}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Spotify API ${endpoint} returned ${response.status}`);
    }

    return response.json();
  }

  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      source: this.id,
      success: false,
      itemsSynced: 0,
      errors: [],
      syncedAt: new Date().toISOString(),
    };

    if (!this.isConfigured()) {
      result.errors.push('Spotify credentials not configured');
      return result;
    }

    if (!this.isAuthenticated()) {
      result.errors.push('Spotify not authenticated. Visit /api/v1/auth/spotify to connect.');
      return result;
    }

    try {
      // Sync recently played
      const recentCount = await this.syncRecentlyPlayed();
      result.itemsSynced += recentCount;

      // Sync top artists and tracks
      const topCount = await this.syncTopItems();
      result.itemsSynced += topCount;

      result.success = true;

      const db = getDb();
      db.prepare(`
        INSERT OR REPLACE INTO data_sources (id, name, type, status, last_synced_at, updated_at)
        VALUES (?, ?, ?, 'connected', datetime('now'), datetime('now'))
      `).run(this.id, this.name, this.type);

    } catch (err: any) {
      result.errors.push(err.message || 'Unknown Spotify sync error');
    }

    return result;
  }

  private async syncRecentlyPlayed(): Promise<number> {
    const data = await this.apiRequest('/me/player/recently-played?limit=50');
    const db = getDb();

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO spotify_recent_tracks 
      (id, track_name, artist_name, album_name, album_image_url, duration_ms, played_at, track_url, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const insertMany = db.transaction((items: any[]) => {
      for (const item of items) {
        const track = item.track;
        stmt.run(
          uuidv4(),
          track.name,
          track.artists.map((a: any) => a.name).join(', '),
          track.album?.name || '',
          track.album?.images?.[0]?.url || '',
          track.duration_ms,
          item.played_at,
          track.external_urls?.spotify || ''
        );
      }
    });

    insertMany(data.items || []);
    return (data.items || []).length;
  }

  private async syncTopItems(): Promise<number> {
    let count = 0;
    const db = getDb();

    for (const timeRange of ['short_term', 'medium_term', 'long_term']) {
      // Top artists
      const artists = await this.apiRequest(`/me/top/artists?limit=10&time_range=${timeRange}`);
      const artistStmt = db.prepare(`
        INSERT OR REPLACE INTO spotify_top_items 
        (id, type, name, image_url, genres, popularity, time_range, rank, synced_at)
        VALUES (?, 'artist', ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      (artists.items || []).forEach((artist: any, idx: number) => {
        artistStmt.run(
          `artist-${timeRange}-${idx}`,
          artist.name,
          artist.images?.[0]?.url || '',
          (artist.genres || []).join(', '),
          artist.popularity,
          timeRange,
          idx + 1
        );
        count++;
      });

      // Top tracks
      const tracks = await this.apiRequest(`/me/top/tracks?limit=10&time_range=${timeRange}`);
      const trackStmt = db.prepare(`
        INSERT OR REPLACE INTO spotify_top_items 
        (id, type, name, image_url, genres, popularity, time_range, rank, synced_at)
        VALUES (?, 'track', ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      (tracks.items || []).forEach((track: any, idx: number) => {
        trackStmt.run(
          `track-${timeRange}-${idx}`,
          `${track.name} — ${track.artists.map((a: any) => a.name).join(', ')}`,
          track.album?.images?.[0]?.url || '',
          '',
          track.popularity,
          timeRange,
          idx + 1
        );
        count++;
      });
    }

    return count;
  }

  getStatus(): ConnectorStatus {
    const db = getDb();
    const trackCount = db.prepare('SELECT COUNT(*) as count FROM spotify_recent_tracks').get() as any;
    const source = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(this.id) as any;

    return {
      id: this.id,
      name: this.name,
      type: this.type,
      connected: this.isAuthenticated(),
      lastSynced: source?.last_synced_at || null,
      itemCount: trackCount?.count || 0,
    };
  }

  getSummary(from?: string, to?: string): Record<string, unknown> {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const fromDate = from || today;
    const toDate = to || new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const recentTracks = db.prepare(`
      SELECT track_name, artist_name, album_name, album_image_url, played_at 
      FROM spotify_recent_tracks 
      WHERE played_at >= ? AND played_at < ?
      ORDER BY played_at DESC LIMIT 10
    `).all(fromDate, toDate);

    const topArtists = db.prepare(`
      SELECT name, image_url, popularity FROM spotify_top_items 
      WHERE type = 'artist' AND time_range = 'short_term'
      ORDER BY rank ASC LIMIT 5
    `).all();

    const topTracks = db.prepare(`
      SELECT name, image_url, popularity FROM spotify_top_items 
      WHERE type = 'track' AND time_range = 'short_term'
      ORDER BY rank ASC LIMIT 5
    `).all();

    const totalPlayed = db.prepare(`
      SELECT COUNT(*) as count FROM spotify_recent_tracks
    `).get() as any;

    return {
      recent_tracks: recentTracks,
      top_artists: topArtists,
      top_tracks: topTracks,
      total_tracks_played: totalPlayed?.count || 0,
    };
  }
}
