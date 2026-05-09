const Group = require('../models/Group');
const logger = require('../utils/logger');

/**
 * Render group page
 * GET /groups/:id
 */
const renderGroupDetail = async (req, res) => {
    try {
        const groupId = req.params.id;
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).render('error', { error: 'Group not found' });
        }

        const memberCount = await Group.getMembersCount(groupId);
        const posts = await Group.getPosts(groupId, 20, 0);
        const admins = await Group.getAdmins(groupId);
        
        // Match specific Logic: Show 3 avatars prioritized by followed users
        const memberPreview = await Group.getMemberPreview(groupId, req.user ? req.user.user_id : null);
        const otherCount = memberCount > 3 ? memberCount - 3 : 0;

        // Check if user is a member
        let userRole = null;
        let memberStatus = null;
        if (req.user) {
            const userId = req.user.userId || req.user.user_id;
            const member = await Group.getMember(groupId, userId);
            
            if (member) {
                userRole = member.role;
                memberStatus = member.status;
            }
            
            // CRITICAL: Creator is always owner regardless of membership row
            if (userId === group.creator_id) {
                userRole = 'owner';
                memberStatus = 'active';
            }
        }

        res.render('group-detail', {
            title: group.name,
            group,
            memberCount,
            memberPreview,
            otherCount,
            initialPosts: posts || [],
            admins: admins || [],
            userRole,
            memberStatus,
            user: req.user,
            csrfToken: req.csrfToken ? req.csrfToken() : null
        });
    } catch (error) {
        logger.error('Render Group Detail Error:', error);
        res.status(500).render('error', { error: 'Internal Server Error' });
    }
};

/**
 * Handle group updates (Settings/Images)
 * POST /api/groups/:id/update
 */
const updateGroupAPI = async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const member = await Group.getMember(groupId, userId);
        const isCreator = group.creator_id === userId;
        const isOwner = isCreator || (member && member.role === 'owner');
        const isAdmin = isOwner || (member && (member.role === 'admin' || member.role === 'moderator'));

        if (!isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const updateData = { ...req.body };
        
        // Sanitize boolean values from body
        const boolFields = ['is_public', 'requires_approval', 'allow_posts', 'require_post_approval'];
        boolFields.forEach(f => {
            if (updateData[f] !== undefined) updateData[f] = updateData[f] === 'true' || updateData[f] === 1 || updateData[f] === true ? 1 : 0;
        });

        if (req.files) {
            if (req.files.icon) updateData.icon_url = req.files.icon[0].path;
            if (req.files.cover) updateData.cover_image = req.files.cover[0].path;
        }

        await Group.update(groupId, updateData);
        res.json({ success: true, message: 'Updated successfully' });
    } catch (error) {
        logger.error('Update Group Error:', error);
        res.status(500).json({ error: 'Update failed' });
    }
};

/**
 * Members tab API
 * GET /api/groups/:id/members
 */
const getMembersDetailedAPI = async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const member = await Group.getMember(groupId, userId);
        const isAdmin = (group.creator_id === userId) || (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'super_admin' || member.role === 'moderator'));

        const members = await Group.getMembersDetailed(groupId, userId, isAdmin);
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

/**
 * Create group post
 * POST /groups/:id/post
 */
const createGroupPost = async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user.userId || req.user.user_id;
        let content = req.body.content;
        let images = [];

        if (req.files && req.files.length > 0) {
            images = req.files.map(f => f.path);
        } else if (req.body.image) {
            images = Array.isArray(req.body.image) ? req.body.image : [req.body.image];
        }

        const image = images.length > 0 ? images.join(',') : null;
        let video = req.body.video;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Validate membership & posting permissions
        const member = await Group.getMember(groupId, userId);
        if (!member || member.status !== 'active') {
            return res.status(403).json({ error: 'You must be an active member to post in this group' });
        }

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const isCreator = group.creator_id === userId;
        const isOwner = isCreator || (member && (member.role === 'owner' || member.role === 'super_admin'));
        const isAdmin = isOwner || (member && (member.role === 'admin' || member.role === 'moderator'));

        // Post Approval Logic
        const approval_status = group.require_post_approval && !isAdmin ? 'pending' : 'approved';

        const postId = await Group.createPost(
            groupId, 
            userId, 
            content, 
            image || null, 
            video || null,
            req.body.feeling || null,
            req.body.activity || null,
            req.body.tagged_users || null
        );

        // Update approval status if pending
        if (approval_status === 'pending') {
            const pool = require('../config/database');
            await pool.query('UPDATE posts SET approval_status = ? WHERE post_id = ?', [approval_status, postId]);
        }
        
        res.status(201).json({ 
            success: true, 
            message: approval_status === 'pending' ? 'Post submitted for approval' : 'Post created successfully',
            post_id: postId,
            status: approval_status
        });
    } catch (error) {
        logger.error('Create Group Post Error:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
};

/**
 * GET group posts API (AJAX)
 * GET /api/groups/:id/posts?page=1
 */
const getGroupPostsAPI = async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user ? (req.user.userId || req.user.user_id) : null;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        // Privacy Check: If private, must be member or creator
        if (!group.is_public) {
            const member = await Group.getMember(groupId, userId);
            const isAuthorized = (group.creator_id === userId) || (member && member.status === 'active');
            if (!isAuthorized) {
                return res.status(403).json({ error: 'Private group: Membership required' });
            }
        }

        const posts = await Group.getPosts(groupId, limit, offset);
        res.json({ success: true, posts });
    } catch (error) {
        logger.error('API Group Posts Error:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
};

/**
 * Post Moderation APIs
 */
const getPendingPostsAPI = async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const member = await Group.getMember(groupId, userId);
        const isAdmin = (group.creator_id === userId) || (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'super_admin' || member.role === 'moderator'));

        if (!isAdmin) {
            return res.status(403).json({ error: 'Admin only' });
        }

        const posts = await Group.getPendingPosts(groupId);
        res.json(posts);
    } catch (error) {
        logger.error('Get Pending Posts Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

const approvePostAPI = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId || req.user.user_id;

        // Get group ID from post
        const [posts] = await pool.query('SELECT group_id FROM posts WHERE post_id = ?', [postId]);
        if (posts.length === 0) return res.status(404).json({ error: 'Post not found' });
        const groupId = posts[0].group_id;

        const group = await Group.findById(groupId);
        const member = await Group.getMember(groupId, userId);
        const isAdmin = (group?.creator_id === userId) || (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'super_admin' || member.role === 'moderator'));

        if (!isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        await Group.approvePost(postId);
        res.json({ success: true });
    } catch (error) {
        logger.error('Approve Post Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

const rejectPostAPI = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId || req.user.user_id;

        const [posts] = await pool.query('SELECT group_id FROM posts WHERE post_id = ?', [postId]);
        if (posts.length === 0) return res.status(404).json({ error: 'Post not found' });
        const groupId = posts[0].group_id;

        const group = await Group.findById(groupId);
        const member = await Group.getMember(groupId, userId);
        const isAdmin = (group?.creator_id === userId) || (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'super_admin' || member.role === 'moderator'));

        if (!isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        await Group.rejectPost(postId);
        res.json({ success: true });
    } catch (error) {
        logger.error('Reject Post Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

/**
 * Member Moderation APIs
 */
const muteMemberAPI = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const currentUserId = req.user.userId || req.user.user_id;

        const group = await Group.findById(id);
        const member = await Group.getMember(id, currentUserId);
        const isAdmin = (group?.creator_id === currentUserId) || (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'super_admin' || member.role === 'moderator'));

        if (!isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const { muted } = req.body;
        await Group.muteMember(id, userId, muted);
        res.json({ success: true });
    } catch (error) {
        logger.error('Mute Member Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

const banMemberAPI = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const currentUserId = req.user.userId || req.user.user_id;

        const group = await Group.findById(id);
        const member = await Group.getMember(id, currentUserId);
        const isAdmin = (group?.creator_id === currentUserId) || (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'super_admin' || member.role === 'moderator'));

        if (!isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const { banned } = req.body;
        await Group.banMember(id, userId, banned);
        res.json({ success: true });
    } catch (error) {
        logger.error('Ban Member Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

/**
 * Render all groups
 */
const renderGroups = async (req, res) => {
    try {
        const userId = req.user ? req.user.user_id : null;
        const filter = req.query.filter || 'all';
        let groups = await Group.getAll(userId);

        // Apply filter on the result set
        if (filter === 'my' && userId) {
            groups = groups.filter(g => g.user_membership_status === 'active');
        } else if (filter === 'managed' && userId) {
            groups = groups.filter(g =>
                (g.creator_id === userId) || 
                (g.user_membership_status === 'active' &&
                (g.user_role === 'admin' || g.user_role === 'owner' || g.user_role === 'super_admin' || g.user_role === 'moderator'))
            );
        }

        res.render('groups', {
            title: 'Groups',
            initialGroups: groups || [],
            activeFilter: filter,
            user: req.user,
            csrfToken: req.csrfToken ? req.csrfToken() : null
        });
    } catch (error) {
        logger.error('Render Groups Error:', error);
        res.render('groups', { title: 'Groups', initialGroups: [], activeFilter: 'all' });

    }
};

const joinGroup = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const groupId = req.params.id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // CREATOR JOIN FIX: Creator is already a member
        if (group.creator_id === userId) {
            return res.status(400).json({ error: 'You are the creator and already an admin of this circle.' });
        }

        if (group.requires_approval) {
            const existingRequest = await Group.findRequest(groupId, userId);
            if (existingRequest) {
                return res.status(400).json({ error: 'Join request already pending' });
            }
            await Group.createJoinRequest(groupId, userId);
            return res.json({ success: true, message: 'Join request sent successfully', status: 'pending' });
        }

        await Group.addMember(groupId, userId);
        res.json({ success: true, message: 'Joined group successfully', status: 'active' });
    } catch (error) {
        logger.error('Join Group Error:', error);
        res.status(500).json({ error: 'Failed to join group' });
    }
};

const leaveGroup = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const groupId = req.params.id;

        const member = await Group.getMember(groupId, userId);
        if (!member) return res.status(400).json({ error: 'You are not a member of this group' });
        if (member.role === 'owner') return res.status(403).json({ error: 'Owners cannot leave. Transfer ownership first.' });

        await Group.removeMember(groupId, userId);
        res.json({ success: true, message: 'Left group successfully' });
    } catch (error) {
        logger.error('Leave Group Error:', error);
        res.status(500).json({ error: 'Failed to leave group' });
    }
};

const deleteGroupAPI = async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        const member = await Group.getMember(groupId, userId);
        if (!member || (member.role !== 'owner' && member.role !== 'super_admin' && group.creator_id !== userId)) {
            return res.status(403).json({ error: 'Only the group owner can delete this community' });
        }

        await Group.deleteGroup(groupId);
        res.json({ success: true, message: 'Group deleted successfully' });
    } catch (error) {
        logger.error('Delete Group Error:', error);
        res.status(500).json({ error: 'Failed to delete group' });
    }
};

const createGroup = async (req, res) => {
    const pool = require('../config/database');
    const connection = await pool.getConnection();
    try {
        const { name, campus, description, is_public, category } = req.body;
        const userId = req.user.userId || req.user.user_id;

        if (!name) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        await connection.beginTransaction();

        const icon_url = req.file ? req.file.path : (req.body.photo_url || '/uploads/avatars/default.png');
        const groupId = require('crypto').randomUUID();
        const requiresApproval = (is_public === 'true' || is_public === true) ? 0 : 1;

        // 1. Create group
        await connection.query(
            `INSERT INTO groups (group_id, name, icon_url, campus, is_public, requires_approval, description, category, creator_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [groupId, name, icon_url, campus || 'main', is_public === 'true' ? 1 : 0, requiresApproval, description || '', category || 'general', userId]
        );

        // 2. Automatically add creator as Super Admin (Owner)
        await connection.query(
            'INSERT INTO group_members (group_id, user_id, role, status) VALUES (?, ?, ?, ?)',
            [groupId, userId, 'super_admin', 'active']
        );

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Group created successfully and joined as owner',
            id: groupId
        });
    } catch (error) {
        await connection.rollback();
        logger.error('Create Group Transaction Error:', error);
        res.status(500).json({ error: 'Failed to create group' });
    } finally {
        connection.release();
    }
};

const getGroupsAPI = async (req, res) => {
    try {
        const campus = req.query.campus;
        const filter = req.query.filter || 'all';
        const userId = req.user ? (req.user.userId || req.user.user_id) : null;
        let groups = await Group.getAll(userId);

        if (campus && campus !== 'all') {
            groups = groups.filter(g => g.campus === campus);
        }

        // Apply filter on the result set
        if (filter === 'my' && userId) {
            groups = groups.filter(g => g.user_membership_status === 'active');
        } else if (filter === 'managed' && userId) {
            groups = groups.filter(g =>
                (g.creator_id === userId) ||
                (g.user_membership_status === 'active' &&
                (g.user_role === 'admin' || g.user_role === 'owner' || g.user_role === 'super_admin' || g.user_role === 'moderator'))
            );
        }

        res.json({ success: true, initialGroups: groups });
    } catch (error) {
        logger.error('API Load Groups Error:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
};

/**
 * API for pending requests
 * GET /api/groups/:id/requests
 */
const getPendingRequestsAPI = async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user.userId || req.user.user_id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const member = await Group.getMember(groupId, userId);
        const isAdmin = (group.creator_id === userId) || (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'super_admin' || member.role === 'moderator'));

        if (!isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const requests = await Group.getPendingRequests(groupId);
        res.json(requests);
    } catch (error) {
        logger.error('API Pending Requests Error:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
};

/**
 * API for request actions
 * POST /api/groups/requests/:requestId/approve
 */
const approveRequestAPI = async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const userId = req.user.userId || req.user.user_id;

        // Get group ID from request
        const [requests] = await pool.query('SELECT group_id FROM group_requests WHERE id = ?', [requestId]);
        if (requests.length === 0) return res.status(404).json({ error: 'Request not found' });
        const groupId = requests[0].group_id;

        const group = await Group.findById(groupId);
        const member = await Group.getMember(groupId, userId);
        const isAdmin = (group?.creator_id === userId) || (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'super_admin' || member.role === 'moderator'));

        if (!isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const success = await Group.approveRequest(requestId);
        res.json({ success });
    } catch (error) {
        logger.error('API Approve Request Error:', error);
        res.status(500).json({ error: 'Failed to approve' });
    }
};

const rejectRequestAPI = async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const userId = req.user.userId || req.user.user_id;

        const [requests] = await pool.query('SELECT group_id FROM group_requests WHERE id = ?', [requestId]);
        if (requests.length === 0) return res.status(404).json({ error: 'Request not found' });
        const groupId = requests[0].group_id;

        const group = await Group.findById(groupId);
        const member = await Group.getMember(groupId, userId);
        const isAdmin = (group?.creator_id === userId) || (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'super_admin' || member.role === 'moderator'));

        if (!isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const success = await Group.rejectRequest(requestId);
        res.json({ success });
    } catch (error) {
        logger.error('API Reject Request Error:', error);
        res.status(500).json({ error: 'Failed to reject' });
    }
};

const removeMemberAPI = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const currentUserId = req.user.userId || req.user.user_id;

        const group = await Group.findById(id);
        const member = await Group.getMember(id, currentUserId);
        const isAdmin = (group?.creator_id === currentUserId) || (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'super_admin' || member.role === 'moderator'));

        if (!isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        // Prevent removing owner unless you are owner (well, even then, owner can't be removed usually)
        const targetMember = await Group.getMember(id, userId);
        if (targetMember && (targetMember.role === 'owner' || targetMember.role === 'super_admin')) {
            return res.status(403).json({ error: 'Cannot remove the circle owner' });
        }

        const success = await Group.removeMember(id, userId);
        res.json({ success });
    } catch (error) {
        logger.error('API Remove Member Error:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
};

const promoteMemberAPI = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const currentUserId = req.user.userId || req.user.user_id;

        const group = await Group.findById(id);
        const member = await Group.getMember(id, currentUserId);
        const isAdmin = (group?.creator_id === currentUserId) || (member && (member.role === 'admin' || member.role === 'owner' || member.role === 'super_admin'));

        if (!isAdmin) {
            return res.status(403).json({ error: 'Only admins or owners can promote members' });
        }

        const success = await Group.updateMemberRole(id, userId, 'admin');
        res.json({ success });
    } catch (error) {
        logger.error('API Promote Member Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

const demoteMemberAPI = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const currentUserId = req.user.userId || req.user.user_id;

        const group = await Group.findById(id);
        const member = await Group.getMember(id, currentUserId);
        const isOwner = (group?.creator_id === currentUserId) || (member && (member.role === 'owner' || member.role === 'super_admin'));

        if (!isOwner) {
            return res.status(403).json({ error: 'Only the circle owner can demote admins' });
        }

        const success = await Group.updateMemberRole(id, userId, 'member');
        res.json({ success });
    } catch (error) {
        logger.error('API Demote Member Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

const deletePostAPI = async (req, res) => {
    try {
        const { id, postId } = req.params;
        const userId = req.user.userId || req.user.user_id;

        // Get post to check author
        const [posts] = await pool.query('SELECT user_id FROM posts WHERE post_id = ?', [postId]);
        if (posts.length === 0) return res.status(404).json({ error: 'Post not found' });
        const postAuthorId = posts[0].user_id;

        // Check if author OR admin/moderator of the group
        const group = await Group.findById(id);
        const member = await Group.getMember(id, userId);
        const isCreator = group?.creator_id === userId;
        const isAdmin = isCreator || (member && (member.role === 'admin' || member.role === 'moderator' || member.role === 'owner' || member.role === 'super_admin'));
        
        if (userId !== postAuthorId && !isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        await Group.deletePost(postId);
        res.json({ success: true });
    } catch (error) {
        logger.error('API Delete Post Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

/**
 * GET group detail API (JSON)
 * GET /api/groups/:id
 */
const getGroupAPI = async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user ? (req.user.userId || req.user.user_id) : null;
        
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const memberCount = await Group.getMembersCount(groupId);
        const memberPreview = await Group.getMemberPreview(groupId, userId);
        const admins = await Group.getAdmins(groupId);
        const posts = await Group.getPosts(groupId, 20, 0);
        const media = await Group.getMedia(groupId, 50, 0);
        
        let userRole = null;
        let memberStatus = null;
        let isAdmin = false;

        if (userId) {
            const member = await Group.getMember(groupId, userId);
            if (member) {
                userRole = member.role;
                memberStatus = member.status;
            }
            
            // CRITICAL: Creator is always owner/super_admin
            if (userId === group.creator_id) {
                userRole = 'super_admin';
                memberStatus = 'active';
            }
            isAdmin = userRole === 'admin' || userRole === 'owner' || userRole === 'super_admin' || userRole === 'moderator';
        }

        const members = await Group.getMembersDetailed(groupId, userId, isAdmin);

        res.json({
            success: true,
            group: {
                ...group,
                memberCount,
                memberPreview,
                admins,
                userRole,
                memberStatus
            },
            initialPosts: posts || [],
            media: media || [],
            members: members || []
        });
    } catch (error) {
        logger.error('API Get Group Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const inviteFriends = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { userIds } = req.body;
        const senderId = req.user.userId || req.user.user_id;

        if (!userIds || !Array.isArray(userIds)) {
            return res.status(400).json({ error: 'User IDs are required' });
        }

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const notificationController = require('./notification.controller');

        // Send notifications for each user
        for (const targetUserId of userIds) {
            await notificationController.createNotification({
                user_id: targetUserId,
                type: 'group_invite',
                title: 'Circle Invitation',
                content: `invited you to join ${group.name}`,
                actor_id: senderId,
                action_url: `/groups/${groupId}`
            });
        }

        logger.info(`User ${senderId} invited ${userIds.length} users to group ${groupId}`);
        res.json({ success: true, message: 'Invitations sent' });
    } catch (error) {
        logger.error('Invite Friends Error:', error);
        res.status(500).json({ error: 'Failed to send invites' });
    }
};

module.exports = {
    renderGroups,
    renderGroupDetail,
    createGroup,
    createGroupPost,
    getGroupPostsAPI,
    joinGroup,
    leaveGroup,
    deleteGroupAPI,
    getGroupsAPI,
    getPendingRequestsAPI,
    approveRequestAPI,
    rejectRequestAPI,
    removeMemberAPI,
    promoteMemberAPI,
    demoteMemberAPI,
    deletePostAPI,
    updateGroupAPI,
    getMembersDetailedAPI,
    getGroupAPI,
    inviteFriends,
    getPendingPostsAPI,
    approvePostAPI,
    rejectPostAPI,
    muteMemberAPI,
    banMemberAPI
};
