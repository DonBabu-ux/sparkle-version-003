// socket/streamSignaling.js — WebRTC signaling for live video streams
const logger = require('../utils/logger');
const pool = require('../config/database');

// streamId -> Set of socket.ids of viewers
const streamViewers = new Map();
// socket.id -> streamId
const socketStream = new Map();

const handleStreamEvents = (io, socket) => {
    const userId = String(socket.userId || '');

    // Broadcaster announces they are live and ready for viewers
    socket.on('stream:broadcaster-join', async ({ streamId }) => {
        if (!streamId) return;
        socket.join(`stream:${streamId}`);
        socket.join(`stream:${streamId}:broadcaster`);
        socketStream.set(socket.id, streamId);
        logger.info(`[LiveStream] Broadcaster joined room stream:${streamId} (user: ${userId})`);
    });

    // Viewer requests to join a live stream
    socket.on('stream:viewer-join', async ({ streamId }) => {
        if (!streamId) return;
        socket.join(`stream:${streamId}`);
        socketStream.set(socket.id, streamId);

        if (!streamViewers.has(streamId)) {
            streamViewers.set(streamId, new Set());
        }
        streamViewers.get(streamId).add(socket.id);

        const currentViewerCount = streamViewers.get(streamId).size;

        // Notify broadcaster that a new viewer joined, so broadcaster can initiate WebRTC offer
        io.to(`stream:${streamId}:broadcaster`).emit('stream:viewer-joined', {
            viewerSocketId: socket.id,
            viewerUserId: userId,
            streamId,
            viewerCount: currentViewerCount,
        });

        // Broadcast updated viewer count to all viewers in stream
        io.to(`stream:${streamId}`).emit('stream:viewer-count', {
            streamId,
            viewerCount: currentViewerCount,
        });

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
        streamViewers.delete(streamId);
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

