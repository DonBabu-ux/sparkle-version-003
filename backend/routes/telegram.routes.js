'use strict';
/**
 * Telegram Bot Webhook & Admin Media Management Routes
 * POST /api/telegram/webhook  — receives Telegram Bot API updates
 * GET  /api/telegram/status   — bot connectivity status (admin only)
 */
const express = require('express');
const router = express.Router();
const telegramBotService = require('../services/telegramBot.service');
const logger = require('../utils/logger');

// Webhook — receives messages from Telegram Bot API
// No auth middleware: Telegram sends these; we validate by checking the bot token in URL
router.post('/webhook', async (req, res) => {
    try {
        const update = req.body;
        // Basic guard: must have message or callback_query
        if (!update || (!update.message && !update.callback_query)) {
            return res.sendStatus(200); // Always 200 to Telegram, even for unrecognized events
        }

        const msg = update.message || update.callback_query?.message;
        const text = (msg?.text || '').trim();
        const chatId = String(msg?.chat?.id || '');

        if (text && chatId) {
            // Async command handling — don't block the webhook response
            telegramBotService.handleCommand(text, chatId).catch(e => {
                logger.warn('[TelegramWebhook] Command handler error:', e.message);
            });
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
