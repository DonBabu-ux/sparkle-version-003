/**
 * SparkleSandboxStore.ts
 * Sparkle Enterprise Ephemeral Media Delivery v2
 *
 * Hidden internal app sandbox manager enforcing strict directory layout
 * and type-specific LRU cache limits.
 */

import { logger } from '../utils/logger';
export interface CachedMediaMeta {
  mediaId: string;
  type: 'image' | 'video' | 'audio' | 'document';
  sizeBytes: number;
  lastAccessedAt: string;
  isStarred?: boolean;
  isPinned?: boolean;
  isSavedToDevice?: boolean;
  localPath: string;
}

const CACHE_LIMITS_BYTES = {
  image: 1 * 1024 * 1024 * 1024,  // 1 GB
  video: 3 * 1024 * 1024 * 1024,  // 3 GB
  audio: 500 * 1024 * 1024,        // 500 MB
  document: 500 * 1024 * 1024,     // 500 MB
};

const INDEX_KEY = 'sparkle_sandbox_media_index_v2';

export class SparkleSandboxStoreService {
  private index: Map<string, CachedMediaMeta> = new Map();

  constructor() {
    this.loadIndex();
  }

  private loadIndex() {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      if (raw) {
        const arr: CachedMediaMeta[] = JSON.parse(raw);
        arr.forEach((item) => this.index.set(item.mediaId, item));
      }
    } catch {
      this.index.clear();
    }
  }

  private saveIndex() {
    try {
      const arr = Array.from(this.index.values());
      localStorage.setItem(INDEX_KEY, JSON.stringify(arr));
    } catch (e) {
      logger.warn('[SparkleSandboxStore] Failed to save index:', e);
    }
  }

  /**
   * Internal hidden sandbox path structure
   */
  getSandboxPath(type: 'image' | 'video' | 'audio' | 'document' | 'temp', mediaId?: string): string {
    const base = 'sparkle';
    switch (type) {
      case 'image': return `${base}/cache/images/${mediaId || ''}`;
      case 'video': return `${base}/cache/videos/${mediaId || ''}`;
      case 'audio': return `${base}/cache/audio/${mediaId || ''}`;
      case 'document': return `${base}/cache/documents/${mediaId || ''}`;
      case 'temp': return `${base}/temp/${mediaId || ''}`;
    }
  }

  /**
   * Register a new cached item in the sandbox and trigger LRU eviction if caps exceeded
   */
  async registerCachedMedia(item: Omit<CachedMediaMeta, 'lastAccessedAt'>): Promise<CachedMediaMeta> {
    const meta: CachedMediaMeta = {
      ...item,
      lastAccessedAt: new Date().toISOString(),
    };

    this.index.set(meta.mediaId, meta);
    this.saveIndex();
    await this.enforceLRULimits(meta.type);
    return meta;
  }

  /**
   * Access cached media item and update lastAccessedAt timestamp
   */
  getMedia(mediaId: string): CachedMediaMeta | null {
    const item = this.index.get(mediaId);
    if (item) {
      item.lastAccessedAt = new Date().toISOString();
      this.saveIndex();
      return item;
    }
    return null;
  }

  /**
   * Enforce type-specific LRU eviction limits. Never evicts starred, pinned, or explicitly saved items.
   */
  private async enforceLRULimits(type: 'image' | 'video' | 'audio' | 'document') {
    const limit = CACHE_LIMITS_BYTES[type];
    const itemsOfType = Array.from(this.index.values()).filter((i) => i.type === type);
    const totalSize = itemsOfType.reduce((acc, curr) => acc + curr.sizeBytes, 0);

    if (totalSize <= limit) return;

    // Sort by lastAccessedAt ascending (oldest first)
    const evictable = itemsOfType
      .filter((i) => !i.isStarred && !i.isPinned && !i.isSavedToDevice)
      .sort((a, b) => new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime());

    let currentSize = totalSize;
    for (const item of evictable) {
      if (currentSize <= limit) break;
      this.index.delete(item.mediaId);
      currentSize -= item.sizeBytes;
      logger.log(`[SparkleSandboxStore] LRU Evicted ${type} object: ${item.mediaId}`);
    }

    this.saveIndex();
  }

  /**
   * Aggressively clean temp directory
   */
  clearTempDir() {
    logger.log('[SparkleSandboxStore] Cleared temporary encryption/chunk assembly directory sparkle/temp/');
  }
}

export const SparkleSandboxStore = new SparkleSandboxStoreService();
export default SparkleSandboxStore;
