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
            const member = await Group.getMember(groupId, req.user.user_id);
            if (member) {
                userRole = member.role;
                memberStatus = member.status;
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
        const userId = req.user.user_id;

        const member = await Group.getMember(groupId, userId);
        if (!member || (member.role !== 'admin' && member.role !== 'moderator' && member.role !== 'owner')) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const updateData = { ...req.body };
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
        const members = await Group.getMembersDetailed(req.params.id, req.user.user_id);
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
        const userId = req.user.user_id;
        let content = req.body.content;
        let image = req.body.image;
        let video = req.body.video;

        if (req.file) {
            image = req.file.path; // Cloudinary secure_url
        }

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Validate membership & posting permissions
        const member = await Group.getMember(groupId, userId);
        if (!member || member.status !== 'active') {
            return res.status(403).json({ error: 'You must be an active member to post in this group' });
        }

        const group = await Group.findById(groupId);
        if (group && !group.allow_posts && member.role !== 'owner' && member.role !== 'admin') {
            return res.status(403).json({ error: 'Posting has been disabled by community admin' });
        }

        const postId = await Group.createPost(groupId, userId, content, image || null, video || null);
        
        res.status(201).json({ 
            success: true, 
            message: 'Post created successfully',
            post_id: postId 
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
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const posts = await Group.getPosts(groupId, limit, offset);
        res.json({ success: true, posts });
    } catch (error) {
        logger.error('API Group Posts Error:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
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
                g.user_membership_status === 'active' &&
                (g.user_role === 'admin' || g.user_role === 'owner' || g.user_role === 'moderator')
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
        const userId = req.user.user_id;
        const groupId = req.params.id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
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
        const userId = req.user.user_id;
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
        const userId = req.user.user_id;

        const member = await Group.getMember(groupId, userId);
        if (!member || member.role !== 'owner') {
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
    try {
        const { name, campus, description, is_public, category } = req.body;
        const userId = req.user.user_id;

        if (!name) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        // Handle icon upload (if using middleware)
        const icon_url = req.file ? req.file.path : (req.body.photo_url || '/uploads/avatars/default.png');

        const groupId = await Group.create(
            name,
            icon_url,
            campus || req.user.campus || 'main',
            is_public === 'true' || is_public === true,
            description || '',
            category || 'general',
            userId
        );

        // Add creator as Founder (Owner)
        await Group.addMember(groupId, userId, 'owner', 'active');

        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            id: groupId
        });
    } catch (error) {
        logger.error('Create Group Error:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
};

const getGroupsAPI = async (req, res) => {
    try {
        const campus = req.query.campus;
        const userId = req.user ? req.user.user_id : null;
        let groups = await Group.getAll(userId);

        if (campus && campus !== 'all') {
            groups = groups.filter(g => g.campus === campus);
        }

        res.json(groups);
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
        const success = await Group.updateMemberRole(id, userId, 'admin');
        res.json({ success });
    } catch (error) {
        logger.error('API Promote Member Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

const deletePostAPI = async (req, res) => {
    try {
        const { id, postId } = req.params;
        const userId = req.user.user_id;

        // Check if admin/moderator of the group
        const member = await Group.getMember(id, userId);
        if (!member || (member.role !== 'admin' && member.role !== 'moderator')) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        await Group.deletePost(postId);
        res.json({ success: true });
    } catch (error) {
        logger.error('API Delete Post Error:', error);
        res.status(500).json({ error: 'Failed' });
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
    deletePostAPI,
    updateGroupAPI,
    getMembersDetailedAPI
};
