const pool = require('../config/database');
const logger = require('../utils/logger');

const search = async (req, res) => {
    try {
        const { q, type = 'all', limit = 20, offset = 0, campus } = req.query;

        if (!q || q.length < 2) {
            return res.json({ status: 'success', data: { results: [] } });
        }

        const searchTerm = `%${q}%`;
        const results = {};
        const promises = [];

        // Search users
        if (type === 'all' || type === 'users') {
            promises.push(
                (async () => {
                    try {
                        const params = [searchTerm, searchTerm, searchTerm];
                        let campusClause = '';
                        if (campus) { campusClause = 'AND campus = ?'; params.push(campus); }
                        params.push(parseInt(limit), parseInt(offset));

                        const [users] = await pool.query(
                            `SELECT 
                                user_id as id, 'user' as type, name as title,
                                username as subtitle, avatar_url as image,
                                CONCAT(name, ' (@', username, ')') as description,
                                campus, bio as extra
                             FROM users
                             WHERE (name LIKE ? OR username LIKE ? OR email LIKE ?)
                             ${campusClause}
                             LIMIT ? OFFSET ?`,
                            params
                        );
                        results.users = users;
                    } catch (e) {
                        logger.error('User search failed:', e);
                        results.users = [];
                    }
                })()
            );
        }

        // Search posts
        if (type === 'all' || type === 'posts') {
            promises.push(
                (async () => {
                    try {
                        const params = [searchTerm];
                        let campusClause = '';
                        if (campus) { campusClause = 'AND p.campus = ?'; params.push(campus); }
                        params.push(parseInt(limit), parseInt(offset));

                        const [posts] = await pool.query(
                            `SELECT 
                                p.post_id as id, 'post' as type,
                                LEFT(p.content, 100) as title,
                                u.username as subtitle, p.media_url as image,
                                p.content as description, p.campus,
                                p.spark_count as extra, p.created_at as date
                             FROM posts p
                             JOIN users u ON p.user_id = u.user_id
                             WHERE p.content LIKE ? 
                               AND (p.post_type = 'public' OR p.group_id IS NULL)
                             ${campusClause}
                             ORDER BY p.created_at DESC
                             LIMIT ? OFFSET ?`,
                            params
                        );
                        results.posts = posts;
                    } catch (e) {
                        logger.error('Post search failed:', e);
                        results.posts = [];
                    }
                })()
            );
        }

        // Search moments
        if (type === 'all' || type === 'moments') {
            promises.push(
                (async () => {
                    try {
                        const [moments] = await pool.query(
                            `SELECT 
                                m.moment_id as id, 'moment' as type,
                                LEFT(m.caption, 100) as title,
                                u.username as subtitle, m.media_url as image,
                                m.caption as description, m.category,
                                m.like_count as extra, m.created_at as date
                             FROM moments m
                             JOIN users u ON m.user_id = u.user_id
                             WHERE m.caption LIKE ?
                             ORDER BY m.created_at DESC
                             LIMIT ? OFFSET ?`,
                            [searchTerm, parseInt(limit), parseInt(offset)]
                        );
                        results.moments = moments;
                    } catch (e) {
                        logger.error('Moment search failed:', e);
                        results.moments = [];
                    }
                })()
            );
        }

        // Search groups
        if (type === 'all' || type === 'groups') {
            promises.push(
                (async () => {
                    try {
                        const params = [searchTerm, searchTerm];
                        let campusClause = '';
                        if (campus) { campusClause = 'AND g.campus = ?'; params.push(campus); }
                        params.push(parseInt(limit), parseInt(offset));

                        const [groups] = await pool.query(
                            `SELECT 
                                g.group_id as id, 'group' as type,
                                g.name as title,
                                CONCAT(g.category, ' · ', 
                                       (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.group_id),
                                       ' members') as subtitle,
                                g.icon_url as image, g.description,
                                g.campus, g.is_public as extra
                             FROM \`groups\` g
                             WHERE g.name LIKE ? OR g.description LIKE ?
                             ${campusClause}
                             LIMIT ? OFFSET ?`,
                            params
                        );
                        results.groups = groups;
                    } catch (e) {
                        logger.error('Group search failed:', e);
                        results.groups = [];
                    }
                })()
            );
        }

        // Search marketplace listings
        if (type === 'all' || type === 'marketplace') {
            promises.push(
                (async () => {
                    try {
                        const [tables] = await pool.query("SHOW TABLES LIKE 'listing_media'");
                        const mediaTableExists = tables.length > 0;
                        
                        const params = [searchTerm, searchTerm];
                        let campusClause = '';
                        if (campus) { campusClause = 'AND l.campus = ?'; params.push(campus); }
                        params.push(parseInt(limit), parseInt(offset));

                        const mediaSubquery = mediaTableExists 
                            ? `(SELECT media_url FROM listing_media lm WHERE lm.listing_id = l.listing_id ORDER BY upload_order LIMIT 1)`
                            : `l.image_url`;

                        const [listings] = await pool.query(
                            `SELECT 
                                l.listing_id as id, 'marketplace' as type,
                                l.title,
                                CONCAT('$', l.price) as subtitle,
                                ${mediaSubquery} as image,
                                l.description, l.campus,
                                l.category as extra, l.created_at as date
                             FROM marketplace_listings l
                             WHERE (l.title LIKE ? OR l.description LIKE ?) 
                               AND l.is_sold = false
                             ${campusClause}
                             ORDER BY l.created_at DESC
                             LIMIT ? OFFSET ?`,
                            params
                        );
                        results.marketplace = listings;
                    } catch (e) {
                        logger.error('Marketplace search failed:', e);
                        results.marketplace = [];
                    }
                })()
            );
        }

        // Search clubs
        if (type === 'all' || type === 'clubs') {
            promises.push(
                (async () => {
                    try {
                        const params = [searchTerm, searchTerm];
                        let campusClause = '';
                        if (campus) { campusClause = 'AND c.campus = ?'; params.push(campus); }
                        params.push(parseInt(limit), parseInt(offset));

                        const [clubs] = await pool.query(
                            `SELECT 
                                c.club_id as id, 'club' as type,
                                c.name as title,
                                CONCAT(c.category, ' · ', 
                                       (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.club_id),
                                       ' members') as subtitle,
                                c.logo_url as image, c.description,
                                c.campus, c.is_public as extra
                             FROM clubs c
                             WHERE c.name LIKE ? OR c.description LIKE ?
                             ${campusClause}
                             LIMIT ? OFFSET ?`,
                            params
                        );
                        results.clubs = clubs;
                    } catch (e) {
                        logger.error('Club search failed:', e);
                        results.clubs = [];
                    }
                })()
            );
        }

        await Promise.all(promises);

        // If requesting specific type, return flat array
        if (type !== 'all') {
            return res.json({
                status: 'success',
                data: results[type] || []
            });
        }

        // Return grouped results with counts
        res.json({
            status: 'success',
            data: {
                results,
                total: Object.values(results).reduce((acc, curr) => acc + curr.length, 0)
            }
        });
    } catch (error) {
        logger.error('Search error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Search suggestions (autocomplete)
const getSuggestions = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json({ status: 'success', data: [] });
        }

        const searchTerm = `%${q}%`;

        const [suggestions] = await pool.query(
            `(SELECT 'user' as type, username as value, name as label, avatar_url as image
              FROM users WHERE username LIKE ? OR name LIKE ? LIMIT 5)
             UNION ALL
             (SELECT 'group' as type, name as value, CONCAT(name, ' (Group)') as label, icon_url as image
              FROM \`groups\` WHERE name LIKE ? LIMIT 5)
             UNION ALL
             (SELECT 'hashtag' as type, hashtag as value, CONCAT('#', hashtag) as label, null as image
              FROM (SELECT DISTINCT hashtag FROM moment_hashtags WHERE hashtag LIKE ? LIMIT 5) as h)
             LIMIT 10`,
            [searchTerm, searchTerm, searchTerm, searchTerm]
        );

        res.json({ status: 'success', data: suggestions });
    } catch (error) {
        logger.error('Get suggestions error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Save a search query to history
const saveSearch = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const { q } = req.body;
        if (!q || !q.trim()) return res.status(400).json({ error: 'Query is required' });
        const id = require('crypto').randomUUID();
        await pool.query(
            `INSERT INTO search_history (id, user_id, query, searched_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE searched_at = NOW()`,
            [id, userId, q.trim()]
        );
        res.json({ status: 'success', message: 'Search saved' });
    } catch (error) {
        logger.error('Save search error:', error);
        // Don't 500 on history failure
        res.json({ status: 'success', message: 'Search proceeded without saving history' });
    }
};

// Get recent search history for a user
const getRecentSearches = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const [rows] = await pool.query(
            'SELECT query, searched_at FROM search_history WHERE user_id = ? ORDER BY searched_at DESC LIMIT 10',
            [userId]
        );
        res.json({ status: 'success', data: rows });
    } catch (error) {
        logger.error('Get recent searches error:', error);
        res.json({ status: 'success', data: [] });
    }
};

// Clear search history
const clearSearchHistory = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        await pool.query('DELETE FROM search_history WHERE user_id = ?', [userId]);
        res.json({ status: 'success', message: 'Search history cleared' });
    } catch (error) {
        logger.error('Clear search history error:', error);
        res.json({ status: 'success', message: 'History clear skipped' });
    }
};

module.exports = { search, getSuggestions, saveSearch, getRecentSearches, clearSearchHistory };
