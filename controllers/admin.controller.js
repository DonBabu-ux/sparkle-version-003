const pool = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

const VALID_ACTIONS = new Set(['approve', 'restrict', 'purge']);
const VALID_TYPES = new Set(['users', 'reports', 'logs']);

const logAdminAction = async (adminId, action, targetType, targetId, details) => {
    try {
        await pool.query(
            `INSERT INTO admin_logs (log_id, admin_id, action, target_type, target_id, details, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [crypto.randomUUID(), adminId, action, targetType, targetId, JSON.stringify(details || {})]
        );
    } catch (e) {
        logger.warn('Failed to write admin_logs:', e.message);
    }
};

const formatTime = (value) => {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 16).replace('T', ' ');
};

// Dashboard stats — contract consumed by frontend/src/pages/AdminDashboard.tsx
const getDashboardStats = async (req, res) => {
    try {
        const count = async (sql) => {
            try {
                const [rows] = await pool.query(sql);
                return Number(Object.values(rows[0] || { c: 0 })[0]) || 0;
            } catch (e) {
                return 0;
            }
        };

        const [userTotal, postTotal, momentTotal, listingTotal, groupTotal,
            pendingReports, pendingPostReports, pendingConfessionReports,
            pendingUserReports, pendingListingReports, activityRows] = await Promise.all([
                count('SELECT COUNT(*) AS c FROM users'),
                count('SELECT COUNT(*) AS c FROM posts'),
                count('SELECT COUNT(*) AS c FROM moments'),
                count('SELECT COUNT(*) AS c FROM marketplace_listings'),
                count('SELECT COUNT(*) AS c FROM `groups`'),
                count('SELECT COUNT(*) AS c FROM reports'),
                count("SELECT COUNT(*) AS c FROM post_reports WHERE status = 'pending'"),
                count('SELECT COUNT(*) AS c FROM confession_reports'),
                count("SELECT COUNT(*) AS c FROM user_reports WHERE status = 'pending'"),
                count("SELECT COUNT(*) AS c FROM listing_reports WHERE status = 'pending'"),
                (async () => {
                    try {
                        const [rows] = await pool.query(
                            `(SELECT 'post' AS type, created_at, user_id, LEFT(content, 80) AS description
                              FROM posts WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) LIMIT 5)
                             UNION ALL
                             (SELECT 'user' AS type, joined_at AS created_at, user_id, 'New user registered' AS description
                              FROM users WHERE joined_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) LIMIT 5)
                             ORDER BY created_at DESC LIMIT 10`
                        );
                        return rows;
                    } catch (e) {
                        return [];
                    }
                })()
            ]);

        res.json({
            users: { total: userTotal },
            posts: { total: postTotal },
            moments: { total: momentTotal },
            marketplace: { total: listingTotal },
            groups: { total: groupTotal },
            reports: {
                pending: pendingReports + pendingPostReports + pendingConfessionReports +
                    pendingUserReports + pendingListingReports
            },
            recentActivity: activityRows.map(r => ({
                message: r.type === 'user' ? (r.description || 'New user registered') : `Post: ${r.description || ''}`,
                time: formatTime(r.created_at)
            }))
        });
    } catch (error) {
        logger.error('Admin dashboard error:', error);
        res.status(500).json({ error: 'Failed to load admin stats' });
    }
};

// User management — contract: { users: [...] }
const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role, verified } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                u.user_id, u.name, u.username, u.email, u.campus, u.role, u.avatar_url,
                u.email_verified, u.account_status, u.is_online, u.joined_at, u.last_seen_at,
                (SELECT COUNT(*) FROM posts WHERE user_id = u.user_id) as post_count,
                (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) as followers_count
            FROM users u WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ' AND (u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        if (role) { query += ' AND u.role = ?'; params.push(role); }
        if (verified !== undefined && verified !== '') { query += ' AND u.email_verified = ?'; params.push(verified === 'true'); }

        query += ' ORDER BY u.joined_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit, 10) || 20, parseInt(offset, 10) || 0);

        const [users] = await pool.query(query, params);
        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');

        res.json({
            users: users.map(u => ({
                ...u,
                status: (u.account_status && u.account_status !== 'active')
                    ? u.account_status
                    : (u.email_verified ? 'active' : 'pending')
            })),
            pagination: {
                page: parseInt(page, 10) || 1,
                limit: parseInt(limit, 10) || 20,
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / (parseInt(limit, 10) || 20))
            },
            filters: { search, role, verified }
        });
    } catch (error) {
        logger.error('Admin users error:', error);
        res.status(500).json({ error: 'Failed to load users' });
    }
};

// Content moderation — live writers: reports, confession_reports, user_reports
// (listing_reports / post_reports are legacy tables, queried defensively)
const getReportedContent = async (req, res) => {
    const queries = [
        `SELECT r.id as report_id, 'post' as type, r.post_id as target_id, r.reason, p.content,
                'pending' as status, r.created_at, u.username as reporter_name
         FROM reports r
         LEFT JOIN posts p ON r.post_id = p.post_id
         LEFT JOIN users u ON r.reporter_id = u.user_id`,
        `SELECT r.report_id, 'confession' as type, r.confession_id as target_id, r.reason, c.content,
                'pending' as status, r.created_at, u.username as reporter_name
         FROM confession_reports r
         JOIN confessions c ON r.confession_id = c.confession_id
         LEFT JOIN users u ON r.reporter_id = u.user_id`,
        `SELECT r.report_id, 'user' as type, r.reported_id as target_id, r.reason,
                CONCAT('Reported user @', COALESCE(u2.username, 'unknown')) as content,
                r.status, r.created_at, u.username as reporter_name
         FROM user_reports r
         LEFT JOIN users u ON r.reporter_id = u.user_id
         LEFT JOIN users u2 ON r.reported_id = u2.user_id`,
        `SELECT r.report_id, 'marketplace' as type, r.listing_id as target_id, r.reason, r.details as content,
                r.status, r.created_at, u.username as reporter_name
         FROM listing_reports r
         LEFT JOIN users u ON r.reporter_id = u.user_id`,
        `SELECT r.report_id, 'post' as type, r.post_id as target_id, r.reason, p.content,
                r.status, r.created_at, u.username as reporter_name
         FROM post_reports r
         JOIN posts p ON r.post_id = p.post_id
         LEFT JOIN users u ON r.reporter_id = u.user_id`
    ];

    let reports = [];
    for (const sql of queries) {
        try {
            const [rows] = await pool.query(sql);
            reports = reports.concat(rows);
        } catch (e) {
            logger.warn(`Report query failed (table might be missing): ${e.message}`);
        }
    }

    reports = reports.map(r => ({
        id: r.report_id,
        type: r.type,
        title: r.reason || r.type,
        details: (r.content ? String(r.content).slice(0, 120) : null) || `Reported ${r.type}`,
        status: r.status || 'pending',
        created_at: r.created_at,
        target_id: r.target_id,
        reporter_name: r.reporter_name
    }));
    reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ reports });
};

// System logs — contract: { logs: [...] }
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
                [parseInt(limit, 10) || 50, parseInt(offset, 10) || 0]
            );
            logs = rows;
            const [countRows] = await pool.query('SELECT COUNT(*) as count FROM admin_logs');
            total = Number(countRows[0].count) || 0;
        } catch (e) {
            logger.warn('admin_logs table may not exist:', e.message);
        }

        res.json({
            logs: logs.map(l => ({
                id: l.log_id,
                action: l.action,
                type: l.target_type,
                target_id: l.target_id,
                title: l.action,
                details: l.details ? String(l.details).slice(0, 120) : 'System Signal',
                status: 'active',
                created_at: l.created_at,
                timestamp: l.created_at,
                admin: l.admin_username || l.admin_name || 'admin'
            })),
            pagination: {
                page: parseInt(page, 10) || 1,
                limit: parseInt(limit, 10) || 50,
                total,
                pages: Math.ceil(total / (parseInt(limit, 10) || 50)) || 1
            }
        });
    } catch (error) {
        logger.error('Admin logs error:', error);
        res.status(500).json({ error: 'Failed to load logs' });
    }
};

const REPORT_SPECS = [
    {
        table: 'reports', idCol: 'id', targetCol: 'post_id',
        resolveSql: null, // no status column: report row is deleted when closed
        purgeTarget: 'DELETE FROM posts WHERE post_id = ?'
    },
    {
        table: 'confession_reports', idCol: 'report_id', targetCol: 'confession_id',
        resolveSql: null,
        purgeTarget: 'DELETE FROM confessions WHERE confession_id = ?'
    },
    {
        table: 'user_reports', idCol: 'report_id', targetCol: 'reported_id',
        resolveSql: "UPDATE user_reports SET status = 'resolved' WHERE report_id = ?",
        affectsReportedUser: true
    },
    {
        table: 'listing_reports', idCol: 'report_id', targetCol: 'listing_id',
        resolveSql: "UPDATE listing_reports SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE report_id = ?",
        purgeTarget: 'DELETE FROM marketplace_listings WHERE listing_id = ?'
    },
    {
        table: 'post_reports', idCol: 'report_id', targetCol: 'post_id',
        resolveSql: "UPDATE post_reports SET status = ?, resolved_by = ?, resolved_at = NOW() WHERE report_id = ?",
        purgeTarget: 'DELETE FROM posts WHERE post_id = ?'
    }
];

// Generic moderation action — contract: POST { id, action, type }
const handleAction = async (req, res) => {
    const { id, action, type } = req.body || {};

    if (!VALID_ACTIONS.has(action)) {
        return res.status(400).json({ error: 'Invalid action. Allowed: approve, restrict, purge' });
    }
    if (!VALID_TYPES.has(type)) {
        return res.status(400).json({ error: 'Invalid type. Allowed: users, reports, logs' });
    }
    if (!id || typeof id !== 'string' || id.length > 64) {
        return res.status(400).json({ error: 'Invalid id' });
    }

    const adminId = req.user.userId || req.user.user_id;

    try {
        if (type === 'users') {
            const [users] = await pool.query('SELECT user_id, username, account_status FROM users WHERE user_id = ?', [id]);
            if (!users.length) {
                return res.status(404).json({ error: 'User not found' });
            }
            if (action !== 'approve' && id === adminId) {
                return res.status(400).json({ error: 'You cannot restrict or purge your own account' });
            }

            const target = users[0];
            if (action === 'approve') {
                await pool.query(
                    "UPDATE users SET account_status = 'active', email_verified = 1, is_verified = 1 WHERE user_id = ?",
                    [id]
                );
            } else if (action === 'restrict') {
                await pool.query("UPDATE users SET account_status = 'suspended' WHERE user_id = ?", [id]);
            } else {
                await pool.query("UPDATE users SET account_status = 'deactivated' WHERE user_id = ?", [id]);
            }

            await logAdminAction(adminId, `${action}_user`, 'user', id, {
                username: target.username,
                from_status: target.account_status
            });
            return res.json({ status: 'success', message: `User ${action} applied successfully` });
        }

        if (type === 'reports') {
            let found = null;
            for (const spec of REPORT_SPECS) {
                try {
                    const [rows] = await pool.query(
                        `SELECT ${spec.idCol} as rid, ${spec.targetCol} as tid FROM ${spec.table} WHERE ${spec.idCol} = ?`,
                        [id]
                    );
                    if (rows.length) {
                        found = { spec, tid: rows[0].tid };
                        break;
                    }
                } catch (e) {
                    logger.warn(`Report lookup failed for ${spec.table}: ${e.message}`);
                }
            }
            if (!found) {
                return res.status(404).json({ error: 'Report not found' });
            }

            const { spec, tid } = found;

            if (spec.affectsReportedUser) {
                if (spec.resolveSql) await pool.query(spec.resolveSql, [id]);
                if (action === 'restrict' && tid) {
                    await pool.query("UPDATE users SET account_status = 'suspended' WHERE user_id = ?", [tid]);
                } else if (action === 'purge' && tid) {
                    await pool.query("UPDATE users SET account_status = 'deactivated' WHERE user_id = ?", [tid]);
                }
            } else if (action === 'purge' && spec.purgeTarget && tid) {
                try {
                    await pool.query(spec.purgeTarget, [tid]);
                } catch (e) {
                    logger.warn(`Purge target delete failed: ${e.message}`);
                }
                if (spec.resolveSql) {
                    await pool.query(spec.resolveSql, ['dismissed', adminId, id]);
                } else {
                    await pool.query(`DELETE FROM ${spec.table} WHERE ${spec.idCol} = ?`, [id]);
                }
            } else if (spec.resolveSql) {
                await pool.query(spec.resolveSql, ['resolved', adminId, id]);
            } else {
                await pool.query(`DELETE FROM ${spec.table} WHERE ${spec.idCol} = ?`, [id]);
            }

            await logAdminAction(adminId, `${action}_report`, 'report', id, {
                report_table: spec.table,
                target_id: tid
            });
            return res.json({ status: 'success', message: `Report ${action} applied successfully` });
        }

        // type === 'logs': audit entries are immutable; record the attempt
        const [logs] = await pool.query('SELECT log_id FROM admin_logs WHERE log_id = ?', [id]);
        if (!logs.length) {
            return res.status(404).json({ error: 'Log entry not found' });
        }
        await logAdminAction(adminId, `${action}_log`, 'admin_log', id, {
            note: 'action attempted on log entry'
        });
        return res.json({ status: 'success', message: `Log ${action} recorded` });
    } catch (error) {
        logger.error('Admin action error:', error);
        res.status(500).json({ error: 'Failed to apply action' });
    }
};

// Broadcast announcement — contract: POST { message }
const broadcastAnnouncement = async (req, res) => {
    const message = String((req.body && req.body.message) || '').trim();
    if (!message || message.length > 500) {
        return res.status(400).json({ error: 'Message is required (max 500 characters)' });
    }

    const adminId = req.user.userId || req.user.user_id;

    try {
        const [users] = await pool.query('SELECT user_id FROM users');
        const CHUNK = 400;
        for (let i = 0; i < users.length; i += CHUNK) {
            const slice = users.slice(i, i + CHUNK);
            const placeholders = slice.map(() => '(?, ?, ?, ?, ?, 0)').join(', ');
            const params = [];
            for (const u of slice) {
                params.push(crypto.randomUUID(), u.user_id, 'system', 'Announcement', message);
            }
            await pool.query(
                `INSERT INTO notifications (notification_id, user_id, type, title, content, is_read) VALUES ${placeholders}`,
                params
            );
        }

        await logAdminAction(adminId, 'broadcast_announcement', 'announcement', null, {
            delivered: users.length,
            message: message.slice(0, 120)
        });
        res.json({ status: 'success', delivered: users.length });
    } catch (error) {
        logger.error('Announcement broadcast error:', error);
        res.status(500).json({ error: 'Failed to broadcast announcement' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role, email_verified, notes } = req.body;

        const sets = [];
        const params = [];
        if (role !== undefined) { sets.push('role = ?'); params.push(role); }
        if (email_verified !== undefined) { sets.push('email_verified = ?'); params.push(email_verified); }
        sets.push('updated_at = NOW()');
        params.push(userId);

        await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE user_id = ?`, params);

        await logAdminAction(req.user.userId || req.user.user_id, 'update_user', 'user', userId, {
            role, email_verified, notes
        });

        res.json({ status: 'success', message: 'User updated successfully' });
    } catch (error) {
        logger.error('Update user error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Resolve report (kept for API compatibility)
const resolveReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { action, notes } = req.body;
        const adminId = req.user.userId || req.user.user_id;

        await pool.query(
            `UPDATE listing_reports 
             SET status = 'resolved', reviewed_by = ?, reviewed_at = NOW()
             WHERE report_id = ?`,
            [adminId, reportId]
        );

        await logAdminAction(adminId, 'resolve_report', 'report', reportId, { action, notes });

        res.json({ status: 'success', message: 'Report resolved successfully' });
    } catch (error) {
        logger.error('Resolve report error:', error);
        res.status(500).json({ error: error.message });
    }
};

const exportLogs = async (req, res) => {
    try {
        const [logs] = await pool.query(
            `SELECT al.*, u.username as admin_username FROM admin_logs al
             LEFT JOIN users u ON al.admin_id = u.user_id
             ORDER BY al.created_at DESC`
        );

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=admin_logs.json');
        res.send(JSON.stringify(logs, null, 2));
    } catch (error) {
        logger.error('Export logs error:', error);
        res.status(500).json({ error: 'Failed to export logs' });
    }
};

const suspendUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, reason } = req.body;
        const adminId = req.user.userId || req.user.user_id;

        await pool.query('UPDATE users SET account_status = ? WHERE user_id = ?', [status, userId]);

        await logAdminAction(adminId, status === 'suspended' ? 'suspend_user' : 'reactivate_user', 'user', userId, { reason });

        res.json({ status: 'success', message: `User ${status} successfully` });
    } catch (error) {
        logger.error('Suspend user error:', error);
        res.status(500).json({ error: error.message });
    }
};

const getVerificationRequests = async (req, res) => {
    try {
        const [requests] = await pool.query(
            `SELECT vr.*, u.username, u.name as user_name, u.avatar_url, u.email
             FROM verification_requests vr
             JOIN users u ON vr.user_id = u.user_id
             WHERE vr.status = 'pending'
             ORDER BY vr.created_at ASC`
        );
        res.json({ requests });
    } catch (error) {
        logger.error('Admin verification requests error:', error);
        res.status(500).json({ error: error.message });
    }
};

const handleVerificationRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status, notes } = req.body;
        const adminId = req.user.userId || req.user.user_id;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            await connection.query(
                'UPDATE verification_requests SET status = ?, reviewed_by = ?, review_notes = ?, reviewed_at = NOW() WHERE request_id = ?',
                [status, adminId, notes, requestId]
            );

            if (status === 'approved') {
                const [request] = await connection.query('SELECT user_id FROM verification_requests WHERE request_id = ?', [requestId]);
                if (request.length > 0) {
                    await connection.query('UPDATE users SET is_verified = 1 WHERE user_id = ?', [request[0].user_id]);
                }
            }

            await connection.commit();

            await logAdminAction(adminId, `verification_${status}`, 'verification_request', requestId, { notes });

            res.json({ status: 'success', message: `Verification ${status}` });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        logger.error('Handle verification error:', error);
        res.status(500).json({ error: error.message });
    }
};


module.exports = {
    getDashboardStats,
    getUsers,
    updateUser,
    getReportedContent,
    resolveReport,
    getLogs,
    exportLogs,
    suspendUser,
    getVerificationRequests,
    handleVerificationRequest,
    handleAction,
    broadcastAnnouncement
};
