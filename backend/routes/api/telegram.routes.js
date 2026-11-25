'use strict';
/**
 * Telegram Bot Webhook & Admin Media Management Routes
 * POST /api/telegram/webhook  — receives Telegram Bot API updates
 * GET  /api/telegram/status   — bot connectivity status (admin only)
 */
const express = require('express');
const router = express.Router();
const telegramBotService = require('../../services/telegramBot.service');
const logger = require('../../utils/logger');

// Webhook — receives messages from Telegram Bot API
// Authenticated via X-Telegram-Bot-Api-Secret-Token (TELEGRAM_WEBHOOK_SECRET),
// constant-time compared; commands are gated to TELEGRAM_ADMIN_CHAT_ID only.
router.post('/webhook', async (req, res) => {
    try {
        const crypto = require('crypto');
        const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        const providedSecret = req.headers['x-telegram-bot-api-secret-token'];
        const providedBuf = Buffer.from(String(providedSecret || ''));
        const expectedBuf = Buffer.from(String(expectedSecret || ''));
        if (!expectedSecret || providedBuf.length !== expectedBuf.length ||
            !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
            logger.warn('[TelegramWebhook] Rejected update: missing or invalid secret token');
            return res.sendStatus(401);
        }

        const update = req.body;
        // Basic guard: must have message or callback_query
        if (!update || (!update.message && !update.callback_query)) {
            return res.sendStatus(200); // Always 200 to Telegram, even for unrecognized events
        }

        const msg = update.message || update.callback_query?.message;
        const text = (msg?.text || '').trim();
        const chatId = String(msg?.chat?.id || '');
        const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_ADMIN_ID;

        if (text && chatId) {
            // Commands leak internal telemetry - admin chat only.
            if (adminChatId && String(chatId) === String(adminChatId)) {
                // Async command handling - do not block the webhook response
                telegramBotService.handleCommand(text, chatId).catch(e => {
                    logger.warn('[TelegramWebhook] Command handler error:', e.message);
                });
            } else {
                logger.warn('[TelegramWebhook] Ignored command from non-admin chat', chatId);
            }
        }

        res.sendStatus(200);
    } catch (err) {
        logger.error('[TelegramWebhook] Unhandled error:', err.message);
        res.sendStatus(200); // Always 200 to Telegram
    }
});

// Status endpoint — verify bot token and connectivity
router.get('/status', async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_ADMIN_ID;

    if (!token) {
        return res.json({ configured: false, reason: 'TELEGRAM_BOT_TOKEN not set' });
    }

    try {
        const https = require('https');
        const result = await new Promise((resolve, reject) => {
            https.get(`https://api.telegram.org/bot${token}/getMe`, (r) => {
                let data = '';
                r.on('data', c => data += c);
                r.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch { reject(new Error('Invalid JSON from Telegram')); }
                });
            }).on('error', reject);
        });
        res.json({
            configured: true,
            adminChatId: chatId || null,
            bot: result.ok ? result.result : null,
            ok: result.ok
        });
    } catch (err) {
        res.json({ configured: true, ok: false, error: err.message });
    }
});

module.exports = router;
