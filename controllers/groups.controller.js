const Group = require('../models/Group');
const logger = require('../utils/logger');

// Web Routes (Rendering)
const renderGroups = async (req, res) => {
    try {
        const groups = await Group.getAll();
        res.render('groups', { title: 'Groups', initialGroups: groups || [] });
    } catch (error) {
        logger.error('Render Groups Error:', error);
        res.render('groups', { title: 'Groups', initialGroups: [] });
    }
};

const renderGroupDetail = async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).render('404', { title: 'Group Not Found' });
        }
        const posts = await Group.getPosts(req.params.id);
        res.render('group-detail', {
            title: group.name,
            group,
            initialPosts: posts || [],
            members: []
        });
    } catch (error) {
        logger.error('Render Group Detail Error:', error);
        res.status(500).render('error', { error: 'Failed to load group details' });
    }
};

// API Routes (JSON)
const getCampusGroups = async (req, res) => {
    try {
        const groups = await Group.search(req.query);
        res.json(groups);
    } catch (error) {
        logger.error('API Search Groups Error:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
};

const createGroup = async (req, res) => {
    try {
        const creatorId = req.user.user_id || req.user.userId;
        const groupId = await Group.create(creatorId, req.body);
        res.status(201).json({ message: 'Group created successfully', group_id: groupId });
    } catch (error) {
        logger.error('Create Group Error:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
};

const joinGroup = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const groupId = req.params.id;
        await Group.addMember(groupId, userId);
        res.json({ message: 'Joined group successfully' });
    } catch (error) {
        logger.error('Join Group Error:', error);
        res.status(500).json({ error: 'Failed to join group' });
    }
};

const leaveGroup = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const groupId = req.params.id;
        const success = await Group.removeMember(groupId, userId);
        if (!success) return res.status(404).json({ error: 'Membership not found' });
        res.json({ message: 'Left group successfully' });
    } catch (error) {
        logger.error('Leave Group Error:', error);
        res.status(500).json({ error: 'Failed to leave group' });
    }
};

module.exports = {
    renderGroups,
    renderGroupDetail,
    getCampusGroups,
    createGroup,
    joinGroup,
    leaveGroup
};
