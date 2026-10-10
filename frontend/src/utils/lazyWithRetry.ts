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
          // Second failure: hard reload to pick up the new HTML entry
          if (!sessionStorage.getItem('sparkle_chunk_reload')) {
            sessionStorage.setItem('sparkle_chunk_reload', '1');
            window.location.reload();
            // Hang the current render until reload completes
            return new Promise(() => {});
          }
        }
      } else {
        // Already retried this session — reload once, then give up to ErrorBoundary
        if (!sessionStorage.getItem('sparkle_chunk_reload')) {
          sessionStorage.setItem('sparkle_chunk_reload', '1');
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw err;
    }
  });
}
