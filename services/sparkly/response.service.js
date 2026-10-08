// services/sparkly/response.service.js
// Response validation, structuring, card formatting, and source attachment

const { SafetyService } = require('./safety.service');

class ResponseService {
    /**
     * Validate and clean assistant response text
     */
    static cleanResponseText(rawText) {
        if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
            return "I don't have enough information to answer that accurately right now.";
        }

        let cleaned = SafetyService.sanitizeFinalResponse(rawText.trim());

        // Strip any accidental system prompt echoes
        cleaned = cleaned
            .replace(/^You are Sparkly.*?helpful\./is, '')
            .replace(/^As an AI language model,?\s*/i, '')
            .trim();

        return cleaned;
    }

    /**
     * Synthesize intelligent fallback response when LLM model provider is unreachable
     */
    static buildIntelligentFallback({
        intent,
        sparkleData,
        webData,
        query,
        user,
        refusalReason = null
    }) {
        if (refusalReason) {
            return refusalReason;
        }

        // 1. Marketplace search results synthesis
        if (sparkleData?.listings && sparkleData.listings.length > 0) {
            const count = sparkleData.listings.length;
            const top = sparkleData.listings[0];
            let response = `I found ${count} listing${count > 1 ? 's' : ''} on Sparkle Marketplace matching your request.\n\n`;
            response += `The top option is **${top.title}** priced at **${top.price}** (${top.condition}) on ${top.campus} campus by ${top.seller}${top.seller_verified ? ' (Verified)' : ''}.\n\n`;

            if (count > 1) {
                response += `Other available options:\n`;
                sparkleData.listings.slice(1, 4).forEach(l => {
                    response += `• **${l.title}** - ${l.price} (${l.condition}, ${l.campus})\n`;
                });
            }

            response += `\nAlways remember to meet in a designated campus safe zone and inspect the item before finalizing payment.`;
            return response;
        }

        if (sparkleData?.listings && sparkleData.listings.length === 0) {
            return `I couldn't find any active listings on Sparkle Marketplace matching "${query || 'your search'}". You might want to broaden your search criteria or check back later as new student listings are added daily.`;
        }

        // 2. Listing detail synthesis
        if (sparkleData?.listing_id) {
            const l = sparkleData;
            return `Here are the details for **${l.title}**:\n\n• **Price**: ${l.price} ${l.is_negotiable ? '(Negotiable)' : '(Fixed)'}\n• **Condition**: ${l.condition}\n• **Campus**: ${l.campus} (${l.location || 'Safe campus meetup'})\n• **Seller**: @${l.seller.username}${l.seller.is_verified ? ' (Verified Student Seller)' : ''}\n\n${l.description || ''}\n\nMake sure to inspect the item in person before confirming receipt in Marketplace Chat.`;
        }

        // 3. User profile synthesis
        if (sparkleData?.username && (intent === 'USER_PROFILE_SELF' || intent === 'USER_PROFILE_PUBLIC')) {
            const u = sparkleData;
            return `**${u.name || u.username}** (@${u.username})\n• **Campus**: ${u.campus || 'Main Campus'}\n• **Major**: ${u.major || 'Student'}${u.year_of_study ? ` (Year ${u.year_of_study})` : ''}\n• **Followers**: ${u.followersCount || 0} | **Following**: ${u.followingCount || 0}\n• **Verification**: ${u.is_verified ? 'Verified Campus Member' : 'Standard Member'}\n\n${u.bio || ''}`.trim();
        }

        // 4. Sparkle Help synthesis
        if (sparkleData?.helpArticles && sparkleData.helpArticles.length > 0) {
            const doc = sparkleData.helpArticles[0];
            return `**${doc.title}**\n\n${doc.content}`;
        }

        // 5. Web Search results synthesis
        if (webData?.results && webData.results.length > 0) {
            let res = `Based on the latest web sources I retrieved:\n\n`;
            webData.results.slice(0, 3).forEach(r => {
                res += `• **${r.title}**: ${r.snippet}\n\n`;
            });
            return res.trim();
        }

        // 6. Hybrid Price Comparison synthesis
        if (intent === 'HYBRID_PRICE_COMPARE' && sparkleData?.price) {
            return `Your Sparkle listing is ${sparkleData.price}. Based on current market information, similar models typically range between comparable rates depending on condition, battery health, and warranty. If it's in good condition, this price is competitive for campus transactions.`;
        }

        return "I'm here to help with Sparkle Marketplace, campus information, and questions. What would you like to explore?";
    }

    /**
     * Assemble final unified response payload
     */
    static formatResponse({
        content,
        sources = [],
        structuredCards = [],
        metadata = {}
    }) {
        return {
            success: true,
            message: {
                role: 'assistant',
                content: this.cleanResponseText(content)
            },
            sources: Array.isArray(sources) ? sources : [],
            structuredCards: Array.isArray(structuredCards) ? structuredCards : [],
            metadata: {
                usedSparkleData: Boolean(metadata.usedSparkleData),
                usedWebSearch: Boolean(metadata.usedWebSearch),
                domain: metadata.domain || 'GENERAL_KNOWLEDGE',
                intent: metadata.intent || 'GENERAL_CHAT'
            }
        };
    }
}

module.exports = ResponseService;
