const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class ModerationService {
    static async createReport(postId, reporterId, reason) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Check if user already reported this post
            const [existing] = await connection.query(
                'SELECT id FROM reports WHERE post_id = ? AND reporter_id = ?',
                [postId, reporterId]
            );

            if (existing.length > 0) {
                throw new Error('You have already reported this post.');
            }

            // Insert report
            const reportId = uuidv4();
            await connection.query(
                'INSERT INTO reports (id, post_id, reporter_id, reason) VALUES (?, ?, ?, ?)',
                [reportId, postId, reporterId, reason]
            );

            await connection.commit();
            
            // Trigger background evaluation
            this.evaluatePost(postId).catch(err => logger.error('Evaluation error:', err));
            
            return { success: true, message: 'Report submitted successfully.', reportId };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    static async evaluatePost(postId) {
        // 1. Aggregate Reports
        const [reports] = await pool.query(
            'SELECT COUNT(*) as count, GROUP_CONCAT(reason) as reasons FROM reports WHERE post_id = ?',
            [postId]
        );
        const reportCount = reports[0].count;

        if (reportCount === 0) return;

        // 2. Fetch post owner
        const [posts] = await pool.query('SELECT user_id, status FROM posts WHERE post_id = ?', [postId]);
        if (posts.length === 0) return;
        
        const ownerId = posts[0].user_id;
        const currentStatus = posts[0].status;

        if (currentStatus === 'removed') return; // Already removed

        // 3. Simulate AI Scoring (In a real system, call AWS Rekognition / Perspective API)
        // Here we just mock scores based on report count for demonstration
        const toxicity = Math.min(1.0, reportCount * 0.15);
        const nsfw = Math.min(1.0, reportCount * 0.10);
        const violence = Math.min(1.0, reportCount * 0.05);
        const maxScore = Math.max(toxicity, nsfw, violence);
        const confidence = 0.85;

        // Update/Insert moderation_scores
        await pool.query(
            `INSERT INTO moderation_scores (post_id, toxicity_score, nsfw_score, violence_score, confidence) 
             VALUES (?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             toxicity_score = VALUES(toxicity_score), nsfw_score = VALUES(nsfw_score), 
             violence_score = VALUES(violence_score), confidence = VALUES(confidence)`,
            [postId, toxicity, nsfw, violence, confidence]
        );

        // 4. Decision Engine
        let newStatus = currentStatus;
        let actionTaken = 'none';

        if (maxScore > 0.8 || reportCount >= 5) {
            newStatus = 'removed';
            actionTaken = 'post_removed';
        } else if (maxScore > 0.5 || reportCount >= 3) {
            newStatus = 'limited';
            actionTaken = 'post_limited';
        }

        if (newStatus !== currentStatus) {
            // Take action
            await pool.query(
                'UPDATE posts SET status = ?, visibility_score = ? WHERE post_id = ?',
                [newStatus, newStatus === 'limited' ? 0.2 : 1.0, postId]
            );

            // Notify owner
            const notificationId = uuidv4();
            const message = newStatus === 'removed' 
                ? 'Your post was removed due to multiple reports and community guidelines violations.' 
                : 'Your post visibility has been limited pending a review due to community reports.';

            await pool.query(
                `INSERT INTO notifications 
                (notification_id, user_id, type, title, content, related_id, related_type) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    notificationId, 
                    ownerId, 
                    'system', // using system type as it's safe for existing enum, or we can use existing ones
                    'Content Moderation Alert', 
                    message, 
                    postId, 
                    'post_moderation'
                ]
            );
        }
    }

    static async submitAppeal(postId, userId, reason) {
        const [posts] = await pool.query('SELECT user_id, status FROM posts WHERE post_id = ?', [postId]);
        if (posts.length === 0) throw new Error('Post not found');
        if (posts[0].user_id !== userId) throw new Error('You can only appeal your own posts');
        if (posts[0].status === 'active') throw new Error('This post is already active');

        const [existing] = await pool.query('SELECT id FROM appeals WHERE post_id = ? AND status = "pending"', [postId]);
        if (existing.length > 0) throw new Error('An appeal is already pending for this post');

        const appealId = uuidv4();
        await pool.query(
            'INSERT INTO appeals (id, post_id, user_id, reason) VALUES (?, ?, ?, ?)',
            [appealId, postId, userId, reason]
        );

        return { success: true, message: 'Appeal submitted successfully', appealId };
    }

    // For admins/moderators to manually restore or reject appeal
    static async reviewAppeal(appealId, decision) {
        const [appeals] = await pool.query('SELECT post_id, user_id, status FROM appeals WHERE id = ?', [appealId]);
        if (appeals.length === 0) throw new Error('Appeal not found');
        if (appeals[0].status !== 'pending') throw new Error('Appeal already reviewed');

        const postId = appeals[0].post_id;
        const ownerId = appeals[0].user_id;
        const newStatus = decision === 'approve' ? 'approved' : 'rejected';

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.query(
                'UPDATE appeals SET status = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newStatus, appealId]
            );

            if (decision === 'approve') {
                await connection.query(
                    'UPDATE posts SET status = "active", visibility_score = 1.0 WHERE post_id = ?',
                    [postId]
                );
            }

            // Notify user
            const notificationId = uuidv4();
            const title = decision === 'approve' ? 'Appeal Approved' : 'Appeal Rejected';
            const content = decision === 'approve' 
                ? 'Your appeal was approved and your post has been restored.' 
                : 'Your appeal was reviewed and rejected. The post will remain removed.';

            await connection.query(
                `INSERT INTO notifications 
                (notification_id, user_id, type, title, content, related_id, related_type) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [notificationId, ownerId, 'system', title, content, postId, 'appeal_result']
            );

            await connection.commit();
            return { success: true, message: `Appeal ${newStatus}` };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }
}

module.exports = ModerationService;
