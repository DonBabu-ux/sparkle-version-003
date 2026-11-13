// socket/streamSignaling.js — WebRTC signaling, real-time comments, guests & interactions for Sparkle Live
const logger = require('../utils/logger');
const pool = require('../config/database');

// streamId -> Set of socket.ids of viewers
const streamViewers = new Map();
// socket.id -> streamId
const socketStream = new Map();
// streamId -> { likesCount: number, pinnedComment: any, guestSockets: Set<string> }
const streamState = new Map();

const getOrCreateStreamState = (streamId) => {
    if (!streamState.has(streamId)) {
        streamState.set(streamId, {
            likesCount: 0,
            pinnedComment: null,
            guestSockets: new Set(),
            moderatorUserIds: new Set()
        });
    }
    return streamState.get(streamId);
};

const handleStreamEvents = (io, socket) => {
    const userId = String(socket.userId || '');

    // Broadcaster announces they are live and ready for viewers
    socket.on('stream:broadcaster-join', async ({ streamId, streamerInfo }) => {
        if (!streamId) return;
        socket.join(`stream:${streamId}`);
        socket.join(`stream:${streamId}:broadcaster`);
        socketStream.set(socket.id, streamId);
        getOrCreateStreamState(streamId);

        logger.info(`[LiveStream] Broadcaster joined room stream:${streamId} (user: ${userId})`);

        // Emit global event across entire app so avatars can light up with LIVE badge in real-time
        io.emit('global:stream-started', {
            streamId,
            streamerId: userId,
            title: streamerInfo?.title || 'Live Stream',
            avatar_url: streamerInfo?.avatar_url || null,
            username: streamerInfo?.username || null
        });
    });

    // Viewer requests to join a live stream
    socket.on('stream:viewer-join', async ({ streamId, userInfo }) => {
        if (!streamId) return;
        socket.join(`stream:${streamId}`);
        socketStream.set(socket.id, streamId);

        if (!streamViewers.has(streamId)) {
            streamViewers.set(streamId, new Set());
        }
        streamViewers.get(streamId).add(socket.id);

        const currentViewerCount = streamViewers.get(streamId).size;
        const state = getOrCreateStreamState(streamId);

        // Notify broadcaster that a new viewer joined, so broadcaster can initiate WebRTC offer
        io.to(`stream:${streamId}:broadcaster`).emit('stream:viewer-joined', {
            viewerSocketId: socket.id,
            viewerUserId: userId,
            userInfo: userInfo || null,
            streamId,
            viewerCount: currentViewerCount,
        });

        // Broadcast updated viewer count to all viewers in stream
        io.to(`stream:${streamId}`).emit('stream:viewer-count', {
            streamId,
            viewerCount: currentViewerCount,
        });

        // Send current stream state (pinned comment, likes) to newly joined viewer
        socket.emit('stream:initial-state', {
            streamId,
            viewerCount: currentViewerCount,
            likesCount: state.likesCount,
            pinnedComment: state.pinnedComment
        });

        // Emit a friendly system message inside the stream room
        if (userInfo?.username) {
            io.to(`stream:${streamId}`).emit('stream:system-event', {
                type: 'user_joined',
                username: userInfo.username,
                name: userInfo.name || userInfo.username,
                userId: userId,
                timestamp: Date.now()
            });
        }

        // Update viewer count in DB
        try {
            await pool.query('UPDATE live_streams SET viewer_count = ? WHERE stream_id = ?', [currentViewerCount, streamId]);
        } catch (e) {
            logger.warn(`Failed to update viewer count for ${streamId}:`, e.message);
        }
    });

    // Broadcaster sends WebRTC SDP offer to a specific viewer
    socket.on('stream:offer', ({ streamId, viewerSocketId, sdp }) => {
        if (!streamId || !viewerSocketId || !sdp) return;
        io.to(viewerSocketId).emit('stream:offer', {
            streamId,
            broadcasterSocketId: socket.id,
            sdp,
        });
    });

    // Viewer sends WebRTC SDP answer back to broadcaster
    socket.on('stream:answer', ({ streamId, broadcasterSocketId, sdp }) => {
        if (!streamId || !broadcasterSocketId || !sdp) return;
        io.to(broadcasterSocketId).emit('stream:answer', {
            streamId,
            viewerSocketId: socket.id,
            sdp,
        });
    });

    // Relaying ICE candidate between broadcaster and viewer
    socket.on('stream:ice-candidate', ({ targetSocketId, candidate }) => {
        if (!targetSocketId || !candidate) return;
        io.to(targetSocketId).emit('stream:ice-candidate', {
            fromSocketId: socket.id,
            candidate,
        });
    });

    // ── LIVE COMMENTS ──────────────────────────────────────────────────────────
    socket.on('stream:comment', async (data) => {
        try {
            const { streamId, content, user } = data || {};
            if (!streamId || !content || !content.trim()) return;

            // Check if user is muted in this stream
            try {
                const [mutes] = await pool.query(
                    'SELECT 1 FROM live_stream_mutes WHERE stream_id = ? AND user_id = ? AND muted_until > NOW()',
                    [streamId, userId]
                );
                if (mutes.length > 0) {
                    socket.emit('stream:error', { message: 'You have been muted in this stream.' });
                    return;
                }
            } catch (err) {
                logger.warn(`Mute check failed: ${err.message}`);
            }

            const commentId = String(Date.now() + Math.random().toString(36).slice(2, 7));
            const commentPayload = {
                id: commentId,
                streamId,
                userId,
                username: user?.username || 'User',
                name: user?.name || user?.username || 'User',
                avatar_url: user?.avatar_url || null,
                content: content.trim(),
                isHost: user?.isHost || false,
                isGuest: user?.isGuest || false,
                isModerator: user?.isModerator || false,
                timestamp: Date.now()
            };

            // Broadcast comment to everyone in stream
            io.to(`stream:${streamId}`).emit('stream:comment', commentPayload);

            // Persist to DB asynchronously
            try {
                await pool.query(
                    'INSERT INTO live_stream_comments (stream_id, user_id, content) VALUES (?, ?, ?)',
                    [streamId, userId, content.trim()]
                );
            } catch (dbErr) {
                logger.warn(`Failed to persist live stream comment: ${dbErr.message}`);
            }
        } catch (e) {
            logger.error(`stream:comment error: ${e.message}`);
        }
    });

    socket.on('stream:delete-comment', ({ streamId, commentId }) => {
        if (!streamId || !commentId) return;
        io.to(`stream:${streamId}`).emit('stream:comment-deleted', { commentId });
    });

    socket.on('stream:pin-comment', ({ streamId, comment }) => {
        if (!streamId || !comment) return;
        const state = getOrCreateStreamState(streamId);
        state.pinnedComment = comment;
        io.to(`stream:${streamId}`).emit('stream:comment-pinned', { comment });
    });

    socket.on('stream:unpin-comment', ({ streamId }) => {
        if (!streamId) return;
        const state = getOrCreateStreamState(streamId);
        state.pinnedComment = null;
        io.to(`stream:${streamId}`).emit('stream:comment-unpinned', {});
    });

    // ── LIKES & FLOATING HEARTS ────────────────────────────────────────────────
    socket.on('stream:like', ({ streamId, count }) => {
        if (!streamId) return;
        const state = getOrCreateStreamState(streamId);
        const increment = typeof count === 'number' && count > 0 ? Math.min(count, 50) : 1;
        state.likesCount += increment;

        io.to(`stream:${streamId}`).emit('stream:like', {
            likesCount: state.likesCount,
            userId,
            increment
        });
    });

    // ── GIFTS ──────────────────────────────────────────────────────────────────
    socket.on('stream:gift', (giftData) => {
        const { streamId, giftName, coins, sender, icon } = giftData || {};
        if (!streamId || !giftName) return;

        io.to(`stream:${streamId}`).emit('stream:gift-received', {
            streamId,
            giftName,
            coins: coins || 0,
            icon: icon || '🎁',
            sender: {
                userId,
                username: sender?.username || 'User',
                name: sender?.name || 'User',
                avatar_url: sender?.avatar_url || null
            },
            timestamp: Date.now()
        });
    });

    // ── MULTI-GUEST & CO-HOSTING ───────────────────────────────────────────────
    socket.on('stream:guest-request', ({ streamId, user }) => {
        if (!streamId) return;
        // Notify broadcaster only
        io.to(`stream:${streamId}:broadcaster`).emit('stream:guest-request', {
            guestSocketId: socket.id,
            guestUserId: userId,
            user: user || { username: 'Viewer' }
        });
    });

    socket.on('stream:guest-accept', ({ streamId, guestSocketId, guestUserId }) => {
        if (!streamId || !guestSocketId) return;
        const state = getOrCreateStreamState(streamId);
        state.guestSockets.add(guestSocketId);

        // Notify the specific guest that their request was accepted
        io.to(guestSocketId).emit('stream:guest-accepted', {
            streamId,
            broadcasterSocketId: socket.id
        });

        // Announce to stream that a guest has joined
        io.to(`stream:${streamId}`).emit('stream:guest-status-change', {
            guestUserId,
            status: 'active'
        });
    });

    socket.on('stream:guest-decline', ({ streamId, guestSocketId }) => {
        if (!streamId || !guestSocketId) return;
        io.to(guestSocketId).emit('stream:guest-declined', { streamId });
    });

    // Guest relay for multi-guest WebRTC exchange
    socket.on('stream:guest-offer', ({ targetSocketId, streamId, sdp }) => {
        if (!targetSocketId || !sdp) return;
        io.to(targetSocketId).emit('stream:guest-offer', {
            fromSocketId: socket.id,
            fromUserId: userId,
            streamId,
            sdp
        });
    });

    socket.on('stream:guest-answer', ({ targetSocketId, streamId, sdp }) => {
        if (!targetSocketId || !sdp) return;
        io.to(targetSocketId).emit('stream:guest-answer', {
            fromSocketId: socket.id,
            streamId,
            sdp
        });
    });

    socket.on('stream:guest-ice', ({ targetSocketId, candidate }) => {
        if (!targetSocketId || !candidate) return;
        io.to(targetSocketId).emit('stream:guest-ice', {
            fromSocketId: socket.id,
            candidate
        });
    });

    socket.on('stream:guest-leave', ({ streamId }) => {
        if (!streamId) return;
        const state = getOrCreateStreamState(streamId);
        state.guestSockets.delete(socket.id);

        io.to(`stream:${streamId}`).emit('stream:guest-left', {
            guestSocketId: socket.id,
            guestUserId: userId
        });
    });

    socket.on('stream:guest-remove', ({ streamId, guestSocketId, guestUserId }) => {
        if (!streamId || !guestSocketId) return;
        const state = getOrCreateStreamState(streamId);
        state.guestSockets.delete(guestSocketId);

        io.to(guestSocketId).emit('stream:guest-removed', { streamId });
        io.to(`stream:${streamId}`).emit('stream:guest-left', {
            guestSocketId,
            guestUserId
        });
    });

    // ── MODERATION ─────────────────────────────────────────────────────────────
    socket.on('stream:mute-user', async ({ streamId, targetUserId, durationMinutes }) => {
        if (!streamId || !targetUserId) return;
        const mins = durationMinutes || 15;
        try {
            await pool.query(
                `INSERT INTO live_stream_mutes (stream_id, user_id, muted_until, muted_by)
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)
                 ON DUPLICATE KEY UPDATE muted_until = DATE_ADD(NOW(), INTERVAL ? MINUTE), muted_by = ?`,
                [streamId, targetUserId, mins, userId, mins, userId]
            );
        } catch (e) {
            logger.warn(`DB live stream mute failed: ${e.message}`);
        }
        io.to(`stream:${streamId}`).emit('stream:user-muted', { targetUserId, durationMinutes: mins });
    });

    // Viewer leaves stream
    const handleViewerLeave = async (streamId, socketId) => {
        if (!streamId) return;
        socket.leave(`stream:${streamId}`);
        socketStream.delete(socketId);

        if (streamViewers.has(streamId)) {
            const viewers = streamViewers.get(streamId);
            viewers.delete(socketId);
            const count = viewers.size;

            io.to(`stream:${streamId}:broadcaster`).emit('stream:viewer-left', {
                viewerSocketId: socketId,
                streamId,
                viewerCount: count,
            });

            io.to(`stream:${streamId}`).emit('stream:viewer-count', {
                streamId,
                viewerCount: count,
            });

            try {
                await pool.query('UPDATE live_streams SET viewer_count = ? WHERE stream_id = ?', [count, streamId]);
            } catch (e) {
                logger.warn(`Failed to update viewer count on leave:`, e.message);
            }
        }
    };

    socket.on('stream:viewer-leave', async ({ streamId }) => {
        await handleViewerLeave(streamId, socket.id);
    });

    // Broadcaster explicitly ends stream
    socket.on('stream:end', async ({ streamId }) => {
        if (!streamId) return;
        io.to(`stream:${streamId}`).emit('stream:ended', { streamId });
        io.emit('global:stream-ended', { streamId, streamerId: userId });

        streamViewers.delete(streamId);
        streamState.delete(streamId);
        socketStream.delete(socket.id);

        try {
            await pool.query('UPDATE live_streams SET status = "ended", ended_at = NOW(), viewer_count = 0 WHERE stream_id = ?', [streamId]);
        } catch (e) {
            logger.warn(`Failed to mark stream ended in DB:`, e.message);
        }
    });

    // Cleanup on disconnect
    socket.on('disconnect', async () => {
        const streamId = socketStream.get(socket.id);
        if (streamId) {
            await handleViewerLeave(streamId, socket.id);
        }
    });
};

module.exports = { handleStreamEvents };


