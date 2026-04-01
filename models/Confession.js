const pool = require('../config/database');
const crypto = require('crypto');

class Confession {
    /**
     * Get recent confessions
     */
    static async getRecent(affiliation = 'all', limit = 20) {
        let query = 'SELECT * FROM confessions WHERE is_approved = 1 ';
        const params = [];

        if (affiliation && affiliation !== 'all') {
            query += ' AND campus = ? ';
            params.push(affiliation);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);

        const [confessions] = await pool.query(query, params);
        return confessions;
    }

    /**
     * Get randomized confession feed (Batch 3)
     */
    static async getFeed(affiliation = 'all', limit = 20, seed = null) {
        let query = 'SELECT * FROM confessions WHERE is_approved = 1 ';
        const params = [];

        if (affiliation && affiliation !== 'all') {
            query += ' AND campus = ? ';
            params.push(affiliation);
        }

        const sqlSeed = seed ? `(${seed})` : '(0)';
        query += ` ORDER BY RAND${sqlSeed} DESC LIMIT ?`;
        params.push(limit);

        const [confessions] = await pool.query(query, params);
        return confessions;
    }

    /**
     * Create new confession
     */
    static async create(userId, content, affiliation, category = 'general') {
        const confessionId = crypto.randomUUID();
        await pool.query(
            'INSERT INTO confessions (confession_id, user_id, content, campus, category) VALUES (?, ?, ?, ?, ?)',
            [confessionId, userId, content, affiliation, category]
        );
        return confessionId;
    }

    /**
     * Add reaction (vote)
     */
    static async addReaction(confessionId, userId, type) {
        const reactionId = crypto.randomUUID();
        
        // 1. Check if user already has a reaction
        const [existing] = await pool.query(
            'SELECT reaction_type FROM confession_reactions WHERE confession_id = ? AND user_id = ?',
            [confessionId, userId]
        );

        if (existing.length > 0) {
            if (existing[0].reaction_type === type) {
                // Toggle off: remove reaction if same type clicked again
                await pool.query(
                    'DELETE FROM confession_reactions WHERE confession_id = ? AND user_id = ?',
                    [confessionId, userId]
                );
            } else {
                // Update: change reaction type
                await pool.query(
                    'UPDATE confession_reactions SET reaction_type = ? WHERE confession_id = ? AND user_id = ?',
                    [type, confessionId, userId]
                );
            }
        } else {
            // Insert new reaction
            await pool.query(
                'INSERT INTO confession_reactions (reaction_id, confession_id, user_id, reaction_type) VALUES (?, ?, ?, ?)',
                [reactionId, confessionId, userId, type]
            );
        }

        await this.updateCounts(confessionId);
    }

    /**
     * Update reaction/comment counts
     */
    static async updateCounts(confessionId) {
        // Detailed counters for Batch 3
        await pool.query(
            `UPDATE confessions SET 
             heart_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'heart'),
             fire_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'fire'),
             smile_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type IN ('smile', 'laugh')),
             downvote_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'downvote'),
             rating_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type IN ('upvote', 'heart', 'fire', 'laugh', 'smile')) - 
                            (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'downvote')
             WHERE confession_id = ?`,
            [confessionId, confessionId, confessionId, confessionId, confessionId, confessionId, confessionId]
        );
    }

    /**
     * Get confession with reactions
     */
    static async findById(confessionId) {
        const [confessions] = await pool.query(
            'SELECT * FROM confessions WHERE confession_id = ?',
            [confessionId]
        );
        return confessions[0] || null;
    }
    static async addReport(confessionId, userId, reason) {
        const reportId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO confession_reports (report_id, confession_id, reporter_id, reason, created_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
            [reportId, confessionId, userId, reason]
        );
    }

    static async addComment(confessionId, userId, content) {
        const commentId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO confession_comments (comment_id, confession_id, user_id, content, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [commentId, confessionId, userId, content]
        );
        return commentId;
    }

    static async getComments(confessionId) {
        const [comments] = await pool.query(
            `SELECT comment_id, content, created_at,
                    'Anonymous' as author
             FROM confession_comments
             WHERE confession_id = ?
             ORDER BY created_at ASC`,
            [confessionId]
        );
        return comments;
    }
}

module.exports = Confession;
