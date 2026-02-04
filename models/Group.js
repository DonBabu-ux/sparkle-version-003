const pool = require('../config/database');
const crypto = require('crypto');

class Group {
    /**
     * Get all groups with member count
     */
    static async getAll() {
        const [groups] = await pool.query(
            `SELECT g.*, u.name as creator_name,
                    (SELECT COUNT(*) FROM group_members WHERE group_id = g.group_id AND status = 'active') as member_count
             FROM groups g 
             JOIN users u ON g.creator_id = u.user_id 
             ORDER BY g.created_at DESC LIMIT 50`
        );
        return groups;
    }

    /**
     * Get group by ID
     */
    static async findById(groupId) {
        const [groups] = await pool.query(
            'SELECT * FROM groups WHERE group_id = ?',
            [groupId]
        );
        return groups[0] || null;
    }

    /**
     * Get group posts
     */
    static async getPosts(groupId) {
        const [posts] = await pool.query(
            `SELECT p.*, u.name as user_name, u.avatar_url
             FROM posts p 
             JOIN users u ON p.user_id = u.user_id 
             WHERE p.group_id = ? 
             ORDER BY p.created_at DESC LIMIT 50`,
            [groupId]
        );
        return posts;
    }

    /**
     * Create new group
     */
    static async create(creatorId, groupData) {
        const groupId = crypto.randomUUID();
        const slug = groupData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        await pool.query(
            `INSERT INTO groups (group_id, creator_id, name, slug, description, campus, category, is_public, banner_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                groupId,
                creatorId,
                groupData.name,
                slug,
                groupData.description || null,
                groupData.campus,
                groupData.category || null,
                groupData.is_public !== false ? 1 : 0,
                groupData.banner_url || null
            ]
        );

        // Add creator as admin
        await this.addMember(groupId, creatorId, 'admin');
        return groupId;
    }

    /**
     * Add member to group
     */
    static async addMember(groupId, userId, role = 'member') {
        const membershipId = crypto.randomUUID();
        await pool.query(
            'INSERT INTO group_members (membership_id, group_id, user_id, role, status) VALUES (?, ?, ?, ?, ?)',
            [membershipId, groupId, userId, role, 'active']
        );
        return membershipId;
    }

    /**
     * Remove member from group
     */
    static async removeMember(groupId, userId) {
        const [result] = await pool.query(
            'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );
        return result.affectedRows > 0;
    }

    /**
     * Search groups
     */
    static async search(searchParams) {
        let query = 'SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.group_id AND gm.status = "active") as member_count FROM groups g WHERE 1=1';
        const params = [];

        if (searchParams.campus) {
            query += ' AND g.campus = ?';
            params.push(searchParams.campus);
        }

        if (searchParams.category) {
            query += ' AND g.category = ?';
            params.push(searchParams.category);
        }

        if (searchParams.query) {
            query += ' AND (g.name LIKE ? OR g.description LIKE ?)';
            params.push(`%${searchParams.query}%`, `%${searchParams.query}%`);
        }

        query += ' ORDER BY g.created_at DESC';

        const [groups] = await pool.query(query, params);
        return groups;
    }
}

module.exports = Group;
