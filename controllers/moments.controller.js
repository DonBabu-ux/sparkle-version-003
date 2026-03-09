const pool = require('../config/database');
const logger = require('../utils/logger');

let tablesEnsured = false;

const ensureMomentTables = async () => {
    if (tablesEnsured) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_likes (
                moment_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (moment_id, user_id),
                INDEX idx_ml_user (user_id),
                INDEX idx_ml_moment (moment_id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS saved_moments (
                moment_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (moment_id, user_id),
                INDEX idx_sm_user (user_id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_hashtags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                moment_id CHAR(36) NOT NULL,
                hashtag VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_mh_moment (moment_id),
                INDEX idx_mh_hashtag (hashtag)
            )
        `);
        tablesEnsured = true;
        logger.info('Moment tables verified/created');
    } catch (e) {
        logger.warn('Could not ensure moment tables: ' + e.message);
    }
};

let columnsEnsured = false;

const ensureMomentColumns = async () => {
    if (columnsEnsured) return;
    const columnsToAdd = [
        { name: 'like_count', def: 'INT DEFAULT 0' },
        { name: 'comment_count', def: 'INT DEFAULT 0' },
        { name: 'share_count', def: 'INT DEFAULT 0' },
        { name: 'category', def: 'VARCHAR(50) DEFAULT NULL' }
    ];
    for (const col of columnsToAdd) {
        try {
            await pool.query(`ALTER TABLE moments ADD COLUMN ${col.name} ${col.def}`);
            logger.info(`Added column moments.${col.name}`);
        } catch (e) {
            // Column already exists — that's fine
        }
    }
    columnsEnsured = true;
};

const renderMoments = async (req, res) => {
    try {
        // Ensure moment_likes and saved_moments tables exist
        await ensureMomentTables();

        // Also ensure moments table has expected columns (add if missing)
        await ensureMomentColumns();

        // Fetch moments with user details
        const [moments] = await pool.query(`
            SELECT 
                m.moment_id,
                m.user_id,
                m.caption,
                m.media_url,
                m.media_type,
                IFNULL(m.like_count, 0) as like_count,
                IFNULL(m.comment_count, 0) as comment_count,
                IFNULL(m.share_count, 0) as share_count,
                m.created_at,
                m.category,
                u.username,
                u.name as user_name,
                u.avatar_url,
                (SELECT COUNT(*) FROM follows WHERE following_id = m.user_id) as follower_count,
                IFNULL(ml.liked, 0) as is_liked,
                IFNULL(sm.saved, 0) as is_saved,
                (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = m.user_id) as is_following
            FROM moments m 
            JOIN users u ON m.user_id = u.user_id
            LEFT JOIN (SELECT moment_id, 1 as liked FROM moment_likes WHERE user_id = ?) ml ON ml.moment_id = m.moment_id
            LEFT JOIN (SELECT moment_id, 1 as saved FROM saved_moments WHERE user_id = ?) sm ON sm.moment_id = m.moment_id
            ORDER BY 
                CASE WHEN m.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 2 END,
                m.created_at DESC
            LIMIT 50
        `, [req.user.user_id, req.user.user_id, req.user.user_id]);

        // Get trending hashtags
        let trendingHashtags = [];
        try {
            const [tags] = await pool.query(`
                SELECT 
                    hashtag,
                    COUNT(*) as usage_count,
                    MAX(created_at) as last_used
                FROM moment_hashtags 
                WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY hashtag
                ORDER BY usage_count DESC, last_used DESC
                LIMIT 10
            `);
            trendingHashtags = tags;
        } catch (e) {
            logger.warn('Could not fetch trending hashtags: ' + e.message);
        }

        // Get suggested users
        const [suggestedUsers] = await pool.query(`
            SELECT 
                u.user_id,
                u.username,
                u.name,
                u.avatar_url,
                (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as follower_count
            FROM users u
            WHERE u.user_id != ? 
            AND u.user_id NOT IN (
                SELECT following_id FROM follows WHERE follower_id = ?
            )
            ORDER BY RAND()
            LIMIT 5
        `, [req.user.user_id, req.user.user_id]);

        // Get user's interests/categories
        let interests = [];
        try {
            const [userInterests] = await pool.query(`
                SELECT DISTINCT category 
                FROM user_interests 
                WHERE user_id = ?
            `, [req.user.user_id]);
            interests = userInterests.map(i => i.category);
        } catch (e) {
            logger.warn('Could not fetch user interests: ' + e.message);
        }

        res.render('moments', {
            title: 'Moments',
            user: req.user,
            initialMoments: moments,
            trendingHashtags,
            suggestedUsers,
            userInterests: interests,
            csrfToken: req.csrfToken ? req.csrfToken() : null,
            env: {
                API_URL: process.env.API_URL || '',
                WS_URL: process.env.WS_URL || ''
            }
        });
    } catch (error) {
        logger.error('Error loading moments:', error);
        res.render('moments', {
            title: 'Moments',
            user: req.user,
            initialMoments: [],
            trendingHashtags: [],
            suggestedUsers: [],
            userInterests: [],
            csrfToken: req.csrfToken ? req.csrfToken() : null,
            env: {
                API_URL: process.env.API_URL || '',
                WS_URL: process.env.WS_URL || ''
            },
            error: 'Failed to load moments'
        });
    }
};

const renderMomentDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const [moments] = await pool.query(`
            SELECT 
                m.*,
                u.username,
                u.name as user_name,
                u.avatar_url
            FROM moments m 
            JOIN users u ON m.user_id = u.user_id 
            WHERE m.moment_id = ?
        `, [id]);

        if (moments.length === 0) {
            return res.status(404).render('404', { title: 'Moment Not Found' });
        }

        res.render('moment-detail', {
            title: 'Moment',
            user: req.user,
            moment: moments[0]
        });
    } catch (error) {
        logger.error('Error loading moment detail:', error);
        res.status(500).render('error', { title: 'Error', error: 'Failed to load moment' });
    }
}

const getMomentsStream = async (req, res) => {
    try {
        const { page = 1, limit = 10, category, hashtag } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                m.*,
                u.username,
                u.name as user_name,
                u.avatar_url,
                m.like_count as likes,
                m.comment_count as comments,
                (SELECT COUNT(*) FROM moment_likes WHERE moment_id = m.moment_id AND user_id = ?) as is_liked,
                (SELECT COUNT(*) FROM saved_moments WHERE moment_id = m.moment_id AND user_id = ?) as is_saved
            FROM moments m
            JOIN users u ON m.user_id = u.user_id
        `;

        const params = [req.user.user_id, req.user.user_id];

        if (hashtag) {
            query = `
                SELECT m.*, u.username, u.name as user_name, u.avatar_url,
                       m.like_count as likes, m.comment_count as comments,
                       (SELECT COUNT(*) FROM moment_likes WHERE moment_id = m.moment_id AND user_id = ?) as is_liked,
                       (SELECT COUNT(*) FROM saved_moments WHERE moment_id = m.moment_id AND user_id = ?) as is_saved
                FROM moments m
                JOIN users u ON m.user_id = u.user_id
                JOIN moment_hashtags h ON m.moment_id = h.moment_id
                WHERE h.hashtag = ?
            `;
            params.push(req.user.user_id, req.user.user_id, hashtag);
        } else if (category && category !== 'all') {
            query += ` WHERE m.category = ?`;
            params.push(category);
        }

        query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [moments] = await pool.query(query, params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM moments';
        if (category && category !== 'all') {
            countQuery += ' WHERE category = ?';
        }
        const [totalResult] = await pool.query(
            countQuery,
            category && category !== 'all' ? [category] : []
        );

        res.json({
            moments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalResult[0].total,
                pages: Math.ceil(totalResult[0].total / limit)
            }
        });
    } catch (error) {
        logger.error('Stream Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const sparkMoment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id;

        // Check if already sparks
        const [existing] = await pool.query(
            'SELECT * FROM moment_likes WHERE moment_id = ? AND user_id = ?',
            [id, userId]
        );

        let action;
        if (existing.length > 0) {
            // Unlike
            await pool.query(
                'DELETE FROM moment_likes WHERE moment_id = ? AND user_id = ?',
                [id, userId]
            );
            await pool.query(
                'UPDATE moments SET like_count = like_count - 1 WHERE moment_id = ?',
                [id]
            );
            action = 'unliked';
        } else {
            // Like
            await pool.query(
                'INSERT INTO moment_likes (moment_id, user_id) VALUES (?, ?)',
                [id, userId]
            );
            await pool.query(
                'UPDATE moments SET like_count = like_count + 1 WHERE moment_id = ?',
                [id]
            );
            action = 'liked';

            // Create notification for moment owner
            try {
                const [moment] = await pool.query(
                    'SELECT user_id FROM moments WHERE moment_id = ?',
                    [id]
                );
                if (moment[0] && moment[0].user_id !== userId) {
                    const notificationId = require('crypto').randomUUID();
                    await pool.query(
                        `INSERT INTO notifications 
                        (notification_id, user_id, type, title, content, related_id, related_type, actor_id, action_url) 
                        VALUES (?, ?, 'spark', 'Moment Sparked!', 'Someone sparked your moment.', ?, 'moment', ?, CONCAT('/moments/', ?))`,
                        [notificationId, moment[0].user_id, id, userId, id]
                    );
                }
            } catch (notiError) {
                console.error('Notification Error:', notiError.message);
            }
        }

        const [result] = await pool.query(
            'SELECT like_count FROM moments WHERE moment_id = ?',
            [id]
        );

        res.json({
            status: 'success',
            action,
            likes: result[0] ? result[0].like_count : 0
        });
    } catch (error) {
        logger.error('Spark Moment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const createMoment = async (req, res) => {
    try {
        const { caption, category = 'general' } = req.body;
        const media_url = req.file ? req.file.path : (req.body.media_url || req.body.video_url);
        const userId = req.user.user_id;

        if (!media_url) {
            return res.status(400).json({ error: 'Media is required' });
        }

        const momentId = require('crypto').randomUUID();
        const media_type = req.file ? req.file.mimetype.split('/')[0] : 'video';

        // Extract hashtags from caption
        const hashtags = caption ? (caption.match(/#[a-zA-Z0-9_]+/g) || []) : [];

        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Insert moment
            await connection.query(
                `INSERT INTO moments 
                (moment_id, user_id, caption, media_url, media_type, category, like_count, comment_count, share_count) 
                VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)`,
                [momentId, userId, caption || '', media_url, media_type, category]
            );

            // Insert hashtags
            for (const tag of hashtags) {
                await connection.query(
                    'INSERT INTO moment_hashtags (moment_id, hashtag) VALUES (?, ?)',
                    [momentId, tag.toLowerCase()]
                );
            }

            await connection.commit();

            // Get created moment with user details
            const [newMoment] = await pool.query(
                `SELECT m.*, u.username, u.name as user_name, u.avatar_url 
                FROM moments m 
                JOIN users u ON m.user_id = u.user_id 
                WHERE m.moment_id = ?`,
                [momentId]
            );

            res.status(201).json({
                status: 'success',
                message: 'Moment created',
                moment: newMoment[0]
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        logger.error('Create Moment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const saveMoment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id;

        const [existing] = await pool.query(
            'SELECT * FROM saved_moments WHERE moment_id = ? AND user_id = ?',
            [id, userId]
        );

        if (existing.length > 0) {
            await pool.query(
                'DELETE FROM saved_moments WHERE moment_id = ? AND user_id = ?',
                [id, userId]
            );
            res.json({ status: 'success', action: 'unsaved' });
        } else {
            await pool.query(
                'INSERT INTO saved_moments (moment_id, user_id) VALUES (?, ?)',
                [id, userId]
            );
            res.json({ status: 'success', action: 'saved' });
        }
    } catch (error) {
        logger.error('Save Moment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        const userId = req.user.user_id;

        const commentId = require('crypto').randomUUID();

        await pool.query(
            `INSERT INTO comments 
            (comment_id, moment_id, user_id, comment) 
            VALUES (?, ?, ?, ?)`,
            [commentId, id, userId, comment]
        );

        await pool.query(
            'UPDATE moments SET comment_count = comment_count + 1 WHERE moment_id = ?',
            [id]
        );

        // Get comment with user details
        const [newComment] = await pool.query(
            `SELECT c.*, u.username, u.avatar_url 
            FROM comments c 
            JOIN users u ON c.user_id = u.user_id 
            WHERE c.comment_id = ?`,
            [commentId]
        );

        // Create notification
        const [moment] = await pool.query(
            'SELECT user_id FROM moments WHERE moment_id = ?',
            [id]
        );
        if (moment[0] && moment[0].user_id !== userId) {
            await pool.query(
                `INSERT INTO notifications 
                (notification_id, user_id, type, title, content, related_id, related_type, actor_id, action_url) 
                VALUES (UUID(), ?, 'comment', 'New Comment', 'Someone commented on your moment.', ?, 'moment', ?, CONCAT('/moments/', ?))`,
                [moment[0].user_id, id, userId, id]
            );
        }

        res.status(201).json({
            status: 'success',
            comment: newComment[0]
        });
    } catch (error) {
        logger.error('Add Comment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const [comments] = await pool.query(
            `SELECT c.*, u.username, u.avatar_url 
            FROM comments c 
            JOIN users u ON c.user_id = u.user_id 
            WHERE c.moment_id = ? 
            ORDER BY c.created_at DESC 
            LIMIT ? OFFSET ?`,
            [id, parseInt(limit), parseInt(offset)]
        );

        const [totalResult] = await pool.query(
            'SELECT COUNT(*) as total FROM comments WHERE moment_id = ?',
            [id]
        );

        res.json({
            comments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalResult[0].total,
                pages: Math.ceil(totalResult[0].total / limit)
            }
        });
    } catch (error) {
        logger.error('Get Comments Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const followUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.user_id;

        if (userId === currentUserId) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }

        const [existing] = await pool.query(
            'SELECT * FROM follows WHERE follower_id = ? AND following_id = ?',
            [currentUserId, userId]
        );

        if (existing.length > 0) {
            await pool.query(
                'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
                [currentUserId, userId]
            );
            res.json({ status: 'success', action: 'unfollowed' });
        } else {
            await pool.query(
                'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
                [currentUserId, userId]
            );

            // Create notification
            await pool.query(
                `INSERT INTO notifications 
                (notification_id, user_id, type, title, content, related_id, related_type, actor_id, action_url) 
                VALUES (UUID(), ?, 'follow', 'New Follower', 'Someone started following you.', ?, 'user', ?, '/connect')`,
                [userId, currentUserId, currentUserId]
            );

            res.json({ status: 'success', action: 'followed' });
        }
    } catch (error) {
        logger.error('Follow User Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const trackShare = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(
            'UPDATE moments SET share_count = share_count + 1 WHERE moment_id = ?',
            [id]
        );
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getShareData = async (req, res) => {
    try {
        const { id } = req.params;
        const [moments] = await pool.query(`
            SELECT m.*, u.username, u.name 
            FROM moments m 
            JOIN users u ON m.user_id = u.user_id 
            WHERE m.moment_id = ?
        `, [id]);

        if (moments.length === 0) {
            return res.status(404).json({ error: 'Moment not found' });
        }

        const moment = moments[0];
        res.json({
            title: `${moment.name} (@${moment.username}) on Sparkle`,
            description: moment.caption || 'Check out this moment on Sparkle!',
            image: moment.media_url.startsWith('http') ? moment.media_url : `${req.protocol}://${req.get('host')}${moment.media_url}`,
            url: `${req.protocol}://${req.get('host')}/moments/${id}`,
            type: 'video.moment'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    renderMoments,
    renderMomentDetail,
    getMomentsStream,
    createMoment,
    sparkMoment,
    saveMoment,
    addComment,
    getComments,
    followUser,
    trackShare,
    getShareData
};
