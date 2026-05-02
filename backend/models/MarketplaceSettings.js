const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class MarketplaceSettings {
    static async getSellerSettings(userId) {
        const [settingsRows] = await db.query(
            'SELECT * FROM marketplace_seller_settings WHERE user_id = ?',
            [userId]
        );
        
        const [verification] = await db.query(
            'SELECT status FROM marketplace_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        const verificationStatus = verification[0]?.status || 'unverified';
        const isVerified = verificationStatus === 'verified';

        const settings = settingsRows[0] || {
            profile_visibility: 'public',
            message_permissions: 'everyone',
            notifications_messages: 1,
            notifications_offers: 1,
            notifications_marketing: 0,
            auto_reply_enabled: 0,
            auto_reply_text: null
        };

        // Feature Gating Logic
        const features = {
            verification: { status: verificationStatus === 'verified' ? 'enabled' : 'limited', reason: verificationStatus === 'pending' ? 'under_review' : null },
            security: { status: 'enabled', reason: null },
            safety: { status: 'enabled', reason: null },
            analytics: { status: 'limited', reason: 'generating_data' },
            payouts: { status: isVerified ? 'enabled' : 'locked', reason: isVerified ? null : 'verification_required' },
            seller_tools: { status: 'limited', reason: 'auto_replies_only' },
            privacy: { status: 'enabled', reason: null },
            notifications: { status: 'enabled', reason: null },
            support: { status: 'enabled', reason: null }
        };

        return { ...settings, features };
    }

    static async updateSellerSettings(userId, settings) {
        const {
            profile_visibility = 'public',
            message_permissions = 'everyone',
            notifications_messages = 1,
            notifications_offers = 1,
            notifications_marketing = 0,
            auto_reply_enabled = 0,
            auto_reply_text = null
        } = settings;

        const [existing] = await db.query(
            'SELECT user_id FROM marketplace_seller_settings WHERE user_id = ?',
            [userId]
        );

        if (existing.length > 0) {
            await db.query(`
                UPDATE marketplace_seller_settings 
                SET profile_visibility = ?, message_permissions = ?, notifications_messages = ?, 
                    notifications_offers = ?, notifications_marketing = ?, auto_reply_enabled = ?, auto_reply_text = ?
                WHERE user_id = ?
            `, [profile_visibility, message_permissions, notifications_messages, notifications_offers, notifications_marketing, auto_reply_enabled, auto_reply_text, userId]);
        } else {
            await db.query(`
                INSERT INTO marketplace_seller_settings 
                (user_id, profile_visibility, message_permissions, notifications_messages, notifications_offers, notifications_marketing, auto_reply_enabled, auto_reply_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [userId, profile_visibility, message_permissions, notifications_messages, notifications_offers, notifications_marketing, auto_reply_enabled, auto_reply_text]);
        }

        return this.getSellerSettings(userId);
    }

    static async submitVerification(userId, idFrontUrl, idBackUrl, selfieUrl) {
        const verificationId = uuidv4();
        await db.query(`
            INSERT INTO marketplace_verifications 
            (verification_id, user_id, id_front_url, id_back_url, selfie_url, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `, [verificationId, userId, idFrontUrl, idBackUrl, selfieUrl]);
        
        return verificationId;
    }

    static async getVerificationStatus(userId) {
        const [rows] = await db.query(
            'SELECT status, rejection_reason FROM marketplace_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        return rows[0] || { status: 'unverified' };
    }

    static async addPayoutMethod(userId, provider, accountNumber, accountName) {
        const payoutId = uuidv4();
        
        // In a real app, accountNumber should be encrypted here
        await db.query(`
            INSERT INTO marketplace_payout_settings 
            (payout_id, user_id, provider, account_number, account_name)
            VALUES (?, ?, ?, ?, ?)
        `, [payoutId, userId, provider, accountNumber, accountName]);

        return payoutId;
    }

    static async getPayoutMethods(userId) {
        const [rows] = await db.query(
            'SELECT payout_id, provider, account_name, is_default FROM marketplace_payout_settings WHERE user_id = ?',
            [userId]
        );
        return rows;
    }

    static async getAnalytics(userId, period = '30d') {
        // Simplified analytics query - in reality this would aggregate from events/logs
        // For demonstration, we aggregate from the listings table
        const [rows] = await db.query(`
            SELECT 
                SUM(view_count) as total_views,
                COUNT(listing_id) as total_listings,
                SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as total_sales
            FROM marketplace_listings 
            WHERE seller_id = ?
        `, [userId]);

        return {
            views: rows[0].total_views || 0,
            listings: rows[0].total_listings || 0,
            sales: rows[0].total_sales || 0,
            engagement_rate: rows[0].total_views > 0 ? (rows[0].total_sales / rows[0].total_views).toFixed(4) : 0
        };
    }
}

module.exports = MarketplaceSettings;
