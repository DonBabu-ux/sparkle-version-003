import { Capacitor } from '@capacitor/core';
import { logger } from '../utils/logger';

export interface ServerEndpointConfig {
  id: 'primary' | 'backup';
  name: string;
  origin: string;
  apiBase: string;
  healthUrl: string;
}

export const SERVER_CONFIGS: Record<'primary' | 'backup', ServerEndpointConfig> = {
  primary: {
    id: 'primary',
    name: 'Primary Server (Server 1)',
    origin: 'https://sparkle-version-003-1-f4v3.onrender.com',
    apiBase: 'https://sparkle-version-003-1-f4v3.onrender.com/api',
    healthUrl: 'https://sparkle-version-003-1-f4v3.onrender.com/api/health',
  },
  backup: {
    id: 'backup',
    name: 'Backup Server (Server 2)',
    origin: 'https://sparkle-app-backup.onrender.com',
    apiBase: 'https://sparkle-app-backup.onrender.com/api',
    healthUrl: 'https://sparkle-app-backup.onrender.com/api/health',
  },
};

const STORAGE_KEY_ACTIVE_SERVER = 'sparkle_active_server_id';
const STORAGE_KEY_QUARANTINED = 'sparkle_quarantined_servers';
const STORAGE_KEY_LAST_FAILOVER = 'sparkle_last_failover_ts';

export type ServerChangeListener = (newServer: ServerEndpointConfig, previousServer: ServerEndpointConfig) => void;

class ServerFailoverManagerClass {
  private activeServerId: 'primary' | 'backup' = 'primary';
  private consecutivePrimaryFailures = 0;
  private consecutivePrimarySuccesses = 0;
  private consecutiveBackupFailures = 0;
  private healthIntervalId: any = null;
  private listeners: Set<ServerChangeListener> = new Set();
  private isCheckingHealth = false;
  private isInitialized = false;

  constructor() {
    this.hydratePersistedState();
    this.setupLifecycleListeners();
  }

  private hydratePersistedState(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_SERVER);
      if (stored === 'primary' || stored === 'backup') {
        this.activeServerId = stored;
      }
    } catch {
      // storage unavailable
    }
  }

  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    logger.log(`[Failover] Initialized with active server: ${this.activeServerId} (${this.getActiveServer().origin})`);
    
    // Quick probe on startup
    void this.checkHealth();
    this.startHealthPolling();
  }

  public getActiveServer(): ServerEndpointConfig {
    return SERVER_CONFIGS[this.activeServerId];
  }

  public getActiveOrigin(): string {
    return this.getActiveServer().origin;
  }

  public getActiveApiBase(): string {
    return this.getActiveServer().apiBase;
  }

  public getSecondaryServer(): ServerEndpointConfig {
    return this.activeServerId === 'primary' ? SERVER_CONFIGS.backup : SERVER_CONFIGS.primary;
  }

  public isQuarantined(serverId: 'primary' | 'backup'): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_QUARANTINED);
      if (!raw) return false;
      const list: string[] = JSON.parse(raw);
      return list.includes(serverId);
    } catch {
      return false;
    }
  }

  public quarantineServer(serverId: 'primary' | 'backup', reason: string): void {
    logger.error(`🚨 [Failover] QUARANTINING ${serverId}: ${reason}`);
    try {
      const raw = localStorage.getItem(STORAGE_KEY_QUARANTINED);
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(serverId)) {
        list.push(serverId);
        localStorage.setItem(STORAGE_KEY_QUARANTINED, JSON.stringify(list));
      }
    } catch {}

    if (this.activeServerId === serverId) {
      const other = serverId === 'primary' ? 'backup' : 'primary';
      if (!this.isQuarantined(other)) {
        this.switchActiveServer(other, `Quarantine of ${serverId}: ${reason}`);
      }
    }
  }

  public switchActiveServer(nextId: 'primary' | 'backup', reason: string): void {
    if (this.activeServerId === nextId) return;
    if (this.isQuarantined(nextId)) {
      logger.warn(`[Failover] Refusing to switch to quarantined server ${nextId}`);
      return;
    }

    const prev = this.getActiveServer();
    this.activeServerId = nextId;

    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_SERVER, nextId);
      localStorage.setItem(STORAGE_KEY_LAST_FAILOVER, String(Date.now()));
    } catch {}

    const curr = this.getActiveServer();
    logger.warn(`🔁 [Failover] Active server switched: ${prev.id} -> ${curr.id} (${reason})`);

    // Notify listeners (axios client, socket client, etc.)
    this.listeners.forEach((fn) => {
      try {
        fn(curr, prev);
      } catch (err) {
        logger.error('[Failover] Listener callback error:', err);
      }
    });

    // Dispatch a window event for components that need to respond
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sparkle:server-failover', {
        detail: { activeServer: curr, previousServer: prev, reason }
      }));
    }
  }

  public onServerChange(listener: ServerChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Health check implementation.
   * - Times out after 4 seconds per check.
   * - 2 consecutive failures on active server triggers failover to healthy secondary.
   * - 3 consecutive successes on Primary while running on Backup triggers recovery to Primary.
   */
  public async checkHealth(): Promise<{ primaryHealthy: boolean; backupHealthy: boolean }> {
    if (this.isCheckingHealth) return { primaryHealthy: false, backupHealthy: false };
    this.isCheckingHealth = true;

    try {
      const probe = async (url: string): Promise<boolean> => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' }
          });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json().catch(() => null);
            // Healthy if database is connected or status is success
            return data?.status === 'success' || data?.database === 'connected';
          }
          return false;
        } catch {
          return false;
        }
      };

      const [primaryHealthy, backupHealthy] = await Promise.all([
        probe(SERVER_CONFIGS.primary.healthUrl),
        probe(SERVER_CONFIGS.backup.healthUrl)
      ]);

      // Update counters
      if (primaryHealthy) {
        this.consecutivePrimaryFailures = 0;
        this.consecutivePrimarySuccesses++;
      } else {
        this.consecutivePrimarySuccesses = 0;
        this.consecutivePrimaryFailures++;
      }

      if (backupHealthy) {
        this.consecutiveBackupFailures = 0;
      } else {
        this.consecutiveBackupFailures++;
      }

      // ── Failover Decision ──
      // Scenario A: Active is Primary, but Primary failed 2+ times and Backup is healthy
      if (this.activeServerId === 'primary' && this.consecutivePrimaryFailures >= 2 && backupHealthy) {
        this.switchActiveServer('backup', `Primary failed ${this.consecutivePrimaryFailures} consecutive health checks`);
      }
      // Scenario B: Active is Backup, but Primary has been stably healthy for 3+ consecutive checks
      else if (this.activeServerId === 'backup' && primaryHealthy && this.consecutivePrimarySuccesses >= 3 && !this.isQuarantined('primary')) {
        this.switchActiveServer('primary', `Primary recovered with ${this.consecutivePrimarySuccesses} consecutive successful checks`);
      }
      // Scenario C: Active is Primary and startup check proved it is down, immediate failover if Backup is up
      else if (this.activeServerId === 'primary' && !primaryHealthy && backupHealthy && this.consecutivePrimaryFailures >= 1) {
        this.switchActiveServer('backup', 'Immediate startup failover: Primary unreachable, Backup operational');
      }

      return { primaryHealthy, backupHealthy };
    } finally {
      this.isCheckingHealth = false;
    }
  }

  public startHealthPolling(): void {
    this.stopHealthPolling();
    // Poll every 12 seconds when app is foregrounded
    this.healthIntervalId = setInterval(() => {
      void this.checkHealth();
    }, 12000);
  }

  public stopHealthPolling(): void {
    if (this.healthIntervalId) {
      clearInterval(this.healthIntervalId);
      this.healthIntervalId = null;
    }
  }

  private setupLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      logger.log('[Failover] Device came online, probing servers immediately');
      void this.checkHealth();
      this.startHealthPolling();
    });

    window.addEventListener('offline', () => {
      this.stopHealthPolling();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.checkHealth();
        this.startHealthPolling();
      } else {
        this.stopHealthPolling();
      }
    });
  }
}

export const ServerFailoverManager = new ServerFailoverManagerClass();
