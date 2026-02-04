const Club = require('../models/Club');
const logger = require('../utils/logger');

// Web Routes (Rendering)
const renderClubs = async (req, res) => {
    try {
        const clubs = await Club.getAll();
        res.render('clubs', {
            title: 'Campus Clubs',
            user: req.user,
            initialClubs: clubs || [],
            currentCampus: 'all',
            currentCategory: 'all',
            searchQuery: ''
        });
    } catch (error) {
        logger.error('Render Clubs Error:', error);
        res.render('clubs', {
            title: 'Campus Clubs',
            user: req.user,
            initialClubs: [],
            currentCampus: 'all',
            currentCategory: 'all',
            searchQuery: ''
        });
    }
};

const renderClubDetail = async (req, res) => {
    try {
        const userId = req.user ? (req.user.user_id || req.user.userId) : null;
        const club = await Club.findById(req.params.id, userId);

        if (!club) {
            return res.status(404).render('404', { title: 'Club Not Found' });
        }

        const events = await Club.getEvents(req.params.id);
        res.render('club-detail', {
            title: club.name,
            club,
            events: events || [],
            user: req.user
        });
    } catch (error) {
        logger.error('Render Club Detail Error:', error);
        res.status(500).render('error', { error: 'Failed to load club details' });
    }
};

// API Routes (JSON)
const getClubs = async (req, res) => {
    try {
        const clubs = await Club.getAll();
        res.json(clubs);
    } catch (error) {
        logger.error('API Get Clubs Error:', error);
        res.status(500).json({ error: 'Failed to fetch clubs' });
    }
};

const getClubById = async (req, res) => {
    try {
        const userId = req.user ? (req.user.user_id || req.user.userId) : null;
        const club = await Club.findById(req.params.id, userId);
        if (!club) return res.status(404).json({ error: 'Club not found' });
        res.json(club);
    } catch (error) {
        logger.error('API Get Club By ID Error:', error);
        res.status(500).json({ error: 'Failed to fetch club' });
    }
};

const createClub = async (req, res) => {
    try {
        const adminId = req.user.user_id || req.user.userId;
        const clubData = { ...req.body };

        // Handle file uploads
        if (req.files) {
            if (req.files.logo && req.files.logo[0]) {
                clubData.logo_url = req.files.logo[0].path;
            }
            if (req.files.banner && req.files.banner[0]) {
                clubData.banner_url = req.files.banner[0].path;
            }
        }

        const clubId = await Club.create(adminId, clubData);
        res.status(201).json({ message: 'Club created successfully', club_id: clubId });
    } catch (error) {
        logger.error('Create Club Error:', error);
        res.status(500).json({ error: 'Failed to create club' });
    }
};

const joinClub = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const clubId = req.params.id;
        await Club.addMember(clubId, userId);
        res.json({ message: 'Joined club successfully' });
    } catch (error) {
        logger.error('Join Club Error:', error);
        res.status(500).json({ error: 'Failed to join club' });
    }
};

const leaveClub = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const clubId = req.params.id;
        const success = await Club.removeMember(clubId, userId);
        if (!success) return res.status(404).json({ error: 'Membership not found' });
        res.json({ message: 'Left club successfully' });
    } catch (error) {
        logger.error('Leave Club Error:', error);
        res.status(500).json({ error: 'Failed to leave club' });
    }
};

const getMembers = async (req, res) => {
    try {
        const members = await Club.getMembers(req.params.id);
        res.json(members);
    } catch (error) {
        logger.error('Get Members Error:', error);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
};

const updateClub = async (req, res) => {
    try {
        const clubId = req.params.id;
        const userId = req.user.user_id || req.user.userId;

        // Verify admin status
        const club = await Club.findById(clubId, userId);
        if (!club) return res.status(404).json({ error: 'Club not found' });
        if (club.user_role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can update club details' });
        }

        const updates = { ...req.body };

        // Handle file uploads from Cloudinary
        if (req.files) {
            if (req.files.logo && req.files.logo[0]) {
                updates.logo_url = req.files.logo[0].path;
            }
            if (req.files.banner && req.files.banner[0]) {
                updates.banner_url = req.files.banner[0].path;
            }
        }

        await Club.update(clubId, updates);
        res.json({ message: 'Club updated successfully', updates });
    } catch (error) {
        logger.error('Update Club Error:', error);
        res.status(500).json({ error: 'Failed to update club' });
    }
};

module.exports = {
    renderClubs,
    renderClubDetail,
    getClubs,
    getClubById,
    createClub,
    joinClub,
    leaveClub,
    getMembers,
    updateClub
};
