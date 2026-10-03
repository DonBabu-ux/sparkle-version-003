// services/toolRegistry.service.js - Controlled Allowlisted Server-Side Tool Registry
const SparklyKnowledgeService = require('./knowledge.service');
const WebSearchService = require('./webSearch.service');
const Marketplace = require('../models/Marketplace');
const SparklyModel = require('../models/sparkly.model');
const logger = require('../utils/logger');

class ToolRegistryService {
    /**
     * Tool 1: Search Published Knowledge Base (PostgreSQL)
     */
    static async searchKnowledge({ query, limit = 4 }) {
        if (!query || typeof query !== 'string') return { results: [] };
        const cleanQuery = query.substring(0, 200).trim();
        const results = await SparklyKnowledgeService.searchKnowledge(cleanQuery, { limit: parseInt(limit, 10) || 4 });
        return {
            tool: 'searchKnowledge',
            query: cleanQuery,
            count: results.length,
            results
        };
    }

    /**
     * Tool 2: Fetch Single Knowledge Document by ID
     */
    static async getKnowledgeDocument({ id }) {
        if (!id) return { document: null };
        const doc = await SparklyKnowledgeService.getDocument(id);
        return {
            tool: 'getKnowledgeDocument',
            document: doc
        };
    }

    /**
     * Tool 3: Search Live Marketplace Listings (MySQL)
     */
    static async searchMarketplace({ query = '', minPrice = null, maxPrice = null, category = 'all', campus = 'all', limit = 4 }, user) {
        try {
            const cleanQuery = typeof query === 'string' ? query.substring(0, 150).trim() : '';
            const parsedMax = maxPrice ? parseFloat(maxPrice) : null;
            const parsedMin = minPrice ? parseFloat(minPrice) : null;

            const { listings } = await Marketplace.getListings({
                query: cleanQuery,
                minPrice: parsedMin,
                maxPrice: parsedMax,
                category,
                campus: campus || user?.campus || 'all',
                limit: parseInt(limit, 10) || 4
            }, user?.user_id || user?.id);

            const structuredCards = (listings || []).map(l => ({
                listing_id: l.listing_id,
                title: l.title,
                price: l.price,
                image_url: l.thumbnail_url || l.image_url || (l.image_urls?.[0]),
                campus: l.campus,
                location: l.location,
                condition: l.condition,
                seller_name: l.seller_name || l.username
            }));

            return {
                tool: 'searchMarketplace',
                query: cleanQuery,
                count: listings ? listings.length : 0,
                listings: listings || [],
                structuredCards
            };
        } catch (err) {
            logger.error('[ToolRegistry] searchMarketplace error:', err.message);
            return { tool: 'searchMarketplace', count: 0, listings: [], structuredCards: [] };
        }
    }

    /**
     * Tool 4: Get Marketplace Listing Details by ID
     */
    static async getMarketplaceListing({ listingId }, user) {
        if (!listingId) return { listing: null };
        try {
            const listing = await Marketplace.getListingById(listingId, user?.user_id || user?.id);
            return {
                tool: 'getMarketplaceListing',
                listing: listing || null
            };
        } catch (err) {
            logger.error('[ToolRegistry] getMarketplaceListing error:', err.message);
            return { tool: 'getMarketplaceListing', listing: null };
        }
    }

    /**
     * Tool 5: Get Seller Profile & Listings
     */
    static async getMarketplaceSeller({ sellerId }) {
        if (!sellerId) return { seller: null };
        try {
            const seller = await Marketplace.getSellerProfile(sellerId);
            return {
                tool: 'getMarketplaceSeller',
                seller: seller || null
            };
        } catch (err) {
            logger.error('[ToolRegistry] getMarketplaceSeller error:', err.message);
            return { tool: 'getMarketplaceSeller', seller: null };
        }
    }

    /**
     * Tool 6: Get Authenticated User Context Profile
     */
    static async getCurrentUserProfile(params, user) {
        return {
            tool: 'getCurrentUserProfile',
            userProfile: {
                user_id: user?.user_id || user?.id,
                username: user?.username || 'Sparkle Member',
                name: user?.name || user?.username,
                campus: user?.campus || 'Main Campus'
            }
        };
    }

    /**
     * Tool 7: Get Saved Wishlist Listings
     */
    static async getSavedMarketplaceListings(params, user) {
        const userId = user?.user_id || user?.id;
        if (!userId) return { savedListings: [], structuredCards: [] };
        try {
            const saved = await Marketplace.getUserWishlist(userId);
            const structuredCards = (saved || []).slice(0, 4).map(l => ({
                listing_id: l.listing_id,
                title: l.title,
                price: l.price,
                image_url: l.thumbnail_url || l.image_url,
                campus: l.campus,
                location: l.location,
                condition: l.condition
            }));
            return {
                tool: 'getSavedMarketplaceListings',
                count: saved ? saved.length : 0,
                savedListings: saved || [],
                structuredCards
            };
        } catch (err) {
            logger.error('[ToolRegistry] getSavedMarketplaceListings error:', err.message);
            return { tool: 'getSavedMarketplaceListings', count: 0, savedListings: [], structuredCards: [] };
        }
    }

    /**
     * Tool 8: Get User Memories/Preferences
     */
    static async getMarketplacePreferences(params, user) {
        const userId = user?.user_id || user?.id;
        if (!userId) return { memories: [] };
        const memories = await SparklyModel.getUserMemories(userId);
        return {
            tool: 'getMarketplacePreferences',
            memories
        };
    }

    /**
     * Tool 9: Get Marketplace Categories
     */
    static async getMarketplaceCategories() {
        try {
            const categories = await Marketplace.getCategories();
            return {
                tool: 'getMarketplaceCategories',
                categories
            };
        } catch (err) {
            return { tool: 'getMarketplaceCategories', categories: [] };
        }
    }

    /**
     * Tool 10: Get Official Marketplace Policies
     */
    static async getMarketplacePolicies() {
        const results = await SparklyKnowledgeService.searchKnowledge('policy rules guidelines prohibited safe', { limit: 3 });
        return {
            tool: 'getMarketplacePolicies',
            policies: results
        };
    }

    /**
     * Tool 11: Get Current Dynamic Date & Time with Timezone & Location Support
     */
    static async getCurrentDateTime({ location, timezone } = {}) {
        const LOCATION_TIMEZONE_MAP = {
            'japan': 'Asia/Tokyo',
            'tokyo': 'Asia/Tokyo',
            'london': 'Europe/London',
            'uk': 'Europe/London',
            'united kingdom': 'Europe/London',
            'england': 'Europe/London',
            'new york': 'America/New_York',
            'ny': 'America/New_York',
            'nyc': 'America/New_York',
            'usa': 'America/New_York',
            'united states': 'America/New_York',
            'us': 'America/New_York',
            'los angeles': 'America/Los_Angeles',
            'la': 'America/Los_Angeles',
            'california': 'America/Los_Angeles',
            'chicago': 'America/Chicago',
            'paris': 'Europe/Paris',
            'france': 'Europe/Paris',
            'berlin': 'Europe/Berlin',
            'germany': 'Europe/Berlin',
            'sydney': 'Australia/Sydney',
            'australia': 'Australia/Sydney',
            'beijing': 'Asia/Shanghai',
            'china': 'Asia/Shanghai',
            'shanghai': 'Asia/Shanghai',
            'hong kong': 'Asia/Hong_Kong',
            'singapore': 'Asia/Singapore',
            'india': 'Asia/Kolkata',
            'delhi': 'Asia/Kolkata',
            'mumbai': 'Asia/Kolkata',
            'dubai': 'Asia/Dubai',
            'uae': 'Asia/Dubai',
            'nairobi': 'Africa/Nairobi',
            'kenya': 'Africa/Nairobi',
            'johannesburg': 'Africa/Johannesburg',
            'south africa': 'Africa/Johannesburg',
            'cairo': 'Africa/Cairo',
            'egypt': 'Africa/Cairo',
            'toronto': 'America/Toronto',
            'canada': 'America/Toronto',
            'vancouver': 'America/Vancouver',
            'seoul': 'Asia/Seoul',
            'korea': 'Asia/Seoul',
            'south korea': 'Asia/Seoul',
            'bangkok': 'Asia/Bangkok',
            'thailand': 'Asia/Bangkok'
        };

        let targetTz = timezone;
        if (!targetTz && location) {
            const locKey = location.toLowerCase().trim();
            targetTz = LOCATION_TIMEZONE_MAP[locKey];
            if (!targetTz && location.includes('/')) {
                targetTz = location;
            }
        }
        if (!targetTz) {
            targetTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi';
        }

        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: targetTz,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            const formattedParts = formatter.formatToParts(now);
            const partMap = {};
            formattedParts.forEach(p => partMap[p.type] = p.value);

            const timeString = `${partMap.hour}:${partMap.minute} ${partMap.dayPeriod || ''}`.trim();
            const dateString = `${partMap.weekday}, ${partMap.month} ${partMap.day}, ${partMap.year}`;
            const locationLabel = location ? (location.charAt(0).toUpperCase() + location.slice(1)) : targetTz;

            return {
                tool: 'getCurrentDateTime',
                location: location || null,
                time: timeString,
                date: dateString,
                dayOfWeek: partMap.weekday,
                year: partMap.year,
                timezone: targetTz,
                fullFormatted: location 
                    ? `It's currently ${timeString} on ${dateString} in ${locationLabel} (${targetTz}).`
                    : `${timeString} on ${dateString} (${targetTz})`
            };
        } catch (e) {
            logger.warn(`Invalid timezone requested (${targetTz}), falling back to local:`, e.message);
            const now = new Date();
            return {
                tool: 'getCurrentDateTime',
                time: now.toLocaleTimeString(),
                date: now.toLocaleDateString(),
                timezone: 'Local',
                fullFormatted: `${now.toLocaleTimeString()} on ${now.toLocaleDateString()}`
            };
        }
    }

    /**
     * Tool 12: Real-time Web Search Provider
     */
    static async webSearch({ query, limit = 5 }) {
        return await WebSearchService.search({ query, limit });
    }

    /**
     * Allowlisted Tool Dispatcher
     */
    static async executeTool(toolName, inputs = {}, user = null) {
        const toolMap = {
            searchKnowledge: this.searchKnowledge.bind(this),
            getKnowledgeDocument: this.getKnowledgeDocument.bind(this),
            searchMarketplace: this.searchMarketplace.bind(this),
            getMarketplaceListing: this.getMarketplaceListing.bind(this),
            getMarketplaceSeller: this.getMarketplaceSeller.bind(this),
            getCurrentUserProfile: this.getCurrentUserProfile.bind(this),
            getSavedMarketplaceListings: this.getSavedMarketplaceListings.bind(this),
            getMarketplacePreferences: this.getMarketplacePreferences.bind(this),
            getMarketplaceCategories: this.getMarketplaceCategories.bind(this),
            getMarketplacePolicies: this.getMarketplacePolicies.bind(this),
            getCurrentDateTime: this.getCurrentDateTime.bind(this),
            webSearch: this.webSearch.bind(this)
        };

        if (!toolMap[toolName]) {
            logger.warn(`[ToolRegistry] Rejected unauthorized or invalid tool request: ${toolName}`);
            throw new Error(`Tool "${toolName}" is not registered in allowlist`);
        }

        logger.info(`[ToolRegistry] Executing allowlisted tool: ${toolName}`);
        return await toolMap[toolName](inputs, user);
    }
}

module.exports = ToolRegistryService;
