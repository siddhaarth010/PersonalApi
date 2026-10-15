import { v4 as uuidv4 } from 'uuid';
import { BaseConnector, SyncResult, ConnectorStatus } from './base.js';
import { config } from '../config.js';
import { getDb } from '../db/database.js';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  private: boolean;
  updated_at: string;
}

interface GitHubCommitEvent {
  id: string;
  type: string;
  repo: { name: string };
  payload: {
    commits?: Array<{
      sha: string;
      message: string;
    }>;
  };
  created_at: string;
}

export class GitHubConnector extends BaseConnector {
  readonly id = 'github';
  readonly name = 'GitHub';
  readonly type = 'productivity';

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PersonalAPI/1.0',
    };
    if (config.github.token) {
      h['Authorization'] = `Bearer ${config.github.token}`;
    }
    return h;
  }

  isConfigured(): boolean {
    return !!config.github.username;
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
      result.errors.push('GitHub username not configured');
      return result;
    }

    try {
      // Sync repos
      const reposSynced = await this.syncRepos();
      result.itemsSynced += reposSynced;

      // Sync recent events (commits)
      const commitsSynced = await this.syncEvents();
      result.itemsSynced += commitsSynced;

      result.success = true;

      // Update data source status
      const db = getDb();
      db.prepare(`
        INSERT OR REPLACE INTO data_sources (id, name, type, status, last_synced_at, updated_at)
        VALUES (?, ?, ?, 'connected', datetime('now'), datetime('now'))
      `).run(this.id, this.name, this.type);

    } catch (err: any) {
      result.errors.push(err.message || 'Unknown GitHub sync error');
    }

    return result;
  }

  private async syncRepos(): Promise<number> {
    const response = await fetch(
      `https://api.github.com/users/${config.github.username}/repos?per_page=100&sort=updated`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub repos API returned ${response.status}`);
    }

    const repos: GitHubRepo[] = await response.json() as GitHubRepo[];
    const db = getDb();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO github_repos (id, name, full_name, description, language, stars, forks, is_private, updated_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const insertMany = db.transaction((repos: GitHubRepo[]) => {
      for (const repo of repos) {
        stmt.run(
          String(repo.id),
          repo.name,
          repo.full_name,
          repo.description || '',
          repo.language || 'Unknown',
          repo.stargazers_count,
          repo.forks_count,
          repo.private ? 1 : 0,
          repo.updated_at
        );
      }
    });

    insertMany(repos);
    return repos.length;
  }

  private async syncEvents(): Promise<number> {
    const response = await fetch(
      `https://api.github.com/users/${config.github.username}/events?per_page=100`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub events API returned ${response.status}`);
    }

    const events: GitHubCommitEvent[] = await response.json() as GitHubCommitEvent[];
    const pushEvents = events.filter(e => e.type === 'PushEvent');
    const db = getDb();

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO github_commits (id, repo, message, sha, committed_at, synced_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

    let count = 0;
    const insertMany = db.transaction((events: GitHubCommitEvent[]) => {
      for (const event of events) {
        const commits = event.payload.commits || [];
        for (const commit of commits) {
          stmt.run(
            uuidv4(),
            event.repo.name,
            commit.message,
            commit.sha.substring(0, 7),
            event.created_at
          );
          count++;
        }
      }
    });

    insertMany(pushEvents);
    return count;
  }

  getStatus(): ConnectorStatus {
    const db = getDb();
    const commitCount = db.prepare('SELECT COUNT(*) as count FROM github_commits').get() as any;
    const source = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(this.id) as any;

    return {
      id: this.id,
      name: this.name,
      type: this.type,
      connected: this.isConfigured(),
      lastSynced: source?.last_synced_at || null,
      itemCount: commitCount?.count || 0,
    };
  }

  getSummary(from?: string, to?: string): Record<string, unknown> {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const fromDate = from || today;
    const toDate = to || new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const commits = db.prepare(`
      SELECT COUNT(*) as count FROM github_commits 
      WHERE committed_at >= ? AND committed_at < ?
    `).get(fromDate, toDate) as any;

    const recentCommits = db.prepare(`
      SELECT repo, message, sha, committed_at FROM github_commits 
      WHERE committed_at >= ? AND committed_at < ?
      ORDER BY committed_at DESC LIMIT 10
    `).all(fromDate, toDate);

    const repos = db.prepare(`
      SELECT name, language, stars FROM github_repos 
      ORDER BY updated_at DESC LIMIT 5
    `).all();

    const topLanguages = db.prepare(`
      SELECT language, COUNT(*) as count FROM github_repos 
      WHERE language != 'Unknown'
      GROUP BY language ORDER BY count DESC LIMIT 5
    `).all();

    return {
      commits_today: commits?.count || 0,
      recent_commits: recentCommits,
      active_repos: repos,
      top_languages: topLanguages,
    };
  }
}
