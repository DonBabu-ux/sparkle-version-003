// services/intent.service.js - Upgraded Conversational & Task Intent Classifier Router
const logger = require('../utils/logger');

class IntentService {
    /**
     * Classify user query intent into specific conversational or tool task categories
     * @param {string} messageText 
     * @param {Array} conversationHistory 
     */
    static classifyIntent(messageText, conversationHistory = []) {
        if (!messageText || typeof messageText !== 'string') {
            return { primaryIntent: 'GENERAL_CONVERSATION', toolsToCall: [] };
        }

        const msg = messageText.trim().toLowerCase();
        const toolsToCall = [];

        // 1. Web Search Capability Inquiry ("can u search the internet?")
        if (/(can\s+(you|u)\s+search\s+(the\s+)?(internet|web|online)|do\s+you\s+have\s+(web|internet)\s+access|can\s+(you|u)\s+browse\s+the\s+web|are\s+you\s+connected\s+to\s+the\s+internet)/i.test(msg)) {
            return { primaryIntent: 'WEB_SEARCH_CAPABILITY', toolsToCall: [] };
        }

        // 2. Explicit Web Search / Temporal Live Queries ("search the internet for Kenya tech news")
        const isExplicitWebSearch = /(search\s+the\s+(internet|web)\s+for|google\s+|search\s+online\s+for|look\s+up\s+online\s+for|find\s+on\s+the\s+web)/i.test(msg);
        const isTemporalQuery = /(latest|today's|current|recent)\s+(news|weather|football|sports|stock|events|technology|tech news)/i.test(msg);
        if (isExplicitWebSearch || isTemporalQuery) {
            let webQuery = messageText
                .replace(/\b(search\s+the\s+(internet|web)\s+for|google|search\s+online\s+for|look\s+up\s+online\s+for|find\s+on\s+the\s+web|can\s+you\s+search\s+for)\b/gi, '')
                .replace(/[^\w\s]/gi, ' ')
                .trim();
            if (!webQuery || webQuery.length < 2) webQuery = messageText;
            toolsToCall.push({ tool: 'webSearch', params: { query: webQuery, limit: 5 } });
            return { primaryIntent: 'WEB_SEARCH', toolsToCall };
        }

        // 3. Time Intent
        if (/(what time is it|tell me the time|what's the time|current time|what is the time)/i.test(msg)) {
            const locMatch = msg.match(/(?:in|for|at)\s+([a-z\s]+)$/i) || msg.match(/(?:what time is it in|what's the time in)\s+([a-z\s]+)/i);
            const location = locMatch ? locMatch[1].trim() : null;
            toolsToCall.push({ tool: 'getCurrentDateTime', params: location ? { location } : {} });
            return { primaryIntent: 'TIME', toolsToCall };
        }

        // 4. Date Intent
        if (/(what day is today|what's today's date|what is the date|today's date|current date)/i.test(msg)) {
            const locMatch = msg.match(/(?:in|for|at)\s+([a-z\s]+)$/i);
            const location = locMatch ? locMatch[1].trim() : null;
            toolsToCall.push({ tool: 'getCurrentDateTime', params: location ? { location } : {} });
            return { primaryIntent: 'DATE', toolsToCall };
        }

        // 5. Greeting Intent
        if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup|hey sparkly|hi sparkly)[\s!.]*$/i.test(msg)) {
            return { primaryIntent: 'GREETING', toolsToCall: [] };
        }

        // 6. Casual Conversation / Responses ("how are you", "okay", "nice", "cool")
        if (/(how are you|how's it going|what's up|how are you doing|how do you do)/i.test(msg) ||
            /^(okay|ok|nice|cool|awesome|got it|sweet|great)[\s!.]*$/i.test(msg)) {
            return { primaryIntent: 'CASUAL_CONVERSATION', toolsToCall: [] };
        }

        // 7. Identity
        if (/(who are you|what is your name|who made you|who created you|what are you)/i.test(msg)) {
            return { primaryIntent: 'IDENTITY', toolsToCall: [] };
        }

        // 8. Capabilities & Help
        if (/(what can you do|what are your features|how can you help|help me|what do you do|what are your capabilities)/i.test(msg)) {
            return { primaryIntent: 'CAPABILITIES', toolsToCall: [] };
        }

        // 9. Thanks
        if (/(thank you|thanks|thx|thanks a lot|appreciate it|thank u)/i.test(msg)) {
            return { primaryIntent: 'THANKS', toolsToCall: [] };
        }

        // 10. Farewell
        if (/(bye|goodbye|good night|see ya|talk to you later|cya)/i.test(msg)) {
            return { primaryIntent: 'FAREWELL', toolsToCall: [] };
        }

        // 11. Saved Listings / Wishlist
        if (/(saved|wishlist|favorites|my saved items|my wishlist|items i saved)/i.test(msg)) {
            toolsToCall.push({ tool: 'getSavedMarketplaceListings', params: {} });
            return { primaryIntent: 'SAVED_LISTINGS', toolsToCall };
        }

        // 12. Official Policies & Knowledge / FAQs
        if (/(how to sell|how do i sell|selling rules|marketplace rules|policies|policy|prohibited items|safety|how to buy|how does payment work|refund policy|delivery rules|community guidelines|create a listing|how to contact seller)/i.test(msg)) {
            toolsToCall.push({ tool: 'searchKnowledge', params: { query: messageText } });
            toolsToCall.push({ tool: 'getMarketplacePolicies', params: {} });
            return { primaryIntent: 'KNOWLEDGE_QUERY', toolsToCall };
        }

        // Helper: Find last active marketplace search query from conversation history
        const findLastMarketplaceQuery = (history) => {
            if (!Array.isArray(history) || history.length === 0) return null;
            for (let i = history.length - 1; i >= 0; i--) {
                const item = history[i];
                const content = item.content || '';
                if (item.role === 'user') {
                    const clean = content.toLowerCase()
                        .replace(/\b(find|show|me|search|looking for|buy|get|cheap|under|below|less than|kes|shillings|brand new|new|used|second hand|listings|listing|sparkle|marketplace|recommend)\b/gi, '')
                        .replace(/[^\w\s]/gi, '')
                        .trim();
                    if (clean && clean.length >= 2 && !/^(new|brand new|used|under \d+|cheap)$/i.test(clean)) {
                        return clean;
                    }
                }
            }
            return null;
        };

        // 13. Follow-Up or Direct Live Marketplace Search
        const isFollowUpFilter = /^(brand new|new|used|second hand|pre-owned|under\s*\d+k?|below\s*\d+k?|less than\s*\d+k?|cheap ones?)$/i.test(msg);
        const isMarketplaceSearch = isFollowUpFilter || /(find|show|search|looking for|buy|get|cheap|phone|laptop|electronics|furniture|books|clothes|price|under|below|budget of|kes|shillings|iphone|macbook|tv|shoes|sneakers|trending|deal|deals|item|items|top rated|popular|hot|featured|recommend|sublease|campus|listing|listings)/i.test(msg);

        if (isMarketplaceSearch) {
            let maxPrice = null;
            const priceMatch = msg.match(/(?:under|below|less than|budget of)\s*(?:kes|shillings|k)?\s*(\d+(?:,\d+)?|\d+k)/i);
            if (priceMatch) {
                let raw = priceMatch[1].toLowerCase().replace(',', '');
                maxPrice = raw.endsWith('k') ? parseFloat(raw.replace('k', '')) * 1000 : parseFloat(raw);
            }

            let condition = null;
            if (/(brand new|\bnew\b|mint condition)/i.test(msg)) {
                condition = 'new';
            } else if (/(used|second hand|pre-owned|preowned)/i.test(msg)) {
                condition = 'used';
            }

            let queryKeyword = messageText
                .replace(/\b(find|show|me|search|looking for|buy|get|cheap|under|below|less than|kes|shillings|\d+k|\d+|what are|the|top|items|and|on|today|sparkle|today\??|listings|listing|marketplace|recommend)\b/gi, '')
                .replace(/\b(brand new|new|used|second hand|pre-owned)\b/gi, '')
                .replace(/[^\w\s]/gi, '')
                .trim();

            // Handle follow-up queries (e.g. "brand new" after "find shoes")
            if ((!queryKeyword || queryKeyword.length < 2) && isFollowUpFilter) {
                const previousQuery = findLastMarketplaceQuery(conversationHistory);
                if (previousQuery) {
                    queryKeyword = previousQuery;
                }
            }

            if (/(trending|deal|deals|top rated|popular|hot|featured)/i.test(msg)) {
                queryKeyword = 'trending';
            } else if (!queryKeyword || queryKeyword.length < 2) {
                queryKeyword = messageText.replace(/\b(find|show me|search for|looking for|get me|listings|listing|sparkle|marketplace|recommend)\b/gi, '').replace(/[^\w\s]/gi, '').trim() || messageText;
            }

            toolsToCall.push({
                tool: 'searchMarketplace',
                params: {
                    query: queryKeyword,
                    maxPrice,
                    condition
                }
            });
            return { primaryIntent: 'MARKETPLACE_SEARCH', toolsToCall };
        }

        // 14. User Context & Preferences
        if (/(my preferences|my campus|my budget|my profile|saved preferences|my username)/i.test(msg)) {
            toolsToCall.push({ tool: 'getMarketplacePreferences', params: {} });
            toolsToCall.push({ tool: 'getCurrentUserProfile', params: {} });
            return { primaryIntent: 'USER_CONTEXT', toolsToCall };
        }

        // 15. General Technical / General Q&A (e.g., "What is HTML?", "What is Python?")
        if (/(what is|explain|how does|definition of|meaning of|tell me about)/i.test(msg) && !msg.includes('sparkle') && !msg.includes('marketplace')) {
            return { primaryIntent: 'GENERAL_QA', toolsToCall: [] };
        }

        // Default Fallback: General Conversation with default knowledge search
        toolsToCall.push({ tool: 'searchKnowledge', params: { query: messageText } });
        return { primaryIntent: 'GENERAL_CONVERSATION', toolsToCall };
    }
}

module.exports = IntentService;
