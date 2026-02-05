const pool = require('../config/database');
const logger = require('../utils/logger');

const renderMoments = async (req, res) => {
    try {
        console.log('DEBUG: Fetching moments for render...');
        const [moments] = await pool.query(`
            SELECT 
                m.*, 
                u.username, 
                u.name as user_name, 
                u.avatar_url,
                m.media_url as video_url,
                m.like_count as likes,
                m.comment_count as comments
            FROM moments m 
            JOIN users u ON m.user_id = u.user_id 
            ORDER BY m.created_at DESC 
            LIMIT 20
        `);
        // Stabilize and sanitize data before sending
        const sanitizedMoments = (moments || []).map(m => {
            let mediaUrl = m.video_url || m.media_url || '';

            // Fix picsum or empty URLs server-side
            if (!mediaUrl || mediaUrl.includes('📸os') || mediaUrl.includes('picsum')) {
                const randomId = Math.floor(Math.random() * 1000);
                mediaUrl = `https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=1080&h=1920&stabilizer=${randomId}`;
            }

            return {
                ...m,
                media_url: mediaUrl,
                video_url: mediaUrl,
                avatar_url: m.avatar_url || '/uploads/avatars/default.png'
            };
        });

        res.render('moments', { title: 'Moments', user: req.user, initialMoments: sanitizedMoments });
    } catch (error) {
        console.error('DEBUG ERROR loading moments:', error);
        logger.error('Error loading moments:', error);
        res.render('moments', { title: 'Moments', user: req.user, initialMoments: [] });
    }
};

const getMomentsStream = async (req, res) => {
    try {
        const [moments] = await pool.query(`
            SELECT m.*, u.username, u.name as user_name, u.avatar_url,
            m.like_count as likes,
            m.comment_count as comments
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

const sparkMoment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user.user_id;

        // In a real app, we'd check if user already sparked this moment in a 'moment_sparks' table
        // For now, we'll just increment the count to fix the UI issue
        await pool.query('UPDATE moments SET like_count = like_count + 1 WHERE moment_id = ?', [id]);

        const [result] = await pool.query('SELECT like_count FROM moments WHERE moment_id = ?', [id]);

        res.json({
            status: 'success',
            likes: result[0] ? result[0].like_count : 0
        });
    } catch (error) {
        logger.error('Spark Moment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const trackShare = async (req, res) => {
    try {
        const { id } = req.params;
        // Simple increment for share count
        await pool.query('UPDATE moments SET share_count = share_count + 1 WHERE moment_id = ?', [id]);
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getShareData = async (req, res) => {
    try {
        const { id } = req.params;
        const [moments] = await pool.query(`
            SELECT m.*, u.username 
            FROM moments m 
            JOIN users u ON m.user_id = u.user_id 
            WHERE m.moment_id = ?
        `, [id]);

        if (moments.length === 0) return res.status(404).json({ error: 'Moment not found' });

        const moment = moments[0];
        res.json({
            title: `Check out @${moment.username}'s moment!`,
            caption: moment.caption,
            image_url: moment.media_url,
            type: 'moment',
            url: `/moments/${id}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    renderMoments,
    getMomentsStream,
    getUserMoments,
    createMoment,
    sparkMoment,
    trackShare,
    getShareData
};
