'use strict';
// controllers/calls.controller.js
// Authoritative backend controller for WhatsApp-inspired calling architecture

const pool = require('../config/database');
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
                   COALESCE(u_caller.profile_image, u_caller.avatar_url) as caller_avatar,
                   u_callee.username as callee_username,
                   COALESCE(u_callee.name, u_callee.username) as callee_name,
                   COALESCE(u_callee.profile_image, u_callee.avatar_url) as callee_avatar
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
        serverError(res, err, 'getCallHistory');
    }
};

/**
 * GET /api/calls/settings
 * Retrieves user's call settings and privacy controls.
 */
const getCallSettings = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const [rows] = await pool.query(
            `SELECT settings FROM users WHERE user_id = ?`,
            [userId]
        );
        let settings = {};
        if (rows.length && rows[0].settings) {
            try {
                settings = typeof rows[0].settings === 'string' ? JSON.parse(rows[0].settings) : rows[0].settings;
            } catch (_) {}
        }

        res.json({
            success: true,
            settings: {
                silence_unknown_callers: Boolean(settings.silence_unknown_callers),
                allow_calls_from: settings.allow_calls_from || 'everyone',
                ringtone: settings.ringtone || 'hangouts_ringingtone.mp3',
                vibration: settings.vibration !== false,
            }
        });
    } catch (err) {
        serverError(res, err, 'getCallSettings');
    }
};

/**
 * PUT /api/calls/settings
 * Updates user's call settings and privacy controls.
 */
const updateCallSettings = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const { silence_unknown_callers, allow_calls_from, ringtone, vibration } = req.body || {};

        const [rows] = await pool.query(
            `SELECT settings FROM users WHERE user_id = ?`,
            [userId]
        );
        let currentSettings = {};
        if (rows.length && rows[0].settings) {
            try {
                currentSettings = typeof rows[0].settings === 'string' ? JSON.parse(rows[0].settings) : rows[0].settings;
            } catch (_) {}
        }

        const updatedSettings = {
            ...currentSettings,
            silence_unknown_callers: Boolean(silence_unknown_callers),
            allow_calls_from: ['everyone', 'following', 'nobody'].includes(allow_calls_from) ? allow_calls_from : (currentSettings.allow_calls_from || 'everyone'),
            ringtone: ringtone || currentSettings.ringtone || 'hangouts_ringingtone.mp3',
            vibration: vibration !== undefined ? Boolean(vibration) : true,
        };

        await pool.query(
            `UPDATE users SET settings = ? WHERE user_id = ?`,
            [JSON.stringify(updatedSettings), userId]
        );

        res.json({ success: true, settings: updatedSettings });
    } catch (err) {
        serverError(res, err, 'updateCallSettings');
    }
};

module.exports = {
    getCallHistory,
    getCallSettings,
    updateCallSettings,
};

