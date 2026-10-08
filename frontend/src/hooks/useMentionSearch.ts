import { useEffect, useState } from 'react';
import api from '../api/api';
import { logger } from '../utils/logger';

/** One user row returned by /users/search (and /users/following). */
export interface MentionOption {
  user_id?: string;
  id?: string | number;
  username: string;
  name?: string;
  avatar?: string;
  avatar_url?: string;
  account_type?: string;
  is_verified?: boolean | number;
  follower_count?: number;
  is_following?: boolean;
  is_follower?: boolean;
}

interface UseMentionSearchOptions {
  /** Minimum raw query length required before searching (default 1). */
  minLength?: number;
  /** Debounce before firing the request, in ms (default 300). */
  debounceMs?: number;
  /** When true, the bare "@" query fetches /users/following immediately (0ms delay). */
  followingsOnBareAt?: boolean;
  /** Set loading synchronously while debouncing (eager) instead of when the request fires (lazy). */
  eagerLoading?: boolean;
  /** Cap the returned list. */
  limit?: number;
  /** Skip searching entirely and expose an empty list (default true). */
  enabled?: boolean;
}

/**
 * Shared debounced user lookup for @-mention popups.
 *
 * Behaviour shared by every call site:
 * - query shorter than `minLength` (or disabled) exposes an empty list
 *   synchronously, so popups close in the same tick as before;
 * - API responses may be a bare array or `{ users: [...] }`;
 * - stale in-flight responses are discarded when the query changes;
 * - errors log and expose an empty list.
 */
export function useMentionSearch(
  query: string,
  {
    minLength = 1,
    debounceMs = 300,
    followingsOnBareAt = false,
    eagerLoading = false,
    limit,
    enabled = true,
  }: UseMentionSearchOptions = {}
): { options: MentionOption[]; loading: boolean } {
  const [results, setResults] = useState<MentionOption[]>([]);
  const [loading, setLoading] = useState(false);

  const active = enabled && query.length >= minLength;

  useEffect(() => {
    if (!enabled || query.length < minLength) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const bareAt = followingsOnBareAt && query === '@';
    if (eagerLoading) setLoading(true);
    const timer = setTimeout(async () => {
      if (!eagerLoading) setLoading(true);
      try {
        const res = bareAt
          ? await api.get('/users/following?q=')
          : await api.get(`/users/search?q=${encodeURIComponent(query.replace('@', '').trim())}`);
        if (cancelled) return;
        const data: unknown = res.data;
        let list: MentionOption[] = Array.isArray(data)
          ? data
          : ((data as { users?: MentionOption[] } | null)?.users ?? []);
        if (limit !== undefined) list = list.slice(0, limit);
        setResults(list);
      } catch (err) {
        if (!cancelled) {
          logger.error('Mention search failed:', err);
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, bareAt ? 0 : debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, minLength, debounceMs, followingsOnBareAt, eagerLoading, limit, enabled]);

  return { options: active ? results : [], loading: active && loading };
}
