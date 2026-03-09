const pool = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Dashboard stats
const getDashboardStats = async (req, res) => {
    try {
        const [
            userCount,
            postCount,
            momentCount,
            listingCount,
            groupCount,
            recentUsers,
            recentActivity
        ] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM users'),
            pool.query('SELECT COUNT(*) as count FROM posts'),
            pool.query('SELECT COUNT(*) as count FROM moments'),
            pool.query('SELECT COUNT(*) as count FROM marketplace_listings'),
            pool.query('SELECT COUNT(*) as count FROM `groups`'),
            pool.query(
                `SELECT user_id, name, username, email, campus, avatar_url, joined_at 
                 FROM users ORDER BY joined_at DESC LIMIT 10`
            ),
            pool.query(
                `(SELECT 'post' as type, created_at, user_id, LEFT(content, 80) as description
                  FROM posts WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) LIMIT 5)
                 UNION ALL
                 (SELECT 'user' as type, joined_at as created_at, user_id, 'New user registered' as description
                  FROM users WHERE joined_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) LIMIT 5)
                 ORDER BY created_at DESC LIMIT 10`
            )
        ]);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            user: req.user,
            stats: {
                users: userCount[0][0].count,
                posts: postCount[0][0].count,
                moments: momentCount[0][0].count,
                listings: listingCount[0][0].count,
                groups: groupCount[0][0].count
            },
            recentUsers: recentUsers[0],
            recentActivity: recentActivity[0]
        });
    } catch (error) {
        logger.error('Admin dashboard error:', error);
        res.status(500).render('error', { title: 'Error', error: error.message, user: req.user });
    }
};

// User management
const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role, verified } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                user_id, name, username, email, campus, role, avatar_url,
                email_verified, is_online, joined_at, last_seen_at,
                (SELECT COUNT(*) FROM posts WHERE user_id = u.user_id) as post_count,
                (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count
            FROM users u WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ' AND (name LIKE ? OR username LIKE ? OR email LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        if (role) { query += ' AND role = ?'; params.push(role); }
        if (verified !== undefined) { query += ' AND email_verified = ?'; params.push(verified === 'true'); }

        query += ' ORDER BY joined_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [users] = await pool.query(query, params);
        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');

        res.render('admin/users', {
            title: 'User Management',
            user: req.user,
            users,
            pagination: {
                page: parseInt(page), limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            },
            filters: { search, role, verified }
        });
    } catch (error) {
        logger.error('Admin users error:', error);
        res.status(500).render('error', { title: 'Error', error: error.message, user: req.user });
    }
};

// Update user
const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role, is_active, email_verified, notes } = req.body;

        await pool.query(
            `UPDATE users SET role = ?, email_verified = ?, updated_at = NOW() WHERE user_id = ?`,
            [role, email_verified, userId]
        );

        // Log admin action
        await pool.query(
            `INSERT INTO admin_logs (log_id, admin_id, action, target_type, target_id, details, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [crypto.randomUUID(), req.user.userId || req.user.user_id, 'update_user', 'user', userId,
            JSON.stringify({ role, is_active, email_verified, notes })]
        );

        res.json({ status: 'success', message: 'User updated successfully' });
    } catch (error) {
        logger.error('Update user error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Content moderation — reported content
const getReportedContent = async (req, res) => {
    try {
        let reports = [];
        try {
            const [rows] = await pool.query(
                `SELECT r.*, 
                        reporter.name as reporter_name, reporter.username as reporter_username,
                        l.title as listing_title
                 FROM listing_reports r
                 LEFT JOIN users reporter ON r.reporter_id = reporter.user_id
                 LEFT JOIN marketplace_listings l ON r.listing_id = l.listing_id
                 WHERE r.status = 'pending'
                 ORDER BY r.created_at DESC`
            );
            reports = rows;
        } catch (e) {
            // listing_reports table may not exist yet
            logger.warn('listing_reports table may not exist:', e.message);
        }

        res.render('admin/reports', {
            title: 'Content Moderation',
            user: req.user,
            reports
        });
    } catch (error) {
        logger.error('Admin reports error:', error);
        res.status(500).render('error', { title: 'Error', error: error.message, user: req.user });
    }
};

// Resolve report
const resolveReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { action, notes } = req.body;
        const adminId = req.user.userId || req.user.user_id;

        await pool.query(
            `UPDATE listing_reports 
             SET status = 'resolved', resolved_by = ?, resolution_notes = ?, resolved_at = NOW()
             WHERE report_id = ?`,
            [adminId, notes, reportId]
        );

        // Log action
        await pool.query(
            `INSERT INTO admin_logs (log_id, admin_id, action, target_type, target_id, details, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [crypto.randomUUID(), adminId, 'resolve_report', 'report', reportId,
            JSON.stringify({ action, notes })]
        );

        res.json({ status: 'success', message: 'Report resolved successfully' });
    } catch (error) {
        logger.error('Resolve report error:', error);
        res.status(500).json({ error: error.message });
    }
};

// System logs
const getLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let logs = [];
        let total = 0;
        try {
            const [rows] = await pool.query(
                `SELECT al.*, u.name as admin_name, u.username as admin_username
                 FROM admin_logs al
                 LEFT JOIN users u ON al.admin_id = u.user_id
                 ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
                [parseInt(limit), parseInt(offset)]
            );
            logs = rows;
            const [countResult] = await pool.query('SELECT COUNT(*) as total FROM admin_logs');
            total = countResult[0].total;
        } catch (e) {
            logger.warn('admin_logs table may not exist:', e.message);
        }

        res.render('admin/logs', {
            title: 'System Logs',
            user: req.user,
            logs,
            pagination: {
                page: parseInt(page), limit: parseInt(limit), total,
                pages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        logger.error('Admin logs error:', error);
        res.status(500).render('error', { title: 'Error', error: error.message, user: req.user });
    }
};

module.exports = {
    getDashboardStats,
    getUsers,
    updateUser,
    getReportedContent,
    resolveReport,
    getLogs
};
