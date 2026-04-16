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
            CREATE TABLE IF NOT EXISTS moment_comments (
                comment_id CHAR(36) PRIMARY KEY,
                moment_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                parent_comment_id CHAR(36) DEFAULT NULL,
                content TEXT NOT NULL,
                like_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_mc_moment (moment_id),
                INDEX idx_mc_parent (parent_comment_id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS moment_comment_likes (
                comment_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (comment_id, user_id)
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
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS user_interests (
                        user_id CHAR(36) NOT NULL,
                        category VARCHAR(50) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, category)
                    )
                `);
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS search_history (
                        id CHAR(36) NOT NULL,
                        user_id CHAR(36) NOT NULL,
                        query VARCHAR(255) NOT NULL,
                        searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (id),
                        UNIQUE KEY unique_user_query (user_id, query),
                        INDEX idx_sh_user (user_id)
                    )
                `);
                tablesEnsured = true;
                logger.info('Moment tables and extensions verified/created');
    } catch (e) {
        logger.warn('Could not ensure moment tables: ' + e.message);
    }
};

let columnsEnsured = false;

const ensureMomentColumns = async () => {
    if (columnsEnsured) return;
    
    // Check 'moments' table
    const momentsCols = [
        { name: 'like_count', def: 'INT DEFAULT 0' },
        { name: 'comment_count', def: 'INT DEFAULT 0' },
        { name: 'share_count', def: 'INT DEFAULT 0' },
        { name: 'category', def: 'VARCHAR(50) DEFAULT NULL' }
    ];
    for (const col of momentsCols) {
        try {
            await pool.query(`ALTER TABLE moments ADD COLUMN ${col.name} ${col.def}`);
            logger.info(`Added column moments.${col.name}`);
        } catch (e) { /* ignore if already exists */ }
    }

    // Check 'moment_comments' table
    const commentCols = [
        { name: 'parent_comment_id', def: 'CHAR(36) DEFAULT NULL' },
        { name: 'like_count', def: 'INT DEFAULT 0' }
    ];
    for (const col of commentCols) {
        try {
            await pool.query(`ALTER TABLE moment_comments ADD COLUMN ${col.name} ${col.def}`);
            logger.info(`Added column moment_comments.${col.name}`);
        } catch (e) { /* ignore if already exists */ }
    }

    try {
        await pool.query('ALTER TABLE clubs ADD COLUMN is_public TINYINT(1) DEFAULT 1');
        logger.info('Added column clubs.is_public');
    } catch (e) { /* ignore if already exists */ }

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

const getMomentById = async (req, res) => {
    try {
        const { id } = req.params;
        const [moments] = await pool.query(`
            SELECT 
                m.*,
                u.username,
                u.name as user_name,
                u.avatar_url,
                (SELECT COUNT(*) FROM moment_likes WHERE moment_id = m.moment_id AND user_id = ?) as is_liked,
                (SELECT COUNT(*) FROM saved_moments WHERE moment_id = m.moment_id AND user_id = ?) as is_saved,
                (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = m.user_id) as is_following
            FROM moments m 
            JOIN users u ON m.user_id = u.user_id 
            WHERE m.moment_id = ?
        `, [req.user?.user_id, req.user?.user_id, req.user?.user_id, id]);

        if (moments.length === 0) {
            return res.status(404).json({ error: 'Moment not found' });
        }

        res.json({ success: true, moment: moments[0] });
    } catch (error) {
        logger.error('Error loading moment detail:', error);
        res.status(500).json({ error: 'Failed to load moment' });
    }
}

const getMomentsStream = async (req, res) => {
    try {
        await ensureMomentTables();
        await ensureMomentColumns();
        
        const { page = 1, limit = 10, category, hashtag, recentlySeen } = req.query;
        const currentUserId = req.user.user_id;
        const offset = (page - 1) * limit;

        // Recently seen IDs to exclude (last 50 items from local cache)
        const excludeIds = Array.isArray(recentlySeen) ? recentlySeen : (recentlySeen ? recentlySeen.split(',') : []);

        // 1. Fetch Base Pool (Up to 100 items for scoring)
        let poolQuery = `
            SELECT 
                m.*,
                u.username, u.name as user_name, u.avatar_url,
                IFNULL(m.like_count, 0) as likes, IFNULL(m.comment_count, 0) as comments, IFNULL(m.share_count, 0) as shares,
                (SELECT COUNT(*) FROM moment_likes WHERE moment_id = m.moment_id AND user_id = ?) as is_liked,
                (SELECT COUNT(*) FROM saved_moments WHERE moment_id = m.moment_id AND user_id = ?) as is_saved,
                (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = m.user_id) as is_following,
                (SELECT COUNT(*) FROM moment_likes ml 
                 JOIN follows f ON ml.user_id = f.following_id 
                 WHERE ml.moment_id = m.moment_id AND f.follower_id = ?) as friend_interaction_count
            FROM moments m
            JOIN users u ON m.user_id = u.user_id
        `;

        const params = [currentUserId, currentUserId, currentUserId, currentUserId];

        const whereClauses = [];
        if (hashtag) {
            whereClauses.push(`m.moment_id IN (SELECT moment_id FROM moment_hashtags WHERE hashtag = ?)`);
            params.push(hashtag);
        } else if (category && category !== 'all') {
            whereClauses.push(`m.category = ?`);
            params.push(category);
        }

        if (excludeIds.length > 0) {
            whereClauses.push(`m.moment_id NOT IN (${excludeIds.map(() => '?').join(',')})`);
            params.push(...excludeIds);
        }

        if (whereClauses.length > 0) {
            poolQuery += ` WHERE ` + whereClauses.join(' AND ');
        }

        // Limit the pool for performance (constrained by Part 7)
        poolQuery += ` ORDER BY m.created_at DESC LIMIT 100`;

        const [momentsPool] = await pool.query(poolQuery, params);

        // 2. Probabilistic Ranking (Part 2 & 3)
        // Deterministic-per-session random factor using userId + hourly window
        const hourlySeed = Math.floor(Date.now() / (1000 * 60 * 60));
        
        const scoredMoments = momentsPool.map(m => {
            // Simple pseudo-random using seed
            const seedStr = `${m.moment_id}${currentUserId}${hourlySeed}`;
            let hash = 0;
            for (let i = 0; i < seedStr.length; i++) hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
            const randomFactor = Math.abs(hash % 1000) / 1000;

            const engagementBoost = (m.likes * 0.2) + (m.comments * 0.3) + (m.shares * 0.4);
            const relationshipBoost = (m.is_following ? 0.5 : 0) + (m.friend_interaction_count * 0.6);
            
            return {
                ...m,
                discovery_score: randomFactor + engagementBoost + relationshipBoost
            };
        });

        // 3. Sort and Paginate
        const sortedMoments = scoredMoments.sort((a, b) => b.discovery_score - a.discovery_score);
        const paginatedMoments = sortedMoments.slice(offset, offset + parseInt(limit));

        res.json({
            moments: paginatedMoments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: sortedMoments.length,
                pages: Math.ceil(sortedMoments.length / limit)
            }
        });

    } catch (error) {
        logger.error('Probabilistic Stream Error:', error);
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

        // Extract hashtags (Max 5)
        const tags = caption ? (caption.match(/#[a-zA-Z0-9_]+/g) || []) : [];
        const hashtags = [...new Set(tags.map(t => t.toLowerCase()))].slice(0, 5);

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
        const { comment, parentId } = req.body;
        const userId = req.user.user_id;

        const commentId = require('crypto').randomUUID();

        // Safe the parentId (use NULL if empty string)
        const pid = parentId || null;

        await pool.query(
            `INSERT INTO moment_comments 
            (comment_id, moment_id, user_id, content, parent_comment_id) 
            VALUES (?, ?, ?, ?, ?)`,
            [commentId, id, userId, comment, pid]
        );

        await pool.query(
            'UPDATE moments SET comment_count = comment_count + 1 WHERE moment_id = ?',
            [id]
        );

        // Get comment with user details
        const [newComment] = await pool.query(
            `SELECT c.*, u.username, u.avatar_url 
            FROM moment_comments c 
            JOIN users u ON c.user_id = u.user_id 
            WHERE c.comment_id = ?`,
            [commentId]
        );

        // Create notification for moment owner
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

        // Create notification for parent comment owner if it's a reply
        if (pid) {
            const [parent] = await pool.query('SELECT user_id FROM moment_comments WHERE comment_id = ?', [pid]);
            if (parent[0] && parent[0].user_id !== userId && parent[0].user_id !== moment[0]?.user_id) {
                await pool.query(
                    `INSERT INTO notifications 
                    (notification_id, user_id, type, title, content, related_id, related_type, actor_id, action_url) 
                    VALUES (UUID(), ?, 'reply', 'New Reply', 'Someone replied to your comment.', ?, 'moment_comment', ?, CONCAT('/moments/', ?))`,
                    [parent[0].user_id, pid, userId, id]
                );
            }
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
        const currentUserId = req.user.user_id;

        // Fetch all comments for this moment and tree-ify them
        const [allComments] = await pool.query(
            `SELECT c.*, u.username, u.avatar_url,
                    (SELECT COUNT(*) FROM moment_comment_likes mcl WHERE mcl.comment_id = c.comment_id AND mcl.user_id = ?) as is_liked
            FROM moment_comments c 
            JOIN users u ON c.user_id = u.user_id 
            WHERE c.moment_id = ? 
            ORDER BY c.created_at ASC`,
            [currentUserId, id]
        );

        // Simple tree-ification
        const commentMap = {};
        const roots = [];

        allComments.forEach(c => {
            c.replies = [];
            commentMap[c.comment_id] = c;
        });

        allComments.forEach(c => {
            if (c.parent_comment_id && commentMap[c.parent_comment_id]) {
                commentMap[c.parent_comment_id].replies.push(c);
            } else {
                roots.push(c);
            }
        });

        res.json({
            status: 'success',
            comments: roots.reverse() // Newest on top
        });
    } catch (error) {
        logger.error('Get Comments Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const likeComment = async (req, res) => {
    try {
        const { id } = req.params; // comment_id
        const userId = req.user.user_id;

        const [existing] = await pool.query(
            'SELECT * FROM moment_comment_likes WHERE comment_id = ? AND user_id = ?',
            [id, userId]
        );

        let action = '';
        if (existing.length > 0) {
            await pool.query('DELETE FROM moment_comment_likes WHERE comment_id = ? AND user_id = ?', [id, userId]);
            await pool.query('UPDATE moment_comments SET like_count = GREATEST(like_count - 1, 0) WHERE comment_id = ?', [id]);
            action = 'unliked';
        } else {
            await pool.query('INSERT INTO moment_comment_likes (comment_id, user_id) VALUES (?, ?)', [id, userId]);
            await pool.query('UPDATE moment_comments SET like_count = like_count + 1 WHERE comment_id = ?', [id]);
            action = 'liked';
        }

        const [updated] = await pool.query('SELECT like_count FROM moment_comments WHERE comment_id = ?', [id]);
        res.json({ 
            success: true, 
            action, 
            likes: updated[0]?.like_count || 0 
        });
    } catch (error) {
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
    getShareData,
    likeComment,
    getMomentById
};
