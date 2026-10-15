import { BaseConnector, ConnectorStatus, SyncResult } from './base.js';
import { GitHubConnector } from './github.js';
import { SpotifyConnector } from './spotify.js';
import { ManualEntryConnector } from './manual.js';
import { HealthConnector } from './health.js';
import { WakaTimeConnector } from './wakatime.js';
import { CalendarConnector } from './calendar.js';
import { ReadwiseConnector } from './readwise.js';

export { BaseConnector, type ConnectorStatus, type SyncResult } from './base.js';
export { GitHubConnector } from './github.js';
export { SpotifyConnector } from './spotify.js';
export { ManualEntryConnector } from './manual.js';
export { HealthConnector } from './health.js';
export { WakaTimeConnector } from './wakatime.js';
export { CalendarConnector } from './calendar.js';
export { ReadwiseConnector } from './readwise.js';

export class ConnectorManager {
  private connectors = new Map<string, BaseConnector>();

  constructor() {
    // Register Core Connectors
    this.register(new GitHubConnector());
    this.register(new SpotifyConnector());
    this.register(new ManualEntryConnector());
    this.register(new HealthConnector());

    // Register Secondary Expansion Connectors
    this.register(new WakaTimeConnector());
    this.register(new CalendarConnector());
    this.register(new ReadwiseConnector());
  }

  register(connector: BaseConnector): void {
    this.connectors.set(connector.id, connector);
  }

  get<T extends BaseConnector = BaseConnector>(id: string): T | undefined {
    return this.connectors.get(id) as T | undefined;
  }

  getAll(): BaseConnector[] {
    return Array.from(this.connectors.values());
  }

  getStatusAll(): ConnectorStatus[] {
    return this.getAll().map(c => c.getStatus());
  }

  async syncAll(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (const connector of this.connectors.values()) {
      try {
        const res = await connector.sync();
        results.push(res);
      } catch (err: any) {
        results.push({
          source: connector.id,
          success: false,
          itemsSynced: 0,
          errors: [err.message || 'Unknown sync failure'],
          syncedAt: new Date().toISOString(),
        });
      }
    }
    return results;
  }
}

export const connectorManager = new ConnectorManager();
