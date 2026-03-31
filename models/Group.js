const pool = require('../config/database');
const crypto = require('crypto');

class Group {
    /**
     * Get group by ID
     */
    static async findById(id) {
        const [rows] = await pool.query(
            `SELECT g.*, 
                    (SELECT COUNT(*) FROM group_members WHERE group_id = g.group_id) as member_count
             FROM groups g 
             WHERE g.group_id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Get all groups
     */
    static async getAll(userId = null) {
        let query = `
            SELECT g.*, 
                   (SELECT COUNT(*) FROM group_members WHERE group_id = g.group_id) as member_count
        `;

        const params = [];
        if (userId) {
            query += `, 
                (SELECT status FROM group_members WHERE group_id = g.group_id AND user_id = ?) as user_membership_status,
                (SELECT role   FROM group_members WHERE group_id = g.group_id AND user_id = ?) as user_role,
                (SELECT status FROM group_requests WHERE group_id = g.group_id AND user_id = ? AND status = 'pending' LIMIT 1) as user_request_status
            `;
            params.push(userId, userId, userId);
        }

        query += ` FROM groups g ORDER BY g.created_at DESC`;

        const [rows] = await pool.query(query, params);
        return rows;
    }

    /**
     * Get group members count
     */
    static async getMembersCount(groupId) {
        const [rows] = await pool.query(
            'SELECT COUNT(*) as count FROM group_members WHERE group_id = ?',
            [groupId]
        );
        return rows[0].count;
    }

    /**
     * Get group members
     */
    static async getMembers(groupId) {
        const [rows] = await pool.query(
            `SELECT gm.*, u.username, u.avatar_url as avatar, u.name
             FROM group_members gm
             JOIN users u ON gm.user_id = u.user_id
             WHERE gm.group_id = ?`,
            [groupId]
        );
        return rows;
    }

    static async getAdmins(groupId) {
        const [rows] = await pool.query(
            `SELECT gm.*, u.username, u.avatar_url as avatar, u.name
             FROM group_members gm
             JOIN users u ON gm.user_id = u.user_id
             WHERE gm.group_id = ? AND gm.role IN ('admin', 'moderator')`,
            [groupId]
        );
        return rows;
    }

    /**
     * Check membership
     */
    static async getMember(groupId, userId) {
        const [rows] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );
        return rows[0] || null;
    }

    /**
     * Create group
     */
    static async create(name, icon_url, campus, is_public, description = '', category = 'general', creatorId = null) {
        const groupId = crypto.randomUUID();
        const requiresApproval = is_public ? 0 : 1;
        await pool.query(
            `INSERT INTO groups (group_id, name, icon_url, campus, is_public, requires_approval, description, category, creator_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [groupId, name, icon_url, campus, is_public ? 1 : 0, requiresApproval, description, category, creatorId]
        );
        return groupId;
    }

    /**
     * Add member
     */
    static async addMember(groupId, userId, role = 'member', status = 'active') {
        const [result] = await pool.query(
            'INSERT INTO group_members (group_id, user_id, role, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = ?',
            [groupId, userId, role, status, status]
        );
        return result.insertId;
    }

    /**
     * Join Requests
     */
    static async createJoinRequest(groupId, userId) {
        const [result] = await pool.query(
            'INSERT INTO group_requests (group_id, user_id) VALUES (?, ?)',
            [groupId, userId]
        );
        return result.insertId;
    }

    static async findRequest(groupId, userId) {
        const [rows] = await pool.query(
            "SELECT * FROM group_requests WHERE group_id = ? AND user_id = ? AND status = 'pending'",
            [groupId, userId]
        );
        return rows[0] || null;
    }

    /**
     * Group Post Logic
     */
    static async createPost(groupId, userId, content, image = null, video = null) {
        const postId = crypto.randomUUID();
        await pool.query(
            'INSERT INTO group_posts (post_id, group_id, user_id, content, image_url, video_url) VALUES (?, ?, ?, ?, ?, ?)',
            [postId, groupId, userId, content, image, video]
        );
        return postId;
    }

    static async getPosts(groupId, limit = 10, offset = 0) {
        const [rows] = await pool.query(
            `SELECT gp.*, u.username, u.avatar_url AS avatar, g.name AS group_name, g.icon_url AS group_icon
             FROM group_posts gp
             JOIN users u ON gp.user_id = u.user_id
             JOIN groups g ON gp.group_id = g.group_id
             WHERE gp.group_id = ?
             ORDER BY gp.created_at DESC
             LIMIT ? OFFSET ?`,
            [groupId, limit, offset]
        );
        return rows;
    }
    /**
     * Admin Management
     */
    static async getPendingRequests(groupId) {
        const [rows] = await pool.query(
            `SELECT gr.*, u.username, u.name, u.avatar_url as avatar
             FROM group_requests gr
             JOIN users u ON gr.user_id = u.user_id
             WHERE gr.group_id = ? AND gr.status = 'pending'`,
            [groupId]
        );
        return rows;
    }

    static async approveRequest(requestId) {
        const [rows] = await pool.query('SELECT * FROM group_requests WHERE id = ?', [requestId]);
        if (rows.length === 0) return false;
        
        const { group_id, user_id } = rows[0];
        
        await pool.query("UPDATE group_requests SET status = 'approved' WHERE id = ?", [requestId]);
        await this.addMember(group_id, user_id, 'member', 'active');
        return true;
    }

    static async rejectRequest(requestId) {
        await pool.query("UPDATE group_requests SET status = 'rejected' WHERE id = ?", [requestId]);
        return true;
    }

    static async removeMember(groupId, userId) {
        await pool.query('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        return true;
    }

    static async updateMemberRole(groupId, userId, role) {
        await pool.query('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?', [role, groupId, userId]);
        return true;
    }

    /**
     * Get member preview (up to 3, prioritized by followed users)
     */
    static async getMemberPreview(groupId, currentUserId = null) {
        let query = `
            SELECT u.user_id, u.username, u.avatar_url as avatar, u.name
            FROM group_members gm
            JOIN users u ON gm.user_id = u.user_id
            WHERE gm.group_id = ? AND gm.status = 'active'
        `;
        
        const params = [groupId];
        
        if (currentUserId) {
            query += ` ORDER BY (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) DESC, gm.created_at ASC `;
            params.push(currentUserId);
        } else {
            query += ` ORDER BY gm.created_at ASC `;
        }
        
        query += ` LIMIT 3 `;
        
        const [rows] = await pool.query(query, params);
        return rows;
    }

    /**
     * Get all members with detailed info for the members tab
     */
    static async getMembersDetailed(groupId, currentUserId = null) {
        let query = `
            SELECT u.user_id, u.username, u.name, u.avatar_url as avatar, gm.role, gm.status,
                   (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_followed,
                   (SELECT COUNT(*) FROM follows WHERE follower_id = u.user_id AND following_id = ?) as follows_me
            FROM group_members gm
            JOIN users u ON gm.user_id = u.user_id
            WHERE gm.group_id = ? AND gm.status = 'active'
            ORDER BY gm.role = 'admin' DESC, gm.role = 'moderator' DESC, gm.created_at ASC
        `;
        
        const [rows] = await pool.query(query, [currentUserId, currentUserId, groupId]);
        return rows;
    }

    /**
     * Update group settings
     */
    static async update(groupId, data) {
        const allowedFields = ['name', 'description', 'icon_url', 'cover_image', 'is_public', 'category', 'requires_approval', 'allow_posts'];
        const updates = [];
        const params = [];
        
        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                params.push(value);
            }
        }
        
        if (updates.length === 0) return true;
        
        params.push(groupId);
        await pool.query(`UPDATE groups SET ${updates.join(', ')} WHERE group_id = ?`, params);
        return true;
    }

    static async deletePost(postId) {
        await pool.query('DELETE FROM group_posts WHERE post_id = ?', [postId]);
        return true;
    }

    /**
     * Delete an entire group (owner only — cascades posts, members, requests)
     */
    static async deleteGroup(groupId) {
        await pool.query('DELETE FROM group_posts WHERE group_id = ?', [groupId]);
        await pool.query('DELETE FROM group_members WHERE group_id = ?', [groupId]);
        await pool.query('DELETE FROM group_requests WHERE group_id = ?', [groupId]);
        await pool.query('DELETE FROM groups WHERE group_id = ?', [groupId]);
        return true;
    }
}

module.exports = Group;
