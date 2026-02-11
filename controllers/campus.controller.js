const pool = require('../config/database');

const renderPolls = async (req, res) => {
    try {
        const { campus } = req.query;
        let query = 'SELECT p.*, u.username, u.name as creator_name FROM polls p JOIN users u ON p.creator_id = u.user_id WHERE (p.expires_at IS NULL OR p.expires_at > NOW())';
        if (campus && campus !== 'all') query += ' AND p.campus = ?';
        const [polls] = await pool.query(query + ' ORDER BY p.created_at DESC', campus && campus !== 'all' ? [campus] : []);
        res.render('polls', { title: 'Campus Polls', initialPolls: polls });
    } catch (error) {
        res.render('polls', { title: 'Campus Polls', initialPolls: [] });
    }
};

const renderPollDetail = async (req, res) => {
    try {
        const [polls] = await pool.query('SELECT p.*, u.username FROM polls p JOIN users u ON p.creator_id = u.user_id WHERE p.poll_id = ?', [req.params.id]);
        if (polls.length === 0) return res.status(404).render('error', { error: 'Poll not found' });
        const [opts] = await pool.query('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY option_order', [req.params.id]);
        const poll = polls[0]; poll.options = opts;
        res.render('poll-detail', { title: poll.question, poll });
    } catch (error) {
        res.status(500).render('error', { error: error.message });
    }
};

const renderEvents = async (req, res) => {
    try {
        const [events] = await pool.query('SELECT e.*, u.username FROM campus_events e JOIN users u ON e.creator_id = u.user_id WHERE e.is_public = TRUE ORDER BY e.start_time ASC');
        res.render('events', { title: 'Campus Events', initialEvents: events });
    } catch (error) {
        res.render('events', { title: 'Campus Events', initialEvents: [] });
    }
};

const renderStreams = async (req, res) => {
    try {
        const [streams] = await pool.query('SELECT s.*, u.username FROM live_streams s JOIN users u ON s.streamer_id = u.user_id WHERE s.status = "live" ORDER BY s.viewer_count DESC');
        res.render('streams', { title: 'Live Streams', initialStreams: streams });
    } catch (error) {
        res.render('streams', { title: 'Live Streams', initialStreams: [] });
    }
};

const getPolls = async (req, res) => {
    try {
        const { campus } = req.query;
        let query = 'SELECT p.*, u.username, u.name as creator_name FROM polls p JOIN users u ON p.creator_id = u.user_id WHERE (p.expires_at IS NULL OR p.expires_at > NOW())';
        const params = [];
        if (campus && campus !== 'all') {
            query += ' AND p.campus = ?';
            params.push(campus);
        }
        const [polls] = await pool.query(query + ' ORDER BY p.created_at DESC', params);
        res.json(polls);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getEvents = async (req, res) => {
    try {
        const { campus } = req.query;
        let query = 'SELECT e.*, u.username FROM campus_events e JOIN users u ON e.creator_id = u.user_id WHERE e.is_public = TRUE';
        const params = [];
        if (campus && campus !== 'all') {
            query += ' AND e.campus = ?';
            params.push(campus);
        }
        const [events] = await pool.query(query + ' ORDER BY e.start_time ASC', params);
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Helper to sanitize avatars - prioritizes internal uploads
const getSafeAvatarUrl = (url) => {
    if (url && url.startsWith('/uploads/')) return url;
    return '/uploads/avatars/default.png';
};

// Helper for media - prioritizes internal uploads, fallbacks for broken external
const getSafeMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('/uploads/')) return url;
    if (url.includes('fbcdn.net') || url.includes('fbsbx.com')) {
        return 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1000';
    }
    return url;
};

const getStreams = async (req, res) => {
    try {
        const { campus } = req.query;
        let query = 'SELECT s.*, u.username, u.avatar_url FROM live_streams s JOIN users u ON s.streamer_id = u.user_id WHERE s.status = "live"';
        const params = [];
        if (campus && campus !== 'all') {
            query += ' AND s.campus = ?';
            params.push(campus);
        }
        const [streams] = await pool.query(query + ' ORDER BY s.viewer_count DESC', params);

        const sanitizedStreams = streams.map(s => ({
            ...s,
            avatar_url: getSafeAvatarUrl(s.avatar_url),
            thumbnail_url: getSafeMediaUrl(s.thumbnail_url)
        }));

        res.json(sanitizedStreams);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createEvent = async (req, res) => {
    try {
        const { title, description, event_type, location, campus, start_time, end_time, is_public } = req.body;
        const creator_id = req.user.user_id || req.user.userId;
        const event_id = require('crypto').randomUUID();

        await pool.query(
            'INSERT INTO campus_events (event_id, creator_id, title, description, event_type, location, campus, start_time, end_time, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [event_id, creator_id, title, description, event_type, location, campus, start_time, end_time, is_public ? 1 : 0]
        );

        res.status(201).json({ message: 'Event created', event_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const rsvpEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const user_id = req.user.user_id || req.user.userId;
        const rsvp_id = require('crypto').randomUUID();

        await pool.query(
            'INSERT INTO event_rsvps (rsvp_id, event_id, user_id, event_type, status) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)',
            [rsvp_id, id, user_id, 'campus_event', status]
        );

        res.json({ message: 'RSVP updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createPoll = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { question, options, campus, category, is_anonymous, expires_at } = req.body;
        const creator_id = req.user.user_id || req.user.userId;
        const poll_id = require('crypto').randomUUID();

        await connection.query(
            'INSERT INTO polls (poll_id, creator_id, question, campus, category, is_anonymous, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [poll_id, creator_id, question, campus, category, is_anonymous ? 1 : 0, expires_at]
        );

        if (options && Array.isArray(options)) {
            for (let i = 0; i < options.length; i++) {
                const option_id = require('crypto').randomUUID();
                await connection.query(
                    'INSERT INTO poll_options (option_id, poll_id, option_text, option_order) VALUES (?, ?, ?, ?)',
                    [option_id, poll_id, options[i], i]
                );
            }
        }

        await connection.commit();
        res.status(201).json({ message: 'Poll created', poll_id });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

const votePoll = async (req, res) => {
    console.log('🗳️ votePoll called');
    console.log('Params:', req.params);
    console.log('Body:', req.body);
    console.log('User:', req.user);

    let connection;
    try {
        // Validate inputs
        if (!req.params.id) {
            return res.status(400).json({ error: 'Poll ID is required' });
        }
        if (!req.body.option_id) {
            return res.status(400).json({ error: 'Option ID is required' });
        }
        if (!req.user || (!req.user.user_id && !req.user.userId)) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { id } = req.params; // poll_id
        const { option_id } = req.body;
        const user_id = req.user.user_id || req.user.userId;
        const vote_id = require('crypto').randomUUID();

        console.log(`Attempting to vote: poll=${id}, option=${option_id}, user=${user_id}`);

        connection = await pool.getConnection();
        console.log('✅ DB Connection acquired');

        await connection.beginTransaction();
        console.log('Transaction started');

        // Check if already voted
        const [existing] = await connection.query(
            'SELECT vote_id FROM poll_votes WHERE poll_id = ? AND user_id = ?',
            [id, user_id]
        );

        if (existing.length > 0) {
            console.warn('⚠️ User already voted');
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'You have already voted on this poll' });
        }

        // Record vote
        await connection.query(
            'INSERT INTO poll_votes (vote_id, poll_id, option_id, user_id) VALUES (?, ?, ?, ?)',
            [vote_id, id, option_id, user_id]
        );
        console.log('Vote recorded');

        // Update counts
        await connection.query(
            'UPDATE poll_options SET vote_count = vote_count + 1 WHERE option_id = ?',
            [option_id]
        );
        console.log('Option count updated');

        await connection.query(
            'UPDATE polls SET total_votes = total_votes + 1 WHERE poll_id = ?',
            [id]
        );
        console.log('Poll total updated');

        await connection.commit();
        console.log('✅ Vote committed successfully');

        connection.release();
        res.json({ message: 'Vote submitted', success: true });
    } catch (error) {
        console.error('❌ Vote error:', error);

        if (connection) {
            try {
                await connection.rollback();
                console.log('Transaction rolled back');
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }

            try {
                connection.release();
                console.log('Connection released after error');
            } catch (releaseError) {
                console.error('Release error:', releaseError);
            }
        }

        // Send error response
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to submit vote',
                details: error.message,
                success: false
            });
        }
    }
};

const getPollResults = async (req, res) => {
    try {
        const { id } = req.params;
        const [results] = await pool.query(
            'SELECT * FROM poll_options WHERE poll_id = ? ORDER BY vote_count DESC',
            [id]
        );
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    renderPolls,
    renderPollDetail,
    renderEvents,
    renderStreams,
    getPolls,
    getEvents,
    getStreams,
    createEvent,
    rsvpEvent,
    createPoll,
    votePoll,
    getPollResults
};
