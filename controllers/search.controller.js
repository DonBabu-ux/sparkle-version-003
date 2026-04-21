const pool = require('../config/database');
const logger = require('../utils/logger');

const search = async (req, res) => {
    try {
        const { q, type = 'all', limit = 20, offset = 0, campus } = req.query;

        if (!q || q.length < 2) {
            return res.json({ status: 'success', data: { results: [] } });
        }

        const searchTerm = q.trim();
        const likeTerm = `%${searchTerm}%`;
        const booleanSearchTerm = `${searchTerm}*`;
        const results = {};
        const promises = [];

        const currentUserId = req.user ? (req.user.userId || req.user.user_id) : null;

        // Search users
        if (type === 'all' || type === 'users') {
            promises.push(
                (async () => {
                    try {
                        const params = [currentUserId, currentUserId, searchTerm, searchTerm, booleanSearchTerm];
                        let campusClause = '';
                        if (campus) { 
                            campusClause = 'AND campus = ?'; 
                            params.push(campus);
                        }
                        params.push(parseInt(limit), parseInt(offset));

                        const [users] = await pool.query(
                            `SELECT 
                                user_id as id, user_id, username, name, avatar_url,
                                'user' as type, name as title,
                                username as subtitle, avatar_url as image,
                                bio as extra, campus, is_verified,
                                IF(? IS NULL, 0, EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = users.user_id)) as is_followed,
                                (MATCH(username, name, bio) AGAINST(?) * 2 + (username = ?) * 5) as relevance
                             FROM users
                             WHERE (MATCH(username, name, bio) AGAINST(? IN BOOLEAN MODE) OR username LIKE ?)
                               AND account_status = 'active'
                             ${campusClause}
                             ORDER BY relevance DESC, joined_at DESC
                             LIMIT ? OFFSET ?`,
                            [currentUserId, currentUserId, searchTerm, searchTerm, booleanSearchTerm, likeTerm, ...params.slice(5)]
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
                        const params = [searchTerm, booleanSearchTerm, likeTerm];
                        let campusClause = '';
                        if (campus) { campusClause = 'AND p.campus = ?'; params.push(campus); }
                        params.push(parseInt(limit), parseInt(offset));

                        const [posts] = await pool.query(
                            `SELECT 
                                p.post_id as id, 'post' as type,
                                LEFT(p.content, 100) as title,
                                u.username as subtitle, p.media_url as image,
                                p.content as description, p.campus,
                                p.spark_count as extra, p.created_at as date,
                                MATCH(p.content) AGAINST(?) as relevance
                             FROM posts p
                             JOIN users u ON p.user_id = u.user_id
                             WHERE (MATCH(p.content) AGAINST(? IN BOOLEAN MODE) OR p.content LIKE ?)
                               AND (p.post_type = 'public' OR p.group_id IS NULL)
                             ${campusClause}
                             ORDER BY relevance DESC, p.created_at DESC
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

        // Search groups
        if (type === 'all' || type === 'groups') {
            promises.push(
                (async () => {
                    try {
                        const params = [searchTerm, booleanSearchTerm, likeTerm, likeTerm];
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
                                g.campus, g.is_public as extra,
                                MATCH(g.name, g.description) AGAINST(?) as relevance
                             FROM \`groups\` g
                             WHERE (MATCH(g.name, g.description) AGAINST(? IN BOOLEAN MODE) OR g.name LIKE ? OR g.description LIKE ?)
                             ${campusClause}
                             ORDER BY relevance DESC
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
                        const params = [searchTerm, booleanSearchTerm, likeTerm, likeTerm];
                        let campusClause = '';
                        if (campus) { campusClause = 'AND l.campus = ?'; params.push(campus); }
                        params.push(parseInt(limit), parseInt(offset));

                        const [listings] = await pool.query(
                            `SELECT 
                                l.listing_id as id, 'marketplace_item' as type,
                                l.title,
                                CONCAT('$', l.price) as subtitle,
                                l.image_url as image,
                                l.description, l.campus,
                                l.category as extra, l.created_at as date,
                                MATCH(l.title, l.description) AGAINST(?) as relevance
                             FROM marketplace_listings l
                             WHERE (MATCH(l.title, l.description) AGAINST(? IN BOOLEAN MODE) OR l.title LIKE ? OR l.description LIKE ?) 
                               AND l.status = 'active'
                             ${campusClause}
                             ORDER BY relevance DESC, l.created_at DESC
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
                        const params = [searchTerm, booleanSearchTerm, likeTerm, likeTerm];
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
                                c.campus, c.is_active as extra,
                                MATCH(c.name, c.description) AGAINST(?) as relevance
                             FROM clubs c
                             WHERE (MATCH(c.name, c.description) AGAINST(? IN BOOLEAN MODE) OR c.name LIKE ? OR c.description LIKE ?)
                               AND c.is_active = 1
                             ${campusClause}
                             ORDER BY relevance DESC
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

        // Return grouped results with total count
        res.json({
            status: 'success',
            data: {
                results,
                total: Object.values(results).reduce((acc, curr) => acc + curr.length, 0)
            }
        });
    } catch (error) {
        logger.error('Search error:', error);
        res.status(500).json({ status: 'error', message: 'An internal error occurred while searching' });
    }
};

// Search suggestions (autocomplete)
const getSuggestions = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json({ status: 'success', data: [] });
        }

        const searchTerm = q.trim();
        const likeTerm = `${searchTerm}%`;

        const [suggestions] = await pool.query(
            `(SELECT 'user' as type, username as value, name as label, avatar_url as image
              FROM users WHERE username LIKE ? OR name LIKE ? LIMIT 5)
             UNION ALL
             (SELECT 'group' as type, name as value, CONCAT(name, ' (Group)') as label, icon_url as image
              FROM \`groups\` WHERE name LIKE ? LIMIT 3)
             UNION ALL
             (SELECT 'club' as type, name as value, CONCAT(name, ' (Club)') as label, logo_url as image
              FROM clubs WHERE name LIKE ? LIMIT 3)
             UNION ALL
             (SELECT 'hashtag' as type, tag as value, CONCAT('#', tag) as label, null as image
              FROM (
                  SELECT tag FROM post_hashtags WHERE tag LIKE ?
                  UNION
                  SELECT hashtag as tag FROM moment_hashtags WHERE hashtag LIKE ?
              ) as h LIMIT 5)
             LIMIT 15`,
            [likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm]
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
            `INSERT INTO search_history (id, user_id, \`query\`, searched_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE searched_at = NOW()`,
            [id, userId, q.trim()]
        );
        res.json({ status: 'success', message: 'Search saved' });
    } catch (error) {
        logger.error('Save search error:', error);
        res.json({ status: 'success', message: 'Search proceeded without saving history' });
    }
};

// Get recent search history for a user
const getRecentSearches = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const [rows] = await pool.query(
            'SELECT id, `query`, searched_at FROM search_history WHERE user_id = ? ORDER BY searched_at DESC LIMIT 10',
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

// Delete a single search item
const deleteSearchItem = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const { id } = req.params;
        await pool.query('DELETE FROM search_history WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ status: 'success', message: 'Search item deleted' });
    } catch (error) {
        logger.error('Delete search item error:', error);
        res.status(500).json({ error: 'Failed to delete search item' });
    }
};

// Get trending hashtags across posts and moments
const getTrending = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `(SELECT tag as name, COUNT(*) as count FROM post_hashtags GROUP BY tag)
             UNION ALL
             (SELECT hashtag as name, COUNT(*) as count FROM moment_hashtags GROUP BY hashtag)
             ORDER BY count DESC LIMIT 10`
        );
        // Deduplicate and aggregate
        const trendingMap = {};
        rows.forEach(r => {
            trendingMap[r.name] = (trendingMap[r.name] || 0) + r.count;
        });
        const trending = Object.entries(trendingMap)
            .map(([name, count]) => ({ name: `#${name}`, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        res.json({ status: 'success', data: trending });
    } catch (error) {
        logger.error('Get trending error:', error);
        res.json({ status: 'success', data: [] });
    }
};

// Get discovery data: Top Creators & Recommended Groups
const getDiscovery = async (req, res) => {
    try {
        const currentUserId = req.user ? (req.user.userId || req.user.user_id) : null;
        
        // 1. Top Creators (Real people with most follows)
        const [creators] = await pool.query(
            `SELECT 
                u.user_id, u.username, u.name, u.avatar_url, u.is_verified,
                (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as follower_count,
                IF(? IS NULL, 0, EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.user_id)) as is_followed
             FROM users u
             WHERE u.account_status = 'active'
               AND u.user_id != ?
             ORDER BY follower_count DESC
             LIMIT 5`,
            [currentUserId, currentUserId, currentUserId]
        );

        // 2. Suggested Groups (Popular ones)
        const [groups] = await pool.query(
            `SELECT 
                g.group_id as id, g.name as title, g.description, g.icon_url as image,
                (SELECT COUNT(*) FROM group_members WHERE group_id = g.group_id) as member_count
             FROM \`groups\` g
             WHERE g.is_public = 1
             ORDER BY member_count DESC
             LIMIT 4`
        );

        res.json({ 
            status: 'success', 
            data: { 
                creators,
                groups: groups.map(g => ({ ...g, subtitle: `${g.member_count} Members` }))
            } 
        });
    } catch (error) {
        logger.error('Get discovery error:', error);
        res.json({ status: 'success', data: { creators: [], groups: [] } });
    }
};

module.exports = { search, getSuggestions, saveSearch, getRecentSearches, clearSearchHistory, deleteSearchItem, getTrending, getDiscovery };


