const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { authMiddleware } = require('../../middleware/auth.middleware');

// Track Share Analytics
router.post('/track', authMiddleware, async (req, res) => {
    try {
        const { contentId, type, platform } = req.body;
        const userId = req.user.userId || req.user.user_id;

        console.log(`Tracking share: ${type} ${contentId} via ${platform} by user ${userId}`);

        // Increment share count in the respective table
        if (type === 'post') {
            await pool.query('UPDATE posts SET share_count = share_count + 1 WHERE post_id = ?', [contentId]);
        } else if (type === 'moment') {
            await pool.query('UPDATE moments SET share_count = share_count + 1 WHERE moment_id = ?', [contentId]);
        } else if (type === 'story') {
            await pool.query('UPDATE stories SET share_count = share_count + 1 WHERE story_id = ?', [contentId]);
        }

        // track in notifications/analytics if needed
        // For now just return success
        res.json({ status: 'success' });
    } catch (error) {
        console.error('Track Share Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get content details for sharing (Open Graph data, etc.)
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query;

        let content;
        if (type === 'moment') {
            const [rows] = await pool.query('SELECT m.*, u.username FROM moments m JOIN users u ON m.user_id = u.user_id WHERE m.moment_id = ?', [id]);
            content = rows[0];
        } else if (type === 'story') {
            const [rows] = await pool.query('SELECT s.*, u.username FROM stories s JOIN users u ON s.user_id = u.user_id WHERE s.story_id = ?', [id]);
            content = rows[0];
        } else if (type === 'confession') {
            const [rows] = await pool.query('SELECT * FROM confessions WHERE confession_id = ?', [id]);
            content = rows[0];
            if (content) content.username = 'Anonymous';
        } else {
            const [rows] = await pool.query('SELECT p.*, u.username FROM posts p JOIN users u ON p.user_id = u.user_id WHERE p.post_id = ?', [id]);
            content = rows[0];
        }

        if (!content) return res.status(404).json({ error: 'Content not found' });

        res.json({
            title: type === 'moment' ? `Check out @${content.username}'s moment!` :
                type === 'story' ? `Check out @${content.username}'s AfterGlow!` :
                    `Post by @${content.username}`,
            caption: content.caption || content.content,
            image_url: content.media_url,
            type: type || 'post',
            url: type === 'moment' ? `/moments/${id}` :
                type === 'story' ? `/dashboard` : // Stories don't have detail pages yet, link to dash
                    `/post/${id}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
