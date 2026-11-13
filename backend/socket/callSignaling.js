// routes/socket/callSignaling.js — 1:1 WebRTC call signaling relay.
//
// The server only relays SDP/ICE between the two peers; media never touches
// the backend (DTLS-SRTP end-to-end). A per-user busy map prevents concurrent
// calls; every terminal path (reject/end/disconnect) releases both slots.
// Call sessions are persisted to call_sessions for history and analytics.

const logger = require('../utils/logger');
const NotificationService = require('../services/notification.service');
const pool = require('../config/database');

// callId -> { callerId, calleeId, mode, startedAt }
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

            // 1. Check user blocks (blocking privacy restriction)
            try {
                const [blocks] = await pool.query(
                    'SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
                    [target, uid, uid, target]
                );
                if (blocks.length > 0) {
                    socket.emit('call:unavailable', { callId, targetId: target, reason: 'blocked' });
                    return;
                }
            } catch (err) {
                logger.warn(`Block check failed: ${err.message}`);
            }

            // 2. Check callee call privacy settings (e.g. silence unknown callers)
            try {
                const [targetUser] = await pool.query(
                    'SELECT settings FROM users WHERE user_id = ?',
                    [target]
                );
                if (targetUser.length && targetUser[0].settings) {
                    let s = targetUser[0].settings;
                    if (typeof s === 'string') {
                        try { s = JSON.parse(s); } catch (_) {}
                    }
                    if (s.silence_unknown_callers) {
                        // Check if callee follows the caller
                        const [follows] = await pool.query(
                            'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
                            [target, uid]
                        );
                        if (follows.length === 0) {
                            socket.emit('call:unavailable', { callId, targetId: target, reason: 'silenced' });
                            return;
                        }
                    }
                }
            } catch (err) {
                logger.warn(`Privacy check failed: ${err.message}`);
            }

            // 3. Busy check
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
                startedAt: Date.now(),
            });

            // 4. Persist call session to database
            try {
                await pool.query(
                    `INSERT INTO call_sessions (call_id, caller_id, callee_id, mode, status)
                     VALUES (?, ?, ?, ?, 'ringing')
                     ON DUPLICATE KEY UPDATE status='ringing'`,
                    [String(callId), uid, target, mode === 'video' ? 'video' : 'voice']
                );
            } catch (dbErr) {
                logger.warn(`call_sessions insert failed: ${dbErr.message}`);
            }

            // 5. Emit real-time invite to callee
            io.to(`user:${target}`).emit('call:invite', {
                callId,
                callerId: uid,
                mode: mode === 'video' ? 'video' : 'voice',
                sdp,
                callerName: callerName || socket.user?.username || 'Incoming call',
                callerAvatar: callerAvatar || null,
            });

            // 6. FCM push notification fallback for backgrounded devices
            try {
                await NotificationService.send({
                    type: 'incoming_call',
                    priority: 'HIGH',
                    recipients: [target],
                    data: {
                        title: `${callerName || socket.user?.username || 'Someone'} is calling`,
                        content: mode === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call',
                        url: '/messages',
                        callId: String(callId),
                        callerId: uid,
                        callerName: callerName || socket.user?.username || 'Sparkle User',
                        callerAvatar: callerAvatar || '',
                        callMode: mode === 'video' ? 'video' : 'voice',
                        callType: mode === 'video' ? 'video' : 'voice',
                        expiresAt: String(Date.now() + 35000),
                    },
                });
            } catch (pushErr) {
                logger.warn(`Call push notify failed: ${pushErr.message}`);
            }
        } catch (err) {
            logger.error(`call:invite error: ${err.message}`);
        }
    });

    // Callee alerts caller that the incoming call is ringing on device
    socket.on('call:ringing', ({ callId, targetId }) => {
        if (!isValidId(callId) || !isValidId(targetId)) return;
        io.to(`user:${String(targetId)}`).emit('call:ringing', { callId });
    });

    // Callee accepts the call
    socket.on('call:accept', async (data) => {
        try {
            const { callId, targetId, sdp } = data || {};
            if (!isValidId(callId) || !sdp) return;
            const call = activeCalls.get(callId);
            if (!call || String(call.calleeId) !== uid) return;

            io.to(`user:${String(targetId)}`).emit('call:accept', { callId, calleeId: uid, sdp });

            // Persist accepted state
            try {
                await pool.query(
                    `UPDATE call_sessions SET status='accepted', answered_at=NOW() WHERE call_id=?`,
                    [String(callId)]
                );
            } catch (dbErr) {
                logger.warn(`call_sessions accept update failed: ${dbErr.message}`);
            }
        } catch (err) {
            logger.error(`call:accept error: ${err.message}`);
        }
    });

    // WebRTC ICE Candidate relay
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

    // Callee rejects call
    socket.on('call:reject', async (data) => {
        try {
            const { callId, targetId, reason } = data || {};
            if (!isValidId(callId) || !isValidId(targetId)) return;
            const call = activeCalls.get(callId);
            if (!call) return;
            io.to(`user:${String(targetId)}`).emit('call:reject', { callId, reason: reason || 'declined' });
            releaseCall(callId);

            // Persist rejected state
            try {
                await pool.query(
                    `UPDATE call_sessions SET status='rejected', ended_at=NOW(), end_reason=? WHERE call_id=?`,
                    [reason || 'declined', String(callId)]
                );
            } catch (dbErr) {
                logger.warn(`call_sessions reject update failed: ${dbErr.message}`);
            }
        } catch (err) {
            logger.error(`call:reject error: ${err.message}`);
        }
    });

    // Caller cancels call before callee answers
    socket.on('call:cancel', async (data) => {
        try {
            const { callId, targetId } = data || {};
            if (!isValidId(callId) || !isValidId(targetId)) return;
            const call = activeCalls.get(callId);
            if (!call) return;

            io.to(`user:${String(targetId)}`).emit('call:cancel', { callId });
            releaseCall(callId);

            try {
                await pool.query(
                    `UPDATE call_sessions SET status='cancelled', ended_at=NOW() WHERE call_id=?`,
                    [String(callId)]
                );
            } catch (dbErr) {
                logger.warn(`call_sessions cancel update failed: ${dbErr.message}`);
            }
        } catch (err) {
            logger.error(`call:cancel error: ${err.message}`);
        }
    });

    // Active call end / termination
    socket.on('call:end', async (data) => {
        try {
            const { callId, targetId } = data || {};
            if (!isValidId(callId) || !isValidId(targetId)) return;
            io.to(`user:${String(targetId)}`).emit('call:end', { callId });
            releaseCall(callId);

            // Persist ended state: if accepted/active → ended with duration;
            // if still ringing → missed (caller hung up before answer).
            try {
                await pool.query(
                    `UPDATE call_sessions
                     SET status='ended', ended_at=NOW(),
                         duration_seconds=TIMESTAMPDIFF(SECOND, answered_at, NOW())
                     WHERE call_id=? AND status IN ('accepted','active','connecting')`,
                    [String(callId)]
                );
                await pool.query(
                    `UPDATE call_sessions SET status='missed', ended_at=NOW()
                     WHERE call_id=? AND status='ringing'`,
                    [String(callId)]
                );
            } catch (dbErr) {
                logger.warn(`call_sessions end update failed: ${dbErr.message}`);
            }
        } catch (err) {
            logger.error(`call:end error: ${err.message}`);
        }
    });

    // Microphone mute sync
    socket.on('call:mute', ({ callId, targetId, isMuted }) => {
        if (!isValidId(callId) || !isValidId(targetId)) return;
        io.to(`user:${String(targetId)}`).emit('call:mute', { callId, isMuted: Boolean(isMuted) });
    });

    // Camera on/off sync
    socket.on('call:camera', ({ callId, targetId, isCameraOn }) => {
        if (!isValidId(callId) || !isValidId(targetId)) return;
        io.to(`user:${String(targetId)}`).emit('call:camera', { callId, isCameraOn: Boolean(isCameraOn) });
    });

    // Voice-to-Video upgrade request
    socket.on('call:upgrade-video', ({ callId, targetId }) => {
        if (!isValidId(callId) || !isValidId(targetId)) return;
        io.to(`user:${String(targetId)}`).emit('call:upgrade-video', { callId, requesterId: uid });
    });

    // Voice-to-Video upgrade response
    socket.on('call:upgrade-response', async ({ callId, targetId, accepted, sdp }) => {
        if (!isValidId(callId) || !isValidId(targetId)) return;
        io.to(`user:${String(targetId)}`).emit('call:upgrade-response', { callId, accepted: Boolean(accepted), sdp });
        if (accepted) {
            try {
                await pool.query(
                    `UPDATE call_sessions SET mode='video' WHERE call_id=?`,
                    [String(callId)]
                );
            } catch (_) {}
        }
    });

    // Disconnect cleanup
    socket.on('disconnect', async () => {
        try {
            const callId = userCall.get(uid);
            if (!callId) return;
            const call = releaseCall(callId);
            if (call) {
                const peer = String(call.callerId) === uid ? String(call.calleeId) : String(call.callerId);
                io.to(`user:${peer}`).emit('call:end', { callId, reason: 'peer-disconnected' });
                logger.info(`📞 Call ${callId} released on disconnect of ${uid}`);
                try {
                    await pool.query(
                        `UPDATE call_sessions
                         SET status='ended', ended_at=NOW(),
                             duration_seconds=TIMESTAMPDIFF(SECOND, answered_at, NOW())
                         WHERE call_id=? AND status IN ('accepted','active','connecting')`,
                        [String(callId)]
                    );
                    await pool.query(
                        `UPDATE call_sessions SET status='missed', ended_at=NOW()
                         WHERE call_id=? AND status='ringing'`,
                        [String(callId)]
                    );
                } catch (dbErr) {
                    logger.warn(`call_sessions disconnect update failed: ${dbErr.message}`);
                }
            }
        } catch (err) {
            logger.error(`call disconnect cleanup error: ${err.message}`);
        }
    });
};

module.exports = { handleCallEvents };
