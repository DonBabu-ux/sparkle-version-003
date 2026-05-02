const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { v4: uuidv4 } = require('uuid');

// Require authentication for all marketplace chat routes
router.use(authMiddleware);

// 1. Get or Create Conversation (Clicking "Message Seller")
router.post('/conversations', async (req, res) => {
    const { seller_id, listing_id } = req.body;
    const buyer_id = req.user.user_id;

    if (buyer_id === seller_id) {
        return res.status(403).json({ error: 'You cannot message yourself about your own listing.' });
    }

    if (!seller_id || !listing_id) {
        return res.status(400).json({ error: 'seller_id and listing_id are required' });
    }

    try {
        // A. Check for Blocks
        const [blocks] = await pool.query(
            `SELECT * FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
            [seller_id, buyer_id, buyer_id, seller_id]
        );

        if (blocks.length > 0) {
            return res.status(403).json({ error: 'Message blocked. You or the other user have blocked each other.' });
        }

        // B. Check Seller's Marketplace Settings
        const [settings] = await pool.query(
            `SELECT who_can_message_me FROM marketplace_message_settings WHERE user_id = ?`,
            [seller_id]
        );

        if (settings.length > 0) {
            const restriction = settings[0].who_can_message_me;
            if (restriction === 'none') {
                return res.status(403).json({ error: 'This user is not accepting new marketplace messages at this time.' });
            }
            if (restriction === 'vouched_only') {
                const [trust] = await pool.query(`SELECT trust_score FROM user_trust WHERE user_id = ?`, [buyer_id]);
                const score = trust.length > 0 ? trust[0].trust_score : 1.0;
                if (score < 2.0) { // Threshold for "vouched"
                    return res.status(403).json({ error: 'This seller only accepts messages from vouched users (Trust Score >= 2.0).' });
                }
            }
        }

        // C. Check if thread exists
        const [existing] = await pool.query(
            `SELECT * FROM marketplace_conversations WHERE buyer_id = ? AND seller_id = ? AND listing_id = ?`,
            [buyer_id, seller_id, listing_id]
        );

        if (existing.length > 0) {
            return res.json(existing[0]);
        }

        // D. Create new
        const convId = uuidv4();
        await pool.query(
            `INSERT INTO marketplace_conversations (id, buyer_id, seller_id, listing_id) VALUES (?, ?, ?, ?)`,
            [convId, buyer_id, seller_id, listing_id]
        );

        res.status(201).json({ id: convId, buyer_id, seller_id, listing_id });
    } catch (err) {
        console.error("Failed to create conversation:", err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Fetch User's Conversations
router.get('/conversations', async (req, res) => {
    const userId = req.user.user_id;

    try {
        const [conversations] = await pool.query(`
            SELECT c.*, 
                   u1.username as buyer_username, u1.name as buyer_name, u1.avatar_url as buyer_avatar,
                   u2.username as seller_username, u2.name as seller_name, u2.avatar_url as seller_avatar,
                   l.title as listing_title, l.price as listing_price, l.image_url as listing_image, 
                   l.description as listing_description, l.status as listing_status
            FROM marketplace_conversations c
            LEFT JOIN users u1 ON c.buyer_id = u1.user_id
            LEFT JOIN users u2 ON c.seller_id = u2.user_id
            LEFT JOIN marketplace_listings l ON c.listing_id = l.listing_id
            WHERE c.buyer_id = ? OR c.seller_id = ?
            ORDER BY c.last_activity_at DESC
        `, [userId, userId]);

        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Fetch Messages for a Thread
router.get('/messages/:conversation_id', async (req, res) => {
    try {
        const [conversations] = await pool.query(
            `SELECT * FROM marketplace_conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)`,
            [req.params.conversation_id, req.user.user_id, req.user.user_id]
        );

        if (conversations.length === 0) {
            return res.status(403).json({ error: 'Not authorized or conversation not found' });
        }

        const [messages] = await pool.query(`
            SELECT m.*, s.delivered_at, s.read_at, u.username as sender_username, u.name as sender_name, u.avatar_url as sender_avatar,
                   (SELECT JSON_ARRAYAGG(JSON_OBJECT('user_id', user_id, 'reaction', reaction_type)) FROM marketplace_message_reactions WHERE message_id = m.id) as reactions
            FROM marketplace_messages m
            LEFT JOIN marketplace_message_status s ON m.id = s.message_id
            LEFT JOIN users u ON m.sender_id = u.user_id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at ASC
        `, [req.params.conversation_id]);
        
        messages.forEach(m => m.reactions = typeof m.reactions === 'string' ? JSON.parse(m.reactions) : (m.reactions || []));
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Edit Message
router.put('/messages/:message_id', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });
        const [msg] = await pool.query(`SELECT * FROM marketplace_messages WHERE id = ? AND sender_id = ?`, [req.params.message_id, req.user.user_id]);
        if (msg.length === 0) return res.status(403).json({ error: 'Unauthorized' });
        await pool.query(`UPDATE marketplace_messages SET message_text = ?, is_edited = TRUE WHERE id = ?`, [text, req.params.message_id]);
        res.json({ success: true, message: 'Message updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Delete / Unsend Message
router.delete('/messages/:message_id', async (req, res) => {
    try {
        const [msg] = await pool.query(`SELECT * FROM marketplace_messages WHERE id = ? AND sender_id = ?`, [req.params.message_id, req.user.user_id]);
        if (msg.length === 0) return res.status(403).json({ error: 'Unauthorized' });
        await pool.query(`DELETE FROM marketplace_messages WHERE id = ?`, [req.params.message_id]);
        await pool.query(`DELETE FROM marketplace_message_status WHERE message_id = ?`, [req.params.message_id]);
        res.json({ success: true, message: 'Message deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Upload Media
const { messageUpload } = require('../../middleware/upload.middleware');
router.post('/messages/upload', messageUpload.single('media'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        res.json({ success: true, url: req.file.path, type: req.file.mimetype.startsWith('video') ? 'video' : 'image' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. React
router.post('/messages/:message_id/react', async (req, res) => {
    try {
        const { reaction } = req.body;
        const userId = req.user.user_id;
        if (!reaction) return res.status(400).json({ error: 'Reaction is required' });
        const id = uuidv4();
        await pool.query(`DELETE FROM marketplace_message_reactions WHERE message_id = ? AND user_id = ?`, [req.params.message_id, userId]);
        await pool.query(`INSERT INTO marketplace_message_reactions (id, message_id, user_id, reaction_type) VALUES (?, ?, ?, ?)`, [id, req.params.message_id, userId, reaction]);
        res.json({ success: true, message: 'Reacted' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Get Marketplace Settings
router.get('/settings', async (req, res) => {
    try {
        const [settings] = await pool.query(
            `SELECT * FROM marketplace_message_settings WHERE user_id = ?`,
            [req.user.user_id]
        );

        if (settings.length === 0) {
            return res.json({
                who_can_message_me: 'everyone',
                message_filter: 1,
                read_receipts: 1,
                typing_indicators: 1,
                show_online_status: 1,
                auto_reply_enabled: 0,
                auto_reply_text: ''
            });
        }

        res.json(settings[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Update Marketplace Settings
router.put('/settings', async (req, res) => {
    try {
        const { who_can_message_me, message_filter, read_receipts, typing_indicators, show_online_status, auto_reply_enabled, auto_reply_text } = req.body;
        
        await pool.query(
            `INSERT INTO marketplace_message_settings 
                (user_id, who_can_message_me, message_filter, read_receipts, typing_indicators, show_online_status, auto_reply_enabled, auto_reply_text)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                who_can_message_me = VALUES(who_can_message_me),
                message_filter = VALUES(message_filter),
                read_receipts = VALUES(read_receipts),
                typing_indicators = VALUES(typing_indicators),
                show_online_status = VALUES(show_online_status),
                auto_reply_enabled = VALUES(auto_reply_enabled),
                auto_reply_text = VALUES(auto_reply_text)`,
            [req.user.user_id, who_can_message_me, message_filter, read_receipts, typing_indicators, show_online_status, auto_reply_enabled, auto_reply_text]
        );

        res.json({ success: true, message: 'Settings updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. Toggle Conversation Flags (mute, archive, pin)
router.patch('/conversations/:id/toggle', async (req, res) => {
    try {
        const { field } = req.body;
        if (!['is_muted', 'is_archived', 'is_pinned'].includes(field)) {
            return res.status(400).json({ error: 'Invalid field' });
        }

        // Verify ownership
        const [conv] = await pool.query(
            `SELECT * FROM marketplace_conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)`,
            [req.params.id, req.user.user_id, req.user.user_id]
        );

        if (conv.length === 0) return res.status(403).json({ error: 'Unauthorized' });

        const newValue = conv[0][field] ? 0 : 1;
        await pool.query(
            `UPDATE marketplace_conversations SET ${field} = ? WHERE id = ?`,
            [newValue, req.params.id]
        );

        res.json({ success: true, field, value: !!newValue });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 11. Check Block Status for a Conversation
router.get('/conversations/:id/status', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const [conv] = await pool.query(
            `SELECT * FROM marketplace_conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)`,
            [req.params.id, userId, userId]
        );

        if (conv.length === 0) return res.status(404).json({ error: 'Conversation not found' });

        const opponentId = userId === conv[0].buyer_id ? conv[0].seller_id : conv[0].buyer_id;

        // Check if I blocked them
        const [myBlocks] = await pool.query(
            `SELECT * FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`,
            [userId, opponentId]
        );

        // Check if they blocked me
        const [theirBlocks] = await pool.query(
            `SELECT * FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`,
            [opponentId, userId]
        );

        res.json({
            isBlockedByMe: myBlocks.length > 0,
            amIBlocked: theirBlocks.length > 0,
            opponentId
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 12. Delete Conversation
router.delete('/conversations/:id', async (req, res) => {
    try {
        const userId = req.user.user_id;
        // Verify ownership
        const [conv] = await pool.query(
            `SELECT * FROM marketplace_conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)`,
            [req.params.id, userId, userId]
        );

        if (conv.length === 0) return res.status(403).json({ error: 'Unauthorized' });

        // Delete messages, reactions, status and conversation
        await pool.query(`DELETE FROM marketplace_message_reactions WHERE message_id IN (SELECT id FROM marketplace_messages WHERE conversation_id = ?)`, [req.params.id]);
        await pool.query(`DELETE FROM marketplace_message_status WHERE message_id IN (SELECT id FROM marketplace_messages WHERE conversation_id = ?)`, [req.params.id]);
        await pool.query(`DELETE FROM marketplace_messages WHERE conversation_id = ?`, [req.params.id]);
        await pool.query(`DELETE FROM marketplace_conversations WHERE id = ?`, [req.params.id]);

        res.json({ success: true, message: 'Conversation deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
