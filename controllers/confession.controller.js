const Confession = require('../models/Confession');
const logger = require('../utils/logger');

// Web Routes
const renderConfessions = async (req, res) => {
    try {
        const campus = req.user.campus || 'all';
        const confessions = await Confession.getRecent(campus);
        res.render('confessions', {
            title: 'Campus Confessions',
            confessions: confessions || [],
            user: req.user
        });
    } catch (error) {
        logger.error('Render Confessions Error:', error);
        res.render('confessions', { title: 'Campus Confessions', confessions: [], user: req.user });
    }
};

// API Routes
const createConfession = async (req, res) => {
    try {
        const { content, category } = req.body;
        const campus = req.user.campus;

        if (!content) return res.status(400).json({ error: 'Content is required' });

        // Basic "AI" Filter (Keyword based for now)
        const badWords = ['hate', 'violence', 'kill', 'stupid', 'idiot']; // Expand as needed
        const hasBadWords = badWords.some(word => content.toLowerCase().includes(word));

        if (hasBadWords) {
            return res.status(400).json({ error: 'Your confession matches our negative content filter. Please be kind!' });
        }

        const id = await Confession.create(content, campus, category);
        res.status(201).json({ message: 'Confession submitted anonymously', id });
    } catch (error) {
        logger.error('Create Confession Error:', error);
        res.status(500).json({ error: 'Failed to submit confession' });
    }
};

const reactToConfession = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // upvote, downvote, etc.
        const userId = req.user.user_id || req.user.userId;

        await Confession.addReaction(id, userId, type);
        res.json({ message: 'Reaction recorded' });
    } catch (error) {
        logger.error('React Confession Error:', error);
        res.status(500).json({ error: 'Failed to record reaction' });
    }
};

module.exports = {
    renderConfessions,
    createConfession,
    reactToConfession
};
