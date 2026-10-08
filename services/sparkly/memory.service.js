// services/sparkly/memory.service.js
// Persistent conversation memory, window trimming, and preference extraction

const SparklyModel = require('../../models/sparkly.model');
const logger = require('../../utils/logger');

class MemoryService {
    /**
     * Load recent conversation turns with window management (max 8 messages)
     */
    static async getRecentConversationTurns(conversationId, userId, maxTurns = 8) {
        if (!conversationId || !userId) return [];
        try {
            const rawMessages = await SparklyModel.getConversationMessages(conversationId, userId, maxTurns);
            // Return chronological order
            return (rawMessages || []).map(m => ({
                role: m.role,
                content: m.content
            }));
        } catch (error) {
            logger.warn('[MemoryService] getRecentConversationTurns warning:', error.message);
            return [];
        }
    }

    /**
     * Load user saved preferences/memories
     */
    static async getUserMemories(userId) {
        if (!userId) return [];
        try {
            const memories = await SparklyModel.getUserMemories(userId);
            return memories || [];
        } catch (error) {
            logger.warn('[MemoryService] getUserMemories warning:', error.message);
            return [];
        }
    }

    /**
     * Format memories into a concise text block for model context
     */
    static formatMemoryBlock(memories = []) {
        if (!Array.isArray(memories) || memories.length === 0) return '';
        return memories
            .map(m => `- ${m.memory_key}: ${m.memory_value}`)
            .join('\n');
    }

    /**
     * Asynchronously extract and persist user preferences from conversation
     */
    static async extractAndSavePreferences(userMessage, userId) {
        if (!userId || !userMessage) return;
        const msg = userMessage.toLowerCase();

        // 1. Budget preference
        const budgetMatch = msg.match(/(?:my\s+budget\s+is|looking\s+for.*under|budget\s+of)\s*(?:ksh|kes|shillings)?\s*(\d+(?:,\d+)?|\d+k)/i);
        if (budgetMatch) {
            let val = budgetMatch[1].toLowerCase().replace(',', '');
            let budgetNum = val.endsWith('k') ? parseFloat(val.replace('k', '')) * 1000 : parseFloat(val);
            if (budgetNum > 0) {
                await SparklyModel.saveMemory(userId, 'preferred_max_budget', `KSh ${budgetNum.toLocaleString()}`, 'preference').catch(() => {});
            }
        }

        // 2. Category interest
        const catMatch = msg.match(/(?:looking\s+for|want\s+to\s+buy|interested\s+in)\s+(?:a\s+|an\s+)?(laptop|phone|iphone|macbook|ipad|tv|subwoofer|sneakers|fridge|camera|shoes)/i);
        if (catMatch) {
            await SparklyModel.saveMemory(userId, 'category_interest', catMatch[1], 'interest').catch(() => {});
        }

        // 3. Campus preference
        const campusMatch = msg.match(/(?:i'm\s+at|my\s+campus\s+is|study\s+at)\s+([a-zA-Z\s]{3,30}\s+(?:campus|university))/i);
        if (campusMatch) {
            await SparklyModel.saveMemory(userId, 'campus_location', campusMatch[1].trim(), 'preference').catch(() => {});
        }
    }

    /**
     * Generate concise conversation title from first exchange
     */
    static generateTitle(userMessage) {
        if (!userMessage) return 'New Chat';
        const cleaned = userMessage
            .trim()
            .replace(/^(hi|hello|hey|can\s+you|please|find|show\s+me|search\s+for|looking\s+for|i\s+want|is\s+this|compare)\s+/i, '')
            .replace(/[^\w\s-]/gi, '')
            .trim();

        if (!cleaned || cleaned.length < 2) return 'Marketplace Chat';
        const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        return capitalized.length > 32 ? capitalized.substring(0, 30) + '...' : capitalized;
    }

    /**
     * Save turn to conversation
     */
    static async saveTurn({ conversationId, userId, role, content, structuredData = null }) {
        if (!conversationId || !userId) return null;
        try {
            return await SparklyModel.saveMessage(conversationId, userId, role, content, structuredData);
        } catch (error) {
            logger.error('[MemoryService] saveTurn error:', error.message);
            return null;
        }
    }
}

module.exports = MemoryService;
