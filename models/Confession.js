const pool = require('../config/database');
const crypto = require('crypto');

class Confession {
    /**
     * Get recent confessions
     */
    static async getRecent(campus, limit = 20) {
        const [confessions] = await pool.query(
            `SELECT * FROM confessions 
             WHERE campus = ? AND is_approved = 1 
             ORDER BY created_at DESC LIMIT ?`,
            [campus, limit]
        );
        return confessions;
    }

    /**
     * Create new confession
     */
    static async create(content, campus, category = 'general') {
        const confessionId = crypto.randomUUID();
        await pool.query(
            'INSERT INTO confessions (confession_id, content, campus, category) VALUES (?, ?, ?, ?)',
            [confessionId, content, campus, category]
        );
        return confessionId;
    }

    /**
     * Add reaction (vote)
     */
    static async addReaction(confessionId, userId, reactionType) {
        const reactionId = crypto.randomUUID();
        try {
            await pool.query(
                'INSERT INTO confession_reactions (reaction_id, confession_id, user_id, reaction_type) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE reaction_type = VALUES(reaction_type)',
                [reactionId, confessionId, userId, reactionType]
            );

            // Update counts
            await this.updateCounts(confessionId);
            return true;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update reaction/comment counts
     */
    static async updateCounts(confessionId) {
        await pool.query(
            `UPDATE confessions SET 
             rating_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'upvote') - 
                            (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'downvote')
             WHERE confession_id = ?`,
            [confessionId, confessionId, confessionId]
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
