const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const notificationController = require('./notification.controller');

const supportController = {
    createTicket: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const { subject, category, description, priority, related_entity_type, related_entity_id } = req.body;
            
            const ticketId = uuidv4();
            await pool.query(`
                INSERT INTO support_tickets (
                    ticket_id, user_id, subject, category, priority, status, description, 
                    related_entity_type, related_entity_id
                ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)
            `, [
                ticketId, userId, subject, category || 'other', priority || 'medium', 
                description, related_entity_type || null, related_entity_id || null
            ]);

            // Add the initial description as the first message
            await pool.query(`
                INSERT INTO support_messages (message_id, ticket_id, sender_id, sender_type, content)
                VALUES (?, ?, ?, 'user', ?)
            `, [uuidv4(), ticketId, userId, description]);

            // Trigger Bot Response
            await supportController.triggerBotResponse(ticketId, category, description);

            res.status(201).json({ success: true, ticketId, message: 'Ticket created' });
        } catch (error) {
            console.error('Create ticket error:', error);
            res.status(500).json({ success: false, message: 'Failed to create ticket' });
        }
    },

    getTickets: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const [tickets] = await pool.query(
                'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC',
                [userId]
            );
            res.json({ success: true, tickets });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
        }
    },

    getTicketDetail: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const { ticketId } = req.params;

            const [[ticket]] = await pool.query(
                'SELECT * FROM support_tickets WHERE ticket_id = ? AND user_id = ?',
                [ticketId, userId]
            );

            if (!ticket) {
                return res.status(404).json({ success: false, message: 'Ticket not found' });
            }

            const [messages] = await pool.query(
                'SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC',
                [ticketId]
            );

            res.json({ success: true, ticket, messages });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to fetch ticket details' });
        }
    },

    addMessage: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const { ticketId } = req.params;
            const { content } = req.body;

            // Verify ownership
            const [[ticket]] = await pool.query(
                'SELECT status FROM support_tickets WHERE ticket_id = ? AND user_id = ?',
                [ticketId, userId]
            );

            if (!ticket) {
                return res.status(404).json({ success: false, message: 'Ticket not found' });
            }

            if (ticket.status === 'closed') {
                return res.status(400).json({ success: false, message: 'Ticket is closed' });
            }

            const messageId = uuidv4();
            await pool.query(`
                INSERT INTO support_messages (message_id, ticket_id, sender_id, sender_type, content)
                VALUES (?, ?, ?, 'user', ?)
            `, [messageId, ticketId, userId, content]);

            // Trigger Bot Response for specific keywords
            await supportController.triggerBotResponse(ticketId, 'reply', content);

            res.json({ success: true, messageId });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to send message' });
        }
    },

    triggerBotResponse: async (ticketId, context, userText) => {
        const text = userText.toLowerCase();
        let botResponse = "";

        // Simple Bot Logic
        if (context === 'marketplace' || text.includes('refund') || text.includes('scam') || text.includes('money')) {
            botResponse = "I've flagged this for our Marketplace Safety team. If you've been a victim of a scam, please stop all communication with the seller and do not send any more money. We'll review the listing and user account immediately.";
        } else if (text.includes('delivery') || text.includes('shipping')) {
            botResponse = "Sparkle Marketplace currently encourages local campus meetups. If you opted for delivery, ensure you used a tracked service. We recommend meeting in person at a safe, public campus location.";
        } else if (text.includes('hi') || text.includes('hello')) {
            botResponse = "Hello! I'm the Sparkle Support Bot. I've logged your request and a human team member will be with you shortly. Is there anything specific about your account or a listing I can help with?";
        } else if (context === 'account') {
            botResponse = "I see you're having account issues. Most login problems can be solved by resetting your password or verifying your university email. Would you like me to send a password reset link?";
        }

        if (botResponse) {
            // Delay bot response slightly for "realism"
            setTimeout(async () => {
                const messageId = uuidv4();
                await pool.query(`
                    INSERT INTO support_messages (message_id, ticket_id, sender_id, sender_type, content)
                    VALUES (?, ?, NULL, 'bot', ?)
                `, [messageId, ticketId, botResponse]);

                // Notify user
                const [[ticket]] = await pool.query('SELECT user_id, subject FROM support_tickets WHERE ticket_id = ?', [ticketId]);
                if (ticket) {
                    await notificationController.createNotification({
                        user_id: ticket.user_id,
                        type: 'support_update',
                        title: 'Support Bot Response',
                        content: `New response on your ticket: ${ticket.subject}`,
                        entity_type: 'support_update',
                        entity_id: ticketId,
                        action_url: `/support/ticket/${ticketId}`
                    });
                }
            }, 2000);
        }
    }
};

module.exports = supportController;
