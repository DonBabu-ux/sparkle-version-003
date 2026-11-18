const express = require('express');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const router = express.Router();
const pool = require('../../config/database');
const { optionalAuthMiddleware } = require('../../middleware/auth.middleware');

const getRequesterId = (req) => req.user?.user_id || req.user?.id || null;

// A reference number the user quotes, not a secret. The space is wide
// (timestamp base36 + 3 base36 chars of entropy) so thousands of tickets
// cannot collide, and ticket_id carries a UNIQUE key (migration
// 20261117) so any residual collision surfaces as a retryable error rather
// than silently creating a second ticket with a duplicate reference.
const generateTicketId = () =>
    'SPK-TKT-' +
    Date.now().toString(36).toUpperCase().padStart(8, '0') +
    crypto.randomInt(0, 46656).toString(36).toUpperCase().padStart(3, '0');

const extractDescription = (message) => {
    const text = String(message || '').trim();
    const separator = text.indexOf('\n\n');
    return separator === -1 ? text : text.slice(separator + 2).trim();
};

// Legacy contact form (name/email/type/message)
router.post('/', async (req, res) => {
    try {
        const { name, email, type, message } = req.body;

        if (!message || !name || !email || !type) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        await pool.query(
            'INSERT INTO support_requests (name, email, type, message) VALUES (?, ?, ?, ?)',
            [name, email, type, message]
        );

        return res.json({ success: true, message: 'Support request received successfully.' });
    } catch (error) {
        logger.error('Support API Error:', error);
        return res.status(500).json({ error: 'An error occurred while submitting your request.' });
    }
});

// Create a support ticket. Success is returned only after the row is stored.
const createTicket = async (req, res) => {
    try {
        const { category, subject, description, email, priority } = req.body || {};
        const userId = getRequesterId(req);

        if (!description || !String(description).trim()) {
            return res.status(400).json({ success: false, error: 'Issue description is required.' });
        }

        const ticketSubject = (subject && String(subject).trim()) || `Support request: ${category || 'General'}`;
        const ticketCategory = category || 'other';

        // Retry on the (astronomically unlikely) reference collision instead of
        // failing the submission.
        let ticketId = generateTicketId();
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const storedMessage = `[${ticketId}] Priority: ${priority || 'medium'}\n\n${String(description).trim()}`;
                await pool.query(
                    `INSERT INTO support_requests
                        (ticket_id, user_id, name, email, type, message, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'open')`,
                    [
                        ticketId,
                        userId,
                        ticketSubject,
                        email || req.user?.email || null,
                        ticketCategory,
                        storedMessage
                    ]
                );
                break;
            } catch (insertErr) {
                const isDuplicate = insertErr && (insertErr.code === 'ER_DUP_ENTRY' || /duplicate/i.test(insertErr.message || ''));
                if (isDuplicate && attempt < 2) {
                    ticketId = generateTicketId();
                    continue;
                }
                throw insertErr;
            }
        }

        return res.status(201).json({
            success: true,
            ticketId,
            message: `Ticket ${ticketId} received. Our support team will follow up.`
        });
    } catch (error) {
        logger.error('Support ticket create failed:', error);
        return res.status(500).json({ success: false, error: 'Could not save your support request. Please try again.' });
    }
};

router.post('/tickets', optionalAuthMiddleware, createTicket);
router.post('/ticket', optionalAuthMiddleware, createTicket);

// List the signed-in user's tickets
router.get('/tickets', optionalAuthMiddleware, async (req, res) => {
    const userId = getRequesterId(req);
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Please sign in to view your tickets.' });
    }

    try {
        const [tickets] = await pool.query(
            `SELECT ticket_id, name AS subject, type AS category, status, created_at
               FROM support_requests
              WHERE user_id = ?
              ORDER BY created_at DESC
              LIMIT 100`,
            [userId]
        );

        return res.json({ success: true, tickets });
    } catch (error) {
        logger.error('Support ticket list failed:', error);
        return res.status(500).json({ success: false, error: 'Could not load your support tickets.' });
    }
});

// Ticket detail with the original report as the opening message
router.get('/tickets/:ticketId', optionalAuthMiddleware, async (req, res) => {
    const userId = getRequesterId(req);
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Please sign in to view this ticket.' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT ticket_id, name AS subject, type AS category, status, message, created_at
               FROM support_requests
              WHERE ticket_id = ? AND user_id = ?
              LIMIT 1`,
            [req.params.ticketId, userId]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, error: 'Ticket not found.' });
        }

        const row = rows[0];
        const description = extractDescription(row.message);

        const [replies] = await pool.query(
            `SELECT id, sender_id, sender_name, is_admin, message AS content, created_at
               FROM support_ticket_messages
              WHERE ticket_id = ?
              ORDER BY created_at ASC`,
            [req.params.ticketId]
        );

        return res.json({
            success: true,
            ticket: {
                ticket_id: row.ticket_id,
                subject: row.subject,
                category: row.category,
                status: row.status,
                description,
                created_at: row.created_at
            },
            messages: [
                {
                    message_id: `${row.ticket_id}-opening`,
                    sender_id: userId,
                    sender_type: 'user',
                    content: description,
                    created_at: row.created_at
                },
                ...replies.map((m) => ({
                    message_id: String(m.id),
                    sender_id: m.sender_id,
                    sender_type: m.is_admin ? 'staff' : 'user',
                    content: m.content,
                    created_at: m.created_at
                }))
            ]
        });
    } catch (error) {
        logger.error('Support ticket detail failed:', error);
        return res.status(500).json({ success: false, error: 'Could not load this ticket.' });
    }
});

// Reply to a ticket. Stored per-message so a two-way conversation can render
// in order after the opening report.
router.post('/tickets/:ticketId/messages', optionalAuthMiddleware, async (req, res) => {
    const userId = getRequesterId(req);
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Please sign in to reply to this ticket.' });
    }

    const content = String((req.body || {}).content || '').trim();
    if (!content) {
        return res.status(400).json({ success: false, error: 'Reply cannot be empty.' });
    }
    if (content.length > 5000) {
        return res.status(400).json({ success: false, error: 'Reply is too long (5000 characters max).' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT ticket_id, status FROM support_requests
              WHERE ticket_id = ? AND user_id = ? LIMIT 1`,
            [req.params.ticketId, userId]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, error: 'Ticket not found.' });
        }
        if (rows[0].status === 'closed') {
            return res.status(409).json({ success: false, error: 'This ticket is closed. Please open a new one.' });
        }

        const [inserted] = await pool.query(
            `INSERT INTO support_ticket_messages
                (ticket_id, sender_id, sender_name, is_admin, message)
             VALUES (?, ?, ?, 0, ?)`,
            [req.params.ticketId, userId, null, content]
        );
        const [stored] = await pool.query(
            'SELECT id, created_at FROM support_ticket_messages WHERE id = ?',
            [inserted.insertId]
        );

        // Replying reopens a ticket that had been marked resolved.
        if (rows[0].status === 'resolved') {
            await pool.query('UPDATE support_requests SET status = ? WHERE ticket_id = ?', ['open', req.params.ticketId]);
        }

        return res.status(201).json({
            success: true,
            message: {
                message_id: String(stored[0].id),
                sender_id: userId,
                sender_type: 'user',
                content,
                created_at: stored[0].created_at
            }
        });
    } catch (error) {
        logger.error('Support ticket reply failed:', error);
        return res.status(500).json({ success: false, error: 'Could not send your reply. Please try again.' });
    }
});

// Sparkly AI Assistant Support Bot endpoint
const aiController = require('../../controllers/ai.controller');
router.post('/bot/ask', optionalAuthMiddleware, aiController.sparklyChat);

module.exports = router;
