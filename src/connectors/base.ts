/**
 * Base Connector Interface
 * 
 * Every data source connector must implement this interface.
 * This provides a standardized way to sync, query, and manage
 * any external data source.
 */
export interface ConnectorConfig {
  [key: string]: unknown;
}

export interface SyncResult {
  source: string;
  success: boolean;
  itemsSynced: number;
  errors: string[];
  syncedAt: string;
}

export interface ConnectorStatus {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  lastSynced: string | null;
  itemCount: number;
}

export abstract class BaseConnector {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly type: string;

  /**
   * Check if the connector is properly configured and can connect
   */
  abstract isConfigured(): boolean;

  /**
   * Sync data from the external source into the local database
   */
  abstract sync(): Promise<SyncResult>;

  /**
   * Get the current status of this connector
   */
  abstract getStatus(): ConnectorStatus;

  /**
   * Get summary data for the dashboard (today/recent)
   */
  abstract getSummary(from?: string, to?: string): Record<string, unknown>;
}
