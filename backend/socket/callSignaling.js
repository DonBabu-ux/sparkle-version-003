'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');
const NotificationService = require('../services/notification.service');
const pool = require('../config/database');
const {
    normalizeMode,
    callContent,
    buildCallMessageMetadata,
    computeDurationSeconds,
} = require('../utils/callMessage');

const MAX_SDP_BYTES = 128 * 1024;
const MIN_INVITE_INTERVAL_MS = 1500;
const CALL_TIMEOUT_SECONDS = 60;
const TERMINAL_STATUSES = ['ended', 'missed', 'rejected', 'cancelled', 'failed'];
const ACTIVE_STATUSES = ['initiating', 'ringing', 'accepted', 'connecting', 'active', 'reconnecting'];
let expiryMonitorStarted = false;

const isValidId = (value) =>
    (typeof value === 'string' || typeof value === 'number') &&
    String(value).length > 0 &&
    String(value).length <= 64;

const activeCallCache = new Map();

const getCallSession = async (callId, forceRefresh = false) => {
    if (!callId) return null;
    const key = String(callId);
    if (!forceRefresh && activeCallCache.has(key)) {
        return activeCallCache.get(key);
    }
    const [rows] = await pool.query(
        `SELECT call_id, caller_id, callee_id, mode, status, started_at, answered_at, connected_at, ended_at,
                duration_seconds, end_reason
         FROM call_sessions WHERE call_id = ? LIMIT 1`,
        [key]
    );
    const session = rows[0] || null;
    if (session && !TERMINAL_STATUSES.includes(session.status)) {
        activeCallCache.set(key, session);
    } else {
        activeCallCache.delete(key);
    }
    return session;
};

const updateCachedCallStatus = (callId, updates) => {
    const key = String(callId);
    if (activeCallCache.has(key)) {
        const current = activeCallCache.get(key);
        activeCallCache.set(key, { ...current, ...updates });
    }
};

const evictCachedCall = (callId) => {
    activeCallCache.delete(String(callId));
};

const isParticipant = (call, userId) =>
    Boolean(call && (String(call.caller_id) === String(userId) || String(call.callee_id) === String(userId)));

const otherParticipant = (call, userId) =>
    String(call.caller_id) === String(userId) ? String(call.callee_id) : String(call.caller_id);

const personalConversationExists = async (firstUserId, secondUserId) => {
    const [rows] = await pool.query(
        `SELECT chat_id FROM personal_chats
         WHERE (participant1_id = ? AND participant2_id = ?)
            OR (participant1_id = ? AND participant2_id = ?)
         LIMIT 1`,
        [firstUserId, secondUserId, secondUserId, firstUserId]
    );
    return rows[0] ? rows[0].chat_id : null;
};

const getUserCallSettings = async (userId) => {
    try {
        const [rows] = await pool.query(
            `SELECT silence_unknown_callers, allow_calls_from, ringtone, vibration,
                    incoming_call_notifications, use_less_data, default_audio_route, camera_quality
             FROM user_call_settings WHERE user_id = ? LIMIT 1`,
            [userId]
        );
        if (!rows || !rows[0]) return {};
        const r = rows[0];
        return {
            silence_unknown_callers: Boolean(r.silence_unknown_callers),
            allow_calls_from: r.allow_calls_from || 'everyone',
            ringtone: r.ringtone || 'hangouts_ringtone.mp3',
            vibration: r.vibration !== 0,
            incoming_call_notifications: r.incoming_call_notifications !== 0,
            use_less_data: Boolean(r.use_less_data),
            default_audio_route: r.default_audio_route || 'earpiece',
            camera_quality: r.camera_quality || 'standard',
        };
    } catch (err) {
        logger.warn(`[callSignaling] settings lookup failed: ${err.message}`);
        return {};
    }
};

const hasActiveCall = async (userId) => {
    const [rows] = await pool.query(
        `SELECT call_id FROM call_sessions
         WHERE (caller_id = ? OR callee_id = ?)
           AND status IN ('initiating','ringing','accepted','connecting','active','reconnecting')
         LIMIT 1`,
        [userId, userId]
    );
    return rows[0] ? rows[0].call_id : null;
};

const recordCallMessage = async (io, call, outcome, durationSeconds) => {
    try {
        const chatId = await personalConversationExists(call.caller_id, call.callee_id);
        if (!chatId) return false;

        const callId = String(call.call_id);
        const messageId = crypto.randomUUID();
        const content = callContent(call.mode, outcome);
        const metadata = JSON.stringify(buildCallMessageMetadata({
            callId,
            mode: call.mode,
            outcome,
            durationSeconds,
            callerId: call.caller_id,
            calleeId: call.callee_id,
            connectedAt: call.connected_at,
            endedAt: call.ended_at,
        }));

        const [insertResult] = await pool.query(
            `INSERT IGNORE INTO messages
                (message_id, chat_id, conversation_id, personal_chat_id, sender_id, recipient_id,
                 type, content, metadata, status, sent_at, call_id)
             VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'sent', NOW(), ?)`,
            [
                messageId,
                chatId,
                chatId,
                call.caller_id,
                call.callee_id,
                call.mode === 'video' ? 'video_call' : 'voice_call',
                content,
                metadata,
                callId,
            ]
        );

        if (!insertResult || insertResult.affectedRows !== 1) return false;

        await pool.query(
            `UPDATE personal_chats SET last_message = ?, last_message_time = NOW() WHERE chat_id = ?`,
            [content, chatId]
        );

        const message = {
            message_id: messageId,
            id: messageId,
            chat_id: null,
            conversation_id: chatId,
            personal_chat_id: chatId,
            sender_id: String(call.caller_id),
            recipient_id: String(call.callee_id),
            type: call.mode === 'video' ? 'video_call' : 'voice_call',
            content,
            metadata,
            status: 'sent',
            sent_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
        };

        io.to(`user:${call.caller_id}`).emit('receive_message', message);
        io.to(`user:${call.callee_id}`).emit('receive_message', message);
        return true;
    } catch (err) {
        logger.warn(`[callSignaling] recordCallMessage failed: ${err.message}`);
        return false;
    }
};

const finalizeCall = async (io, call, outcome, reason) => {
    if (!call) return false;
    evictCachedCall(call.call_id);
    const statusMap = {
        completed: 'ended',
        missed: 'missed',
        declined: 'rejected',
        cancelled: 'cancelled',
        failed: 'failed',
    };
    const status = statusMap[outcome] || outcome;
    const durationSeconds = outcome === 'completed'
        ? computeDurationSeconds(call.connected_at, new Date())
        : 0;

    const [result] = await pool.query(
        `UPDATE call_sessions
         SET status = ?, ended_at = NOW(), duration_seconds = ?, end_reason = ?, offer_sdp = NULL
         WHERE call_id = ? AND status NOT IN ('ended','missed','rejected','cancelled','failed')`,
        [status, durationSeconds, String(reason || outcome).slice(0, 50), String(call.call_id)]
    );

    if (!result || result.affectedRows !== 1) return false;
    await recordCallMessage(io, call, outcome, durationSeconds);
    return true;
};

const emitCallEnd = (io, call, reason) => {
    if (!call) return;
    io.to(`user:${call.caller_id}`).emit('call:end', { callId: call.call_id, reason });
    io.to(`user:${call.callee_id}`).emit('call:end', { callId: call.call_id, reason });
};

const relayToParticipant = (io, call, actorId, event, payload) => {
    const targetId = otherParticipant(call, actorId);
    io.to(`user:${targetId}`).emit(event, { ...payload, callId: call.call_id });
};

const startExpiryMonitor = (io) => {
    if (expiryMonitorStarted) return;
    expiryMonitorStarted = true;
    const timer = setInterval(async () => {
        try {
            const [rows] = await pool.query(
                `SELECT call_id, caller_id, callee_id, mode, status, started_at, answered_at, connected_at
                 FROM call_sessions
                 WHERE status IN ('ringing','accepted','connecting')
                   AND started_at < DATE_SUB(NOW(), INTERVAL ? SECOND)
                 LIMIT 100`,
                [CALL_TIMEOUT_SECONDS]
            );
            for (const call of rows) {
                const outcome = call.status === 'ringing' ? 'missed' : 'failed';
                const finalized = await finalizeCall(io, call, outcome, 'expired');
                if (finalized) emitCallEnd(io, call, 'expired');
            }
        } catch (err) {
            logger.warn(`[callSignaling] expiry monitor failed: ${err.message}`);
        }
    }, 15000);
    timer.unref();
};

const handleCallEvents = (io, socket) => {
    const uid = String(socket.userId);
    startExpiryMonitor(io);

    socket.on('call:invite', async (data) => {
        try {
            const { callId, targetId, mode, sdp } = data || {};
            if (!isValidId(callId) || !isValidId(targetId) || !sdp) return;
            if (typeof sdp !== 'object' || JSON.stringify(sdp).length > MAX_SDP_BYTES) return;

            const now = Date.now();
            if (socket._lastCallInviteAt && now - socket._lastCallInviteAt < MIN_INVITE_INTERVAL_MS) return;
            socket._lastCallInviteAt = now;

            const target = String(targetId);
            if (target === uid) return;

            const chatId = await personalConversationExists(uid, target);
            if (!chatId) {
                socket.emit('call:unavailable', { callId, reason: 'not-a-contact' });
                return;
            }

            const [blocks] = await pool.query(
                'SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1',
                [target, uid, uid, target]
            );
            if (blocks.length > 0) {
                socket.emit('call:unavailable', { callId, reason: 'blocked' });
                return;
            }

            const settings = await getUserCallSettings(target);
            if (settings.allow_calls_from === 'nobody') {
                socket.emit('call:unavailable', { callId, reason: 'calls-disabled' });
                return;
            }
            if (settings.silence_unknown_callers || settings.allow_calls_from === 'following') {
                const [follows] = await pool.query(
                    'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
                    [target, uid]
                );
                if (follows.length === 0) {
                    socket.emit('call:unavailable', { callId, reason: 'silenced' });
                    return;
                }
            }

            const busyCallId = await hasActiveCall(uid) || await hasActiveCall(target);
            if (busyCallId) {
                socket.emit('call:busy', { callId, reason: 'busy' });
                return;
            }

            const callMode = normalizeMode(mode);
            try {
                await pool.query(
                    `INSERT INTO call_sessions (call_id, caller_id, callee_id, mode, status)
                     VALUES (?, ?, ?, ?, 'initiating')`,
                    [String(callId), uid, target, callMode]
                );
                await pool.query(
                    `UPDATE call_sessions SET status='ringing', started_at=NOW(), offer_sdp=? WHERE call_id=? AND status='initiating'`,
                    [JSON.stringify(sdp), String(callId)]
                );
                activeCallCache.set(String(callId), {
                    call_id: String(callId),
                    caller_id: uid,
                    callee_id: target,
                    mode: callMode,
                    status: 'ringing',
                    started_at: new Date(),
                    answered_at: null,
                    connected_at: null,
                    ended_at: null,
                    duration_seconds: 0,
                    end_reason: null,
                });
            } catch (dbErr) {
                logger.warn(`[callSignaling] session insert failed: ${dbErr.message}`);
                socket.emit('call:unavailable', { callId, reason: 'service-unavailable' });
                return;
            }

            const call = await getCallSession(callId);
            if (!call || String(call.caller_id) !== uid || String(call.callee_id) !== target) return;

            io.to(`user:${target}`).emit('call:invite', {
                callId: String(callId),
                callerId: uid,
                mode: callMode,
                sdp,
                callerName: data.callerName || socket.user?.username || 'Incoming call',
                callerAvatar: data.callerAvatar || null,
                expiresAt: Date.now() + CALL_TIMEOUT_SECONDS * 1000,
            });

            if (settings.incoming_call_notifications === false) {
                logger.info(`[callSignaling] incoming call push suppressed for user ${target}`);
            } else {
                try {
                    await NotificationService.send({
                        type: 'incoming_call',
                        priority: 'HIGH',
                        recipients: [target],
                        eventId: `call:${callId}`,
                        data: {
                            title: `${data.callerName || socket.user?.username || 'Someone'} is calling`,
                            content: callMode === 'video' ? 'Incoming video call' : 'Incoming voice call',
                            url: '/messages',
                            callId: String(callId),
                            callerId: uid,
                            callerName: data.callerName || socket.user?.username || 'Sparkle User',
                            callerAvatar: data.callerAvatar || '',
                            callMode,
                            callType: callMode,
                            expiresAt: String(Date.now() + CALL_TIMEOUT_SECONDS * 1000),
                        },
                    });
                } catch (pushErr) {
                    logger.warn(`[callSignaling] call push notify failed: ${pushErr.message}`);
                }
            }
        } catch (err) {
            logger.error(`call:invite error: ${err.message}`);
        }
    });

    socket.on('call:received', async (data) => {
        try {
            const { callId } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || String(call.callee_id) !== uid) return;
            relayToParticipant(io, call, uid, 'call:received', { callId });
        } catch (err) {
            logger.error(`call:received error: ${err.message}`);
        }
    });

    socket.on('call:ringing', async (data) => {
        try {
            const { callId } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || String(call.callee_id) !== uid) return;
            relayToParticipant(io, call, uid, 'call:ringing', {});
        } catch (err) {
            logger.error(`call:ringing error: ${err.message}`);
        }
    });

    socket.on('call:accept', async (data) => {
        try {
            const { callId, sdp } = data || {};
            if (!isValidId(callId) || !sdp) return;
            const call = await getCallSession(callId);
            if (!call || String(call.callee_id) !== uid) return;

            if (call.status === 'ringing') {
                const [result] = await pool.query(
                    `UPDATE call_sessions SET status='accepted', answered_at=NOW()
                     WHERE call_id=? AND status='ringing' AND callee_id=?`,
                    [String(callId), uid]
                );
                if (!result || result.affectedRows !== 1) {
                    socket.emit('call:busy', { callId, reason: 'already-answered' });
                    return;
                }
                updateCachedCallStatus(callId, { status: 'accepted', answered_at: new Date() });
                socket.to(`user:${uid}`).emit('call:answered_elsewhere', { callId });
            } else if (!['accepted', 'connecting', 'active', 'reconnecting'].includes(call.status)) {
                return;
            }

            relayToParticipant(io, call, uid, 'call:accept', { calleeId: uid, sdp });
        } catch (err) {
            logger.error(`call:accept error: ${err.message}`);
        }
    });

    socket.on('call:offer', async (data) => {
        try {
            const { callId, sdp } = data || {};
            if (!isValidId(callId) || !sdp) return;
            const call = await getCallSession(callId);
            if (!call || !isParticipant(call, uid)) return;
            relayToParticipant(io, call, uid, 'call:offer', { sdp });
        } catch (err) {
            logger.error(`call:offer error: ${err.message}`);
        }
    });

    socket.on('call:ice', async (data) => {
        try {
            const { callId, candidate } = data || {};
            if (!isValidId(callId) || !candidate) return;
            const call = await getCallSession(callId);
            if (!call || !isParticipant(call, uid)) return;
            relayToParticipant(io, call, uid, 'call:ice', { candidate });
        } catch (err) {
            logger.error(`call:ice error: ${err.message}`);
        }
    });

    socket.on('call:connected', async (data) => {
        try {
            const { callId } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || !isParticipant(call, uid)) return;
            const [result] = await pool.query(
                `UPDATE call_sessions SET status='active', connected_at=COALESCE(connected_at, NOW())
                 WHERE call_id=? AND status IN ('accepted','connecting','active','reconnecting')`,
                [String(callId)]
            );
            if (result && result.affectedRows > 0) {
                updateCachedCallStatus(callId, { status: 'active', connected_at: new Date() });
                relayToParticipant(io, call, uid, 'call:connected', {});
            }
        } catch (err) {
            logger.error(`call:connected error: ${err.message}`);
        }
    });

    socket.on('call:reconnecting', async (data) => {
        try {
            const { callId } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || !isParticipant(call, uid)) return;
            await pool.query(
                `UPDATE call_sessions SET status='reconnecting' WHERE call_id=? AND status IN ('active','connecting','accepted')`,
                [String(callId)]
            );
            updateCachedCallStatus(callId, { status: 'reconnecting' });
            relayToParticipant(io, call, uid, 'call:reconnecting', {});
        } catch (err) {
            logger.error(`call:reconnecting error: ${err.message}`);
        }
    });

    socket.on('call:reject', async (data) => {
        try {
            const { callId } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || String(call.callee_id) !== uid) return;
            relayToParticipant(io, call, uid, 'call:reject', { reason: 'declined' });
            await finalizeCall(io, call, 'declined', 'declined');
        } catch (err) {
            logger.error(`call:reject error: ${err.message}`);
        }
    });

    socket.on('call:cancel', async (data) => {
        try {
            const { callId } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || String(call.caller_id) !== uid) return;
            relayToParticipant(io, call, uid, 'call:cancel', { reason: 'cancelled' });
            await finalizeCall(io, call, 'cancelled', 'cancelled');
        } catch (err) {
            logger.error(`call:cancel error: ${err.message}`);
        }
    });

    socket.on('call:failed', async (data) => {
        try {
            const { callId, reason } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || !isParticipant(call, uid)) return;
            relayToParticipant(io, call, uid, 'call:failed', { reason: reason || 'connection-failed' });
            await finalizeCall(io, call, 'failed', reason || 'connection-failed');
        } catch (err) {
            logger.error(`call:failed error: ${err.message}`);
        }
    });

    socket.on('call:end', async (data) => {
        try {
            const { callId, reason } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || !isParticipant(call, uid)) return;
            const outcome = TERMINAL_STATUSES.includes(call.status)
                ? null
                : ACTIVE_STATUSES.includes(call.status) && ['accepted', 'connecting', 'active', 'reconnecting'].includes(call.status)
                    ? 'completed'
                    : String(call.caller_id) === uid
                        ? 'cancelled'
                        : 'missed';
            relayToParticipant(io, call, uid, 'call:end', { reason: reason || outcome });
            if (outcome) await finalizeCall(io, call, outcome, reason || outcome);
        } catch (err) {
            logger.error(`call:end error: ${err.message}`);
        }
    });

    socket.on('call:mute', async (data) => {
        try {
            const { callId, isMuted } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || !isParticipant(call, uid)) return;
            relayToParticipant(io, call, uid, 'call:mute', { isMuted: Boolean(isMuted) });
        } catch (err) {
            logger.error(`call:mute error: ${err.message}`);
        }
    });

    socket.on('call:camera', async (data) => {
        try {
            const { callId, isCameraOn } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || !isParticipant(call, uid)) return;
            relayToParticipant(io, call, uid, 'call:camera', { isCameraOn: Boolean(isCameraOn) });
        } catch (err) {
            logger.error(`call:camera error: ${err.message}`);
        }
    });

    socket.on('call:audio-route', async (data) => {
        try {
            const { callId, route } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || !isParticipant(call, uid)) return;
            relayToParticipant(io, call, uid, 'call:audio-route', { route: String(route || '') });
        } catch (err) {
            logger.error(`call:audio-route error: ${err.message}`);
        }
    });

    socket.on('call:upgrade-video', async (data) => {
        try {
            const { callId } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || !isParticipant(call, uid)) return;
            relayToParticipant(io, call, uid, 'call:upgrade-video', { requesterId: uid });
        } catch (err) {
            logger.error(`call:upgrade-video error: ${err.message}`);
        }
    });

    socket.on('call:upgrade-response', async (data) => {
        try {
            const { callId, accepted, sdp } = data || {};
            if (!isValidId(callId)) return;
            const call = await getCallSession(callId);
            if (!call || !isParticipant(call, uid)) return;
            relayToParticipant(io, call, uid, 'call:upgrade-response', { accepted: Boolean(accepted), sdp });
            if (accepted) {
                await pool.query('UPDATE call_sessions SET mode=\'video\' WHERE call_id=?', [String(callId)]);
            }
        } catch (err) {
            logger.error(`call:upgrade-response error: ${err.message}`);
        }
    });

    socket.on('disconnect', async () => {
        try {
            const room = io.sockets.adapter.rooms.get(`user:${uid}`);
            if (room && room.size > 0) return;
            const [rows] = await pool.query(
                `SELECT call_id, caller_id, callee_id, mode, status, started_at, answered_at, connected_at
                 FROM call_sessions
                 WHERE (caller_id = ? OR callee_id = ?)
                   AND status IN ('initiating','ringing','accepted','connecting','active','reconnecting')
                 LIMIT 1`,
                [uid, uid]
            );
            const call = rows[0];
            if (!call) return;
            const peerId = otherParticipant(call, uid);
            io.to(`user:${peerId}`).emit('call:reconnecting', { callId: call.call_id, reason: 'peer-disconnected' });
            setTimeout(async () => {
                try {
                    const peerRoom = io.sockets.adapter.rooms.get(`user:${uid}`);
                    if (peerRoom && peerRoom.size > 0) return;
                    const latest = await getCallSession(call.call_id);
                    if (!latest || TERMINAL_STATUSES.includes(latest.status)) return;
                    await finalizeCall(io, latest, 'failed', 'peer-disconnected');
                    emitCallEnd(io, latest, 'peer-disconnected');
                } catch (err) {
                    logger.warn(`[callSignaling] disconnect finalization failed: ${err.message}`);
                }
            }, 15000).unref();
        } catch (err) {
            logger.error(`call disconnect cleanup error: ${err.message}`);
        }
    });
};

module.exports = {
    handleCallEvents,
    getCallSession,
    isParticipant,
    otherParticipant,
    personalConversationExists,
    normalizeMode,
    recordCallMessage,
    evictCachedCall,
};
