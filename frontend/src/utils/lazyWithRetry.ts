import { lazy } from 'react';

/**
 * Wraps a dynamic import for React.lazy with one automatic retry.
 *
 * After a redeploy, previously hashed chunks 404. Users with the old HTML
 * open would otherwise hit "Failed to fetch dynamically imported module"
 * and land on a white/error screen. This retries the import once (bypassing
 * the browser's failed-module cache), then forces a single hard reload as a
 * last resort so the user gets the fresh build instead of a dead screen.
 */
const reloadedOnceKey = '__sparkle_chunk_retry__';

const chunkReloadGuard = {
  key: 'sparkle_chunk_reloads',
  max: 2,
  windowMs: 10 * 60 * 1000,
};

/** Timestamps of hard chunk-reloads in this tab, bounded to max per window. */
function recentChunkReloads(): number[] {
  try {
    const raw = sessionStorage.getItem(chunkReloadGuard.key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((t) => Date.now() - t < chunkReloadGuard.windowMs) : [];
  } catch {
    return [];
  }
}

function recordChunkReload(): void {
  try {
    const next = [...recentChunkReloads(), Date.now()].slice(-chunkReloadGuard.max);
    sessionStorage.setItem(chunkReloadGuard.key, JSON.stringify(next));
  } catch {
    /* storage unavailable — the window bound degrades to this session */
  }
}

function canHardReloadForChunk(): boolean {
  // Never hard-reload in dev: a 404 chunk on the dev server is almost always a
  // stale HMR graph, and reloading loops forever. Surface it to the boundary.
  if (import.meta.env.DEV) return false;
  return recentChunkReloads().length < chunkReloadGuard.max;
}

export function lazyWithRetry<T extends React.ComponentType<any>>(
  importFactory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importFactory();
    } catch (err) {
      // First failure: retry once with a cache-busting hint
      const alreadyRetried = (window as any)[reloadedOnceKey];
      if (!alreadyRetried) {
        (window as any)[reloadedOnceKey] = true;
        // Small delay lets CDN/edge settle right after a deploy
        await new Promise((r) => setTimeout(r, 300));
        try {
          return await importFactory();
        } catch (retryErr) {
          // Second failure: hard reload to pick up the new HTML entry —
          // at most twice per 10 minutes, and never in dev.
          if (canHardReloadForChunk()) {
            recordChunkReload();
            window.location.reload();
            // Hang the current render until reload completes
            return new Promise(() => {});
          }
        }
      }
      throw err;
    }
  });
}
