// services/sparkly/intent.service.js
// Production-grade Intent Detection & Information Routing Engine

const logger = require('../../utils/logger');
const { SafetyService } = require('./safety.service');

// Defined Domain & Route Types
const DOMAIN_TYPES = {
    SPARKLE_INTERNAL: 'SPARKLE_INTERNAL',
    INTERNET_WEB: 'INTERNET_WEB',
    HYBRID: 'HYBRID',
    GENERAL_KNOWLEDGE: 'GENERAL_KNOWLEDGE',
    SAFETY_REFUSAL: 'SAFETY_REFUSAL'
};

const INTENT_TYPES = {
    MARKETPLACE_SEARCH: 'MARKETPLACE_SEARCH',
    MARKETPLACE_LISTING_DETAIL: 'MARKETPLACE_LISTING_DETAIL',
    MARKETPLACE_SELLER_INFO: 'MARKETPLACE_SELLER_INFO',
    MARKETPLACE_PRICE_REASONING: 'MARKETPLACE_PRICE_REASONING',
    MARKETPLACE_COMPARISON: 'MARKETPLACE_COMPARISON',
    MARKETPLACE_POLICY: 'MARKETPLACE_POLICY',
    USER_PROFILE_SELF: 'USER_PROFILE_SELF',
    USER_PROFILE_PUBLIC: 'USER_PROFILE_PUBLIC',
    USER_NOTIFICATIONS: 'USER_NOTIFICATIONS',
    USER_REFERRALS: 'USER_REFERRALS',
    SPARKLE_HELP: 'SPARKLE_HELP',
    SPARKLE_FEATURE: 'SPARKLE_FEATURE',
    WEB_SEARCH: 'WEB_SEARCH',
    HYBRID_PRICE_COMPARE: 'HYBRID_PRICE_COMPARE',
    GENERAL_CHAT: 'GENERAL_CHAT',
    SAFETY_REFUSAL: 'SAFETY_REFUSAL'
};

class IntentService {
    /**
     * Parse and route user intent, domain requirements, and parameters
     */
    static routeRequest({ message, conversationHistory = [], context = {}, user = null }) {
        if (!message || typeof message !== 'string') {
            return {
                domain: DOMAIN_TYPES.GENERAL_KNOWLEDGE,
                intent: INTENT_TYPES.GENERAL_CHAT,
                requiresSparkleData: false,
                requiresWebSearch: false,
                parameters: {}
            };
        }

        const raw = message.trim();
        const msg = raw.toLowerCase();

        // 1. Safety and Privacy Boundaries Check
        const privacyCheck = SafetyService.checkPrivacyBoundary(raw, user);
        if (!privacyCheck.allowed) {
            return {
                domain: DOMAIN_TYPES.SAFETY_REFUSAL,
                intent: INTENT_TYPES.SAFETY_REFUSAL,
                requiresSparkleData: false,
                requiresWebSearch: false,
                refusalReason: privacyCheck.reason,
                parameters: {}
            };
        }

        // 2. Hybrid Intent: Compare Sparkle Listing with Online Prices
        // "Compare this Sparkle listing with current prices online" / "Is this phone cheaper than market price?"
        const isHybridCompare = (
            (msg.includes('compare') || msg.includes('worth') || msg.includes('cheaper') || msg.includes('fair price') || msg.includes('good deal')) &&
            (msg.includes('online') || msg.includes('market price') || msg.includes('outside') || msg.includes('amazon') || msg.includes('jumia') || msg.includes('internet'))
        ) || (
            context.listingId && (msg.includes('compare with online') || msg.includes('check online price') || msg.includes('current price outside'))
        );

        if (isHybridCompare) {
            return {
                domain: DOMAIN_TYPES.HYBRID,
                intent: INTENT_TYPES.HYBRID_PRICE_COMPARE,
                requiresSparkleData: true,
                requiresWebSearch: true,
                parameters: {
                    listingId: context.listingId || null,
                    query: this.extractProductQuery(msg)
                }
            };
        }

        // 3. User Self Profile & Account Info
        if (/(what('s|\s+is)\s+my\s+username|who\s+am\s+i|show\s+(my\s+)?profile|my\s+account|how\s+many\s+followers\s+do\s+i\s+have|my\s+followers|who\s+follows\s+me)/i.test(msg)) {
            return {
                domain: DOMAIN_TYPES.SPARKLE_INTERNAL,
                intent: INTENT_TYPES.USER_PROFILE_SELF,
                requiresSparkleData: true,
                requiresWebSearch: false,
                parameters: { userId: user?.user_id || user?.id }
            };
        }

        // 4. User Notifications
        if (/(my\s+notifications|show\s+(my\s+)?notifications|any\s+new\s+notifications|check\s+notifications)/i.test(msg)) {
            return {
                domain: DOMAIN_TYPES.SPARKLE_INTERNAL,
                intent: INTENT_TYPES.USER_NOTIFICATIONS,
                requiresSparkleData: true,
                requiresWebSearch: false,
                parameters: { userId: user?.user_id || user?.id }
            };
        }

        // 5. User Referral Stats
        if (/(my\s+referrals|referral\s+code|referral\s+stats|how\s+many\s+people\s+have\s+i\s+invited|invite\s+rewards)/i.test(msg)) {
            return {
                domain: DOMAIN_TYPES.SPARKLE_INTERNAL,
                intent: INTENT_TYPES.USER_REFERRALS,
                requiresSparkleData: true,
                requiresWebSearch: false,
                parameters: { userId: user?.user_id || user?.id }
            };
        }

        // 6. Public Profile Lookup
        const profileMatch = msg.match(/(?:who is|show profile for|look up user|tell me about)\s+@?([a-zA-Z0-9_]{3,30})/i);
        if (profileMatch && !['sparkly', 'sparkle'].includes(profileMatch[1].toLowerCase())) {
            return {
                domain: DOMAIN_TYPES.SPARKLE_INTERNAL,
                intent: INTENT_TYPES.USER_PROFILE_PUBLIC,
                requiresSparkleData: true,
                requiresWebSearch: false,
                parameters: { username: profileMatch[1] }
            };
        }

        // 7. Sparkle Platform Help, Policies & How-To
        if (/(how\s+do\s+i\s+change\s+my\s+username|how\s+to\s+change\s+username|how\s+to\s+sell|selling\s+rules|marketplace\s+rules|prohibited\s+items|safe\s+meetup|sparkle\s+pay|how\s+does\s+sparkle\s+pay\s+work|verify\s+account|how\s+to\s+get\s+verified|community\s+guidelines)/i.test(msg)) {
            return {
                domain: DOMAIN_TYPES.SPARKLE_INTERNAL,
                intent: INTENT_TYPES.SPARKLE_HELP,
                requiresSparkleData: true,
                requiresWebSearch: false,
                parameters: { topic: raw }
            };
        }

        // 8. Specific Listing Context / Inquiries
        if (context.listingId && /(this\s+phone|this\s+listing|this\s+item|this\s+laptop|the\s+seller|is\s+it\s+worth|worth\s+buying|what\s+does\s+it\s+include)/i.test(msg)) {
            return {
                domain: DOMAIN_TYPES.SPARKLE_INTERNAL,
                intent: INTENT_TYPES.MARKETPLACE_LISTING_DETAIL,
                requiresSparkleData: true,
                requiresWebSearch: false,
                parameters: { listingId: context.listingId }
            };
        }

        // 9. Marketplace Search Intent
        const isMarketplaceSearch = (
            /(find|search|looking\s+for|show\s+me|get\s+me|buy|cheap|phones|laptops?|shoes?|sneakers?|furniture|tv|fridge|bed|subwoofer|camera|calculator|textbook)/i.test(msg) &&
            !/(news|weather|sports|scores|today's news|wikipedia)/i.test(msg)
        ) || /(on\s+sparkle|on\s+marketplace|in\s+marketplace|sparkle\s+marketplace)/i.test(msg);

        if (isMarketplaceSearch) {
            const priceInfo = this.extractPriceConstraint(msg);
            const cleanSearchQuery = this.extractProductQuery(msg);
            return {
                domain: DOMAIN_TYPES.SPARKLE_INTERNAL,
                intent: INTENT_TYPES.MARKETPLACE_SEARCH,
                requiresSparkleData: true,
                requiresWebSearch: false,
                parameters: {
                    query: cleanSearchQuery,
                    maxPrice: priceInfo.maxPrice,
                    minPrice: priceInfo.minPrice,
                    campus: context.campus || user?.campus || 'all'
                }
            };
        }

        // 10. Web Search Intent (Temporal & Live External Information - Section 44)
        const isExplicitWeb = /(search\s+the\s+(internet|web)|google\s+|look\s+up\s+online|search\s+online)/i.test(msg);
        const isTemporalQuery = /(latest|today('s)?|current|recent|this\s+week|this\s+month|2026|breaking|newly\s+released|price\s+today|current\s+price|latest\s+version|recent\s+news|what('s|\s+is)\s+happening\s+in\s+kenya|kenya\s+today)/i.test(msg);
        const isLiveWorldQuery = /(weather\s+in|premier\s+league|epl\s+scores|who\s+won|stock\s+price|president\s+of)/i.test(msg);

        if (isExplicitWeb || isTemporalQuery || isLiveWorldQuery) {
            let webQuery = raw
                .replace(/\b(search\s+the\s+(internet|web)\s+for|google|search\s+online\s+for|look\s+up\s+online\s+for|find\s+on\s+the\s+web|can\s+you\s+search\s+for)\b/gi, '')
                .trim();
            if (!webQuery || webQuery.length < 2) webQuery = raw;

            return {
                domain: DOMAIN_TYPES.INTERNET_WEB,
                intent: INTENT_TYPES.WEB_SEARCH,
                requiresSparkleData: false,
                requiresWebSearch: true,
                parameters: { query: webQuery }
            };
        }

        // 11. General Knowledge (timeless questions, coding, general explanations)
        return {
            domain: DOMAIN_TYPES.GENERAL_KNOWLEDGE,
            intent: INTENT_TYPES.GENERAL_CHAT,
            requiresSparkleData: false,
            requiresWebSearch: false,
            parameters: {}
        };
    }

    /**
     * Extract numerical price constraints like "under 20k", "under KSh 20,000", "below 15000"
     */
    static extractPriceConstraint(msg) {
        let maxPrice = null;
        let minPrice = null;

        const maxMatch = msg.match(/(?:under|below|less\s+than|max|budget\s+(?:of|is)?)\s*(?:ksh|kes)?\s*(\d+(?:,\d+)?|\d+k)\b/i);
        if (maxMatch) {
            let val = maxMatch[1].toLowerCase().replace(',', '');
            maxPrice = val.endsWith('k') ? parseFloat(val.replace('k', '')) * 1000 : parseFloat(val);
        }

        const minMatch = msg.match(/(?:above|more\s+than|min|starting\s+(?:from|at))\s*(?:ksh|kes)?\s*(\d+(?:,\d+)?|\d+k)\b/i);
        if (minMatch) {
            let val = minMatch[1].toLowerCase().replace(',', '');
            minPrice = val.endsWith('k') ? parseFloat(val.replace('k', '')) * 1000 : parseFloat(val);
        }

        return { maxPrice, minPrice };
    }

    /**
     * Extract product search query from natural conversational sentences
     */
    static extractProductQuery(msg) {
        return msg
            .replace(/\b(find\s+me|find|search\s+for|looking\s+for|show\s+me|get\s+me|can\s+you\s+find|a\s+good|a\s+cheap|best)\b/gi, '')
            .replace(/\b(under|below|less\s+than|max|budget\s+of)?\s*(?:ksh|kes)?\s*(\d+(?:,\d+)?|\d+k)\b/gi, '')
            .replace(/\b(on\s+sparkle|on\s+marketplace|in\s+sparkle)\b/gi, '')
            .replace(/[^\w\s-]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

module.exports = {
    IntentService,
    DOMAIN_TYPES,
    INTENT_TYPES
};
