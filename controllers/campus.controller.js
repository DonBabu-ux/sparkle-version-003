const pool = require('../config/database');
const QRCode = require('qrcode');
const { getIO } = require('../socket');

const renderPolls = async (req, res) => {
    try {
        const affiliation = req.query.affiliation || req.query.campus;
        let query = 'SELECT p.*, u.username, u.name as creator_name FROM polls p JOIN users u ON p.creator_id = u.user_id WHERE (p.expires_at IS NULL OR p.expires_at > NOW())';
        if (affiliation && affiliation !== 'all') query += ' AND p.campus = ?';
        const [polls] = await pool.query(query + ' ORDER BY p.created_at DESC', affiliation && affiliation !== 'all' ? [affiliation] : []);
        res.render('polls', { title: 'Community Polls', initialPolls: polls });
    } catch (error) {
        res.render('polls', { title: 'Community Polls', initialPolls: [] });
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
        const userId = req.user.user_id || req.user.userId;
        const filter = req.query.filter; // 'managed' or 'campus' or null
        const campus = req.query.campus || (filter !== 'managed' ? req.user.campus : null);

        let query = `
            SELECT e.*, u.username,
            (SELECT status FROM event_rsvps WHERE event_id = e.event_id AND user_id = ?) as user_status,
            (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.event_id AND status IN ('pending', 'accepted')) as total_rsvps,
            (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.event_id AND status = 'attended') as total_attended,
            (e.creator_id = ?) as is_creator
            FROM campus_events e 
            JOIN users u ON e.creator_id = u.user_id 
            WHERE 1=1
        `;
        const params = [userId, userId];

        if (filter === 'managed') {
            query += ' AND e.creator_id = ?';
            params.push(userId);
        } else {
            query += ' AND e.is_public = TRUE';
            if (campus && campus !== 'all') {
                query += ' AND e.campus = ?';
                params.push(campus);
            }
        }

        const [events] = await pool.query(query + ' ORDER BY e.start_time ASC', params);
        res.render('events', { title: 'Campus Events', initialEvents: events, currentUser: req.user, activeFilter: filter || 'all' });
    } catch (error) {
        console.error('Render Events Error:', error);
        res.render('events', { title: 'Campus Events', initialEvents: [], currentUser: req.user, activeFilter: 'all' });
    }
};

const renderEventsAdmin = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;

        // Fetch events created by this user
        const [events] = await pool.query(`
            SELECT e.*,
            (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.event_id AND status IN ('pending', 'accepted')) as total_reservations,
            (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.event_id AND status = 'attended') as total_attended
            FROM campus_events e 
            WHERE e.creator_id = ?
            ORDER BY e.start_time DESC
        `, [userId]);

        res.render('events-admin', { title: 'Manage My Events', initialEvents: events });
    } catch (error) {
        console.error('Events Admin Render Error:', error);
        res.redirect('/events');
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
        const affiliation = req.query.affiliation || req.query.campus;
        let query = 'SELECT p.*, u.username, u.name as creator_name FROM polls p JOIN users u ON p.creator_id = u.user_id WHERE (p.expires_at IS NULL OR p.expires_at > NOW())';
        const params = [];
        if (affiliation && affiliation !== 'all') {
            query += ' AND p.campus = ?';
            params.push(affiliation);
        }
        const [polls] = await pool.query(query + ' ORDER BY p.created_at DESC', params);
        res.json(polls);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getEvents = async (req, res) => {
    try {
        const affiliation = req.query.affiliation || req.query.campus;
        let query = 'SELECT e.*, u.username FROM campus_events e JOIN users u ON e.creator_id = u.user_id WHERE e.is_public = TRUE';
        const params = [];
        if (affiliation && affiliation !== 'all') {
            query += ' AND e.campus = ?';
            params.push(affiliation);
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
        return '/uploads/defaults/no-image.png';
    }
    return url;
};

const getStreams = async (req, res) => {
    try {
        const affiliation = req.query.affiliation || req.query.campus;
        let query = 'SELECT s.*, u.username, u.avatar_url FROM live_streams s JOIN users u ON s.streamer_id = u.user_id WHERE s.status = "live"';
        const params = [];
        if (affiliation && affiliation !== 'all') {
            query += ' AND s.campus = ?';
            params.push(affiliation);
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
        const { title, description, event_type, location, campus, start_time, end_time, is_public, max_attendees, requirements } = req.body;
        const creator_id = req.user.user_id || req.user.userId;
        const event_id = require('crypto').randomUUID();

        await pool.query(
            'INSERT INTO campus_events (event_id, creator_id, title, description, event_type, location, campus, start_time, end_time, is_public, max_attendees, requirements) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [event_id, creator_id, title, description, event_type, location, campus, start_time, end_time, is_public ? 1 : 0, max_attendees || 0, requirements || '']
        );

        res.status(201).json({ message: 'Event created', event_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const rsvpEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // status: 'pending' or 'not_going'
        const user_id = req.user.user_id || req.user.userId;
        const rsvp_id = require('crypto').randomUUID();

        // Check if event is full before reserving if max_attendees > 0
        if (status === 'pending') {
            const [events] = await pool.query('SELECT total_rsvps, max_attendees FROM campus_events WHERE event_id = ?', [id]);
            if (events.length > 0 && events[0].max_attendees > 0 && events[0].total_rsvps >= events[0].max_attendees) {
                return res.status(400).json({ error: 'Event is fully booked' });
            }
        }

        if (status === 'not_going') {
            await pool.query('DELETE FROM event_rsvps WHERE user_id = ? AND event_id = ?', [user_id, id]);
        } else {
            // New RSVPs start as 'pending'
            await pool.query(
                'INSERT INTO event_rsvps (rsvp_id, event_id, user_id, event_type, status) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)',
                [rsvp_id, id, user_id, 'campus_event', status]
            );
        }

        // Update total_rsvps cache on the event (Only counting accepted/confirmed if necessary, but here we count all 'pending' + 'accepted')
        await pool.query(`
            UPDATE campus_events 
            SET total_rsvps = (SELECT COUNT(*) FROM event_rsvps WHERE event_id = ? AND status IN ('pending', 'accepted', 'going'))
            WHERE event_id = ?
        `, [id, id]);

        // Real-time Live Update broadcast
        try {
            const io = getIO();
            io.emit('event_updated', { eventId: id });
        } catch(ioErr) {}

        res.json({ message: 'RSVP updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const approveRSVP = async (req, res) => {
    try {
        const { eventId, userId, status } = req.body; // status: 'accepted' or 'rejected'
        const currentUserId = req.user.user_id || req.user.userId;

        const [event] = await pool.query('SELECT creator_id FROM campus_events WHERE event_id = ?', [eventId]);
        if (event.length === 0) return res.status(404).json({ error: 'Event not found' });
        if (event[0].creator_id !== currentUserId) return res.status(403).json({ error: 'Only event creator can approve RSVPs' });

        await pool.query('UPDATE event_rsvps SET status = ? WHERE event_id = ? AND user_id = ?', [status, eventId, userId]);

        // Notify user via Socket
        try {
            const io = getIO();
            io.to(`user:${userId}`).emit('event_rsvp_status', { eventId, status });
            io.emit('event_updated', { eventId }); // Update live stats for everyone
        } catch (e) {}

        res.json({ status: 'success', message: `RSVP ${status}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const generateEventQR = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const eventId = req.params.id;

        const data = JSON.stringify({ userId, eventId });
        const qr = await QRCode.toDataURL(data);
        
        // Return a simple HTML view or JSON with QR base64
        res.json({ status: 'success', qr });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

const checkInEvent = async (req, res) => {
    try {
        const { userId, eventId } = req.body;
        const currentUserId = req.user.user_id || req.user.userId;
        const userRole = req.user.user_role || req.user.userType;

        // Verify that the person checking in is an admin or the event creator
        const [event] = await pool.query('SELECT creator_id FROM campus_events WHERE event_id = ?', [eventId]);
        if (event.length === 0) return res.status(404).json({ error: 'Event not found' });

        if (userRole !== 'admin' && event[0].creator_id !== currentUserId) {
            return res.status(403).json({ error: 'Unauthorized to check-in attendees' });
        }

        // ONLY ACCEPTED users can attend
        const [rsvp] = await pool.query("SELECT status FROM event_rsvps WHERE user_id=? AND event_id=?", [userId, eventId]);
        if (rsvp.length === 0 || rsvp[0].status !== 'accepted') {
            return res.status(400).json({ error: 'Access denied: Entry only for accepted RSVPs' });
        }

        const [result] = await pool.query(
            "UPDATE event_rsvps SET status='attended' WHERE user_id=? AND event_id=?",
            [userId, eventId]
        );

        // Send real-time check-in notification to the dashboard
        try {
            const io = getIO();
            io.emit('event_update', { eventId, type: 'checkin', userId });
        } catch (e) {}

        res.json({ status: 'success', message: 'Check-in successful' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id || req.user.userId;
        const userRole = req.user.user_role || req.user.userType;

        const [event] = await pool.query('SELECT creator_id FROM campus_events WHERE event_id = ?', [id]);
        if (event.length === 0) return res.status(404).json({ error: 'Event not found' });

        if (userRole !== 'admin' && event[0].creator_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized to delete this event' });
        }

        await pool.query('DELETE FROM campus_events WHERE event_id = ?', [id]);
        res.json({ status: 'success', message: 'Event deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateEventStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_public } = req.body;
        const userId = req.user.user_id || req.user.userId;
        const userRole = req.user.user_role || req.user.userType;

        const [event] = await pool.query('SELECT creator_id FROM campus_events WHERE event_id = ?', [id]);
        if (event.length === 0) return res.status(404).json({ error: 'Event not found' });

        if (userRole !== 'admin' && event[0].creator_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized to update this event' });
        }

        await pool.query('UPDATE campus_events SET is_public = ? WHERE event_id = ?', [is_public ? 1 : 0, id]);
        res.json({ status: 'success', message: 'Event status updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
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

// Create a live (text) stream
const createStream = async (req, res) => {
    try {
        const { title, description, campus, category } = req.body;
        const streamerId = req.user.user_id || req.user.userId;
        const stream_id = require('crypto').randomUUID();

        await pool.query(
            'INSERT INTO live_streams (stream_id, streamer_id, title, description, campus, category, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [stream_id, streamerId, title, description || null, campus || req.user.campus, category || null, 'live']
        );

        res.status(201).json({ message: 'Stream created', stream_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Post an update to a live stream
const postStreamUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const streamerId = req.user.user_id || req.user.userId;
        const update_id = require('crypto').randomUUID();

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Verify ownership
        const [streams] = await pool.query('SELECT * FROM live_streams WHERE stream_id = ? AND streamer_id = ?', [id, streamerId]);
        if (streams.length === 0) return res.status(403).json({ error: 'Not your stream' });

        await pool.query(
            'INSERT INTO stream_updates (update_id, stream_id, content, created_at) VALUES (?, ?, ?, NOW())',
            [update_id, id, content.trim()]
        );

        res.status(201).json({ message: 'Update posted', update_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Follow a stream (get updates)
const followStream = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id || req.user.userId;
        const follow_id = require('crypto').randomUUID();

        await pool.query(
            'INSERT INTO stream_followers (follow_id, stream_id, user_id, followed_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE followed_at = NOW()',
            [follow_id, id, userId]
        );

        res.json({ message: 'Stream followed. You will receive updates.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getEventAttendees = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id || req.user.userId;

        // Security Check: Only creator can see full attendee details for management
        const [event] = await pool.query('SELECT creator_id FROM campus_events WHERE event_id = ?', [id]);
        if (event.length === 0) return res.status(404).json({ error: 'Event not found' });
        
        // If not creator, return basic list (or restrict depending on privacy needs)
        // For now, let's allow public view of names but restrict admin actions
        
        const [attendees] = await pool.query(
            `SELECT r.user_id, r.status, u.name, u.username, u.avatar_url
             FROM event_rsvps r
             JOIN users u ON r.user_id = u.user_id
             WHERE r.event_id = ?
             ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, u.username ASC`,
            [id]
        );
        res.json(attendees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Share a poll — returns a shareable link
const sharePoll = async (req, res) => {
    try {
        const { id } = req.params;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.json({ status: 'success', data: { share_url: `${baseUrl}/polls/${id}` } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Share an event — returns a shareable link
const shareEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.json({ status: 'success', data: { share_url: `${baseUrl}/events/${id}` } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const endStream = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user.user_id;
        await pool.query('DELETE FROM streams WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ success: true, message: 'Stream ended' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to end stream' });
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
    getPollResults,
    createStream,
    postStreamUpdate,
    followStream,
    getEventAttendees,
    sharePoll,
    shareEvent,
    endStream,
    generateEventQR,
    checkInEvent,
    renderEventsAdmin,
    deleteEvent,
    updateEventStatus,
    approveRSVP
};
