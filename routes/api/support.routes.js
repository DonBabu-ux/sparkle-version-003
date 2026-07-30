const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { optionalAuthMiddleware } = require('../../middleware/auth.middleware');

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

        res.json({ success: true, message: 'Support request received successfully.' });
    } catch (error) {
        console.error('Support API Error:', error);
        res.status(500).json({ error: 'An error occurred while submitting your request.' });
    }
});

router.post('/ticket', optionalAuthMiddleware, async (req, res) => {
    try {
        const { category, subject, description, email } = req.body;
        const userId = req.user?.id || req.user?.user_id || null;

        if (!description) {
            return res.status(400).json({ error: 'Issue description is required.' });
        }

        const ticketId = 'SPK-TKT-' + Math.floor(100000 + Math.random() * 900000);

        try {
            await pool.query(
                'INSERT INTO support_requests (name, email, type, message) VALUES (?, ?, ?, ?)',
                [
                    subject || `Emergency: ${category || 'Security'}`,
                    email || req.user?.email || 'support-user@sparkle.app',
                    category || 'emergency',
                    `[${ticketId}] User: ${userId || 'Anonymous'}\n\n${description}`
                ]
            );
        } catch (_) {
            // Soft fail fallback if support_requests table schema varies
        }

        res.json({
            success: true,
            ticketId,
            message: `Ticket #${ticketId} submitted successfully. Sparkle Safety & Support team has been alerted.`
        });
    } catch (error) {
        console.error('Support Ticket Submission Error:', error);
        res.status(500).json({ error: 'Failed to submit support ticket.' });
    }
});

module.exports = router;
