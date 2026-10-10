const pool = require('../config/database');
const crypto = require('crypto');

class Confession {
    /**
     * Get recent confessions
     */
    static async getRecent(affiliation = 'all', limit = 20, category = null) {
        let query = 'SELECT * FROM confessions WHERE is_approved = 1 ';
        const params = [];

        if (affiliation && affiliation !== 'all') {
            query += ' AND campus = ? ';
            params.push(affiliation);
        }

        if (category && category !== 'all') {
            query += ' AND category = ? ';
            params.push(category);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);

        const [confessions] = await pool.query(query, params);
        return confessions;
    }

    /**
     * Get discovery-ranked confession feed
     */
    static async getFeed(affiliation = 'all', limit = 20, category = null) {
        let query = 'SELECT * FROM confessions WHERE is_approved = 1 ';
        const params = [];

        if (affiliation && affiliation !== 'all') {
            query += ' AND campus = ? ';
            params.push(affiliation);
        }

        if (category && category !== 'all') {
            query += ' AND category = ? ';
            params.push(category);
        }

        // Boost fresh posts with high engagement
        query += ' ORDER BY discovery_score DESC, created_at DESC LIMIT ?';
        params.push(limit);

        const [confessions] = await pool.query(query, params);
        return confessions;
    }

    /**
     * Create new confession with rotating alias
     */
    static async create(userId, content, affiliation, category = 'general', imageUrl = null) {
        const confessionId = crypto.randomUUID();
        const randomId = Math.floor(1000 + Math.random() * 9000);
        const authorAlias = `Anonymous #${randomId}`;

        await pool.query(
            'INSERT INTO confessions (confession_id, user_id, content, campus, category, author_alias, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [confessionId, userId, content, affiliation, category, authorAlias, imageUrl]
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
     * Update reaction/comment counts and recalculate discovery score
     */
    static async updateCounts(confessionId) {
        // Detailed counters for modern engagement
        await pool.query(
            `UPDATE confessions SET 
             heart_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'heart'),
             fire_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'fire'),
             smile_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type IN ('smile', 'laugh', 'funny')),
             relate_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'relate'),
             support_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'support'),
             downvote_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'downvote'),
             rating_count = (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type IN ('upvote', 'heart', 'fire', 'laugh', 'smile', 'relate', 'support', 'funny')) - 
                            (SELECT COUNT(*) FROM confession_reactions WHERE confession_id = ? AND reaction_type = 'downvote')
             WHERE confession_id = ?`,
            [confessionId, confessionId, confessionId, confessionId, confessionId, confessionId, confessionId, confessionId, confessionId]
        );

        await this.calculateDiscoveryScore(confessionId);
    }

    /**
     * Calculate Discovery Score (Engagement Velocity + Decay)
     * Score = (Relates * 3 + Comments * 5 + Other Reactions * 1) / (TimeDecay^1.8)
     */
    static async calculateDiscoveryScore(confessionId) {
        const [confession] = await pool.query(
            'SELECT created_at, relate_count, comment_count, rating_count FROM confessions WHERE confession_id = ?',
            [confessionId]
        );

        if (confession.length === 0) return;

        const c = confession[0];
        const hoursOld = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60);
        
        // Weights
        const relateWeight = (c.relate_count || 0) * 3;
        const commentWeight = (c.comment_count || 0) * 5;
        const baseEngagement = (c.rating_count || 0) * 1;
        
        // Decay (Gravity)
        const gravity = 1.8;
        const score = (relateWeight + commentWeight + baseEngagement) / Math.pow(hoursOld + 2, gravity);

        await pool.query(
            'UPDATE confessions SET discovery_score = ? WHERE confession_id = ?',
            [score, confessionId]
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

    static async addComment(confessionId, userId, content, parentId = null) {
        const commentId = crypto.randomUUID();
        
        // 1. Check if user is the author of the confession
        const [confession] = await pool.query(
            'SELECT user_id FROM confessions WHERE confession_id = ?',
            [confessionId]
        );
        
        let alias = `Responder #${Math.floor(100 + Math.random() * 899)}`;
        if (confession.length > 0 && confession[0].user_id === userId) {
            alias = 'Author';
        } else {
            // Check if user has already commented to keep same alias in thread
            const [existing] = await pool.query(
                'SELECT author_alias FROM confession_comments WHERE confession_id = ? AND user_id = ? LIMIT 1',
                [confessionId, userId]
            );
            if (existing.length > 0) {
                alias = existing[0].author_alias;
            }
        }

        await pool.query(
            `INSERT INTO confession_comments (comment_id, confession_id, user_id, parent_id, content, author_alias, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [commentId, confessionId, userId, parentId, content, alias]
        );

        // Update comment count
        await pool.query(
            'UPDATE confessions SET comment_count = (SELECT COUNT(*) FROM confession_comments WHERE confession_id = ?) WHERE confession_id = ?',
            [confessionId, confessionId]
        );

        await this.calculateDiscoveryScore(confessionId);
        
        return commentId;
    }

    static async getComments(confessionId) {
        const [comments] = await pool.query(
            `SELECT comment_id, parent_id, content, created_at,
                    author_alias as author
             FROM confession_comments
             WHERE confession_id = ?
             ORDER BY created_at ASC`,
            [confessionId]
        );
        return comments;
    }

    static async findCommentById(commentId) {
        const [comments] = await pool.query(
            'SELECT * FROM confession_comments WHERE comment_id = ?',
            [commentId]
        );
        return comments[0] || null;
    }
}

module.exports = Confession;
