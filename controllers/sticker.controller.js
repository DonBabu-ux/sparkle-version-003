const pool = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

// 1. Create a sticker for a story
const createSticker = async (req, res) => {
    try {
        const { story_id, type, config, x, y, scale, rotation } = req.body;
        const sticker_id = crypto.randomUUID();

        await pool.query(
            `INSERT INTO story_stickers (sticker_id, story_id, type, config, position_x, position_y, scale, rotation)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [sticker_id, story_id, type, JSON.stringify(config), x || 50, y || 50, scale || 1, rotation || 0]
        );

        res.status(201).json({ status: 'success', sticker_id });
    } catch (error) {
        logger.error('Create Sticker Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to create sticker' });
    }
};

// 2. Add Yours Prompt
const createAddYoursPrompt = async (req, res) => {
    try {
        const { text } = req.body;
        const creator_id = req.user.userId || req.user.user_id;
        const prompt_id = crypto.randomUUID();

        await pool.query(
            'INSERT INTO add_yours_prompts (prompt_id, text, creator_id) VALUES (?, ?, ?)',
            [prompt_id, text, creator_id]
        );

        res.status(201).json({ status: 'success', prompt_id });
    } catch (error) {
        logger.error('Create Add Yours Prompt Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to create prompt' });
    }
};

// 3. Add Yours Response
const respondToAddYours = async (req, res) => {
    try {
        const { prompt_id, story_id } = req.body;
        const user_id = req.user.userId || req.user.user_id;
        const response_id = crypto.randomUUID();

        await pool.query(
            'INSERT INTO add_yours_responses (response_id, prompt_id, user_id, story_id) VALUES (?, ?, ?, ?)',
            [response_id, prompt_id, user_id, story_id]
        );

        res.status(201).json({ status: 'success', response_id });
    } catch (error) {
        logger.error('Respond Add Yours Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to respond' });
    }
};

// 4. Vote on Poll
const votePoll = async (req, res) => {
    try {
        const { sticker_id, option_index } = req.body;
        const user_id = req.user.userId || req.user.user_id;
        const vote_id = crypto.randomUUID();

        await pool.query(
            `INSERT INTO poll_votes (vote_id, sticker_id, user_id, option_index) 
             VALUES (?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE option_index = VALUES(option_index)`,
            [vote_id, sticker_id, user_id, option_index]
        );

        res.json({ status: 'success' });
    } catch (error) {
        logger.error('Vote Poll Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to vote' });
    }
};

// 6. Get Add Yours Data (Prompt + Responses)
const getAddYoursData = async (req, res) => {
    try {
        const { prompt_id } = req.params;

        const [prompts] = await pool.query(
            'SELECT p.*, u.username as creator_name FROM add_yours_prompts p JOIN users u ON p.creator_id = u.user_id WHERE p.prompt_id = ?',
            [prompt_id]
        );

        if (prompts.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Prompt not found' });
        }

        const [responses] = await pool.query(
            `SELECT r.*, u.username, u.avatar_url, s.media_url, s.media_type 
             FROM add_yours_responses r 
             JOIN users u ON r.user_id = u.user_id 
             JOIN stories s ON r.story_id = s.story_id 
             WHERE r.prompt_id = ?`,
            [prompt_id]
        );

        res.json({
            status: 'success',
            prompt: prompts[0],
            responses: responses
        });
    } catch (error) {
        logger.error('Get Add Yours Data Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch data' });
    }
};

// 7. React to Story
const reactToStory = async (req, res) => {
    try {
        const { story_id, emoji } = req.body;
        const user_id = req.user.userId || req.user.user_id;
        const reaction_id = crypto.randomUUID();

        await pool.query(
            'INSERT INTO story_reactions (reaction_id, story_id, user_id, emoji) VALUES (?, ?, ?, ?)',
            [reaction_id, story_id, user_id, emoji]
        );

        res.json({ status: 'success' });
    } catch (error) {
        logger.error('React Story Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to react' });
    }
};

module.exports = {
    createSticker,
    createAddYoursPrompt,
    respondToAddYours,
    votePoll,
    reactToStory,
    getAddYoursData
};
