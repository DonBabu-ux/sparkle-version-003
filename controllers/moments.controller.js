const pool = require('../config/database');
const logger = require('../utils/logger');

const renderMoments = async (req, res) => {
    try {
        const [moments] = await pool.query(`
            SELECT 
                m.*, 
                u.username, 
                u.name as user_name, 
                u.avatar_url,
                m.media_url as video_url,
                (SELECT COUNT(*) FROM sparks s WHERE s.moment_id = m.moment_id) as likes,
                (SELECT COUNT(*) FROM comments c WHERE c.moment_id = m.moment_id) as comments
            FROM moments m 
            JOIN users u ON m.user_id = u.user_id 
            ORDER BY m.created_at DESC 
            LIMIT 20
        `);
        res.render('moments', { title: 'Moments', user: req.user, initialMoments: moments || [] });
    } catch (error) {
        logger.error('Error loading moments:', error);
        res.render('moments', { title: 'Moments', user: req.user, initialMoments: [] });
    }
};

const getMomentsStream = async (req, res) => {
    try {
        const [moments] = await pool.query(`
            SELECT m.*, u.username, u.name as user_name, u.avatar_url,
            (SELECT COUNT(*) FROM sparks s WHERE s.moment_id = m.moment_id) as likes,
            (SELECT COUNT(*) FROM comments c WHERE c.moment_id = m.moment_id) as comments
            FROM moments m 
            JOIN users u ON m.user_id = u.user_id 
            ORDER BY m.created_at DESC
            LIMIT 50
        `);
        res.json(moments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getUserMoments = async (req, res) => {
    try {
        const { userId } = req.params;
        const [moments] = await pool.query('SELECT * FROM moments WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        res.json(moments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createMoment = async (req, res) => {
    try {
        const { caption } = req.body;
        const media_url = req.file ? req.file.path : req.body.video_url;

        if (!media_url) {
            return res.status(400).json({ error: 'Video is required' });
        }

        const userId = req.user.userId || req.user.user_id;
        const momentId = require('crypto').randomUUID();
        const media_type = 'video'; // Moments are specifically videos

        await pool.query(
            'INSERT INTO moments (moment_id, user_id, caption, media_url, media_type) VALUES (?, ?, ?, ?, ?)',
            [momentId, userId, caption, media_url, media_type]
        );

        res.status(201).json({ status: 'success', message: 'Moment created', moment_id: momentId });
    } catch (error) {
        logger.error('Create Moment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { renderMoments, getMomentsStream, getUserMoments, createMoment };
