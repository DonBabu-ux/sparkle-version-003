const cron = require('node-cron');
const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Media Health Worker
 *
 * Recurring probe of user-facing media URLs so a dead asset (Cloudinary
 * destroyed, external host blocking hotlink, expired signed URL) never
 * reaches a user's feed as a broken "Media Unavailable" tile.
 *
 * Two-strike rule: a URL must fail on two consecutive hourly runs before
 * any destructive action is taken, so a transient blip or single network
 * hiccup never deletes content.
 *
 * Action differs by surface:
 *  - moments / stories : media is mandatory -> delete the row
 *  - posts / messages  : text survives      -> NULL the media_url column
 *  - post_media        : attachment gone    -> delete the attachment row
 *  - marketplace etc.  : row survives       -> NULL the media/image column
 *
 * Avatars are intentionally excluded (client already falls back to a
 * letter avatar; churning 140 user rows is not worth the risk).
 */

const FAIL_THRESHOLD = 2;          // consecutive failures before action
const PROBE_CONCURRENCY = 10;
const PROBE_TIMEOUT_MS = 12000;
const BATCH_LIMIT = 500;           // max URLs probed per table per run

// table -> { columns: [...], onDead: 'delete_row' | 'null_column', nullCols?: [...] }
const SURFACES = {
    moments:        { idCol: 'moment_id',  urlCols: ['media_url'], onDead: 'delete_row' },
    stories:        { idCol: 'story_id',   urlCols: ['media_url'], onDead: 'delete_row' },
    posts:          { idCol: 'post_id',    urlCols: ['media_url'], onDead: 'null_column', nullCols: ['media_url', 'media_type'] },
    post_media:     { idCol: 'media_id',   urlCols: ['media_url'], onDead: 'delete_row' },
    messages:       { idCol: 'message_id', urlCols: ['media_url'], onDead: 'null_column', nullCols: ['media_url'] },
    marketplace_listings: { idCol: 'listing_id',   urlCols: ['image_url'],  onDead: 'null_column', nullCols: ['image_url'] },
    listing_media:        { idCol: 'media_id',     urlCols: ['media_url'],  onDead: 'null_column', nullCols: ['media_url'] },
    lost_found_items:     { idCol: 'item_id',      urlCols: ['image_url'],  onDead: 'null_column', nullCols: ['image_url'] },
    lost_found_media:     { idCol: 'media_id',     urlCols: ['media_url'],  onDead: 'null_column', nullCols: ['media_url'] },
    confessions:          { idCol: 'confession_id',urlCols: ['image_url'],  onDead: 'null_column', nullCols: ['image_url'] },
    group_posts:          { idCol: 'post_id',      urlCols: ['image_url', 'video_url'], onDead: 'null_column', nullCols: ['image_url', 'video_url'] },
};

const ensureTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS media_health_checks (
            url_hash        CHAR(64)      NOT NULL,
            table_name      VARCHAR(64)   NOT NULL,
            column_name     VARCHAR(64)   NOT NULL,
            row_id          VARCHAR(64)   NOT NULL,
            url             VARCHAR(1000) NOT NULL,
            fail_count      INT           NOT NULL DEFAULT 0,
            last_status     INT           NULL,
            status          VARCHAR(16)   NOT NULL DEFAULT 'ok',
            last_checked_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (url_hash),
            KEY idx_status (status),
            KEY idx_table (table_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
};

const hashUrl = (url) => crypto.createHash('sha256').update(url).digest('hex');

// HEAD a URL; treat 200/206/301/302 as alive. Some CDNs reject HEAD (405/403)
// so fall back to a ranged GET before declaring it dead.
const probeUrl = async (url) => {
    try {
        let res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
        if (res.status === 405 || res.status === 403) {
            res = await fetch(url, {
                method: 'GET',
                headers: { Range: 'bytes=0-0' },
                signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
            });
        }
        return res.status;
    } catch (e) {
        return 0; // network error -> treat as failure
    }
};

// Pull candidate URLs for one surface (one URL per row, capped).
const collectUrls = async (tableName, cfg) => {
    const colList = cfg.urlCols.join(', ');
    const [rows] = await pool.query(
        `SELECT ${cfg.idCol} as row_id, ${colList}
         FROM \`${tableName}\`
         WHERE (${cfg.urlCols.map(c => `\`${c}\` LIKE 'http%'`).join(' OR ')})
         LIMIT ${BATCH_LIMIT}`
    );
    const out = [];
    for (const r of rows) {
        for (const col of cfg.urlCols) {
            const u = r[col];
            if (u && typeof u === 'string' && u.startsWith('http')) {
                out.push({ tableName, col, rowId: r.row_id, url: u });
            }
        }
    }
    return out;
};

// Apply the destructive action for a confirmed-dead row.
const actOnDead = async (surface) => {
    const cfg = SURFACES[surface.tableName];
    try {
        if (cfg.onDead === 'delete_row') {
            const [res] = await pool.query(
                `DELETE FROM \`${surface.tableName}\` WHERE \`${cfg.idCol}\` = ?`, [surface.rowId]
            );
            logger.warn(`[MediaHealth] Deleted dead ${surface.tableName} row ${surface.rowId} (${surface.col}): ${surface.url}`);
            return res.affectedRows;
        } else {
            const sets = cfg.nullCols.map(c => `\`${c}\` = NULL`).join(', ');
            const [res] = await pool.query(
                `UPDATE \`${surface.tableName}\` SET ${sets} WHERE \`${cfg.idCol}\` = ?`, [surface.rowId]
            );
            logger.warn(`[MediaHealth] Nulled dead media on ${surface.tableName} row ${surface.rowId} (${surface.col}): ${surface.url}`);
            return res.affectedRows;
        }
    } catch (e) {
        logger.error(`[MediaHealth] Failed to act on ${surface.tableName}/${surface.rowId}: ${e.message}`);
        return 0;
    }
};

// One full probe pass across all surfaces.
const runHealthCheck = async () => {
    logger.info('[MediaHealth] Starting media health probe...');
    await ensureTable();

    // 1. Gather + dedupe all candidate URLs across surfaces.
    const all = [];
    for (const [tableName, cfg] of Object.entries(SURFACES)) {
        try {
            all.push(...(await collectUrls(tableName, cfg)));
        } catch (e) {
            logger.error(`[MediaHealth] collectUrls(${tableName}) failed: ${e.message}`);
        }
    }
    // Dedupe by URL but keep a list of every (table,col,row) that points at it.
    const byUrl = new Map();
    for (const item of all) {
        if (!byUrl.has(item.url)) byUrl.set(item.url, []);
        byUrl.get(item.url).push(item);
    }
    const urls = [...byUrl.keys()];
    logger.info(`[MediaHealth] Probing ${urls.length} unique URLs (${all.length} references).`);

    // 2. Probe with bounded concurrency.
    const statusMap = new Map(); // url -> status
    let i = 0;
    async function worker() {
        while (i < urls.length) {
            const idx = i++;
            const u = urls[idx];
            statusMap.set(u, await probeUrl(u));
        }
    }
    await Promise.all(Array.from({ length: PROBE_CONCURRENCY }, worker));

    // 3. Batch-update health rows (chunked), then act on confirmed-dead.
    //    Per-URL round-trips are prohibitive against a remote DB (~450ms RTT);
    //    chunked multi-row upserts keep this to a handful of queries.
    const aliveHashes = [];
    const deadRefs = []; // { hash, url, status, tableName, col, rowId }
    for (const [url, status] of statusMap) {
        const hash = hashUrl(url);
        const alive = status === 200 || status === 206 || status === 301 || status === 302;
        if (alive) {
            aliveHashes.push(hash);
        } else {
            for (const ref of byUrl.get(url)) {
                deadRefs.push({ hash, url, status, ...ref });
            }
        }
    }

    // 3a. Reset alive URLs (one chunked UPDATE per 500 hashes).
    let recovered = 0;
    for (let start = 0; start < aliveHashes.length; start += 500) {
        const chunk = aliveHashes.slice(start, start + 500);
        const [res] = await pool.query(
            `UPDATE media_health_checks
             SET fail_count = 0, status = 'ok', last_checked_at = NOW()
             WHERE url_hash IN (?)`, [chunk]
        );
        recovered += res.affectedRows;
    }

    // 3b. Increment fail_count for every dead reference (chunked multi-row upsert).
    for (let start = 0; start < deadRefs.length; start += 200) {
        const chunk = deadRefs.slice(start, start + 200);
        const vals = chunk.map(() => '(?, ?, ?, ?, ?, 1, ?, \'failing\', NOW())').join(', ');
        const params = [];
        for (const ref of chunk) {
            params.push(ref.hash, ref.tableName, ref.col, ref.rowId, ref.url, ref.status);
        }
        await pool.query(
            `INSERT INTO media_health_checks
                (url_hash, table_name, column_name, row_id, url, fail_count, last_status, status, last_checked_at)
             VALUES ${vals}
             ON DUPLICATE KEY UPDATE
                fail_count = fail_count + 1, last_status = VALUES(last_status),
                status = 'failing', last_checked_at = NOW()`,
            params
        );
    }

    // 3c. Read back fail_counts for the distinct dead URLs in one query.
    const deadHashes = [...new Set(deadRefs.map(r => r.hash))];
    const failCountByHash = new Map();
    if (deadHashes.length > 0) {
        for (let start = 0; start < deadHashes.length; start += 500) {
            const chunk = deadHashes.slice(start, start + 500);
            const [rows] = await pool.query(
                `SELECT url_hash, fail_count FROM media_health_checks WHERE url_hash IN (?)`, [chunk]
            );
            for (const r of rows) failCountByHash.set(r.url_hash, r.fail_count);
        }
    }

    // 3d. Act on confirmed-dead (two-strike) and mark resolved.
    let deadConfirmed = 0, acted = 0;
    const resolvedHashes = [];
    for (const ref of deadRefs) {
        const fc = failCountByHash.get(ref.hash) || 0;
        if (fc >= FAIL_THRESHOLD) {
            acted += await actOnDead(ref);
            resolvedHashes.push(ref.hash);
        }
    }
    deadConfirmed = new Set(
        deadRefs.filter(r => (failCountByHash.get(r.hash) || 0) >= FAIL_THRESHOLD).map(r => r.hash)
    ).size;
    const uniqResolved = [...new Set(resolvedHashes)];
    for (let start = 0; start < uniqResolved.length; start += 500) {
        const chunk = uniqResolved.slice(start, start + 500);
        await pool.query(
            `UPDATE media_health_checks SET status = 'resolved' WHERE url_hash IN (?)`, [chunk]
        );
    }

    logger.info(`[MediaHealth] Done. probed=${urls.length} deadConfirmed=${deadConfirmed} rowsActed=${acted} recovered=${recovered}`);
};

const initMediaHealthJob = () => {
    // Hourly at minute 30 (offset from the minute-0 lifecycle job) to avoid
    // colliding with expireStories/executeCleanup DB + Cloudinary load.
    cron.schedule('30 * * * *', async () => {
        try {
            await runHealthCheck();
        } catch (e) {
            logger.error('[MediaHealth] run failed:', e);
        }
    });
    logger.info('✅ Media Health Job Initialized (hourly at :30).');
};

module.exports = { initMediaHealthJob, runHealthCheck };
