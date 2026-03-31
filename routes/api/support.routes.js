const express = require('express');
const router = express.Router();
const pool = require('../../config/database');

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

module.exports = router;
