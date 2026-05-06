const pool = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');

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
    static async createPost(groupId, userId, content, image = null, video = null, feeling = null, activity = null, taggedUsers = null) {
        try {
            const postId = crypto.randomUUID();
            
            // 1. Insert into main posts table
            await pool.query(
                `INSERT INTO posts (post_id, user_id, content, group_id, post_type, media_url, media_type, feeling, activity, tagged_users) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    postId, 
                    userId, 
                    content, 
                    groupId, 
                    'public', 
                    image ? image.split(',')[0] : null, 
                    video ? 'video' : (image ? 'image' : null),
                    feeling || null,
                    activity || null,
                    taggedUsers ? (typeof taggedUsers === 'string' ? taggedUsers : JSON.stringify(taggedUsers)) : null
                ]
            );

            // 2. Insert multiple images into post_media if applicable
            if (image) {
                const urls = image.split(',');
                for (let i = 0; i < urls.length; i++) {
                    await pool.query(
                        `INSERT INTO post_media (media_id, post_id, media_url, media_type, upload_order) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [crypto.randomUUID(), postId, urls[i], 'image', i]
                    );
                }
            }

            // 3. Send notifications to tagged users
            if (taggedUsers) {
                const users = typeof taggedUsers === 'string' ? JSON.parse(taggedUsers) : taggedUsers;
                const notificationController = require('../controllers/notification.controller');
                
                for (const u of users) {
                    if (u.user_id !== userId) {
                        await notificationController.createNotification({
                            user_id: u.user_id,
                            actor_id: userId,
                            type: 'mention',
                            title: 'New Tag',
                            content: `tagged you in a post: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`,
                            related_id: postId,
                            related_type: 'post',
                            action_url: `/post/${postId}`
                        }).catch(err => logger.error('Tag notification failed:', err));
                    }
                }
            }

            return postId;
        } catch (error) {
            logger.error('Group.createPost Error:', error);
            throw error;
        }
    }

    static async getPosts(groupId, limit = 10, offset = 0) {
        const [rows] = await pool.query(
            `SELECT p.*, p.media_url, 
                    u.username, u.avatar_url, g.name AS group_name, g.icon_url AS group_icon,
                    (SELECT COUNT(*) FROM sparks s WHERE s.post_id = p.post_id) as spark_count,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) as comment_count,
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('url', pm.media_url, 'type', pm.media_type)) 
                     FROM post_media pm WHERE pm.post_id = p.post_id ORDER BY pm.upload_order ASC) as media_files
             FROM posts p
             JOIN users u ON p.user_id = u.user_id
             JOIN groups g ON p.group_id = g.group_id
             WHERE p.group_id = ?
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [groupId, limit, offset]
        );

        return rows.map(post => {
            let media_files = [];
            if (typeof post.media_files === 'string') {
                try { media_files = JSON.parse(post.media_files); } catch(e) { media_files = []; }
            } else if (Array.isArray(post.media_files)) {
                media_files = post.media_files;
            }
            
            // Filter out null elements from JSON_ARRAYAGG (happens if no media)
            media_files = (media_files || []).filter(m => m && m.url);

            return {
                ...post,
                media_files,
                post_type: 'group' 
            };
        });
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
     * Get all media for a group
     */
    static async getMedia(groupId, limit = 50, offset = 0) {
        const [rows] = await pool.query(
            `SELECT pm.media_url, pm.media_type, p.post_id, p.created_at
             FROM post_media pm
             JOIN posts p ON pm.post_id = p.post_id
             WHERE p.group_id = ?
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [groupId, limit, offset]
        );
        return rows;
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
