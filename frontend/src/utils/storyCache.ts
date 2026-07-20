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
