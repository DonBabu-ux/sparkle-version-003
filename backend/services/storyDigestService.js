'use strict';

/**
 * services/storyDigestService.js
 *
 * Engagement Engine Phase 1b — "your friends are sharing new stories".
 *
 * The spec asks for one notification naming up to three people, chosen by
 * how much the recipient interacts with them, excluding stories that have
 * expired, that the recipient has already seen, or that come from someone
 * they have muted or blocked, and never repeating a story already digested.
 *
 * Ranking is the weighted model from the spec, applied to the same signals
 * available here so stories and reels agree:
 *
 *   view 1  like 4  comment 5  share 6
 *
 * Only stories still unexpired are candidates, and the "already seen" check
 * uses story_views rather than trusting the client, which is the only thing
 * that survives a user dismissing the tray without opening anything.
 */

const pool = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const INTERACTION_WEIGHTS = { view: 1, like: 4, comment: 5, share: 6 };
const INTERACTION_WINDOW_DAYS = 30; // how far back interactions count
const MAX_NAMED_CREATORS = 3; // "John, Mary and 1 other"
const BATCH_LIMIT = 50; // recipients per sweep

/**
 * How much a user interacts with a given creator, weighted.
 * Used only for ordering, so it returns zero rather than omitting when there
 * is no history — a followed creator with no interactions still belongs in the
 * digest, just ranked last.
 */
const CREATOR_AFFINITY_SQL = `
  COALESCE((
    SELECT
        ${INTERACTION_WEIGHTS.view}   * (SELECT COUNT(*) FROM story_views   v WHERE v.user_id = u.user_id AND v.story_id IN (SELECT story_id FROM stories WHERE user_id = s.user_id AND created_at >= NOW() - INTERVAL ${INTERACTION_WINDOW_DAYS} DAY))
      + ${INTERACTION_WEIGHTS.like}   * (SELECT COUNT(*) FROM story_likes   l WHERE l.user_id = u.user_id AND l.story_id IN (SELECT story_id FROM stories WHERE user_id = s.user_id AND created_at >= NOW() - INTERVAL ${INTERACTION_WINDOW_DAYS} DAY))
      + ${INTERACTION_WEIGHTS.comment}* (SELECT COUNT(*) FROM story_comments c WHERE c.user_id = u.user_id AND c.story_id IN (SELECT story_id FROM stories WHERE user_id = s.user_id AND created_at >= NOW() - INTERVAL ${INTERACTION_WINDOW_DAYS} DAY))
      + ${INTERACTION_WEIGHTS.share}  * (SELECT COUNT(*) FROM story_shares  sh WHERE sh.user_id = u.user_id AND sh.story_id IN (SELECT story_id FROM stories WHERE user_id = s.user_id AND created_at >= NOW() - INTERVAL ${INTERACTION_WINDOW_DAYS} DAY))
  ), 0)
`;

/**
 * The affinity ordering as a derived table, so the worker and this class
 * cannot drift apart on which signals count or how far back they reach.
 * Attached after the class declaration below, because the class const
 * block references it.
 */

class StoryDigestService {
  /**
   * Recipients who have at least one digestible story, with the stories
   * themselves. Each row is one eligible story for one user, ordered by
   * creator affinity so the caller can take the first three per user.
   *
   * The "already viewed", "already digested", "muted" and "blocked" exclusions
   * live in the WHERE clause rather than in JS, so the limit applies after the
   * exclusions rather than before them.
   */
  static async findEligibleDigests() {
    const [rows] = await pool.query(
      `SELECT
         u.user_id                        AS user_id,
         COALESCE(u.notifications_stories, 1) AS stories_enabled,
         s.story_id,
         s.user_id                        AS creator_id,
         s.created_at,
         s.expires_at,
         creator.username                 AS creator_username,
         creator.name                     AS creator_name,
         ${CREATOR_AFFINITY_SQL}           AS affinity
       FROM stories s
       JOIN users creator ON creator.user_id = s.user_id
       JOIN users u       ON u.user_id != s.user_id
       WHERE s.expires_at > NOW()
         AND s.created_at >= NOW() - INTERVAL ${INTERACTION_WINDOW_DAYS} DAY
         -- the recipient follows the creator (or is followed back: friends
         -- either way, matching how the rest of the app defines the relation)
         AND (
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.user_id AND f.following_id = s.user_id)
           OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = s.user_id AND f.following_id = u.user_id)
         )
         -- not muted by the recipient
         AND NOT EXISTS (SELECT 1 FROM user_mutes m WHERE m.muter_id = u.user_id AND m.muted_id = s.user_id)
         -- the creator has not blocked the recipient from their stories, and
         -- the recipient has not blocked the creator
         AND NOT EXISTS (SELECT 1 FROM story_privacy_blocks b WHERE b.user_id = s.user_id AND b.blocked_user_id = u.user_id)
         AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = u.user_id AND ub.blocked_id = s.user_id)
         -- the recipient has not already watched it
         AND NOT EXISTS (SELECT 1 FROM story_views v WHERE v.story_id = s.story_id AND v.user_id = u.user_id)
         -- it has not been included in a digest for this recipient already
         AND NOT EXISTS (SELECT 1 FROM story_digest_notified n WHERE n.story_id = s.story_id AND n.user_id = u.user_id)
       ORDER BY u.user_id, affinity DESC, s.created_at DESC
       LIMIT ?`,
      [BATCH_LIMIT * MAX_NAMED_CREATORS]
    );
    return rows;
  }

  /**
   * Build the notification copy from the chosen stories.
   * "John, Mary and 1 other have shared new stories."
   */
  static buildCopy(rows) {
    // Group by creator first. "N others" must mean other PEOPLE, not extra
    // stories — someone posting three times is one name, not a name and two
    // strangers — so the count is of distinct creators beyond the named ones.
    const byCreator = new Map();
    for (const r of rows) {
      if (!byCreator.has(r.creator_id)) {
        byCreator.set(r.creator_id, r.creator_name || r.creator_username || 'Someone');
      }
    }
    const creatorNames = [...byCreator.values()];
    const storyCount = new Set(rows.map((r) => r.story_id)).size;
    const named = creatorNames.slice(0, MAX_NAMED_CREATORS);
    const others = Math.max(0, creatorNames.length - named.length);

    let body;
    if (named.length === 0) {
      body = 'Your friends have shared new stories.';
    } else if (named.length === 1 && others === 0) {
      // One person: say how many if it is more than one story.
      const first = named[0];
      body = storyCount > 1
        ? `${first} has shared ${storyCount} new stories. See what they're up to!`
        : `${first} has shared a new story. See what they're up to!`;
    } else {
      const items = others > 0
        ? [...named, others === 1 ? '1 other' : `${others} others`]
        : named;
      const list = items.length > 2
        ? items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]
        : items.join(' and ');
      body = `${list} have shared new stories. See what they're up to!`;
    }

    return { title: "Your friends are sharing new stories!", content: body, storyCount };
  }

  /**
   * Mark stories as digested for a recipient. Called only after a successful
   * send so a failure is retried rather than recorded as delivered.
   */
  static async markNotified({ userId, storyIds }) {
    if (!storyIds || storyIds.length === 0) return 0;
    const values = storyIds.map((storyId) => [uuidv4(), userId, storyId]);
    await pool.query(
      `INSERT IGNORE INTO story_digest_notified (notified_id, user_id, story_id)
       VALUES ?`,
      [values]
    );
    return values.length;
  }

  /**
   * One-off cleanup of rows belonging to stories that have expired, for the
   * retention sweep. Not needed for correctness.
   */
  static async pruneExpired() {
    const [res] = await pool.query(
      `DELETE n FROM story_digest_notified n
       LEFT JOIN stories s ON s.story_id = n.story_id
       WHERE s.story_id IS NULL OR s.expires_at < NOW()`
    );
    return res && typeof res.affectedRows === 'number' ? res.affectedRows : 0;
  }
}

module.exports = StoryDigestService;

// Attached after the class so the worker can reuse the identical ranking
// rather than re-implementing it and drifting.
StoryDigestService.AFFINITY_SUBQUERY = () => `
  SELECT
    u.user_id      AS user_id,
    s.user_id      AS creator_id,
    COALESCE(
      ${INTERACTION_WEIGHTS.view}    * (SELECT COUNT(DISTINCT v.story_id)  FROM story_views    v  JOIN stories sv ON sv.story_id = v.story_id WHERE v.user_id = u.user_id AND sv.user_id = s.user_id AND sv.created_at >= NOW() - INTERVAL ${INTERACTION_WINDOW_DAYS} DAY)
    + ${INTERACTION_WEIGHTS.like}    * (SELECT COUNT(DISTINCT l.story_id)  FROM story_likes    l  JOIN stories sl ON sl.story_id = l.story_id WHERE l.user_id = u.user_id AND sl.user_id = s.user_id AND sl.created_at >= NOW() - INTERVAL ${INTERACTION_WINDOW_DAYS} DAY)
    + ${INTERACTION_WEIGHTS.comment} * (SELECT COUNT(DISTINCT c.story_id)  FROM story_comments c  JOIN stories sc ON sc.story_id = c.story_id WHERE c.user_id = u.user_id AND sc.user_id = s.user_id AND sc.created_at >= NOW() - INTERVAL ${INTERACTION_WINDOW_DAYS} DAY)
    + ${INTERACTION_WEIGHTS.share}   * (SELECT COUNT(DISTINCT sh.story_id) FROM story_shares   sh JOIN stories ss ON ss.story_id = sh.story_id WHERE sh.user_id = u.user_id AND ss.user_id = s.user_id AND ss.created_at >= NOW() - INTERVAL ${INTERACTION_WINDOW_DAYS} DAY)
    , 0) AS affinity
  FROM stories s
  JOIN users u ON u.user_id != s.user_id
  WHERE s.created_at >= NOW() - INTERVAL ${INTERACTION_WINDOW_DAYS} DAY
`;

module.exports.INTERACTION_WEIGHTS = INTERACTION_WEIGHTS;
module.exports.INTERACTION_WINDOW_DAYS = INTERACTION_WINDOW_DAYS;
module.exports.MAX_NAMED_CREATORS = MAX_NAMED_CREATORS;
module.exports.BATCH_LIMIT = BATCH_LIMIT;
