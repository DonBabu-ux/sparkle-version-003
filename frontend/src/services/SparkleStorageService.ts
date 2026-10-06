/**
 * SparkleStorageService.ts
 *
 * Enterprise offline-first private storage layer.
 *
 * Philosophy:
 *   Backend → Socket → Store → SparkleStorageService → Private Android Sandbox
 *
 * This layer is ADDITIVE — it never replaces the backend as source of truth.
 * It acts as an intelligent cache that keeps Sparkle alive when anything goes wrong.
 *
 * On Android: uses Capacitor Filesystem (Directory.Data) → /data/data/com.sparkleapp/files/
 * On Web: falls back gracefully to localStorage
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { logger } from '../utils/logger';

/** Private directory structure inside the app sandbox */
const STORAGE_DIRS = [
  'sparkle/cache/images',
  'sparkle/cache/videos',
  'sparkle/cache/thumbnails',
  'sparkle/cache/stories',
  'sparkle/cache/profiles',
  'sparkle/cache/ai',
  'sparkle/uploads/pending',
  'sparkle/uploads/retry',
  'sparkle/uploads/completed',
  'sparkle/downloads',
  'sparkle/offline/messages',
  'sparkle/offline/reactions',
  'sparkle/offline/receipts',
  'sparkle/offline/typing',
  'sparkle/privacy',
  'sparkle/config',
  'sparkle/logs',
  'sparkle/analytics',
  'sparkle/ai',
  'sparkle/temp',
] as const;

class SparkleStorageServiceClass {
  private initialized = false;
  private isNative = Capacitor.isNativePlatform();

  // ─── Initialization ───────────────────────────────────────────────

  /**
   * Scaffold the private directory structure on first launch.
   * Safe to call multiple times — mkdir with recursive: true is idempotent.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.isNative) {
      for (const dir of STORAGE_DIRS) {
        try {
          await Filesystem.mkdir({
            path: dir,
            directory: Directory.Data,
            recursive: true,
          });
        } catch (e: any) {
          // Directory already exists — that's fine
          if (!e?.message?.includes('exists')) {
            logger.warn(`[SparkleStorage] Failed to create ${dir}:`, e?.message);
          }
        }
      }
    }

    this.initialized = true;
    logger.log(`[SparkleStorage] Initialized (${this.isNative ? 'native' : 'web'})`);
  }

  // ─── Preferences (Key-Value) ──────────────────────────────────────
  // Wraps Capacitor Preferences on native, localStorage on web.
  // Used for: privacy cache, settings, small structured data.

  async setItem(key: string, value: string): Promise<void> {
    if (this.isNative) {
      await Preferences.set({ key, value });
    } else {
      try { localStorage.setItem(key, value); } catch (e) {}
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (this.isNative) {
      const { value } = await Preferences.get({ key });
      return value;
    } else {
      try { return localStorage.getItem(key); } catch { return null; }
    }
  }

  async removeItem(key: string): Promise<void> {
    if (this.isNative) {
      await Preferences.remove({ key });
    } else {
      try { localStorage.removeItem(key); } catch (e) {}
    }
  }

  // ─── JSON Helpers ─────────────────────────────────────────────────

  async setJSON<T>(key: string, value: T): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  // ─── File Operations (Private Sandbox) ────────────────────────────

  async writePrivateFile(path: string, data: string): Promise<void> {
    if (this.isNative) {
      await Filesystem.writeFile({
        path: `sparkle/${path}`,
        data,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    } else {
      try { localStorage.setItem(`sparkle_file_${path}`, data); } catch (e) {}
    }
  }

  async readPrivateFile(path: string): Promise<string | null> {
    if (this.isNative) {
      try {
        const result = await Filesystem.readFile({
          path: `sparkle/${path}`,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
        return typeof result.data === 'string' ? result.data : null;
      } catch {
        return null;
      }
    } else {
      try { return localStorage.getItem(`sparkle_file_${path}`); } catch { return null; }
    }
  }

  async deletePrivateFile(path: string): Promise<void> {
    if (this.isNative) {
      try {
        await Filesystem.deleteFile({
          path: `sparkle/${path}`,
          directory: Directory.Data,
        });
      } catch {}
    } else {
      try { localStorage.removeItem(`sparkle_file_${path}`); } catch {}
    }
  }

  // ─── Privacy Cache ────────────────────────────────────────────────
  // Dedicated methods for per-chat privacy settings cache.
  // Enables instant FLAG_SECURE hydration before network response.

  async setPrivacyCache(chatId: string, settings: any): Promise<void> {
    await this.setJSON(`sparkle_privacy_cache_${chatId}`, settings);
  }

  async getPrivacyCache(chatId: string): Promise<any | null> {
    return this.getJSON(`sparkle_privacy_cache_${chatId}`);
  }

  // ─── Offline Queue ────────────────────────────────────────────────
  // Persistent queue that survives app kills, process death, reboots.

  async getOfflineQueue(): Promise<any[]> {
    return (await this.getJSON<any[]>('sparkle_persistent_outgoing_queue')) || [];
  }

  async saveOfflineQueue(queue: any[]): Promise<void> {
    await this.setJSON('sparkle_persistent_outgoing_queue', queue);
  }

  // ─── Offline Interactions Queue ───────────────────────────────────

  async getInteractionsQueue(): Promise<any[]> {
    return (await this.getJSON<any[]>('sparkle_offline_interactions')) || [];
  }

  async saveInteractionsQueue(queue: any[]): Promise<void> {
    await this.setJSON('sparkle_offline_interactions', queue);
  }

  // ─── Cache Management ─────────────────────────────────────────────

  async clearCache(category?: string): Promise<void> {
    if (!this.isNative) {
      // On web, clear sparkle_file_ prefixed items
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('sparkle_file_cache/')) {
          if (!category || key.includes(`cache/${category}/`)) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      return;
    }

    const targetDir = category ? `sparkle/cache/${category}` : 'sparkle/cache';
    try {
      await Filesystem.rmdir({
        path: targetDir,
        directory: Directory.Data,
        recursive: true,
      });
      // Recreate the directory structure
      if (category) {
        await Filesystem.mkdir({
          path: targetDir,
          directory: Directory.Data,
          recursive: true,
        });
      } else {
        // Recreate all cache subdirectories
        for (const dir of STORAGE_DIRS) {
          if (dir.startsWith('sparkle/cache/')) {
            await Filesystem.mkdir({ path: dir, directory: Directory.Data, recursive: true });
          }
        }
      }
    } catch {}
  }

  // ─── Storage Health ───────────────────────────────────────────────

  async verifyDirectories(): Promise<{ total: number; healthy: number; repaired: number }> {
    let total = STORAGE_DIRS.length;
    let healthy = 0;
    let repaired = 0;

    if (!this.isNative) {
      return { total, healthy: total, repaired: 0 };
    }

    for (const dir of STORAGE_DIRS) {
      try {
        await Filesystem.readdir({ path: dir, directory: Directory.Data });
        healthy++;
      } catch {
        // Directory missing — repair it
        try {
          await Filesystem.mkdir({ path: dir, directory: Directory.Data, recursive: true });
          repaired++;
          healthy++;
        } catch {
          // Truly broken — count as unhealthy
        }
      }
    }

    return { total, healthy, repaired };
  }

  // ─── Operation Journaling (Crash Recovery) ─────────────────────────

  async logOperation(operation: string): Promise<void> {
    const entry = `[${new Date().toISOString()}] ${operation}\n`;
    try {
      const existing = (await this.readPrivateFile('logs/operations.log')) || '';
      // Keep last 100 log lines to prevent unbounded growth
      const lines = (existing + entry).split('\n').slice(-100).join('\n');
      await this.writePrivateFile('logs/operations.log', lines);
    } catch {}
  }

  // ─── Media Indexing & Eviction ─────────────────────────────────────

  async updateMediaIndex(assetId: string, metadata: { chatId: string; sizeBytes: number; category: string }): Promise<void> {
    const index = (await this.getJSON<Record<string, any>>('sparkle_media_index')) || {};
    index[assetId] = {
      ...metadata,
      lastAccess: new Date().toISOString(),
    };
    await this.setJSON('sparkle_media_index', index);
  }

  async getMediaIndex(): Promise<Record<string, any>> {
    return (await this.getJSON<Record<string, any>>('sparkle_media_index')) || {};
  }

  // ─── Automatic Storage Repair & Self-Healing ───────────────────────

  async repairCorruptedStorage(): Promise<{ repairedDirectories: number; resetQueues: number }> {
    let repairedDirectories = 0;
    let resetQueues = 0;

    // 1. Verify and rebuild missing sandbox directories
    const dirResult = await this.verifyDirectories();
    repairedDirectories = dirResult.repaired;

    // 2. Validate offline queue JSON structure
    try {
      const queue = await this.getOfflineQueue();
      if (!Array.isArray(queue)) {
        await this.saveOfflineQueue([]);
        resetQueues++;
      }
    } catch {
      await this.saveOfflineQueue([]);
      resetQueues++;
    }

    // 3. Log repair event to operations journal
    await this.logOperation(`Self-repair completed: ${repairedDirectories} dir(s) repaired, ${resetQueues} queue(s) reset.`);

    return { repairedDirectories, resetQueues };
  }

  /**
   * Full storage wipe for logout / account deletion.
   * Removes ALL private data.
   */
  async clearAllData(): Promise<void> {
    if (this.isNative) {
      try {
        await Filesystem.rmdir({
          path: 'sparkle',
          directory: Directory.Data,
          recursive: true,
        });
      } catch {}
      await Preferences.clear();
    } else {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('sparkle_')) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
    this.initialized = false;
  }
}

/** Singleton instance */
export const SparkleStorage = new SparkleStorageServiceClass();
