/**
 * One-time cleanup: remove owner-self VIEW rows from story_views and
 * recompute story view counts so the author never appears as their own
 * viewer (WhatsApp/Facebook semantics).
 *
 * Owner self-LIKES are intentionally left alone: liking your own story is
 * a valid author interaction (Instagram shows "You liked this") and the
 * viewer list already filters the author out server-side.
 *
 * Usage: node scripts/fix-story-self-views.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

(async () => {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
    });

    const [before] = await pool.query(
        'SELECT COUNT(*) AS c FROM story_views sv JOIN stories s ON sv.story_id = s.story_id WHERE sv.user_id = s.user_id'
    );
    console.log(`owner-self view rows before: ${before[0].c}`);

    if (Number(before[0].c) === 0) {
        console.log('nothing to clean');
        await pool.end();
        return;
    }

    // Capture affected stories so their counts can be recomputed after the delete.
    const [affected] = await pool.query(
        'SELECT DISTINCT sv.story_id FROM story_views sv JOIN stories s ON sv.story_id = s.story_id WHERE sv.user_id = s.user_id'
    );

    await pool.query(
        'DELETE sv FROM story_views sv JOIN stories s ON sv.story_id = s.story_id WHERE sv.user_id = s.user_id'
    );
    console.log(`deleted ${before[0].c} owner-self view rows`);

    for (const row of affected) {
        await pool.query(
            'UPDATE stories SET view_count = (SELECT COUNT(*) FROM story_views WHERE story_id = ?) WHERE story_id = ?',
            [row.story_id, row.story_id]
        );
    }
    console.log(`recomputed view_count for ${affected.length} stories`);

    const [after] = await pool.query(
        'SELECT COUNT(*) AS c FROM story_views sv JOIN stories s ON sv.story_id = s.story_id WHERE sv.user_id = s.user_id'
    );
    console.log(`owner-self view rows after: ${after[0].c}`);

    await pool.end();
})().catch((e) => {
    console.error('cleanup failed:', e.message);
    process.exit(1);
});
