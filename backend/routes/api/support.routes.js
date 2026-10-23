const express = require('express');
const logger = require('../../utils/logger');
const router = express.Router();
const pool = require('../../config/database');
const { optionalAuthMiddleware } = require('../../middleware/auth.middleware');

const getRequesterId = (req) => req.user?.user_id || req.user?.id || null;

const generateTicketId = () =>
    'SPK-TKT-' + Math.floor(100000 + Math.random() * 900000);

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

        const ticketId = generateTicketId();
        const ticketSubject = (subject && String(subject).trim()) || `Support request: ${category || 'General'}`;
        const ticketCategory = category || 'other';
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
                }
            ]
        });
    } catch (error) {
        logger.error('Support ticket detail failed:', error);
        return res.status(500).json({ success: false, error: 'Could not load this ticket.' });
    }
});

// Ticket replies are not stored yet; fail honestly instead of pretending to send.
router.post('/tickets/:ticketId/messages', optionalAuthMiddleware, (req, res) => {
    return res.status(501).json({ success: false, error: 'Ticket replies are not available yet.' });
});

// Sparkly AI Assistant Support Bot endpoint
const aiController = require('../../controllers/ai.controller');
router.post('/bot/ask', optionalAuthMiddleware, aiController.sparklyChat);

module.exports = router;
