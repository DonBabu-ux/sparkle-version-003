'use strict';

// Shared AfterGlow story privacy vocabulary. Mirrors the moments audience
// model so creators pick from the same options wherever they post.
const STORY_AUDIENCES = new Set(['public', 'followers', 'close_friends', 'only_me']);

const STORY_AUDIENCE_LABELS = {
    public: 'Everyone',
    followers: 'Followers',
    close_friends: 'Close Friends',
    only_me: 'Only Me',
};

/**
 * Normalise a client-supplied audience. Anything unrecognised (or missing)
 * falls back to 'public' so older clients keep working unchanged.
 */
function resolveStoryAudience(input) {
    return STORY_AUDIENCES.has(input) ? input : 'public';
}

/**
 * Single source of truth for "can viewerId see this story row".
 * `story` must carry at least { user_id, audience }.
 */
async function canViewStory(pool, story, viewerId) {
    if (!story) return false;
    if (!viewerId) return story.audience === 'public';
    if (story.user_id === viewerId) return true;

    switch (story.audience) {
        case 'only_me':
            return false;
        case 'followers': {
            const [rows] = await pool.query(
                'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
                [viewerId, story.user_id]
            );
            return rows.length > 0;
        }
        case 'close_friends': {
            const [rows] = await pool.query(
                'SELECT 1 FROM close_friends WHERE user_id = ? AND friend_id = ? LIMIT 1',
                [story.user_id, viewerId]
            );
            return rows.length > 0;
        }
        case 'public':
        default:
            return true;
    }
}

module.exports = { STORY_AUDIENCES, STORY_AUDIENCE_LABELS, resolveStoryAudience, canViewStory };
