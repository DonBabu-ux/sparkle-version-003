const cron = require('node-cron');
const pool = require('../config/database');
const logger = require('../utils/logger');
const StoryDigestService = require('../services/storyDigestService');
const NotificationService = require('../services/notification.service');

// Every hour on the quarter, staggered from the marketplace notifier (*/30)
// and the message reminder worker (10,40). One digest per user per sweep is
// the intent, so the hourly cadence is also the frequency cap.
const SCHEDULE = '15 * * * *';

cron.schedule(SCHEDULE, async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // One query, one snapshot. The exclusions (viewed, already digested, muted,
    // blocked) live in the WHERE clause so the limit applies after them, and
    // affinity ordering means the first three per user are the creators that
    // user actually engages with rather than the most recent strangers.
    const [rows] = await connection.query(
      `SELECT
         u.user_id                            AS user_id,
         COALESCE(u.notifications_stories, 1) AS stories_enabled,
         s.story_id,
         s.user_id                            AS creator_id,
         s.created_at,
         creator.username                     AS creator_username,
         creator.name                         AS creator_name,
         creator_affinity.affinity            AS affinity
       FROM stories s
       JOIN users creator ON creator.user_id = s.user_id
       JOIN users u       ON u.user_id != s.user_id
       LEFT JOIN (
         ${StoryDigestService.AFFINITY_SUBQUERY()}
       ) creator_affinity
         ON creator_affinity.user_id = u.user_id
        AND creator_affinity.creator_id = s.user_id
       WHERE s.expires_at > NOW()
         AND s.created_at >= NOW() - INTERVAL ? DAY
         AND (
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.user_id AND f.following_id = s.user_id)
           OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = s.user_id AND f.following_id = u.user_id)
         )
         AND NOT EXISTS (SELECT 1 FROM user_mutes m WHERE m.muter_id = u.user_id AND m.muted_id = s.user_id)
         AND NOT EXISTS (SELECT 1 FROM story_privacy_blocks b WHERE b.user_id = s.user_id AND b.blocked_user_id = u.user_id)
         AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = u.user_id AND ub.blocked_id = s.user_id)
         AND NOT EXISTS (SELECT 1 FROM story_views v WHERE v.story_id = s.story_id AND v.user_id = u.user_id)
         AND NOT EXISTS (SELECT 1 FROM story_digest_notified n WHERE n.story_id = s.story_id AND n.user_id = u.user_id)
       ORDER BY u.user_id, affinity DESC, s.created_at DESC
       LIMIT ?`,
      [
        StoryDigestService.INTERACTION_WINDOW_DAYS,
        StoryDigestService.BATCH_LIMIT * StoryDigestService.MAX_NAMED_CREATORS,
      ]
    );

    await connection.commit();

    const byUser = new Map();
    for (const row of rows) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
      byUser.get(row.user_id).push(row);
    }

    let sent = 0;
    let skipped = 0;

    for (const [userId, stories] of byUser) {
      // Already ordered by affinity per user, so the first three are the
      // creators that user engages with most.
      const chosen = stories.slice(0, StoryDigestService.MAX_NAMED_CREATORS);
      const storyIds = stories.map((s) => s.story_id);

      if (Number(stories[0].stories_enabled) === 0) { skipped += 1; continue; }

      const copy = StoryDigestService.buildCopy(chosen);

      try {
        await NotificationService.send({
          type: 'story',
          priority: 'NORMAL',
          recipients: [userId],
          data: {
            title: copy.title,
            content: copy.content,
            url: '/stories',
            storyCount: String(copy.storyCount),
          },
        });
        // Only after a successful send, so a failure retries next sweep
        // instead of being silently recorded as delivered.
        await StoryDigestService.markNotified({ userId, storyIds });
        sent += 1;
      } catch (notifErr) {
        logger.error(`[storyDigest] failed for user ${userId}: ${notifErr.message}`);
      }
    }

    if (sent > 0 || skipped > 0) {
      logger.info(
        `[storyDigest] sweep done: ${sent} digest(s) sent, ${skipped} opted out, ` +
        `${byUser.size} recipient(s) with eligible stories`
      );
    }
  } catch (error) {
    logger.error('[storyDigest] sweep failed:', error.message);
  } finally {
    if (connection) {
      try { await connection.release(); } catch (_) { /* already closed */ }
    }
  }
});

logger.info('[storyDigest] worker scheduled (' + SCHEDULE + ')');

module.exports = { SCHEDULE };
