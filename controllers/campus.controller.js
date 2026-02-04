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

module.exports = { renderPolls, renderPollDetail, renderEvents, renderStreams, getPolls, getEvents, getStreams };
