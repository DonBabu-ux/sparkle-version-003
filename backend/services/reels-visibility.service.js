const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Reels/Moments audience enforcement.
 *
 * Audiences:
 *   public        — anyone
 *   friends       — "Friends" = the author's followers (per the follow model used across Sparkle)
 *   close_friends — people the AUTHOR put on their close-friends list (the
 *                   viewer must appear in the author's list, Instagram-style)
 *   only_me       — author only
 *
 * On top of the base audience, authors can maintain exclusion/inclusion lists
 * stored two ways (unioned at read time, most restrictive wins):
 *   per-moment  — moments.hide_from_user_ids / moments.show_only_user_ids JSON
 *                 (written by createMoment from the composer payload)
 *   per-author  — moment_audience_lists rows (the author's saved lists; applied
 *                 to every moment so privacy holds even if a client omits them)
 *
 * Precedence (most restrictive wins):
 *   1. owner                        → visible
 *   2. hide_from contains viewer    → hidden
 *   3. audience = only_me           → hidden
 *   4. show_only is non-empty       → visible only if viewer ∈ show_only
 *   5. audience = close_friends     → visible only if viewer ∈ author's close-friends list
 *   6. audience = friends           → visible only if viewer follows author
 *   7. otherwise                    → visible (public)
 */

let tablesEnsured = false;

const ensureTables = async () => {
    if (tablesEnsured) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS close_friends (
                user_id CHAR(36) NOT NULL,
                friend_user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, friend_user_id),
                INDEX idx_cf_friend (friend_user_id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_audience_lists (
                id INT AUTO_INCREMENT PRIMARY KEY,
                owner_id CHAR(36) NOT NULL,
                mode ENUM('hide_from','show_only') NOT NULL,
                target_user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_audience_entry (owner_id, mode, target_user_id),
                INDEX idx_audience_owner (owner_id, mode)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_drafts (
                draft_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                title VARCHAR(255) DEFAULT '',
                thumbnail_url VARCHAR(500) DEFAULT NULL,
                media_refs JSON DEFAULT NULL,
                metadata JSON DEFAULT NULL,
                storage_bytes BIGINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_draft_user (user_id, updated_at)
            )
        `);
        // Reel audience columns on moments (idempotent)
        const [cols] = await pool.query('SHOW COLUMNS FROM moments');
        const have = new Set((cols || []).map(c => c.Field));
        const extra = [
            { name: 'title', def: "VARCHAR(255) DEFAULT NULL" },
            { name: 'description', def: 'TEXT DEFAULT NULL' },
            { name: 'audience', def: "VARCHAR(20) DEFAULT 'public'" },
            { name: 'comments_enabled', def: 'TINYINT(1) DEFAULT 1' },
            { name: 'overlays', def: 'JSON DEFAULT NULL' },
            { name: 'clips_info', def: 'JSON DEFAULT NULL' },
            { name: 'music_info', def: 'JSON DEFAULT NULL' },
            { name: 'captions_info', def: 'JSON DEFAULT NULL' },
            { name: 'duration_seconds', def: 'FLOAT DEFAULT NULL' },
            { name: 'watermark', def: 'TINYINT(1) DEFAULT 0' },
            { name: 'shared_to_story', def: 'TINYINT(1) DEFAULT 0' },
            { name: 'idempotency_key', def: 'VARCHAR(64) DEFAULT NULL' },
            { name: 'hide_from_user_ids', def: 'JSON DEFAULT NULL' },
            { name: 'show_only_user_ids', def: 'JSON DEFAULT NULL' },
        ];
        for (const col of extra) {
            if (have.has(col.name)) continue;
            await pool.query(`ALTER TABLE moments ADD COLUMN \`${col.name}\` ${col.def}`);
            logger.info(`Added column moments.${col.name}`);
        }
        try {
            await pool.query(
                'CREATE UNIQUE INDEX uq_moment_idem ON moments (user_id, idempotency_key)'
            );
        } catch (_) { /* index already exists */ }
        tablesEnsured = true;
    } catch (e) {
        logger.warn('[ReelsVisibility] ensureTables failed: ' + e.message);
    }
};

const parseIdList = (value) => {
    if (!value) return [];
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch (_) {
        return [];
    }
};

/**
 * Loads the viewer's relation context in one round-trip.
 * Cached briefly in-memory per viewer (30s) to keep feed filtering cheap.
 */
const relationCache = new Map();
const RELATION_TTL_MS = 30_000;
const RELATION_CACHE_MAX = 500;

async function getViewerContext(viewerId) {
    if (!viewerId) {
        return { following: new Set(), followers: new Set(), closeFriends: new Set(), blocked: new Set() };
    }
    const cached = relationCache.get(viewerId);
    if (cached && Date.now() - cached.at < RELATION_TTL_MS) return cached.ctx;

    const [followingRows, followersRows, cfRows, cfMemberRows, blockedRows] = await Promise.all([
        pool.query('SELECT following_id FROM follows WHERE follower_id = ?', [viewerId]).catch(() => [[]]),
        pool.query('SELECT follower_id FROM follows WHERE following_id = ?', [viewerId]).catch(() => [[]]),
        pool.query('SELECT friend_user_id FROM close_friends WHERE user_id = ?', [viewerId]).catch(() => [[]]),
        // Authors who placed THIS viewer on their close-friends list — the
        // direction that gates visibility of audience=close_friends moments.
        pool.query('SELECT user_id FROM close_friends WHERE friend_user_id = ?', [viewerId]).catch(() => [[]]),
        pool.query(
            'SELECT blocked_user_id AS id FROM user_blocks WHERE user_id = ? UNION SELECT user_id AS id FROM user_blocks WHERE blocked_user_id = ?',
            [viewerId, viewerId]
        ).catch(() => [[]]),
    ]);

    const ctx = {
        following: new Set((followingRows[0] || []).map(r => r.following_id)),
        followers: new Set((followersRows[0] || []).map(r => r.follower_id)),
        closeFriends: new Set((cfRows[0] || []).map(r => r.friend_user_id)),
        cfMemberships: new Set((cfMemberRows[0] || []).map(r => r.user_id)),
        blocked: new Set((blockedRows[0] || []).map(r => r.id)),
    };

    if (relationCache.size >= RELATION_CACHE_MAX) {
        const now = Date.now();
        for (const [k, v] of relationCache) {
            if (now - v.at >= RELATION_TTL_MS) relationCache.delete(k);
        }
        if (relationCache.size >= RELATION_CACHE_MAX) relationCache.clear();
    }
    relationCache.set(viewerId, { at: Date.now(), ctx });
    return ctx;
}

function invalidateViewerContext(viewerId) {
    relationCache.delete(viewerId);
}

/** Drop every viewer's relation context (used when a list changes many viewers' access). */
function invalidateAllViewerContexts() {
    relationCache.clear();
}

// ── Author-level audience lists (moment_audience_lists), cached 30s ──────────

const ownerListCache = new Map();
const OWNER_LIST_TTL_MS = 30_000;
const OWNER_LIST_CACHE_MAX = 500;

/**
 * Returns Map<ownerId, { hide: Set, show: Set }> for the given author ids.
 * Loads only uncached owners in one query; failures fail-open (row-level
 * lists are still enforced) so a list-cache blip never hides public content.
 */
async function getOwnerAudienceLists(ownerIds) {
    const out = new Map();
    const ids = [...new Set((ownerIds || []).filter(Boolean).map(String))];
    if (ids.length === 0) return out;

    const now = Date.now();
    const missing = [];
    for (const id of ids) {
        const cached = ownerListCache.get(id);
        if (cached && now - cached.at < OWNER_LIST_TTL_MS) out.set(id, cached.lists);
        else missing.push(id);
    }
    if (missing.length === 0) return out;

    try {
        const placeholders = missing.map(() => '?').join(',');
        const [rows] = await pool.query(
            `SELECT owner_id, mode, target_user_id FROM moment_audience_lists WHERE owner_id IN (${placeholders})`,
            missing
        );
        const byOwner = new Map(missing.map(id => [id, { hide: new Set(), show: new Set() }]));
        for (const r of rows || []) {
            const lists = byOwner.get(String(r.owner_id));
            if (!lists) continue;
            (r.mode === 'show_only' ? lists.show : lists.hide).add(String(r.target_user_id));
        }
        for (const [id, lists] of byOwner) {
            out.set(id, lists);
            ownerListCache.set(id, { at: now, lists });
        }
        if (ownerListCache.size > OWNER_LIST_CACHE_MAX) {
            for (const [k, v] of ownerListCache) {
                if (now - v.at >= OWNER_LIST_TTL_MS) ownerListCache.delete(k);
            }
            if (ownerListCache.size > OWNER_LIST_CACHE_MAX) ownerListCache.clear();
        }
    } catch (e) {
        logger.warn('[ReelsVisibility] owner list load failed: ' + e.message);
        for (const id of missing) out.set(id, { hide: new Set(), show: new Set() });
    }
    return out;
}

function invalidateOwnerAudienceList(ownerId) {
    if (ownerId) ownerListCache.delete(String(ownerId));
}

/** JSON column / object / string → array of id strings. */
function parseJsonValue(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return null; }
}

/**
 * Union of the three exclusion sources: per-moment columns, overlays JSON
 * (legacy rows / explicit column lists that carry overlays only), and the
 * author's saved lists from moment_audience_lists.
 */
function exclusionSets(row, ownerLists) {
    const hide = new Set(parseIdList(row?.hide_from_user_ids));
    const show = new Set(parseIdList(row?.show_only_user_ids));
    const overlays = parseJsonValue(row?.overlays);
    if (overlays && typeof overlays === 'object') {
        for (const id of parseIdList(overlays.hide_from)) hide.add(String(id));
        for (const id of parseIdList(overlays.show_only)) show.add(String(id));
    }
    if (ownerLists) {
        for (const id of ownerLists.hide) hide.add(String(id));
        for (const id of ownerLists.show) show.add(String(id));
    }
    return { hide, show };
}

/**
 * Pure visibility decision for one moment row against a viewer context.
 * Rows missing the audience columns (legacy) are treated as public.
 */
function canView(row, viewerId, ctx) {
    if (!row) return false;
    if (viewerId && String(row.user_id) === String(viewerId)) return true;

    const audience = row.audience || 'public';
    const { hide: hideFrom, show: showOnly } = exclusionSets(
        row,
        ctx?.ownerLists?.get(String(row.user_id))
    );

    if (viewerId && ctx?.blocked?.has(String(row.user_id))) return false;
    if (viewerId && ctx?.blocked?.has(viewerId)) return false;

    if (hideFrom.size && viewerId && hideFrom.has(String(viewerId))) return false;
    if (audience === 'only_me') return false;
    if (showOnly.size > 0) return !!viewerId && showOnly.has(String(viewerId));
    if (audience === 'close_friends') {
        // Viewer must be on the AUTHOR's close-friends list (author's list
        // contains viewer), not the other way around.
        return !!viewerId && !!ctx?.cfMemberships?.has(String(row.user_id));
    }
    if (audience === 'friends') {
        // "Friends" = the author's followers (viewer follows the author)
        return !!viewerId && !!ctx?.following?.has(String(row.user_id));
    }
    return true;
}

/** Batch filter: fetch relation context once, drop invisible rows. */
async function filterVisible(rows, viewerId) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const ctx = await getViewerContext(viewerId);
    const ownerLists = await getOwnerAudienceLists(rows.map(r => r && r.user_id));
    const fullCtx = { ...ctx, ownerLists };
    return rows.filter(r => canView(r, viewerId, fullCtx)).map(stripPrivateFields);
}

/**
 * Viewer-facing copy of a moment row: exclusion lists (per-moment columns or
 * embedded in overlays) and the publish idempotency key are author-only state
 * and must never leave the server to a viewer — not even the owner's own list
 * contents are needed to render a feed item.
 */
function stripPrivateFields(row) {
    if (!row || typeof row !== 'object') return row;
    const out = { ...row };
    delete out.hide_from_user_ids;
    delete out.show_only_user_ids;
    delete out.idempotency_key;
    const ov = parseJsonValue(out.overlays);
    if (ov && typeof ov === 'object' && ('hide_from' in ov || 'show_only' in ov)) {
        const clean = { ...ov };
        delete clean.hide_from;
        delete clean.show_only;
        out.overlays = typeof out.overlays === 'string' ? JSON.stringify(clean) : clean;
    }
    return out;
}

/** Single-row check (used by getMomentById, comments, shares). */
async function canViewMoment(row, viewerId) {
    const ctx = await getViewerContext(viewerId);
    const ownerLists = await getOwnerAudienceLists([row && row.user_id]);
    return canView(row, viewerId, { ...ctx, ownerLists });
}

/**
 * SQL fragment for shared candidate pools: only globally-public, non-deleted
 * rows may enter shared Redis pools (they are served to many viewers).
 * Per-user audiences are enforced later via filterVisible().
 */
function publicPoolSql(alias = 'm') {
    return `${alias}.deleted_at IS NULL AND (${alias}.audience IS NULL OR ${alias}.audience = 'public')`;
}

/** Ensures the viewer can comment on the moment (visibility + comments_enabled). */
async function canCommentOn(row, viewerId) {
    if (!row) return false;
    if (Number(row.comments_enabled) === 0) return false;
    return canViewMoment(row, viewerId);
}

module.exports = {
    ensureTables,
    getViewerContext,
    invalidateViewerContext,
    invalidateAllViewerContexts,
    getOwnerAudienceLists,
    invalidateOwnerAudienceList,
    canView,
    filterVisible,
    canViewMoment,
    canCommentOn,
    publicPoolSql,
    parseIdList,
    stripPrivateFields,
};
