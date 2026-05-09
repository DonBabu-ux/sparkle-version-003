const pool = require('../config/database');
const QRCode = require('qrcode');
const { getIO } = require('../socket');
const PollEngagementService = require('../services/poll-engagement.service');
const { v4: uuidv4 } = require('uuid');

const getSafeAvatarUrl = (url) => {
    if (!url) return '/uploads/avatars/default.png';
    if (url.startsWith('http')) return url;
    return url.startsWith('/') ? url : `/${url}`;
};

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
        const currentUserId = req.user?.user_id || req.user?.userId || null;
        const filter = req.query.filter || 'for_you'; // 'for_you', 'trending', 'friends', 'new'
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = parseInt(req.query.offset) || 0;
        
        let query = `
            SELECT p.*, u.username, u.name as creator_name, u.avatar_url as creator_avatar,
                   (p.expires_at IS NOT NULL AND p.expires_at < NOW()) as is_expired,
                   (p.expires_at IS NOT NULL AND p.expires_at > NOW() AND p.expires_at < DATE_ADD(NOW(), INTERVAL 6 HOUR)) as is_ending_soon,
                   (SELECT option_id FROM poll_votes WHERE poll_id = p.poll_id AND user_id = ?) as user_voted_option
            FROM polls p 
            JOIN users u ON p.creator_id = u.user_id 
            WHERE 1=1
        `;
        
        const params = [currentUserId];
        if (affiliation && affiliation !== 'all') {
            query += ' AND p.campus = ?';
            params.push(affiliation);
        }

        if (filter === 'friends' && currentUserId) {
            query += ' AND p.creator_id IN (SELECT following_id FROM follows WHERE follower_id = ?)';
            params.push(currentUserId);
            query += ' ORDER BY p.created_at DESC';
        } else if (filter === 'trending') {
            // Trending: Primary sort by score, secondary by recent
            query += ' ORDER BY p.engagement_score DESC, p.created_at DESC';
        } else if (filter === 'ending_soon') {
            query += ' AND p.expires_at > NOW()';
            query += ' ORDER BY p.expires_at ASC';
        } else if (filter === 'for_you') {
            query += ' AND (p.expires_at IS NULL OR p.expires_at > NOW())';
            query += ' ORDER BY p.engagement_score DESC, p.created_at DESC';
            // Large candidate pool for personalization
            const candidateLimit = offset === 0 ? 100 : 50; 
            query += ` LIMIT ${candidateLimit} OFFSET ${offset}`;
        } else {
            // 'new' / recent
            query += ' ORDER BY p.created_at DESC';
        }

        // Apply SQL limit if not for_you (for_you has custom limit above)
        if (filter !== 'for_you') {
            query += ` LIMIT ${limit} OFFSET ${offset}`;
        }

        const [polls] = await pool.query(query, params);
        
        // 1. Calculate AI-Ranked Personalized Scores (Only for For You)
        let rankedPolls = polls;
        if (filter === 'for_you') {
            rankedPolls = await PollEngagementService.calculateBatchDiscoveryScores(polls, currentUserId);
            // Sort by personalized discovery score
            rankedPolls.sort((a, b) => (b.discovery_score || 0) - (a.discovery_score || 0));
            // Slice to requested limit
            rankedPolls = rankedPolls.slice(0, limit);
        }

        // 2. Batch Fetch Social Context (Friends who voted) - ONLY for the results being returned
        if (currentUserId && rankedPolls.length > 0) {
            const pollIds = rankedPolls.map(p => p.poll_id);
            const [friendsVoted] = await pool.query(`
                SELECT v.poll_id, u.avatar_url, u.username 
                FROM poll_votes v
                JOIN users u ON v.user_id = u.user_id
                JOIN follows f ON f.following_id = u.user_id
                WHERE v.poll_id IN (?) AND f.follower_id = ?
            `, [pollIds, currentUserId]);

            // Group by poll_id
            const friendsMap = friendsVoted.reduce((acc, f) => {
                if (!acc[f.poll_id]) acc[f.poll_id] = [];
                if (acc[f.poll_id].length < 3) {
                    acc[f.poll_id].push({ ...f, avatar_url: getSafeAvatarUrl(f.avatar_url) });
                }
                return acc;
            }, {});

            rankedPolls.forEach(poll => {
                poll.creator_avatar = getSafeAvatarUrl(poll.creator_avatar);
                poll.friends_participating = friendsMap[poll.poll_id] || [];
            });
        } else {
            rankedPolls.forEach(poll => {
                poll.creator_avatar = getSafeAvatarUrl(poll.creator_avatar);
                poll.friends_participating = [];
            });
        }

        res.json({ 
            polls: rankedPolls, 
            hasMore: filter === 'for_you' ? polls.length > limit : polls.length >= limit 
        });
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
        const { question, options, campus, category, is_anonymous, expires_in, allow_invites } = req.body;
        const creator_id = req.user.user_id || req.user.userId;

        // 1. ANTI-SPAM: Daily Limit (5 polls per day)
        const [dailyPolls] = await connection.query(`
            SELECT COUNT(*) as count FROM polls 
            WHERE creator_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
        `, [creator_id]);

        if (dailyPolls[0].count >= 5) {
            await connection.rollback();
            connection.release();
            return res.status(429).json({ error: 'Daily poll limit reached (5/day). Try again tomorrow!' });
        }

        const poll_id = uuidv4();

        // Handle Expiry Logic
        let expires_at = null;
        if (expires_in) {
            const now = new Date();
            if (expires_in === '30m') now.setMinutes(now.getMinutes() + 30);
            else if (expires_in === '1h') now.setHours(now.getHours() + 1);
            else if (expires_in === '6h') now.setHours(now.getHours() + 6);
            else if (expires_in === '12h') now.setHours(now.getHours() + 12);
            else if (expires_in === '24h') now.setHours(now.getHours() + 24);
            else if (expires_in === '3d') now.setDate(now.getDate() + 3);
            else if (expires_in === '7d') now.setDate(now.getDate() + 7);
            else expires_at = new Date(expires_in); // Custom date string
            
            if (!expires_at) expires_at = now;
        }

        await connection.query(
            'INSERT INTO polls (poll_id, creator_id, question, campus, category, is_anonymous, expires_at, allow_invites) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [poll_id, creator_id, question, campus || req.user.campus, category || 'General', is_anonymous ? 1 : 0, expires_at, allow_invites !== false ? 1 : 0]
        );

        if (options && Array.isArray(options)) {
            for (let i = 0; i < options.length; i++) {
                const option_id = uuidv4();
                await connection.query(
                    'INSERT INTO poll_options (option_id, poll_id, option_text, option_order) VALUES (?, ?, ?, ?)',
                    [option_id, poll_id, options[i], i]
                );
            }
        }

        await connection.commit();
        
        // Trigger Smart Notification Workflow
        PollEngagementService.processPollNotifications(poll_id, creator_id);

        res.status(201).json({ message: 'Poll created', poll_id });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

const votePoll = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { option_id } = req.body;
        const user_id = req.user.user_id || req.user.userId;
        const vote_id = uuidv4();

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Check Expiry & Participation Data
        const [pollCheck] = await connection.query('SELECT expires_at, total_votes FROM polls WHERE poll_id = ?', [id]);
        if (pollCheck.length === 0) return res.status(404).json({ error: 'Poll not found' });
        
        if (pollCheck[0].expires_at && new Date(pollCheck[0].expires_at) < new Date()) {
            return res.status(400).json({ error: 'This poll has ended and is no longer accepting votes.' });
        }

        // 2. Check if already voted
        const [existing] = await connection.query(
            'SELECT vote_id FROM poll_votes WHERE poll_id = ? AND user_id = ?',
            [id, user_id]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'You have already voted on this poll' });
        }

        // 3. Record vote
        await connection.query(
            'INSERT INTO poll_votes (vote_id, poll_id, option_id, user_id) VALUES (?, ?, ?, ?)',
            [vote_id, id, option_id, user_id]
        );

        await connection.query(
            'UPDATE poll_options SET vote_count = COALESCE(vote_count, 0) + 1 WHERE option_id = ?',
            [option_id]
        );

        await connection.query(
            'UPDATE polls SET total_votes = COALESCE(total_votes, 0) + 1 WHERE poll_id = ?',
            [id]
        );

        await connection.commit();
        
        // 4. Async Engagement Scoring & Interaction Tracking
        PollEngagementService.updateEngagementScore(id);
        const [poll] = await pool.query('SELECT category FROM polls WHERE poll_id = ?', [id]);
        if (poll.length > 0) {
            PollEngagementService.trackUserInteraction(user_id, poll[0].category);
        }

        // Increment Vote Streak if first vote of the day
        await pool.query(`
            UPDATE users 
            SET poll_vote_streak = poll_vote_streak + 1 
            WHERE user_id = ? AND NOT EXISTS (
                SELECT 1 FROM poll_votes 
                WHERE user_id = ? 
                AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
                AND poll_id != ?
            )
        `, [user_id, user_id, id]);

        // 5. Real-time Broadcast
        const io = getIO();
        if (io) {
            io.emit('poll_participation', { 
                poll_id: id, 
                option_id: option_id,
                total_votes: (pollCheck[0].total_votes || 0) + 1 
            });
        }

        res.json({ message: 'Vote submitted', success: true });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

const getPollResults = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user?.user_id || req.user?.userId || null;

        // Fetch the main poll data
        const [polls] = await pool.query(
            'SELECT p.*, u.username, u.name as creator_name, u.avatar_url as creator_avatar FROM polls p JOIN users u ON p.creator_id = u.user_id WHERE p.poll_id = ?',
            [id]
        );

        if (polls.length === 0) return res.status(404).json({ error: 'Poll not found' });
        const poll = polls[0];

        // Fetch options
        const [options] = await pool.query(
            'SELECT * FROM poll_options WHERE poll_id = ? ORDER BY vote_count DESC',
            [id]
        );

        // Fetch voters for all options
        const [voters] = await pool.query(`
            SELECT v.option_id, u.user_id, u.name, u.username, u.avatar_url,
                   (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.user_id) as is_following
            FROM poll_votes v
            JOIN users u ON v.user_id = u.user_id
            WHERE v.poll_id = ?
        `, [currentUserId, id]);

        // Group voters into options
        poll.options = options.map(opt => ({
            ...opt,
            voters: voters.filter(v => v.option_id === opt.option_id).map(v => ({
                ...v,
                avatar_url: getSafeAvatarUrl(v.avatar_url),
                is_following: !!v.is_following
            }))
        }));

        // Check if current user voted
        const [userVote] = await pool.query('SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?', [id, currentUserId]);
        poll.user_voted_option = userVote.length > 0 ? userVote[0].option_id : null;

        res.json({ poll });
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

const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id || req.user.userId;
        const { title, description, max_attendees, requirements } = req.body;

        const [event] = await pool.query('SELECT creator_id FROM campus_events WHERE event_id = ?', [id]);
        if (event.length === 0) return res.status(404).json({ error: 'Event not found' });
        if (event[0].creator_id !== userId) return res.status(403).json({ error: 'Unauthorized to edit this event' });

        const updates = [];
        const params = [];
        if (title) { updates.push('title = ?'); params.push(title); }
        if (description) { updates.push('description = ?'); params.push(description); }
        if (max_attendees) { updates.push('max_attendees = ?'); params.push(max_attendees); }
        if (requirements) { updates.push('requirements = ?'); params.push(requirements); }

        if (updates.length > 0) {
            params.push(id);
            await pool.query(`UPDATE campus_events SET ${updates.join(', ')} WHERE event_id = ?`, params);
        }

        res.json({ success: true, message: 'Event updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getEventAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id || req.user.userId;

        const [event] = await pool.query('SELECT creator_id FROM campus_events WHERE event_id = ?', [id]);
        if (event.length === 0) return res.status(404).json({ error: 'Event not found' });
        if (event[0].creator_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        const [[stats]] = await pool.query(
            `SELECT 
                COUNT(*) as total_rsvps,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) as checked_in_count
             FROM event_rsvps WHERE event_id = ?`,
            [id]
        );

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const notifyAttendees = async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const userId = req.user.user_id || req.user.userId;

        const [event] = await pool.query('SELECT creator_id, title FROM campus_events WHERE event_id = ?', [id]);
        if (event.length === 0) return res.status(404).json({ error: 'Event not found' });
        if (event[0].creator_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        res.json({ success: true, message: 'Announcement sent to all attendees' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const inviteToPoll = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_ids } = req.body; // Array of user IDs to invite
        const inviter_id = req.user.user_id || req.user.userId;

        if (!user_ids || !Array.isArray(user_ids)) {
            return res.status(400).json({ error: 'user_ids must be an array' });
        }

        const [poll] = await pool.query('SELECT question, allow_invites FROM polls WHERE poll_id = ?', [id]);
        if (poll.length === 0) return res.status(404).json({ error: 'Poll not found' });
        if (!poll[0].allow_invites) return res.status(403).json({ error: 'Invitations are disabled for this poll' });

        const [inviter] = await pool.query('SELECT name FROM users WHERE user_id = ?', [inviter_id]);
        const inviterName = inviter[0].name || 'Someone';

        for (const target_id of user_ids) {
            // Prevent duplicate invites
            const [existing] = await pool.query('SELECT invite_id FROM poll_invites WHERE poll_id = ? AND invitee_id = ?', [id, target_id]);
            if (existing.length > 0) continue;

            const invite_id = uuidv4();
            await pool.query(
                'INSERT INTO poll_invites (invite_id, poll_id, inviter_id, invitee_id) VALUES (?, ?, ?, ?)',
                [invite_id, id, inviter_id, target_id]
            );

            // Send notification
            await pool.query(`
                INSERT INTO notifications (notification_id, user_id, type, title, content, related_id, actor_id, action_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                target_id,
                'poll_invite',
                'Poll Invitation',
                `${inviterName} invited you to vote on: "${poll[0].question}"`,
                id,
                inviter_id,
                `/polls/${id}`
            ]);
        }

        res.json({ success: true, message: 'Invitations sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.predictPollWinner = async (req, res) => {
    const { id } = req.params;
    const { option_id } = req.body;
    const user_id = req.user.user_id;

    try {
        const [poll] = await pool.query('SELECT is_expired FROM polls WHERE poll_id = ?', [id]);
        if (poll.length === 0) return res.status(404).json({ message: 'Poll not found' });
        if (poll[0].is_expired) return res.status(400).json({ message: 'Poll has already ended' });

        const predictionId = uuidv4();
        await pool.query(`
            INSERT INTO poll_predictions (prediction_id, poll_id, user_id, option_id)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE option_id = VALUES(option_id)
        `, [predictionId, id, user_id, option_id]);

        res.json({ message: 'Prediction recorded' });
    } catch (err) {
        console.error('Prediction error:', err);
        res.status(500).json({ message: 'Error recording prediction' });
    }
};

exports.trackPollInteraction = async (req, res) => {
    const { id } = req.params;
    const { type } = req.body; // 'share', 'skip', 'save'
    const user_id = req.user.user_id;

    try {
        if (type === 'share') {
            await pool.query('UPDATE polls SET share_count = share_count + 1 WHERE poll_id = ?', [id]);
        }

        // Update behavioral interest
        const [poll] = await pool.query('SELECT category FROM polls WHERE poll_id = ?', [id]);
        if (poll.length > 0) {
            await pool.query(`
                INSERT INTO user_poll_interests (user_id, category, interaction_count)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE interaction_count = interaction_count + 1
            `, [user_id, poll[0].category]);
        }

        await pollEngagementService.updateEngagementScore(id);
        res.json({ message: 'Interaction tracked' });
    } catch (err) {
        console.error('Interaction tracking error:', err);
        res.status(500).json({ message: 'Error tracking interaction' });
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
    approveRSVP,
    updateEvent,
    getEventAnalytics,
    notifyAttendees,
    inviteToPoll,
    predictPollWinner: exports.predictPollWinner,
    trackPollInteraction: exports.trackPollInteraction
};
