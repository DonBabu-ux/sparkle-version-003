'use strict';
// controllers/calls.controller.js
// Authoritative backend controller for WhatsApp-inspired calling architecture

const pool = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { serverError } = require('../utils/serverError');

/**
 * GET /api/calls/history
 * Returns user's call history with caller/callee metadata and duration.
 */
const getCallHistory = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const filter = req.query.type || 'all'; // 'all' | 'missed'
        const limit = Math.min(Number(req.query.limit) || 50, 100);

        let query = `
            SELECT cs.call_id,
                   cs.caller_id,
                   cs.callee_id,
                   cs.mode,
                   cs.status,
                   cs.started_at,
                   cs.answered_at,
                   cs.ended_at,
                   cs.duration_seconds,
                   cs.end_reason,
                   u_caller.username as caller_username,
                   COALESCE(u_caller.name, u_caller.username) as caller_name,
                   u_caller.avatar_url as caller_avatar,
                   u_callee.username as callee_username,
                   COALESCE(u_callee.name, u_callee.username) as callee_name,
                   u_callee.avatar_url as callee_avatar
            FROM call_sessions cs
            LEFT JOIN users u_caller ON u_caller.user_id = cs.caller_id
            LEFT JOIN users u_callee ON u_callee.user_id = cs.callee_id
            WHERE (cs.caller_id = ? OR cs.callee_id = ?)
        `;

        const params = [userId, userId];

        if (filter === 'missed') {
            query += ` AND cs.status = 'missed' AND cs.callee_id = ?`;
            params.push(userId);
        }

        query += ` ORDER BY cs.started_at DESC LIMIT ?`;
        params.push(limit);

        const [rows] = await pool.query(query, params);

        const history = rows.map(r => {
            const isCaller = String(r.caller_id) === String(userId);
            return {
                id: r.call_id,
                call_id: r.call_id,
                mode: r.mode,
                status: r.status,
                end_reason: r.end_reason || null,
                direction: isCaller ? 'outgoing' : 'incoming',
                duration_seconds: r.duration_seconds || 0,
                started_at: r.started_at,
                answered_at: r.answered_at,
                ended_at: r.ended_at,
                partner: {
                    user_id: isCaller ? r.callee_id : r.caller_id,
                    username: isCaller ? r.callee_username : r.caller_username,
                    name: isCaller ? r.callee_name : r.caller_name,
                    avatar_url: isCaller ? r.callee_avatar : r.caller_avatar,
                }
            };
        });

        res.json({ success: true, history });
    } catch (err) {
        logger.error('[calls.controller] getCallHistory error:', err);
        serverError(res, err);
    }
};

const DEFAULT_CALL_SETTINGS = Object.freeze({
    silence_unknown_callers: false,
    allow_calls_from: 'everyone',
    ringtone: 'hangouts_ringtone.mp3',
    vibration: true,
    incoming_call_notifications: true,
    use_less_data: false,
    default_audio_route: 'earpiece',
    camera_quality: 'standard',
});

/**
 * GET /api/calls/settings
 * Retrieves user's call settings and privacy controls.
 */
const getCallSettings = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const [rows] = await pool.query(
            `SELECT silence_unknown_callers, allow_calls_from, ringtone, vibration,
                    incoming_call_notifications, use_less_data, default_audio_route, camera_quality
             FROM user_call_settings WHERE user_id = ? LIMIT 1`,
            [userId]
        );
        const row = rows[0] || {};

        res.json({
            success: true,
            settings: {
                silence_unknown_callers: Boolean(row.silence_unknown_callers ?? DEFAULT_CALL_SETTINGS.silence_unknown_callers),
                allow_calls_from: row.allow_calls_from || DEFAULT_CALL_SETTINGS.allow_calls_from,
                ringtone: row.ringtone || DEFAULT_CALL_SETTINGS.ringtone,
                vibration: row.vibration !== undefined && row.vibration !== null
                    ? Boolean(row.vibration)
                    : DEFAULT_CALL_SETTINGS.vibration,
                incoming_call_notifications: row.incoming_call_notifications !== undefined && row.incoming_call_notifications !== null
                    ? Boolean(row.incoming_call_notifications)
                    : DEFAULT_CALL_SETTINGS.incoming_call_notifications,
                use_less_data: Boolean(row.use_less_data ?? DEFAULT_CALL_SETTINGS.use_less_data),
                default_audio_route: row.default_audio_route || DEFAULT_CALL_SETTINGS.default_audio_route,
                camera_quality: row.camera_quality || DEFAULT_CALL_SETTINGS.camera_quality,
            }
        });
    } catch (err) {
        logger.error('[calls.controller] getCallSettings error:', err);
        serverError(res, err);
    }
};

/**
 * PUT /api/calls/settings
 * Updates user's call settings and privacy controls.
 */
const updateCallSettings = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const {
            silence_unknown_callers,
            allow_calls_from,
            ringtone,
            vibration,
            incoming_call_notifications,
            use_less_data,
            default_audio_route,
            camera_quality,
        } = req.body || {};

        const [existing] = await pool.query(
            `SELECT silence_unknown_callers, allow_calls_from, ringtone, vibration,
                    incoming_call_notifications, use_less_data, default_audio_route, camera_quality
             FROM user_call_settings WHERE user_id = ? LIMIT 1`,
            [userId]
        );
        const current = existing[0] || {};

        const updatedSettings = {
            silence_unknown_callers: silence_unknown_callers !== undefined
                ? Boolean(silence_unknown_callers)
                : Boolean(current.silence_unknown_callers ?? DEFAULT_CALL_SETTINGS.silence_unknown_callers),
            allow_calls_from: ['everyone', 'following', 'nobody'].includes(allow_calls_from)
                ? allow_calls_from
                : (current.allow_calls_from || DEFAULT_CALL_SETTINGS.allow_calls_from),
            ringtone: ringtone || current.ringtone || DEFAULT_CALL_SETTINGS.ringtone,
            vibration: vibration !== undefined
                ? Boolean(vibration)
                : (current.vibration !== undefined && current.vibration !== null ? Boolean(current.vibration) : DEFAULT_CALL_SETTINGS.vibration),
            incoming_call_notifications: incoming_call_notifications !== undefined
                ? Boolean(incoming_call_notifications)
                : (current.incoming_call_notifications !== undefined && current.incoming_call_notifications !== null ? Boolean(current.incoming_call_notifications) : DEFAULT_CALL_SETTINGS.incoming_call_notifications),
            use_less_data: use_less_data !== undefined
                ? Boolean(use_less_data)
                : Boolean(current.use_less_data ?? DEFAULT_CALL_SETTINGS.use_less_data),
            default_audio_route: ['earpiece', 'speaker'].includes(default_audio_route)
                ? default_audio_route
                : (current.default_audio_route || DEFAULT_CALL_SETTINGS.default_audio_route),
            camera_quality: ['low', 'standard', 'high'].includes(camera_quality)
                ? camera_quality
                : (current.camera_quality || DEFAULT_CALL_SETTINGS.camera_quality),
        };

        await pool.query(
            `INSERT INTO user_call_settings (
                user_id, silence_unknown_callers, allow_calls_from, ringtone,
                vibration, incoming_call_notifications, use_less_data,
                default_audio_route, camera_quality
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                silence_unknown_callers = VALUES(silence_unknown_callers),
                allow_calls_from = VALUES(allow_calls_from),
                ringtone = VALUES(ringtone),
                vibration = VALUES(vibration),
                incoming_call_notifications = VALUES(incoming_call_notifications),
                use_less_data = VALUES(use_less_data),
                default_audio_route = VALUES(default_audio_route),
                camera_quality = VALUES(camera_quality),
                updated_at = CURRENT_TIMESTAMP`,
            [
                userId,
                updatedSettings.silence_unknown_callers ? 1 : 0,
                updatedSettings.allow_calls_from,
                updatedSettings.ringtone,
                updatedSettings.vibration ? 1 : 0,
                updatedSettings.incoming_call_notifications ? 1 : 0,
                updatedSettings.use_less_data ? 1 : 0,
                updatedSettings.default_audio_route,
                updatedSettings.camera_quality
            ]
        );

        res.json({ success: true, settings: updatedSettings });
    } catch (err) {
        logger.error('[calls.controller] updateCallSettings error:', err);
        serverError(res, err);
    }
};

const getCallOffer = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const callId = String(req.params.callId || '');
        const [rows] = await pool.query(
            `SELECT cs.call_id, cs.caller_id, cs.mode, cs.status, cs.offer_sdp,
                    u.username AS caller_username, COALESCE(u.name, u.username) AS caller_name, u.avatar_url AS caller_avatar
             FROM call_sessions cs
             JOIN users u ON u.user_id = cs.caller_id
             WHERE cs.call_id = ? AND cs.callee_id = ? AND cs.status = 'ringing'
             LIMIT 1`,
            [callId, userId]
        );
        const call = rows[0];
        if (!call || !call.offer_sdp) {
            return res.status(404).json({ success: false, error: 'Call is no longer available' });
        }
        let sdp;
        try {
            sdp = JSON.parse(call.offer_sdp);
        } catch (_) {
            return res.status(404).json({ success: false, error: 'Call is no longer available' });
        }
        return res.json({
            success: true,
            call: {
                callId: call.call_id,
                callerId: call.caller_id,
                callerName: call.caller_name || call.caller_username,
                callerAvatar: call.caller_avatar || null,
                mode: call.mode,
                sdp,
            },
        });
    } catch (err) {
        logger.error('[calls.controller] getCallOffer error:', err);
        return serverError(res, err);
    }
};

const getIceServers = async (req, res) => {
    try {
        const stunUrls = (process.env.TURN_STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302')
            .split(',')
            .map((url) => url.trim())
            .filter(Boolean);
        const iceServers = stunUrls.map((urls) => ({ urls: urls.split(',') }));
        const turnUrls = String(process.env.TURN_URLS || '')
            .split(',')
            .map((url) => url.trim())
            .filter(Boolean);
        const sharedSecret = String(process.env.TURN_SHARED_SECRET || '');

        if (turnUrls.length > 0 && sharedSecret) {
            const userId = req.user.user_id || req.user.userId;
            const ttl = Math.max(300, Math.min(Number(process.env.TURN_CREDENTIAL_TTL_SECONDS) || 3600, 86400));
            const expiresAt = Math.floor(Date.now() / 1000) + ttl;
            const username = `${expiresAt}:${userId}`;
            const credential = crypto
                .createHmac('sha1', sharedSecret)
                .update(username)
                .digest('base64');
            iceServers.push({ urls: turnUrls, username, credential, credentialType: 'password' });
        }

        res.json({ success: true, iceServers, expiresIn: turnUrls.length > 0 && sharedSecret ? ttl : 0 });
    } catch (err) {
        logger.error('[calls.controller] getIceServers error:', err);
        serverError(res, err);
    }
};

/**
 * POST /api/calls/:callId/decline
 * Allows recipient or caller to dismiss/decline/cancel a call via REST API.
 */
const declineCall = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const callId = String(req.params.callId || '');
        if (!callId) {
            return res.status(400).json({ success: false, error: 'Call ID required' });
        }

        const [rows] = await pool.query(
            `SELECT call_id, caller_id, callee_id, mode, status, started_at
             FROM call_sessions WHERE call_id = ? LIMIT 1`,
            [callId]
        );
        const call = rows[0];
        if (!call) {
            return res.status(404).json({ success: false, error: 'Call not found' });
        }
        if (String(call.callee_id) !== String(userId) && String(call.caller_id) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized for this call' });
        }

        if (['initiating', 'ringing'].includes(call.status)) {
            const isCaller = String(call.caller_id) === String(userId);
            const outcome = isCaller ? 'cancelled' : 'declined';
            const status = isCaller ? 'cancelled' : 'rejected';
            const reason = outcome;

            await pool.query(
                `UPDATE call_sessions
                 SET status = ?, ended_at = NOW(), duration_seconds = 0, end_reason = ?, offer_sdp = NULL
                 WHERE call_id = ? AND status IN ('initiating', 'ringing')`,
                [status, reason, callId]
            );

            const { evictCachedCall, recordCallMessage } = require('../socket/callSignaling');
            if (typeof evictCachedCall === 'function') {
                evictCachedCall(callId);
            }

            const io = req.app.get('io') || global.io;
            if (io) {
                const event = isCaller ? 'call:cancel' : 'call:reject';
                io.to(`user:${call.caller_id}`).emit(event, { callId, reason });
                io.to(`user:${call.callee_id}`).emit(event, { callId, reason });
                if (typeof recordCallMessage === 'function') {
                    await recordCallMessage(io, call, outcome, 0);
                }
            }
        }

        res.json({ success: true, message: 'Call declined successfully' });
    } catch (err) {
        logger.error('[calls.controller] declineCall error:', err);
        serverError(res, err);
    }
};

module.exports = {
    getCallHistory,
    getCallSettings,
    updateCallSettings,
    getCallOffer,
    getIceServers,
    declineCall,
};

