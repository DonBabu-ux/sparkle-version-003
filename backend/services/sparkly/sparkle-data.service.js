// services/sparkly/sparkle-data.service.js
// Controlled, parameterized Sparkle data retrieval layer

const pool = require('../../config/database');
const logger = require('../../utils/logger');
const Marketplace = require('../../models/Marketplace');
const fs = require('fs');
const path = require('path');
const { SafetyService, PERMISSION_LEVELS } = require('./safety.service');

class SparkleDataService {
    /**
     * Get authorized user profile details
     */
    static async getUserProfile(userId, requestingUserId) {
        if (!userId) return null;
        try {
            const [rows] = await pool.query(
                `SELECT user_id, name, username, display_name, avatar_url, campus, major, 
                        year_of_study, bio, is_verified, role, user_role, account_status, 
                        is_online, last_seen_at, joined_at
                 FROM users 
                 WHERE user_id = ? 
                 LIMIT 1`,
                [userId]
            );

            if (!rows || rows.length === 0) return null;
            const profile = rows[0];

            // If the requesting user is checking their own profile, attach follow stats
            const isOwner = requestingUserId && String(requestingUserId) === String(userId);
            if (isOwner) {
                const stats = await this.getFollowStats(userId);
                profile.followersCount = stats.followersCount;
                profile.followingCount = stats.followingCount;
            }

            return SafetyService.stripSensitiveData(profile);
        } catch (error) {
            logger.error('[SparkleDataService] getUserProfile error:', error.message);
            return null;
        }
    }

    /**
     * Get public profile by username
     */
    static async getPublicSparkleProfile(username) {
        if (!username) return null;
        const cleanUsername = username.replace(/^@/, '').trim();
        try {
            const [rows] = await pool.query(
                `SELECT user_id, name, username, display_name, avatar_url, campus, major, 
                        year_of_study, bio, is_verified, account_status, joined_at
                 FROM users 
                 WHERE username = ? OR username_normalized = ?
                 LIMIT 1`,
                [cleanUsername, cleanUsername.toLowerCase()]
            );

            if (!rows || rows.length === 0) return null;
            const user = rows[0];
            const stats = await this.getFollowStats(user.user_id);
            user.followersCount = stats.followersCount;
            user.followingCount = stats.followingCount;

            return SafetyService.stripSensitiveData(user);
        } catch (error) {
            logger.error('[SparkleDataService] getPublicSparkleProfile error:', error.message);
            return null;
        }
    }

    /**
     * Get follower & following counts
     */
    static async getFollowStats(userId) {
        if (!userId) return { followersCount: 0, followingCount: 0 };
        try {
            const [[followers]] = await pool.query(
                'SELECT COUNT(*) as count FROM follows WHERE following_id = ?',
                [userId]
            );
            const [[following]] = await pool.query(
                'SELECT COUNT(*) as count FROM follows WHERE follower_id = ?',
                [userId]
            );
            return {
                followersCount: followers?.count || 0,
                followingCount: following?.count || 0
            };
        } catch (error) {
            logger.warn('[SparkleDataService] getFollowStats error:', error.message);
            return { followersCount: 0, followingCount: 0 };
        }
    }

    /**
     * Search Marketplace listings with filters
     */
    static async searchMarketplace({ query = '', minPrice = null, maxPrice = null, category = 'all', campus = 'all', condition = null, limit = 5 }, user = null) {
        try {
            const cleanQuery = typeof query === 'string' ? query.substring(0, 150).trim() : '';
            const parsedMax = maxPrice ? parseFloat(maxPrice) : null;
            const parsedMin = minPrice ? parseFloat(minPrice) : null;
            const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 4, 1), 10);

            let sql = `
                SELECT l.listing_id, l.title, l.description, l.price, l.category, 
                       l.condition, l.campus, l.location, l.image_url, l.is_sold, 
                       l.is_negotiable, l.average_rating, l.created_at,
                       u.user_id as seller_id, u.username as seller_username, 
                       u.name as seller_name, u.is_verified as seller_verified
                FROM marketplace_listings l
                LEFT JOIN users u ON l.seller_id = u.user_id
                WHERE (l.status = 'active' OR l.status IS NULL) 
                  AND (l.is_sold = 0 OR l.is_sold IS NULL)
            `;
            const params = [];

            if (cleanQuery) {
                sql += ` AND (l.title LIKE ? OR l.description LIKE ? OR l.category LIKE ?)`;
                const term = `%${cleanQuery}%`;
                params.push(term, term, term);
            }

            if (category && category !== 'all') {
                sql += ` AND l.category = ?`;
                params.push(category);
            }

            if (condition && condition !== 'all') {
                sql += ` AND l.condition = ?`;
                params.push(condition);
            }

            if (campus && campus !== 'all') {
                sql += ` AND (l.campus = ? OR l.campus = 'all')`;
                params.push(campus);
            }

            if (parsedMin !== null && !isNaN(parsedMin)) {
                sql += ` AND l.price >= ?`;
                params.push(parsedMin);
            }

            if (parsedMax !== null && !isNaN(parsedMax)) {
                sql += ` AND l.price <= ?`;
                params.push(parsedMax);
            }

            sql += ` ORDER BY l.is_promoted DESC, l.priority_score DESC, l.created_at DESC LIMIT ?`;
            params.push(parsedLimit);

            const [listings] = await pool.query(sql, params);

            const structuredCards = (listings || []).map(l => ({
                listing_id: l.listing_id,
                title: l.title,
                price: Number(l.price),
                formatted_price: `KSh ${Number(l.price).toLocaleString()}`,
                image_url: l.image_url,
                campus: l.campus,
                location: l.location,
                condition: l.condition,
                seller_name: l.seller_name || l.seller_username,
                seller_verified: Boolean(l.seller_verified),
                is_negotiable: Boolean(l.is_negotiable)
            }));

            return {
                query: cleanQuery,
                count: listings.length,
                listings: listings.map(l => ({
                    listing_id: l.listing_id,
                    title: l.title,
                    price: `KSh ${Number(l.price).toLocaleString()}`,
                    raw_price: Number(l.price),
                    condition: l.condition || 'Used',
                    campus: l.campus,
                    seller: l.seller_name || l.seller_username,
                    seller_verified: Boolean(l.seller_verified),
                    description: (l.description || '').substring(0, 160)
                })),
                structuredCards
            };
        } catch (error) {
            logger.error('[SparkleDataService] searchMarketplace error:', error.message);
            return { query, count: 0, listings: [], structuredCards: [] };
        }
    }

    /**
     * Get complete details of a specific Marketplace listing
     */
    static async getMarketplaceListing(listingId) {
        if (!listingId) return null;
        try {
            const [rows] = await pool.query(
                `SELECT l.*, 
                        u.user_id as seller_id, u.username as seller_username, 
                        u.name as seller_name, u.avatar_url as seller_avatar, 
                        u.is_verified as seller_verified, u.joined_at as seller_joined_at
                 FROM marketplace_listings l
                 LEFT JOIN users u ON l.seller_id = u.user_id
                 WHERE l.listing_id = ?
                 LIMIT 1`,
                [listingId]
            );

            if (!rows || rows.length === 0) return null;
            const l = rows[0];

            return {
                listing_id: l.listing_id,
                title: l.title,
                description: l.description,
                price: `KSh ${Number(l.price).toLocaleString()}`,
                raw_price: Number(l.price),
                category: l.category,
                condition: l.condition,
                campus: l.campus,
                location: l.location,
                image_url: l.image_url,
                is_negotiable: Boolean(l.is_negotiable),
                is_sold: Boolean(l.is_sold),
                average_rating: l.average_rating ? Number(l.average_rating) : null,
                created_at: l.created_at,
                seller: {
                    seller_id: l.seller_id,
                    username: l.seller_username,
                    name: l.seller_name,
                    is_verified: Boolean(l.seller_verified)
                }
            };
        } catch (error) {
            logger.error('[SparkleDataService] getMarketplaceListing error:', error.message);
            return null;
        }
    }

    /**
     * Compare multiple marketplace listings
     */
    static async compareMarketplaceListings(listingIds = []) {
        if (!Array.isArray(listingIds) || listingIds.length === 0) return [];
        const validIds = listingIds.slice(0, 4);
        try {
            const listings = [];
            for (const id of validIds) {
                const item = await this.getMarketplaceListing(id);
                if (item) listings.push(item);
            }
            return listings;
        } catch (error) {
            logger.error('[SparkleDataService] compareMarketplaceListings error:', error.message);
            return [];
        }
    }

    /**
     * Get seller profile and their active listing count
     */
    static async getMarketplaceSeller(sellerId) {
        if (!sellerId) return null;
        try {
            const [uRows] = await pool.query(
                `SELECT user_id, name, username, avatar_url, campus, is_verified, joined_at
                 FROM users WHERE user_id = ? LIMIT 1`,
                [sellerId]
            );
            if (!uRows || uRows.length === 0) return null;
            const seller = uRows[0];

            const [[countRow]] = await pool.query(
                `SELECT COUNT(*) as count FROM marketplace_listings 
                 WHERE seller_id = ? AND (is_sold = 0 OR is_sold IS NULL)`,
                [sellerId]
            );

            return {
                seller_id: seller.user_id,
                name: seller.name,
                username: seller.username,
                campus: seller.campus,
                is_verified: Boolean(seller.is_verified),
                activeListingsCount: countRow?.count || 0
            };
        } catch (error) {
            logger.error('[SparkleDataService] getMarketplaceSeller error:', error.message);
            return null;
        }
    }

    /**
     * Get user referral statistics (OWNER_ONLY)
     */
    static async getUserReferralStats(userId) {
        if (!userId) return null;
        try {
            const ReferralService = require('../referral.service');
            const data = await ReferralService.getReferralStats({ user_id: userId });
            return {
                referralCode: data.referralCode,
                referralLink: data.referralLink,
                totalInvites: data.friendsInvited || 0,
                successfulInvites: data.successfulSignups || 0,
                pendingReferrals: data.pendingReferrals || 0,
                totalEarnedKES: data.totalEarnings || 0,
                pendingRewardsKES: data.pendingRewards || 0
            };
        } catch (error) {
            logger.warn('[SparkleDataService] getUserReferralStats error:', error.message);
            return { totalInvites: 0, successfulInvites: 0, totalEarnedKES: 0 };
        }
    }

    /**
     * Get user notifications (OWNER_ONLY)
     */
    static async getUserNotifications(userId, requestingUserId, limit = 5) {
        if (!userId || String(userId) !== String(requestingUserId)) {
            return [];
        }
        try {
            const [rows] = await pool.query(
                `SELECT notification_id, type, title, content, is_read, created_at
                 FROM notifications
                 WHERE user_id = ?
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [userId, parseInt(limit, 10) || 5]
            );
            return rows || [];
        } catch (error) {
            logger.warn('[SparkleDataService] getUserNotifications error:', error.message);
            return [];
        }
    }

    /**
     * Search Sparkle Help Center articles & guidelines from local markdown docs
     */
    static searchSparkleHelp(topic) {
        if (!topic || typeof topic !== 'string') return [];
        const cleanTopic = topic.toLowerCase().trim();
        const knowledgeDir = path.join(__dirname, '..', '..', 'sparkly-knowledge');
        const results = [];

        function scanDir(dir) {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.md')) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const titleMatch = content.match(/^#\s+(.+)$/m);
                        const title = titleMatch ? titleMatch[1].trim() : entry.name.replace('.md', '');

                        // Scoring simple keyword occurrence
                        const words = cleanTopic.split(/\s+/).filter(w => w.length > 2);
                        let score = 0;
                        for (const word of words) {
                            if (content.toLowerCase().includes(word)) score += 1;
                            if (title.toLowerCase().includes(word)) score += 3;
                        }

                        if (score > 0 || cleanTopic.includes(entry.name.replace('.md', ''))) {
                            results.push({
                                title,
                                file: entry.name,
                                score,
                                content: content.substring(0, 1200)
                            });
                        }
                    } catch (e) { }
                }
            }
        }

        scanDir(knowledgeDir);
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, 3);
    }

    /**
     * Get official Marketplace Policies
     */
    static getMarketplacePolicies() {
        const rulesPath = path.join(__dirname, '..', '..', 'sparkly-knowledge', 'marketplace', 'rules.md');
        if (fs.existsSync(rulesPath)) {
            try {
                return fs.readFileSync(rulesPath, 'utf8');
            } catch (e) { }
        }
        return `Sparkle Marketplace Rules:
- All prices must be quoted in KES (Kenyan Shillings).
- Prohibited: counterfeit items, weapons, academic dishonesty items, illegal goods.
- Meetups must be conducted in safe public campus locations.
- Inspect goods thoroughly before completing transactions.
-For more rules check the marketplace page,contact support or read our legal PDFs. If stuck:DM Don or any sparkle official account for help`;
    }

    /**
     * Get registered Marketplace categories
     */
    static async getMarketplaceCategories() {
        try {
            return await Marketplace.getCategories();
        } catch (e) {
            return [
                'Electronics & Phones',
                'Laptops & Computers',
                'Fashion & Sneakers',
                'Books & Academic Material',
                'Hostel & Dorm Essentials',
                'Beauty & Personal Care',
                'Services & Tutoring'
            ];
        }
    }
}

module.exports = SparkleDataService;
