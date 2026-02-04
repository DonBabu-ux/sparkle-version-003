const pool = require('../config/database');
const crypto = require('crypto');

class Club {
    /**
     * Get all clubs
     */
    static async getAll() {
        const [clubs] = await pool.query(
            `SELECT c.*, u.name as admin_name, u.avatar_url as admin_avatar,
                    (SELECT COUNT(*) FROM club_members WHERE club_id = c.club_id AND status = 'active') as member_count
             FROM clubs c 
             LEFT JOIN users u ON c.admin_id = u.user_id 
             ORDER BY c.created_at DESC`
        );
        return clubs;
    }

    /**
     * Get club by ID with details
     */
    static async findById(clubId, userId = null) {
        const [clubs] = await pool.query(
            `SELECT c.*, u.name as admin_name, u.avatar_url as admin_avatar,
                    (SELECT COUNT(*) FROM club_members WHERE club_id = c.club_id AND status = 'active') as member_count,
                    ${userId ? `(SELECT role FROM club_members WHERE club_id = c.club_id AND user_id = ? AND status = 'active') as user_role` : 'NULL as user_role'}
             FROM clubs c 
             LEFT JOIN users u ON c.admin_id = u.user_id 
             WHERE c.club_id = ?`,
            userId ? [userId, clubId] : [clubId]
        );
        return clubs[0] || null;
    }

    /**
     * Create new club
     */
    static async create(adminId, clubData) {
        const clubId = crypto.randomUUID();
        const slug = clubData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        await pool.query(
            `INSERT INTO clubs (club_id, name, slug, description, category, campus, admin_id, logo_url, banner_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                clubId,
                clubData.name,
                slug,
                clubData.description,
                clubData.category,
                clubData.campus,
                adminId,
                clubData.logo_url || null,
                clubData.banner_url || null
            ]
        );

        // Add admin as first member
        await this.addMember(clubId, adminId, 'admin');
        return clubId;
    }

    /**
     * Add member to club
     */
    static async addMember(clubId, userId, role = 'member') {
        const membershipId = crypto.randomUUID();
        await pool.query(
            'INSERT INTO club_members (membership_id, club_id, user_id, role, status) VALUES (?, ?, ?, ?, ?)',
            [membershipId, clubId, userId, role, 'active']
        );
        await pool.query(
            'UPDATE clubs SET member_count = member_count + 1 WHERE club_id = ?',
            [clubId]
        );
        return membershipId;
    }

    /**
     * Remove member from club
     */
    static async removeMember(clubId, userId) {
        const [result] = await pool.query(
            'DELETE FROM club_members WHERE club_id = ? AND user_id = ?',
            [clubId, userId]
        );
        if (result.affectedRows > 0) {
            await pool.query(
                'UPDATE clubs SET member_count = GREATEST(member_count - 1, 0) WHERE club_id = ?',
                [clubId]
            );
        }
        return result.affectedRows > 0;
    }

    /**
     * Get club members
     */
    static async getMembers(clubId) {
        const [members] = await pool.query(
            `SELECT cm.*, u.user_id, u.name, u.username, u.avatar_url
             FROM club_members cm
             JOIN users u ON cm.user_id = u.user_id
             WHERE cm.club_id = ? AND cm.status = 'active'
             ORDER BY FIELD(cm.role, 'admin', 'moderator', 'member'), cm.joined_at`,
            [clubId]
        );
        return members;
    }

    /**
     * Get club events
     */
    static async getEvents(clubId) {
        const [events] = await pool.query(
            `SELECT * FROM club_events 
             WHERE club_id = ? AND start_time >= NOW()
             ORDER BY start_time ASC`,
            [clubId]
        );
        return events;
    }

    /**
     * Update club details
     */
    static async update(clubId, updates) {
        const fields = [];
        const values = [];

        if (updates.name !== undefined) {
            fields.push('name = ?');
            values.push(updates.name);
            const slug = updates.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            fields.push('slug = ?');
            values.push(slug);
        }
        if (updates.description !== undefined) {
            fields.push('description = ?');
            values.push(updates.description);
        }
        if (updates.category !== undefined) {
            fields.push('category = ?');
            values.push(updates.category);
        }
        if (updates.campus !== undefined) {
            fields.push('campus = ?');
            values.push(updates.campus);
        }
        if (updates.logo_url !== undefined) {
            fields.push('logo_url = ?');
            values.push(updates.logo_url);
        }
        if (updates.banner_url !== undefined) {
            fields.push('banner_url = ?');
            values.push(updates.banner_url);
        }

        if (fields.length === 0) return false;

        values.push(clubId);
        await pool.query(
            `UPDATE clubs SET ${fields.join(', ')} WHERE club_id = ?`,
            values
        );
        return true;
    }
}

module.exports = Club;
