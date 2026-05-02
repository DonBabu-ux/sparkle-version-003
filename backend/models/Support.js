const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Support {
    static async createTicket(userId, data) {
        const ticketId = uuidv4();
        const { category, subject, description } = data;
        
        // Priority engine
        let priority = 'low';
        if (category === 'payment') priority = 'high';
        if (category === 'verification' || category === 'abuse') priority = 'medium';

        await db.query(\`
            INSERT INTO support_tickets 
            (ticket_id, user_id, category, subject, description, priority)
            VALUES (?, ?, ?, ?, ?, ?)
        \`, [ticketId, userId, category, subject, description, priority]);

        return ticketId;
    }

    static async getTickets(userId) {
        const [rows] = await db.query(
            'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        return rows;
    }

    static async getTicketDetails(ticketId, userId) {
        const [tickets] = await db.query(
            'SELECT * FROM support_tickets WHERE ticket_id = ? AND user_id = ?',
            [ticketId, userId]
        );
        
        if (tickets.length === 0) return null;

        const [messages] = await db.query(
            'SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC',
            [ticketId]
        );

        return { ...tickets[0], messages };
    }

    static async addMessage(ticketId, userId, message, isAdmin = 0) {
        const messageId = uuidv4();
        await db.query(\`
            INSERT INTO support_messages (message_id, ticket_id, sender_id, message, is_admin)
            VALUES (?, ?, ?, ?, ?)
        \`, [messageId, ticketId, userId, message, isAdmin]);
        
        return messageId;
    }

    // Simple Intent Matcher / Bot Response Engine
    static async getBotResponse(input) {
        const inputLower = input.toLowerCase();
        
        const faqs = [
            {
                keywords: ['verify', 'verification', 'id', 'blue badge'],
                response: 'To get verified, go to Marketplace Settings > Marketplace Verification. You will need a clear photo of your government ID and a live selfie. Processing usually takes 24 hours.'
            },
            {
                keywords: ['payment', 'payout', 'money', 'withdraw', 'mpesa'],
                response: 'Payouts are processed within 2-4 hours of a successful transaction. Ensure your payout method is correctly set up in Marketplace Settings > Payout Settings.'
            },
            {
                keywords: ['scam', 'fraud', 'fake', 'report'],
                response: 'Safety is our priority. If you encounter a suspicious listing, use the "Report" button on the listing page. For immediate help, open a High Priority support ticket under the "Abuse" category.'
            },
            {
                keywords: ['listing', 'sell', 'post', 'item'],
                response: 'To sell an item, tap the "Sell" button in the Marketplace. Ensure you provide high-quality photos and a clear description to attract buyers.'
            }
        ];

        for (const faq of faqs) {
            if (faq.keywords.some(keyword => inputLower.includes(keyword))) {
                return faq.response;
            }
        }

        return "I'm not sure I understand. Would you like to create a support ticket to speak with a human agent?";
    }
}

module.exports = Support;
