// routes/socket/callSignaling.js — 1:1 WebRTC call signaling relay.
//
// The server only relays SDP/ICE between the two peers; media never touches
// the backend (DTLS-SRTP end-to-end). A per-user busy map prevents concurrent
// calls; every terminal path (reject/end/disconnect) releases both slots.

const logger = require('../utils/logger');
const NotificationService = require('../services/notification.service');

// callId -> { callerId, calleeId, mode }
const activeCalls = new Map();
// userId (string) -> callId
const userCall = new Map();

const MAX_SDP_BYTES = 128 * 1024;
const MIN_INVITE_INTERVAL_MS = 1500;

const releaseCall = (callId) => {
    const call = activeCalls.get(callId);
    if (!call) return null;
    activeCalls.delete(callId);
    if (userCall.get(String(call.callerId)) === callId) userCall.delete(String(call.callerId));
    if (userCall.get(String(call.calleeId)) === callId) userCall.delete(String(call.calleeId));
    return call;
};

const isValidId = (v) => (typeof v === 'string' || typeof v === 'number') && String(v).length > 0 && String(v).length <= 64;

const handleCallEvents = (io, socket) => {
    const uid = String(socket.userId);

    socket.on('call:invite', async (data) => {
        try {
            const { callId, targetId, mode, sdp, callerName, callerAvatar } = data || {};
            if (!isValidId(callId) || !isValidId(targetId) || !sdp) return;
            if (typeof sdp !== 'object' || JSON.stringify(sdp).length > MAX_SDP_BYTES) return;

            // Basic spam guard: one invite per 1.5s per socket.
            const now = Date.now();
            if (socket._lastCallInviteAt && now - socket._lastCallInviteAt < MIN_INVITE_INTERVAL_MS) return;
            socket._lastCallInviteAt = now;

            const target = String(targetId);
            if (target === uid) return;

            if (userCall.has(uid) || userCall.has(target)) {
                socket.emit('call:busy', { callId, targetId: target });
                return;
            }

            userCall.set(uid, callId);
            userCall.set(target, callId);
            activeCalls.set(callId, {
                callerId: uid,
                calleeId: target,
                mode: mode === 'video' ? 'video' : 'voice',
            });

            io.to(`user:${target}`).emit('call:invite', {
                callId,
                callerId: uid,
                mode: mode === 'video' ? 'video' : 'voice',
                sdp,
                callerName: callerName || socket.user?.username || 'Incoming call',
                callerAvatar: callerAvatar || null,
            });

            // FCM fallback so the callee rings when the app is backgrounded
            // (the socket event only reaches a live connection).
            try {
                await NotificationService.send({
                    type: 'call',
                    priority: 'HIGH',
                    recipients: [target],
                    data: {
                        title: `${callerName || socket.user?.username || 'Someone'} is calling`,
                        content: mode === 'video' ? 'Incoming video call' : 'Incoming voice call',
                        url: '/messages',
                    },
                });
            } catch (pushErr) {
                logger.warn(`Call push notify failed: ${pushErr.message}`);
            }
        } catch (err) {
            logger.error(`call:invite error: ${err.message}`);
        }
    });

    socket.on('call:accept', (data) => {
        try {
            const { callId, targetId, sdp } = data || {};
            if (!isValidId(callId) || !sdp) return;
            const call = activeCalls.get(callId);
            if (!call || String(call.calleeId) !== uid) return;
            io.to(`user:${String(targetId)}`).emit('call:accept', { callId, calleeId: uid, sdp });
        } catch (err) {
            logger.error(`call:accept error: ${err.message}`);
        }
    });

    socket.on('call:ice', (data) => {
        try {
            const { callId, targetId, candidate } = data || {};
            if (!isValidId(callId) || !isValidId(targetId)) return;
            const call = activeCalls.get(callId);
            if (!call) return;
            io.to(`user:${String(targetId)}`).emit('call:ice', { callId, candidate });
        } catch (err) {
            logger.error(`call:ice error: ${err.message}`);
        }
    });

    socket.on('call:reject', (data) => {
        try {
            const { callId, targetId } = data || {};
            if (!isValidId(callId) || !isValidId(targetId)) return;
            const call = activeCalls.get(callId);
            if (!call) return;
            io.to(`user:${String(targetId)}`).emit('call:reject', { callId, reason: 'declined' });
            releaseCall(callId);
        } catch (err) {
            logger.error(`call:reject error: ${err.message}`);
        }
    });

    socket.on('call:end', (data) => {
        try {
            const { callId, targetId } = data || {};
            if (!isValidId(callId) || !isValidId(targetId)) return;
            io.to(`user:${String(targetId)}`).emit('call:end', { callId });
            releaseCall(callId);
        } catch (err) {
            logger.error(`call:end error: ${err.message}`);
        }
    });

    socket.on('disconnect', () => {
        try {
            const callId = userCall.get(uid);
            if (!callId) return;
            const call = releaseCall(callId);
            if (call) {
                const peer = String(call.callerId) === uid ? String(call.calleeId) : String(call.callerId);
                io.to(`user:${peer}`).emit('call:end', { callId, reason: 'peer-disconnected' });
                logger.info(`📞 Call ${callId} released on disconnect of ${uid}`);
            }
        } catch (err) {
            logger.error(`call disconnect cleanup error: ${err.message}`);
        }
    });
};

module.exports = { handleCallEvents };
