const pool = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * GET /highlights/:id
 * Returns a highlight's stories for playback
 */
const getHighlight = async (req, res) => {
    try {
        const { id } = req.params;

        const [highlights] = await pool.query(
            `SELECT h.highlight_id, h.title, h.cover_url, h.user_id
             FROM highlights h WHERE h.highlight_id = ?`,
            [id]
        );
        if (!highlights[0]) return res.status(404).json({ error: 'Highlight not found' });

        const [stories] = await pool.query(
            `SELECT s.story_id as id, s.media_url, s.media_type, s.caption, s.created_at
             FROM highlight_stories hs
             JOIN stories s ON hs.story_id = s.story_id
             WHERE hs.highlight_id = ?
             ORDER BY hs.position ASC, hs.added_at ASC`,
            [id]
        );

        res.json({ ...highlights[0], stories });
    } catch (error) {
        logger.error('Get highlight error:', error);
        res.status(500).json({ error: 'Failed to get highlight' });
    }
};

/**
 * GET /users/:id/highlights
 * Returns all highlights for a user's profile
 */
const getUserHighlights = async (req, res) => {
    try {
        const { id } = req.params;

        const [highlights] = await pool.query(
            `SELECT h.highlight_id as id, h.title, h.cover_url,
                    COUNT(hs.story_id) as story_count
             FROM highlights h
             LEFT JOIN highlight_stories hs ON h.highlight_id = hs.highlight_id
             WHERE h.user_id = ?
             GROUP BY h.highlight_id
             ORDER BY h.created_at DESC`,
            [id]
        );

        res.json(highlights);
    } catch (error) {
        logger.error('Get user highlights error:', error);
        res.status(500).json({ error: 'Failed to get highlights' });
    }
};

/**
 * POST /highlights
 * Create a new highlight
 */
const createHighlight = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { title, cover_url, story_ids } = req.body;

        if (!title) return res.status(400).json({ error: 'Title is required' });

        const highlightId = crypto.randomUUID();

        await pool.query(
            `INSERT INTO highlights (highlight_id, user_id, title, cover_url) VALUES (?, ?, ?, ?)`,
            [highlightId, userId, title, cover_url || null]
        );

        if (story_ids && story_ids.length > 0) {
            const values = story_ids.map((sid, idx) => [crypto.randomUUID(), highlightId, sid, idx]);
            await pool.query(
                `INSERT INTO highlight_stories (id, highlight_id, story_id, position) VALUES ?`,
                [values]
            );
        }

        res.status(201).json({ id: highlightId, title, cover_url, story_count: (story_ids || []).length });
    } catch (error) {
        logger.error('Create highlight error:', error);
        res.status(500).json({ error: 'Failed to create highlight' });
    }
};

/**
 * PUT /highlights/:id
 * Update title/cover of a highlight
 */
const updateHighlight = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { id } = req.params;
        const { title, cover_url } = req.body;

        const [existing] = await pool.query(
            'SELECT highlight_id FROM highlights WHERE highlight_id = ? AND user_id = ?',
            [id, userId]
        );
        if (!existing[0]) return res.status(404).json({ error: 'Highlight not found' });

        await pool.query(
            `UPDATE highlights SET title = COALESCE(?, title), cover_url = COALESCE(?, cover_url) WHERE highlight_id = ?`,
            [title, cover_url, id]
        );

        res.json({ success: true });
    } catch (error) {
        logger.error('Update highlight error:', error);
        res.status(500).json({ error: 'Failed to update highlight' });
    }
};

/**
 * DELETE /highlights/:id
 * Delete a highlight
 */
const deleteHighlight = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { id } = req.params;

        const [existing] = await pool.query(
            'SELECT highlight_id FROM highlights WHERE highlight_id = ? AND user_id = ?',
            [id, userId]
        );
        if (!existing[0]) return res.status(404).json({ error: 'Highlight not found' });

        await pool.query('DELETE FROM highlights WHERE highlight_id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        logger.error('Delete highlight error:', error);
        res.status(500).json({ error: 'Failed to delete highlight' });
    }
};

/**
 * POST /highlights/:id/stories
 * Add stories to a highlight
 */
const addStoriesToHighlight = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { id } = req.params;
        const { story_ids } = req.body;

        const [existing] = await pool.query(
            'SELECT highlight_id FROM highlights WHERE highlight_id = ? AND user_id = ?',
            [id, userId]
        );
        if (!existing[0]) return res.status(404).json({ error: 'Highlight not found' });

        if (!story_ids || !story_ids.length) return res.status(400).json({ error: 'No story IDs provided' });

        // Get current max position
        const [[maxPos]] = await pool.query(
            'SELECT COALESCE(MAX(position), -1) as maxPos FROM highlight_stories WHERE highlight_id = ?',
            [id]
        );

        const values = story_ids.map((sid, idx) => [crypto.randomUUID(), id, sid, maxPos.maxPos + 1 + idx]);
        await pool.query(
            `INSERT IGNORE INTO highlight_stories (id, highlight_id, story_id, position) VALUES ?`,
            [values]
        );

        res.json({ success: true });
    } catch (error) {
        logger.error('Add stories to highlight error:', error);
        res.status(500).json({ error: 'Failed to add stories' });
    }
};

/**
 * DELETE /highlights/:id/stories/:storyId
 * Remove a story from a highlight
 */
const removeStoryFromHighlight = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { id, storyId } = req.params;

        const [existing] = await pool.query(
            'SELECT highlight_id FROM highlights WHERE highlight_id = ? AND user_id = ?',
            [id, userId]
        );
        if (!existing[0]) return res.status(404).json({ error: 'Highlight not found' });

        await pool.query(
            'DELETE FROM highlight_stories WHERE highlight_id = ? AND story_id = ?',
            [id, storyId]
        );

        res.json({ success: true });
    } catch (error) {
        logger.error('Remove story from highlight error:', error);
        res.status(500).json({ error: 'Failed to remove story' });
    }
};

/**
 * GET /highlights/archive
 * Get all archived stories for the current user (expired stories)
 */
const getStoryArchive = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;

        const [stories] = await pool.query(
            `SELECT story_id as id, media_url, media_type, caption, created_at, expires_at
             FROM stories
             WHERE user_id = ? AND (is_archived = 1 OR expires_at <= NOW())
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json(stories);
    } catch (error) {
        logger.error('Get story archive error:', error);
        res.status(500).json({ error: 'Failed to get archive' });
    }
};

module.exports = {
    getHighlight,
    getUserHighlights,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    addStoriesToHighlight,
    removeStoryFromHighlight,
    getStoryArchive
};
