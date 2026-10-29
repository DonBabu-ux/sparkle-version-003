const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const pool = require('../config/database');
const logger = require('../utils/logger');
const visibility = require('../services/reels-visibility.service');

const MAX_TITLE_CHARS = 250;
const MAX_DESCRIPTION_CHARS = 5000;
const MAX_HASHTAGS = 5;
const MAX_DRAFTS_PER_USER = 50;

const sanitizeHashtag = (tag) => String(tag || '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 100);

const parseJson = (value, fallback = null) => {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return fallback; }
};

// ─────────────────────────────── Drafts ───────────────────────────────

const listDrafts = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const [rows] = await pool.query(
            `SELECT draft_id, title, thumbnail_url, media_refs, metadata, storage_bytes, created_at, updated_at
               FROM moment_drafts
              WHERE user_id = ?
              ORDER BY updated_at DESC
              LIMIT 100`,
            [userId]
        );
        const drafts = (rows || []).map(r => ({
            draft_id: r.draft_id,
            title: r.title || '',
            thumbnail_url: r.thumbnail_url,
            media_refs: parseJson(r.media_refs, []),
            metadata: parseJson(r.metadata, {}),
            storage_bytes: Number(r.storage_bytes) || 0,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }));
        const totalBytes = drafts.reduce((sum, d) => sum + (d.storage_bytes || 0), 0);
        res.json({ success: true, drafts, count: drafts.length, total_bytes: totalBytes });
    } catch (error) {
        logger.error('[Reels] listDrafts failed:', error.message);
        res.status(500).json({ error: 'Failed to load drafts' });
    }
};

const getDraft = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const [rows] = await pool.query(
            'SELECT * FROM moment_drafts WHERE draft_id = ? AND user_id = ?',
            [req.params.id, userId]
        );
        if (!rows.length) return res.status(404).json({ error: 'Draft not found' });
        const r = rows[0];
        res.json({
            success: true,
            draft: {
                draft_id: r.draft_id,
                title: r.title || '',
                thumbnail_url: r.thumbnail_url,
                media_refs: parseJson(r.media_refs, []),
                metadata: parseJson(r.metadata, {}),
                storage_bytes: Number(r.storage_bytes) || 0,
                created_at: r.created_at,
                updated_at: r.updated_at,
            },
        });
    } catch (error) {
        logger.error('[Reels] getDraft failed:', error.message);
        res.status(500).json({ error: 'Failed to load draft' });
    }
};

const upsertDraft = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const { draft_id, title = '', thumbnail_url = null, media_refs = [], metadata = {}, storage_bytes = 0 } = req.body || {};

        if (metadata && typeof metadata === 'object') {
            if (metadata.title && String(metadata.title).length > MAX_TITLE_CHARS) {
                return res.status(400).json({ error: `Title exceeds ${MAX_TITLE_CHARS} characters` });
            }
            if (metadata.description && String(metadata.description).length > MAX_DESCRIPTION_CHARS) {
                return res.status(400).json({ error: `Description exceeds ${MAX_DESCRIPTION_CHARS} characters` });
            }
        }

        let draftId = draft_id;
        if (draftId) {
            const [existing] = await pool.query(
                'SELECT draft_id FROM moment_drafts WHERE draft_id = ? AND user_id = ?',
                [draftId, userId]
            );
            if (!existing.length) draftId = null;
        }

        if (!draftId) {
            const [[countRow]] = await pool.query(
                'SELECT COUNT(*) AS c FROM moment_drafts WHERE user_id = ?',
                [userId]
            );
            if ((countRow?.c || 0) >= MAX_DRAFTS_PER_USER) {
                return res.status(400).json({ error: `Draft limit reached (${MAX_DRAFTS_PER_USER}). Delete an old draft first.` });
            }
            draftId = crypto.randomUUID();
            await pool.query(
                `INSERT INTO moment_drafts (draft_id, user_id, title, thumbnail_url, media_refs, metadata, storage_bytes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [draftId, userId, String(title).slice(0, MAX_TITLE_CHARS), thumbnail_url,
                 JSON.stringify(media_refs || []), JSON.stringify(metadata || {}), Number(storage_bytes) || 0]
            );
        } else {
            await pool.query(
                `UPDATE moment_drafts
                    SET title = ?, thumbnail_url = ?, media_refs = ?, metadata = ?, storage_bytes = ?
                  WHERE draft_id = ? AND user_id = ?`,
                [String(title).slice(0, MAX_TITLE_CHARS), thumbnail_url,
                 JSON.stringify(media_refs || []), JSON.stringify(metadata || {}), Number(storage_bytes) || 0,
                 draftId, userId]
            );
        }

        res.json({ success: true, draft_id: draftId });
    } catch (error) {
        logger.error('[Reels] upsertDraft failed:', error.message);
        res.status(500).json({ error: 'Failed to save draft' });
    }
};

const deleteDraft = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const [result] = await pool.query(
            'DELETE FROM moment_drafts WHERE draft_id = ? AND user_id = ?',
            [req.params.id, userId]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Draft not found' });
        res.json({ success: true });
    } catch (error) {
        logger.error('[Reels] deleteDraft failed:', error.message);
        res.status(500).json({ error: 'Failed to delete draft' });
    }
};

// ──────────────────────────── Close Friends ────────────────────────────

const getCloseFriends = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const [rows] = await pool.query(
            `SELECT cf.friend_user_id AS user_id, u.username, u.name AS display_name, u.avatar_url
               FROM close_friends cf
               JOIN users u ON u.user_id = cf.friend_user_id
              WHERE cf.user_id = ?
              ORDER BY cf.created_at DESC`,
            [userId]
        );
        res.json({ success: true, close_friends: rows || [] });
    } catch (error) {
        logger.error('[Reels] getCloseFriends failed:', error.message);
        res.status(500).json({ error: 'Failed to load close friends' });
    }
};

const setCloseFriends = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const { user_ids = [] } = req.body || {};
        if (!Array.isArray(user_ids)) return res.status(400).json({ error: 'user_ids must be an array' });
        const ids = [...new Set(user_ids.map(String).filter(Boolean))].slice(0, 500);
        // Only allow followers (or people the user already follows) — validate against follows table
        // Snapshot previous members first: their cfMemberships caches must refresh too.
        const [prevRows] = await pool.query(
            'SELECT friend_user_id FROM close_friends WHERE user_id = ?',
            [userId]
        );
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            await connection.query('DELETE FROM close_friends WHERE user_id = ?', [userId]);
            for (const fid of ids) {
                await connection.query(
                    'INSERT IGNORE INTO close_friends (user_id, friend_user_id) VALUES (?, ?)',
                    [userId, fid]
                );
            }
            await connection.commit();
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
        // Affected viewers = previous members ∪ new members (they gain/lose
        // access to this author's audience=close_friends moments).
        const affected = new Set([
            ...(prevRows || []).map(r => String(r.friend_user_id)),
            ...ids,
        ]);
        for (const fid of affected) visibility.invalidateViewerContext(fid);
        visibility.invalidateViewerContext(userId);
        const [rows] = await pool.query(
            `SELECT cf.friend_user_id AS user_id, u.username, u.name AS display_name, u.avatar_url
               FROM close_friends cf JOIN users u ON u.user_id = cf.friend_user_id
              WHERE cf.user_id = ? ORDER BY cf.created_at DESC`,
            [userId]
        );
        res.json({ success: true, close_friends: rows || [] });
    } catch (error) {
        logger.error('[Reels] setCloseFriends failed:', error.message);
        res.status(500).json({ error: 'Failed to save close friends' });
    }
};

/**
 * Suggested close-friend candidates: people the user exchanges messages with
 * and recent commenters, minus existing close friends. Real interaction data only.
 */
const getCloseFriendSuggestions = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        // Primary source: personal-chat partners (real messaging interactions).
        // Fallback path runs in the same query via UNION; if personal_chats is
        // empty the commenter half still yields results.
        const [rows] = await pool.query(
            `SELECT u.user_id, u.username, u.name AS display_name, u.avatar_url, SUM(s.score) AS score
               FROM (
                   SELECT other_id, 3 AS score FROM (
                       SELECT CASE WHEN pc.participant1_id = ? THEN pc.participant2_id ELSE pc.participant1_id END AS other_id
                         FROM personal_chats pc
                        WHERE pc.participant1_id = ? OR pc.participant2_id = ?
                        ORDER BY pc.created_at DESC LIMIT 100
                   ) partners
                   UNION ALL
                   SELECT mc.user_id AS other_id, 1 AS score
                     FROM moment_comments mc
                     JOIN moments m ON m.moment_id = mc.moment_id
                    WHERE m.user_id = ? AND mc.user_id <> ?
                    ORDER BY mc.created_at DESC LIMIT 100
               ) s
               JOIN users u ON u.user_id = s.other_id
              WHERE s.other_id <> ?
                AND u.account_status = 'active'
                AND NOT EXISTS (
                    SELECT 1 FROM close_friends cf
                     WHERE cf.user_id = ? AND cf.friend_user_id = s.other_id
                )
              GROUP BY s.other_id, u.username, u.name, u.avatar_url
              ORDER BY SUM(s.score) DESC
              LIMIT 12`,
            [userId, userId, userId, userId, userId, userId, userId]
        ).catch(err => {
            logger.warn('[Reels] close-friend suggestion join failed: ' + err.message);
            return [];
        });
        res.json({ success: true, suggestions: rows || [] });
    } catch (error) {
        logger.error('[Reels] getCloseFriendSuggestions failed:', error.message);
        res.status(500).json({ error: 'Failed to load suggestions' });
    }
};

// ─────────────────────── Audience exclude/include ───────────────────────

const getAudienceList = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const mode = req.query.mode === 'show_only' ? 'show_only' : 'hide_from';
        const [rows] = await pool.query(
            `SELECT al.target_user_id AS user_id, u.username, u.name AS display_name, u.avatar_url
               FROM moment_audience_lists al
               JOIN users u ON u.user_id = al.target_user_id
              WHERE al.owner_id = ? AND al.mode = ?
              ORDER BY al.created_at DESC`,
            [userId, mode]
        );
        res.json({ success: true, mode, users: rows || [] });
    } catch (error) {
        logger.error('[Reels] getAudienceList failed:', error.message);
        res.status(500).json({ error: 'Failed to load audience list' });
    }
};

const setAudienceList = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const mode = req.body.mode === 'show_only' ? 'show_only' : 'hide_from';
        const { user_ids = [] } = req.body || {};
        if (!Array.isArray(user_ids)) return res.status(400).json({ error: 'user_ids must be an array' });
        const ids = [...new Set(user_ids.map(String).filter(Boolean))].slice(0, 500);
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            await connection.query(
                'DELETE FROM moment_audience_lists WHERE owner_id = ? AND mode = ?',
                [userId, mode]
            );
            for (const tid of ids) {
                await connection.query(
                    'INSERT IGNORE INTO moment_audience_lists (owner_id, mode, target_user_id) VALUES (?, ?, ?)',
                    [userId, mode, tid]
                );
            }
            await connection.commit();
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
        visibility.invalidateOwnerAudienceList(userId);
        const [rows] = await pool.query(
            `SELECT al.target_user_id AS user_id, u.username, u.name AS display_name, u.avatar_url
               FROM moment_audience_lists al JOIN users u ON u.user_id = al.target_user_id
              WHERE al.owner_id = ? AND al.mode = ? ORDER BY al.created_at DESC`,
            [userId, mode]
        );
        res.json({ success: true, mode, users: rows || [] });
    } catch (error) {
        logger.error('[Reels] setAudienceList failed:', error.message);
        res.status(500).json({ error: 'Failed to save audience list' });
    }
};

// ───────────────────────────── Hashtags ─────────────────────────────

const getRecentHashtags = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const [rows] = await pool.query(
            `SELECT mh.hashtag, MAX(mh.created_at) AS last_used
               FROM moment_hashtags mh
               JOIN moments m ON m.moment_id = mh.moment_id
              WHERE m.user_id = ? AND m.deleted_at IS NULL
              GROUP BY mh.hashtag
              ORDER BY last_used DESC
              LIMIT 20`,
            [userId]
        );
        res.json({ success: true, hashtags: (rows || []).map(r => r.hashtag) });
    } catch (error) {
        logger.error('[Reels] getRecentHashtags failed:', error.message);
        res.status(500).json({ error: 'Failed to load recent hashtags' });
    }
};

const suggestHashtags = async (req, res) => {
    try {
        const raw = String(req.query.q || '').trim();
        const tag = sanitizeHashtag(raw);
        if (!tag) return res.json({ success: true, suggestions: [] });
        const [rows] = await pool.query(
            `SELECT hashtag, COUNT(*) AS post_count
               FROM moment_hashtags
              WHERE hashtag LIKE ?
              GROUP BY hashtag
              ORDER BY post_count DESC
              LIMIT 20`,
            [`${tag}%`]
        );
        res.json({
            success: true,
            suggestions: (rows || []).map(r => ({
                tag: r.hashtag,
                post_count: Number(r.post_count) || 0,
            })),
        });
    } catch (error) {
        logger.error('[Reels] suggestHashtags failed:', error.message);
        res.status(500).json({ error: 'Failed to search hashtags' });
    }
};

// ───────────────────────────── Mentions ─────────────────────────────

const getRecentMentions = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        // Real prior interactions: recent commenters on the user's moments + recent followed-by edges
        const [rows] = await pool.query(
            `SELECT u.user_id, u.username, u.name AS display_name, u.avatar_url, MAX(mc.created_at) AS last_seen
               FROM moment_comments mc
               JOIN moments m ON m.moment_id = mc.moment_id
               JOIN users u ON u.user_id = mc.user_id
              WHERE m.user_id = ? AND mc.user_id <> ?
              GROUP BY u.user_id, u.username, u.name, u.avatar_url
              ORDER BY last_seen DESC
              LIMIT 20`,
            [userId, userId]
        );
        res.json({ success: true, people: rows || [] });
    } catch (error) {
        logger.error('[Reels] getRecentMentions failed:', error.message);
        res.status(500).json({ error: 'Failed to load recent people' });
    }
};

const searchPeople = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const q = String(req.query.q || '').trim();
        if (!q) return res.json({ success: true, people: [] });
        const like = `%${q.replace(/[%_]/g, m => '\\' + m)}%`;
        const [rows] = await pool.query(
            `SELECT u.user_id, u.username, u.name AS display_name, u.avatar_url,
                    (SELECT COUNT(*) FROM follows f1 WHERE f1.follower_id = ? AND f1.following_id = u.user_id) AS i_follow,
                    (SELECT COUNT(*) FROM follows f2 WHERE f2.follower_id = u.user_id AND f2.following_id = ?) AS follows_me
               FROM users u
              WHERE (u.username LIKE ? OR u.name LIKE ?)
                AND u.user_id <> ?
                AND u.account_status = 'active'
              ORDER BY (u.username = ?) DESC, u.name
              LIMIT 25`,
            [userId, userId, like, like, userId, q]
        );
        res.json({
            success: true,
            people: (rows || []).map(r => ({
                user_id: r.user_id,
                username: r.username,
                display_name: r.display_name,
                avatar_url: r.avatar_url,
                i_follow: Number(r.i_follow) > 0,
                follows_me: Number(r.follows_me) > 0,
                relationship: Number(r.i_follow) > 0 && Number(r.follows_me) > 0 ? 'mutual'
                    : Number(r.i_follow) > 0 ? 'following'
                    : Number(r.follows_me) > 0 ? 'follows_you' : 'none',
            })),
        });
    } catch (error) {
        logger.error('[Reels] searchPeople failed:', error.message);
        res.status(500).json({ error: 'Failed to search people' });
    }
};

const getFriendsList = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const [rows] = await pool.query(
            `SELECT u.user_id, u.username, u.name AS display_name, u.avatar_url, 1 AS i_follow, 1 AS follows_me
               FROM follows f1
               JOIN follows f2 ON f2.follower_id = f1.following_id AND f2.following_id = f1.follower_id
               JOIN users u ON u.user_id = f1.following_id
              WHERE f1.follower_id = ? AND u.account_status = 'active'
              ORDER BY u.name
              LIMIT 100`,
            [userId]
        );
        res.json({
            success: true,
            people: (rows || []).map(r => ({ ...r, relationship: 'mutual' })),
        });
    } catch (error) {
        logger.error('[Reels] getFriendsList failed:', error.message);
        res.status(500).json({ error: 'Failed to load friends' });
    }
};

/** Followers with relationship flags — used by audience + close-friends pickers. */
const getFollowers = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const [rows] = await pool.query(
            `SELECT u.user_id, u.username, u.name AS display_name, u.avatar_url,
                    0 AS i_follow,
                    (SELECT COUNT(*) FROM follows f2 WHERE f2.follower_id = u.user_id AND f2.following_id = ?) AS follows_me,
                    (SELECT COUNT(*) FROM follows f1 WHERE f1.follower_id = ? AND f1.following_id = u.user_id) AS i_follow_row
               FROM follows f
               JOIN users u ON u.user_id = f.follower_id
              WHERE f.following_id = ? AND u.account_status = 'active'
              ORDER BY u.name
              LIMIT 300`,
            [userId, userId, userId, userId]
        );
        res.json({
            success: true,
            people: (rows || []).map(r => ({
                user_id: r.user_id,
                username: r.username,
                display_name: r.display_name,
                avatar_url: r.avatar_url,
                i_follow: Number(r.i_follow_row) > 0,
                follows_me: true,
                relationship: Number(r.i_follow_row) > 0 ? 'mutual' : 'follows_you',
            })),
        });
    } catch (error) {
        logger.error('[Reels] getFollowers failed:', error.message);
        res.status(500).json({ error: 'Failed to load followers' });
    }
};

// ──────────────────────────── Captions (STT) ────────────────────────────

const OPENROUTER_STT_URL = 'https://openrouter.ai/api/v1/audio/transcriptions';

/** Map an upload's mime/extension → OpenRouter input_audio.format. */
const sttAudioFormat = (mime, filename = '') => {
    const m = String(mime || '').toLowerCase();
    const ext = String(filename).split('.').pop()?.toLowerCase() || '';
    if (m.includes('webm') || ext === 'webm') return 'webm';
    if (m.includes('wav') || ext === 'wav') return 'wav';
    if (m.includes('mpeg') || m.includes('mp3') || ext === 'mp3') return 'mp3';
    if (m.includes('flac') || ext === 'flac') return 'flac';
    if (m.includes('ogg') || ext === 'ogg') return 'ogg';
    if (m.includes('m4a') || ext === 'm4a') return 'm4a';
    if (m.includes('aac') || ext === 'aac') return 'aac';
    // MP4/MOV carry an AAC track in an ISO-BMFF container — m4a decodes it.
    return 'm4a';
};

/**
 * OpenRouter STT: JSON body with base64 audio (not the OpenAI multipart
 * shape) + verbose_json for word-timed segments.
 */
const sttWithOpenRouter = async (file, apiKey) => {
    const buffer = await fs.promises.readFile(file.path);
    const upstream = await axios.post(OPENROUTER_STT_URL, {
        model: process.env.OPENROUTER_STT_MODEL || 'openai/whisper-large-v3',
        input_audio: {
            data: buffer.toString('base64'),
            format: sttAudioFormat(file.mimetype, file.originalname),
        },
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
    }, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120_000,
        maxBodyLength: 64 * 1024 * 1024,
    });
    return upstream.data || {};
};

/** Groq Whisper fallback: OpenAI-style multipart upload (used when only GROQ_API_KEY is set). */
const sttWithGroq = async (file, apiKey) => {
    const form = new FormData();
    form.append('file', fs.createReadStream(file.path), {
        filename: file.originalname || 'reel.mp4',
        contentType: file.mimetype || 'video/mp4',
    });
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'verbose_json');

    const upstream = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
        timeout: 120_000,
        maxBodyLength: 50 * 1024 * 1024,
    });
    return upstream.data || {};
};

/**
 * Real speech-to-text via OpenRouter (`OPENROUTER_API_KEY`, e.g.
 * openai/whisper-large-v3) with Groq Whisper as a legacy fallback when only
 * `GROQ_API_KEY` is set. Accepts the rendered reel video (or an audio
 * extract) as multipart "media". Returns word-timed segments; never
 * fabricates output.
 */
const transcribeCaptions = async (req, res) => {
    try {
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        const groqKey = process.env.GROQ_API_KEY;
        if (!openrouterKey && !groqKey) {
            return res.status(503).json({
                success: false,
                error: 'CAPTIONS_NOT_CONFIGURED',
                message: 'Automatic captions are not configured on this server. You can add captions manually.',
            });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'MEDIA_REQUIRED', message: 'No media uploaded for transcription.' });
        }
        const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm'];
        const mime = (req.file.mimetype || '').toLowerCase();
        if (allowed.length && !allowed.includes(mime)) {
            return res.status(415).json({
                success: false,
                error: 'UNSUPPORTED_MEDIA',
                message: `Cannot transcribe ${mime || 'this file'}. Upload a short MP4/WebM video or audio file.`,
            });
        }

        const data = openrouterKey
            ? await sttWithOpenRouter(req.file, openrouterKey)
            : await sttWithGroq(req.file, groqKey);

        const segments = (data.segments || []).map(seg => ({
            start: Number(seg.start) || 0,
            end: Number(seg.end) || 0,
            text: String(seg.text || '').trim(),
        })).filter(s => s.text);

        // Best-effort cleanup of the temp upload
        try { if (req.file.path) fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }

        if (!segments.length && !String(data.text || '').trim()) {
            return res.json({ success: true, text: '', segments: [], empty: true });
        }

        res.json({
            success: true,
            text: String(data.text || segments.map(s => s.text).join(' ')).trim(),
            segments,
            language: data.language || null,
            empty: false,
        });
    } catch (error) {
        try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
        const status = error.response?.status;
        logger.error('[Reels] transcribeCaptions failed:', error.response?.data || error.message);
        if (status === 401 || status === 403) {
            return res.status(503).json({
                success: false,
                error: 'CAPTIONS_AUTH',
                message: 'Caption transcription is not authorized on this server. You can add captions manually.',
            });
        }
        if (status === 429) {
            return res.status(429).json({
                success: false,
                error: 'CAPTIONS_RATE_LIMIT',
                message: 'Too many transcription requests. Try again shortly.',
            });
        }
        res.status(502).json({
            success: false,
            error: 'CAPTIONS_FAILED',
            message: 'Transcription failed. You can retry or add captions manually.',
        });
    }
};

module.exports = {
    listDrafts,
    getDraft,
    upsertDraft,
    deleteDraft,
    getCloseFriends,
    setCloseFriends,
    getCloseFriendSuggestions,
    getAudienceList,
    setAudienceList,
    getRecentHashtags,
    suggestHashtags,
    getRecentMentions,
    searchPeople,
    getFriendsList,
    getFollowers,
    transcribeCaptions,
    sanitizeHashtag,
};
