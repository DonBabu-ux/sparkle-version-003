// Lightweight in-memory cache for story groups.
// Pre-populates StoryViewer so it can open instantly without waiting for a network fetch.

interface StoryItem {
  story_id: string;
  media_url: string;
  media_type: string;
  thumbnail_url?: string | null;
  [key: string]: any;
}

interface UserStoryGroup {
  user_id: string;
  user_name: string;
  username?: string;
  avatar_url?: string;
  stories: StoryItem[];
  [key: string]: any;
}

const _cache = new Map<string, UserStoryGroup>();

// ── Story composer helpers ───────────────────────────────────────────────
// Pure, storage-free logic shared by the story composer (CreateStory), the
// background upload worker and the dashboard. Colocated with the story cache
// so the story surface has a single dependency-free module to import from
// (these must stay free of React/zustand so they can be unit-tested in node).

/**
 * sessionStorage key CreateStory sets once a story is queued. Dashboard reads
 * it to force a story refresh; without this the freshly published story only
 * appeared after the next unrelated refresh.
 */
export const STORY_POSTED_FLAG_KEY = 'sparkle_story_posted';

/** Minimal storage surface so the helper can be driven by tests. */
export interface FlagStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

const resolveFlagStorage = (storage?: FlagStorage): FlagStorage | null => {
  if (storage) return storage;
  return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
};

/**
 * Reads the "story just posted" flag and clears it in the same call, so a
 * single dashboard mount consumes it exactly once.
 *
 * Returns true when the flag was present (caller should refetch), false when
 * absent or storage is unavailable.
 */
export function consumeStoryPostedFlag(storage?: FlagStorage): boolean {
  const store = resolveFlagStorage(storage);
  if (!store) return false;
  try {
    const posted = store.getItem(STORY_POSTED_FLAG_KEY);
    if (!posted) return false;
    store.removeItem(STORY_POSTED_FLAG_KEY);
    return true;
  } catch {
    // Private-mode / disabled storage: behave as if nothing was posted
    // rather than throwing inside a mount effect.
    return false;
  }
}

/** Undo/redo stack for story-editor snapshots (sticker placements). */
export interface SnapshotHistory<T> {
  /** Older snapshots, oldest first. */
  past: T[];
  /** The snapshot currently applied. */
  present: T;
  /** Snapshots undone via undo(), redo-able in order. */
  future: T[];
}

/** Cap so a long composing session cannot grow the stack without bound. */
export const SNAPSHOT_HISTORY_LIMIT = 25;

export function createSnapshotHistory<T>(present: T): SnapshotHistory<T> {
  return { past: [], present, future: [] };
}

/**
 * Records `snapshot` as the state to return to. Any redo branch is dropped.
 * A no-op change (deep-equal to the current snapshot) does not create a step.
 */
export function pushSnapshot<T>(history: SnapshotHistory<T>, snapshot: T): SnapshotHistory<T> {
  if (snapshot === history.present) return history;
  const past = [...history.past, history.present];
  return {
    past: past.length > SNAPSHOT_HISTORY_LIMIT ? past.slice(past.length - SNAPSHOT_HISTORY_LIMIT) : past,
    present: snapshot,
    future: [],
  };
}

/** Steps one snapshot back. Returns the same history when there is none. */
export function undoSnapshot<T>(history: SnapshotHistory<T>): SnapshotHistory<T> {
  if (history.past.length === 0) return history;
  const past = history.past.slice(0, -1);
  const present = history.past[history.past.length - 1];
  return { past, present, future: [history.present, ...history.future] };
}

/** Re-applies the last undone snapshot. Returns the same history when there is none. */
export function redoSnapshot<T>(history: SnapshotHistory<T>): SnapshotHistory<T> {
  if (history.future.length === 0) return history;
  const [present, ...future] = history.future;
  return { past: [...history.past, history.present], present, future };
}

export function canUndoSnapshot<T>(history: SnapshotHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedoSnapshot<T>(history: SnapshotHistory<T>): boolean {
  return history.future.length > 0;
}

/**
 * Multipart field names the backend `createStory` reads for a story upload.
 * Kept structural (no uploadStore import) so this module stays test-only-safe.
 */
export interface StoryUploadMeta {
  caption?: string;
  audience?: string;
  save_to_gallery?: boolean;
  storyDuration?: number;
  storyTheme?: string;
  stickers?: string;
  parentStoryId?: string;
  musicInfo?: string;
  storyLayers?: string;
  textContent?: string;
  textConfig?: string;
}

/**
 * Maps story metadata onto the multipart field names createStory expects.
 * Empty/undefined values are omitted, so an optional field never ships as an
 * empty string (which would overwrite a server-side default).
 */
export function buildStoryUploadFields(meta: StoryUploadMeta): Record<string, string> {
  const fields: Record<string, string> = {};
  const put = (key: string, value: string | number | boolean | undefined | null) => {
    if (value === undefined || value === null) return;
    const text = String(value);
    if (text === '') return;
    fields[key] = text;
  };
  put('caption', meta.caption);
  put('audience', meta.audience);
  put('save_to_gallery', meta.save_to_gallery);
  put('story_duration', meta.storyDuration);
  put('story_theme', meta.storyTheme);
  put('stickers', meta.stickers);
  put('parent_story_id', meta.parentStoryId);
  put('music_info', meta.musicInfo);
  put('story_layers', meta.storyLayers);
  put('text_content', meta.textContent);
  put('text_config', meta.textConfig);
  return fields;
}

export const storyCache = {
  /** Store a story group by userId */
  set(userId: string, group: UserStoryGroup) {
    _cache.set(String(userId), group);
  },

  /** Retrieve a cached story group */
  get(userId: string): UserStoryGroup | undefined {
    return _cache.get(String(userId));
  },

  /** Populate from the full stories array returned by /stories/active */
  populate(stories: UserStoryGroup[]) {
    stories.forEach(group => _cache.set(String(group.user_id), group));
  },

  clear() {
    _cache.clear();
  },
};
