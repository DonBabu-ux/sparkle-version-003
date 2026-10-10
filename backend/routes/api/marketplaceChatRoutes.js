const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { v4: uuidv4 } = require('uuid');

// Helper to robustly extract user ID across different token payload shapes
const getUserId = (req) => req.user?.user_id || req.user?.id || req.user?.userId;

// Require authentication for all marketplace chat routes
router.use(authMiddleware);

// 1. Get or Create Conversation (Clicking "Message Seller")
router.post('/conversations', async (req, res) => {
    const { seller_id, listing_id } = req.body;
    const buyer_id = getUserId(req);

    if (!buyer_id) {
        return res.status(401).json({ error: 'Unauthorized user' });
    }

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
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized user' });

    try {
        const [[mConvs], [pConvs]] = await Promise.all([
            pool.query(`
                SELECT c.id, c.buyer_id, c.seller_id, c.listing_id, c.last_message, c.last_activity_at,
                       c.is_muted, c.is_archived, c.is_pinned,
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
            `, [userId, userId]),

            pool.query(`
                SELECT pc.chat_id as id, pc.participant1_id as buyer_id, pc.participant2_id as seller_id,
                       pc.marketplace_listing_id as listing_id, 
                       (SELECT content FROM messages WHERE conversation_id = pc.chat_id ORDER BY sent_at DESC LIMIT 1) as last_message, 
                       pc.last_message_time as last_activity_at,
                       0 as is_muted, 0 as is_archived, 0 as is_pinned,
                       u1.username as buyer_username, u1.name as buyer_name, u1.avatar_url as buyer_avatar,
                       u2.username as seller_username, u2.name as seller_name, u2.avatar_url as seller_avatar,
                       l.title as listing_title, l.price as listing_price, l.image_url as listing_image, 
                       l.description as listing_description, l.status as listing_status
                FROM personal_chats pc
                LEFT JOIN users u1 ON pc.participant1_id = u1.user_id
                LEFT JOIN users u2 ON pc.participant2_id = u2.user_id
                LEFT JOIN marketplace_listings l ON pc.marketplace_listing_id = l.listing_id
                WHERE (pc.participant1_id = ? OR pc.participant2_id = ?)
                  AND pc.marketplace_listing_id IS NOT NULL
                ORDER BY pc.last_message_time DESC
            `, [userId, userId])
        ]);

        const existingIds = new Set(mConvs.map(c => String(c.id)));
        const filteredPConvs = pConvs.filter(c => !existingIds.has(String(c.id)));

        const combined = [...mConvs, ...filteredPConvs].sort((a, b) => {
            const timeA = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
            const timeB = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
            return timeB - timeA;
        });

        res.json(combined);
    } catch (err) {
        console.error('Error fetching marketplace conversations:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2b. Fetch Single Conversation by ID
router.get('/conversations/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized user' });

        const convId = req.params.id;
        const [convs] = await pool.query(`
            SELECT c.id COLLATE utf8mb4_general_ci as id,
                   c.buyer_id COLLATE utf8mb4_general_ci as buyer_id,
                   c.seller_id COLLATE utf8mb4_general_ci as seller_id,
                   c.listing_id COLLATE utf8mb4_general_ci as listing_id,
                   c.last_message COLLATE utf8mb4_general_ci as last_message,
                   c.last_activity_at,
                   c.is_muted, c.is_archived, c.is_pinned,
                   u1.username as buyer_username, u1.name as buyer_name, u1.avatar_url as buyer_avatar,
                   u2.username as seller_username, u2.name as seller_name, u2.avatar_url as seller_avatar,
                   l.title as listing_title, l.price as listing_price, l.image_url as listing_image, 
                   l.description as listing_description, l.status as listing_status
            FROM marketplace_conversations c
            LEFT JOIN users u1 ON c.buyer_id = u1.user_id
            LEFT JOIN users u2 ON c.seller_id = u2.user_id
            LEFT JOIN marketplace_listings l ON c.listing_id = l.listing_id
            WHERE c.id = ? AND (c.buyer_id = ? OR c.seller_id = ?)
            UNION
            SELECT pc.chat_id as id, pc.participant1_id as buyer_id, pc.participant2_id as seller_id,
                   pc.marketplace_listing_id as listing_id, 
                   (SELECT content FROM messages WHERE conversation_id = pc.chat_id ORDER BY sent_at DESC LIMIT 1) as last_message, 
                   pc.last_message_time as last_activity_at,
                   0 as is_muted, 0 as is_archived, 0 as is_pinned,
                   u1.username as buyer_username, u1.name as buyer_name, u1.avatar_url as buyer_avatar,
                   u2.username as seller_username, u2.name as seller_name, u2.avatar_url as seller_avatar,
                   l.title as listing_title, l.price as listing_price, l.image_url as listing_image, 
                   l.description as listing_description, l.status as listing_status
            FROM personal_chats pc
            LEFT JOIN users u1 ON pc.participant1_id = u1.user_id
            LEFT JOIN users u2 ON pc.participant2_id = u2.user_id
            LEFT JOIN marketplace_listings l ON pc.marketplace_listing_id = l.listing_id
            WHERE pc.chat_id = ? AND (pc.participant1_id = ? OR pc.participant2_id = ?)
        `, [convId, userId, userId, convId, userId, userId]);

        if (convs.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        res.json(convs[0]);
    } catch (err) {
        console.error('Error fetching single conversation:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Fetch Messages for a Thread
router.get('/messages/:conversation_id', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized user' });

        const convId = req.params.conversation_id;

        const [conversations] = await pool.query(
            `SELECT c.id COLLATE utf8mb4_general_ci as id,
                    c.buyer_id COLLATE utf8mb4_general_ci as buyer_id,
                    c.seller_id COLLATE utf8mb4_general_ci as seller_id,
                    c.listing_id COLLATE utf8mb4_general_ci as listing_id,
                    c.last_message COLLATE utf8mb4_general_ci as last_message,
                    c.last_activity_at, c.reminder_sent, c.is_muted, c.is_archived, c.is_pinned
             FROM marketplace_conversations c WHERE c.id = ? AND (c.buyer_id = ? OR c.seller_id = ?)
             UNION
             SELECT chat_id as id, participant1_id as buyer_id, participant2_id as seller_id, marketplace_listing_id as listing_id, NULL as last_message, last_message_time as last_activity_at, 0 as reminder_sent, 0 as is_muted, 0 as is_archived, 0 as is_pinned
             FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)`,
            [convId, userId, userId, convId, userId, userId]
        );

        if (conversations.length === 0) {
            return res.status(403).json({ error: 'Not authorized or conversation not found' });
        }

        const [messages] = await pool.query(`
            SELECT m.id, m.conversation_id, m.sender_id, m.message_text, m.message_type, m.media_url, m.reply_to_id, m.created_at, m.is_edited,
                   s.delivered_at, s.read_at, u.username as sender_username, u.name as sender_name, u.avatar_url as sender_avatar,
                   (SELECT JSON_ARRAYAGG(JSON_OBJECT('user_id', user_id, 'reaction', emoji)) FROM marketplace_message_reactions WHERE message_id = m.id) as reactions
            FROM marketplace_messages m
            LEFT JOIN marketplace_message_status s ON m.id = s.message_id
            LEFT JOIN users u ON m.sender_id = u.user_id
            WHERE m.conversation_id = ?

            UNION ALL

            SELECT m.message_id as id, m.conversation_id, m.sender_id, m.content as message_text,
                   CASE WHEN m.message_type IS NOT NULL THEN m.message_type ELSE 'text' END as message_type,
                   m.media_url, NULL as reply_to_id, m.created_at, 0 as is_edited,
                   m.delivered_at, m.read_at, u.username as sender_username, u.name as sender_name, u.avatar_url as sender_avatar,
                   NULL as reactions
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.user_id
            WHERE m.conversation_id = ? AND ? NOT IN (SELECT conversation_id FROM marketplace_messages)

            ORDER BY created_at ASC
        `, [convId, convId, convId]);
        
        messages.forEach(m => m.reactions = typeof m.reactions === 'string' ? JSON.parse(m.reactions) : (m.reactions || []));
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Edit Message
router.put('/messages/:message_id', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });
        const [msg] = await pool.query(`SELECT * FROM marketplace_messages WHERE id = ? AND sender_id = ?`, [req.params.message_id, userId]);
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
        const userId = getUserId(req);
        const [msg] = await pool.query(`SELECT * FROM marketplace_messages WHERE id = ? AND sender_id = ?`, [req.params.message_id, userId]);
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
        const userId = getUserId(req);
        if (!reaction) return res.status(400).json({ error: 'Reaction is required' });
        const id = uuidv4();
        await pool.query(`DELETE FROM marketplace_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`, [req.params.message_id, userId, reaction]);
        await pool.query(`INSERT INTO marketplace_message_reactions (reaction_id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)`, [id, req.params.message_id, userId, reaction]);
        res.json({ success: true, message: 'Reacted' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Get Marketplace Settings
router.get('/settings', async (req, res) => {
    try {
        const userId = getUserId(req);
        const [settings] = await pool.query(
            `SELECT * FROM marketplace_message_settings WHERE user_id = ?`,
            [userId]
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
        const userId = getUserId(req);
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
            [userId, who_can_message_me, message_filter, read_receipts, typing_indicators, show_online_status, auto_reply_enabled, auto_reply_text]
        );

        res.json({ success: true, message: 'Settings updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. Toggle Conversation Flags (mute, archive, pin)
router.patch('/conversations/:id/toggle', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { field } = req.body;
        if (!['is_muted', 'is_archived', 'is_pinned'].includes(field)) {
            return res.status(400).json({ error: 'Invalid field' });
        }

        // Verify ownership
        const [conv] = await pool.query(
            `SELECT * FROM marketplace_conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)`,
            [req.params.id, userId, userId]
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
        const userId = getUserId(req);
        const convId = req.params.id;

        const [conv] = await pool.query(
            `SELECT buyer_id, seller_id FROM marketplace_conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)
             UNION
             SELECT participant1_id as buyer_id, participant2_id as seller_id FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)`,
            [convId, userId, userId, convId, userId, userId]
        );

        if (conv.length === 0) return res.json({ isBlockedByMe: false, amIBlocked: false, opponentId: null });

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
        const userId = getUserId(req);
        // Verify ownership
        const [conv] = await pool.query(
            `SELECT * FROM marketplace_conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)
             UNION
             SELECT chat_id as id, participant1_id as buyer_id, participant2_id as seller_id FROM personal_chats WHERE chat_id = ? AND (participant1_id = ? OR participant2_id = ?)`,
            [req.params.id, userId, userId, req.params.id, userId, userId]
        );

        if (conv.length === 0) return res.status(403).json({ error: 'Unauthorized' });

        // Delete messages, reactions, status and conversation
        await pool.query(`DELETE FROM marketplace_message_reactions WHERE message_id IN (SELECT id FROM marketplace_messages WHERE conversation_id = ?)`, [req.params.id]);
        await pool.query(`DELETE FROM marketplace_message_status WHERE message_id IN (SELECT id FROM marketplace_messages WHERE conversation_id = ?)`, [req.params.id]);
        await pool.query(`DELETE FROM marketplace_messages WHERE conversation_id = ?`, [req.params.id]);
        await pool.query(`DELETE FROM marketplace_conversations WHERE id = ?`, [req.params.id]);
        await pool.query(`DELETE FROM personal_chats WHERE chat_id = ?`, [req.params.id]);

        res.json({ success: true, message: 'Conversation deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
