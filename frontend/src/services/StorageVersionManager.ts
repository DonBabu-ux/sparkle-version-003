/**
 * StorageVersionManager.ts
 *
 * Enterprise Storage Versioning & Schema Migration Service.
 *
 * Ensures storage format changes between app updates do not break
 * existing user data or cause cache corruption.
 */

import { SparkleStorage } from './SparkleStorageService';
import { logger } from '../utils/logger';

export const CURRENT_STORAGE_VERSION = 3;
const VERSION_KEY = 'sparkle_storage_version';

export interface MigrationStep {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate: () => Promise<void>;
}

export class StorageVersionManagerClass {
  private migrations: MigrationStep[] = [
    {
      fromVersion: 1,
      toVersion: 2,
      description: 'Migrate legacy localStorage keys into SparkleStorage private sandbox',
      migrate: async () => {
        // Migrate legacy privacy cache keys
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sparkle_privacy_cache_')) {
            const chatId = key.replace('sparkle_privacy_cache_', '');
            try {
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                await SparkleStorage.setPrivacyCache(chatId, parsed);
              }
            } catch (e) {}
          }
        }
      },
    },
    {
      fromVersion: 2,
      toVersion: 3,
      description: 'Initialize private directory structure and operation journal',
      migrate: async () => {
        await SparkleStorage.initialize();
        await SparkleStorage.writePrivateFile('logs/operations.log', `[${new Date().toISOString()}] Migration v2->v3 completed.\n`);
      },
    },
  ];

  async getStoredVersion(): Promise<number> {
    const v = await SparkleStorage.getItem(VERSION_KEY);
    return v ? parseInt(v, 10) : 1;
  }

  async runMigrationsIfNeeded(): Promise<{ startVersion: number; endVersion: number; executed: string[] }> {
    const startVersion = await this.getStoredVersion();
    const executed: string[] = [];

    let current = startVersion;
    while (current < CURRENT_STORAGE_VERSION) {
      const step = this.migrations.find(m => m.fromVersion === current);
      if (!step) break;

      logger.log(`[StorageVersionManager] Running migration v${step.fromVersion} -> v${step.toVersion}: ${step.description}`);
      try {
        await step.migrate();
        current = step.toVersion;
        await SparkleStorage.setItem(VERSION_KEY, current.toString());
        executed.push(`v${step.fromVersion}->v${step.toVersion}: ${step.description}`);
      } catch (err: any) {
        logger.error(`[StorageVersionManager] Migration failed at v${step.fromVersion}:`, err);
        break;
      }
    }

    return { startVersion, endVersion: current, executed };
  }
}

export const StorageVersionManager = new StorageVersionManagerClass();
