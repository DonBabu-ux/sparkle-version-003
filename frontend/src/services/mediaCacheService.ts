/**
 * MediaCacheService.ts
 *
 * Enterprise Local-First Media Retrieval & Caching Architecture.
 *
 * Core Principles:
 * 1. Cache the media file bytes (Blobs), NOT temporary or signed delivery URLs.
 * 2. Identify media using a STABLE media ID (content ID or Cloudinary public ID),
 *    never by temporary signed Cloudinary URLs which can rotate or expire.
 * 3. Media reuse across collections: The same video accessed via Profile (Own Videos),
 *    Liked Videos, Saved Videos, or Moments FYP resolves to the identical stable ID.
 * 4. Separation of Responsibilities:
 *    - Media bytes: Local storage first, original server CDN fallback.
 *    - Dynamic interactions (comments, likes, shares, counts, follows): Server-authoritative.
 * 5. Recovery & Self-Healing: If local cache is cleared or corrupted, seamlessly
 *    falls back to the server source and repairs the cache index.
 */

import { logger } from '../utils/logger';

export interface MediaCacheEntry {
  stableMediaId: string;
  contentId: string;
  contentType: 'video' | 'image';
  ownerId?: string;
  originalMediaUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileSize: number;
  cachedAt: string;
  lastAccessedAt: string;
  isOwned?: boolean;
  isLiked?: boolean;
  isSaved?: boolean;
  status: 'valid' | 'corrupted';
}

export interface MediaResolvable {
  moment_id?: string | number;
  post_id?: string | number;
  id?: string | number;
  media_url?: string | null;
  video_url?: string | null;
  streaming_url?: string | null;
  thumbnail_url?: string | null;
  media_type?: string | null;
  user_id?: string | number;
}

const DB_NAME = 'sparkle-local-media-cache';
const DB_VERSION = 1;
const STORE_BLOBS = 'media_blobs';
const STORE_INDEX = 'media_index';

// Maximum local media storage quota (500 MB)
const MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024;
// Keep track of active in-memory object URLs to revoke them on eviction
const activeObjectUrls = new Map<string, string>();
// Set of currently downloading IDs to prevent duplicate concurrent network fetches
const activeDownloads = new Set<string>();

class MediaCacheServiceClass {
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Generates a stable, canonical media ID that does NOT change when Cloudinary
   * delivery URLs are signed, versioned, or transformed.
   */
  getStableMediaId(item: MediaResolvable): string {
    // 1. If explicit moment_id is available
    if (item.moment_id != null && String(item.moment_id).trim() !== '') {
      return `moment_${String(item.moment_id).trim()}`;
    }

    // 2. If explicit post_id is available
    if (item.post_id != null && String(item.post_id).trim() !== '') {
      return `post_${String(item.post_id).trim()}`;
    }

    // 3. If explicit generic id is available
    if (item.id != null && String(item.id).trim() !== '') {
      return `media_${String(item.id).trim()}`;
    }

    // 4. Derive from URL without query params, transforms, or version tags
    const rawUrl = item.video_url || item.media_url || item.streaming_url || item.thumbnail_url || '';
    if (!rawUrl) return `media_unknown_${Date.now()}`;

    try {
      // Strip query parameters and hash
      const cleanUrl = rawUrl.split('?')[0].split('#')[0];

      // Extract Cloudinary public ID if applicable:
      // Pattern: /upload/(?:[a-zA-Z0-9_,]+)?/(?:v\d+/)?(.+)
      const cloudMatch = cleanUrl.match(/\/upload\/(?:[a-zA-Z0-9_,-]+\/)?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
      if (cloudMatch && cloudMatch[1]) {
        return `cloud_${cloudMatch[1].replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      }

      // Generic path-based stable key
      const parts = cleanUrl.split('/').filter(Boolean);
      const filename = parts[parts.length - 1] || 'media';
      return `url_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    } catch {
      return `media_hash_${encodeURIComponent(rawUrl).slice(-32)}`;
    }
  }

  /** Open or initialize the IndexedDB storage */
  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not supported in this environment'));
        return;
      }

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS);
        }
        if (!db.objectStoreNames.contains(STORE_INDEX)) {
          const indexStore = db.createObjectStore(STORE_INDEX, { keyPath: 'stableMediaId' });
          indexStore.createIndex('contentId', 'contentId', { unique: false });
          indexStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        logger.warn('[MediaCache] Failed to open IndexedDB:', req.error);
        reject(req.error || new Error('Failed to open MediaCache IndexedDB'));
      };
    });

    return this.dbPromise;
  }

  /** Run a read-only transaction */
  private async readTx<T>(storeName: string, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
    try {
      const db = await this.getDB();
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = fn(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      logger.warn(`[MediaCache] read error in ${storeName}:`, err);
      return null;
    }
  }

  /** Run a read-write transaction */
  private async writeTx<T>(storeName: string, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
    try {
      const db = await this.getDB();
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = fn(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      logger.warn(`[MediaCache] write error in ${storeName}:`, err);
      return null;
    }
  }

  /**
   * Retrieves a media asset local-first.
   * If cached locally and valid: returns `{ url: objectUrl, fromCache: true }`.
   * If cache miss: returns original server URL and triggers background caching when appropriate.
   */
  async getMediaUrl(item: MediaResolvable, opts?: { forceRefresh?: boolean; autoCache?: boolean }): Promise<{ url: string; fromCache: boolean; stableId: string }> {
    const stableId = this.getStableMediaId(item);
    const originalUrl = item.video_url || item.media_url || item.streaming_url || '';

    if (!originalUrl) {
      return { url: '', fromCache: false, stableId };
    }

    // 1. Return existing active object URL if already created in this session
    if (!opts?.forceRefresh && activeObjectUrls.has(stableId)) {
      return { url: activeObjectUrls.get(stableId)!, fromCache: true, stableId };
    }

    // 2. Check local IndexedDB storage
    if (!opts?.forceRefresh) {
      try {
        const indexRecord = await this.readTx<MediaCacheEntry>(STORE_INDEX, (store) => store.get(stableId));
        if (indexRecord && indexRecord.status === 'valid') {
          const blob = await this.readTx<Blob>(STORE_BLOBS, (store) => store.get(stableId));
          if (blob && blob.size > 0) {
            const objectUrl = URL.createObjectURL(blob);
            activeObjectUrls.set(stableId, objectUrl);

            // Update last accessed time asynchronously
            this.touchAccess(stableId).catch(() => {});

            return { url: objectUrl, fromCache: true, stableId };
          } else {
            // File reference invalid or 0-byte corrupt entry — clean it up safely
            this.invalidate(stableId).catch(() => {});
          }
        }
      } catch (err) {
        logger.warn('[MediaCache] Cache lookup failed, falling back to server URL:', err);
      }
    }

    // 3. Cache Miss: Fall back to authoritative server/CDN URL immediately
    // If autoCache is enabled or item is owned/liked/saved, schedule background caching
    if (opts?.autoCache !== false) {
      this.cacheMediaInBackground(item).catch(() => {});
    }

    return { url: originalUrl, fromCache: false, stableId };
  }

  /**
   * Background media downloader & cacher.
   * Downloads original media file, verifies content, stores Blob by stable ID,
   * and updates index metadata. Never blocks playback.
   */
  async cacheMediaInBackground(item: MediaResolvable, meta?: { isOwned?: boolean; isLiked?: boolean; isSaved?: boolean }): Promise<boolean> {
    const stableId = this.getStableMediaId(item);
    const originalUrl = item.video_url || item.media_url || item.streaming_url;

    if (!originalUrl || activeDownloads.has(stableId)) {
      return false;
    }

    // Check if already cached
    const existing = await this.readTx<MediaCacheEntry>(STORE_INDEX, (store) => store.get(stableId));
    if (existing && existing.status === 'valid') {
      // Update relationship flags if changed
      if (meta && (meta.isOwned || meta.isLiked || meta.isSaved)) {
        await this.updateMetadata(stableId, meta);
      }
      return true;
    }

    activeDownloads.add(stableId);

    try {
      // Fetch media file bytes from the original server URL
      const response = await fetch(originalUrl, { mode: 'cors' });
      if (!response.ok || response.status !== 200) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Downloaded media blob is empty');
      }

      // Check cache quota and evict LRU if needed
      await this.ensureStorageQuota(blob.size);

      // Save blob in IndexedDB
      await this.writeTx(STORE_BLOBS, (store) => store.put(blob, stableId));

      // Save metadata entry in IndexedDB
      const now = new Date().toISOString();
      const entry: MediaCacheEntry = {
        stableMediaId: stableId,
        contentId: String(item.moment_id || item.post_id || item.id || stableId),
        contentType: (item.media_type === 'image' || (!item.video_url && originalUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i))) ? 'image' : 'video',
        ownerId: item.user_id ? String(item.user_id) : undefined,
        originalMediaUrl: originalUrl,
        thumbnailUrl: item.thumbnail_url || undefined,
        mimeType: blob.type || 'video/mp4',
        fileSize: blob.size,
        cachedAt: now,
        lastAccessedAt: now,
        isOwned: meta?.isOwned,
        isLiked: meta?.isLiked,
        isSaved: meta?.isSaved,
        status: 'valid'
      };

      await this.writeTx(STORE_INDEX, (store) => store.put(entry));
      logger.log(`[MediaCache] Successfully cached ${stableId} (${Math.round(blob.size / 1024)} KB)`);
      return true;
    } catch (err) {
      logger.warn(`[MediaCache] Background cache failed for ${stableId}:`, err);
      return false;
    } finally {
      activeDownloads.delete(stableId);
    }
  }

  /** Update interaction/relationship flags (owned, liked, saved) for a cached media entry */
  async updateMetadata(stableId: string, updates: Partial<MediaCacheEntry>): Promise<void> {
    try {
      const existing = await this.readTx<MediaCacheEntry>(STORE_INDEX, (store) => store.get(stableId));
      if (existing) {
        const merged: MediaCacheEntry = { ...existing, ...updates, lastAccessedAt: new Date().toISOString() };
        await this.writeTx(STORE_INDEX, (store) => store.put(merged));
      }
    } catch (err) {
      logger.warn('[MediaCache] updateMetadata error:', err);
    }
  }

  /** Update lastAccessedAt timestamp */
  private async touchAccess(stableId: string): Promise<void> {
    await this.updateMetadata(stableId, { lastAccessedAt: new Date().toISOString() });
  }

  /** Invalidate and remove a single corrupted or stale media entry */
  async invalidate(stableId: string): Promise<void> {
    try {
      if (activeObjectUrls.has(stableId)) {
        URL.revokeObjectURL(activeObjectUrls.get(stableId)!);
        activeObjectUrls.delete(stableId);
      }
      await this.writeTx(STORE_BLOBS, (store) => store.delete(stableId));
      await this.writeTx(STORE_INDEX, (store) => store.delete(stableId));
      logger.log(`[MediaCache] Evicted entry ${stableId}`);
    } catch (err) {
      logger.warn(`[MediaCache] Error invalidating ${stableId}:`, err);
    }
  }

  /** Controlled LRU cache eviction when quota is exceeded */
  private async ensureStorageQuota(incomingBytes: number): Promise<void> {
    try {
      const allEntries = await this.readTx<MediaCacheEntry[]>(STORE_INDEX, (store) => store.getAll());
      if (!Array.isArray(allEntries)) return;

      const totalSize = allEntries.reduce((sum, e) => sum + (e.fileSize || 0), 0);
      if (totalSize + incomingBytes <= MAX_CACHE_SIZE_BYTES) return;

      // Sort by lastAccessedAt ascending (oldest first)
      // Never evict items that are currently active in memory
      const evictable = allEntries
        .filter((e) => !activeObjectUrls.has(e.stableMediaId))
        .sort((a, b) => new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime());

      let freedBytes = 0;
      const targetFree = incomingBytes + 50 * 1024 * 1024; // Free extra 50MB headroom

      for (const entry of evictable) {
        if (freedBytes >= targetFree) break;
        await this.invalidate(entry.stableMediaId);
        freedBytes += entry.fileSize || 0;
      }
    } catch (err) {
      logger.warn('[MediaCache] Quota management warning:', err);
    }
  }

  /**
   * Clear all locally cached media files and indexes.
   * Server references and actual ownership relationships remain safe on server.
   */
  async clearCache(): Promise<void> {
    try {
      // Revoke all created Object URLs
      for (const [, url] of activeObjectUrls.entries()) {
        URL.revokeObjectURL(url);
      }
      activeObjectUrls.clear();

      await this.writeTx(STORE_BLOBS, (store) => store.clear());
      await this.writeTx(STORE_INDEX, (store) => store.clear());
      logger.log('[MediaCache] Cleared all local media cache files.');
    } catch (err) {
      logger.warn('[MediaCache] Error clearing media cache:', err);
    }
  }

  /** Cache statistics */
  async getStats(): Promise<{ count: number; totalSizeBytes: number }> {
    try {
      const all = await this.readTx<MediaCacheEntry[]>(STORE_INDEX, (store) => store.getAll());
      if (!Array.isArray(all)) return { count: 0, totalSizeBytes: 0 };
      const totalSizeBytes = all.reduce((sum, e) => sum + (e.fileSize || 0), 0);
      return { count: all.length, totalSizeBytes };
    } catch {
      return { count: 0, totalSizeBytes: 0 };
    }
  }
}

export const MediaCacheService = new MediaCacheServiceClass();
