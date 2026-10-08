// services/sparkly/sparkly.service.js
// High-level service interface for Sparkly AI Assistant

const SparklyOrchestrator = require('./sparkly.orchestrator');
const MemoryService = require('./memory.service');
const SparklyModel = require('../../models/sparkly.model');
const logger = require('../../utils/logger');

class SparklyService {
    /**
     * Process standard chat turn
     */
    static async processChat({ userId, conversationId, messageText, userProfile, clientContext = {} }) {
        const user = userProfile || { user_id: userId, id: userId };
        const result = await SparklyOrchestrator.processChatRequest({
            user,
            message: messageText,
            conversationId,
            clientContext
        });

        return {
            answer: result.message?.content,
            structuredCards: result.structuredCards || [],
            sources: result.sources || [],
            savedMessage: result.savedMessage,
            conversationId: result.conversationId,
            conversationTitle: null,
            metadata: result.metadata
        };
    }

    /**
     * Process streaming chat turn with token & card callbacks (used by chat sockets & SSE)
     */
    static async processMessageStream({
        userId,
        userMessage,
        conversationId,
        onInit,
        onChunk,
        onCards,
        onSources,
        onDone
    }) {
        if (typeof onInit === 'function') onInit();

        const user = { user_id: userId, id: userId };
        const result = await SparklyOrchestrator.processChatRequest({
            user,
            message: userMessage,
            conversationId
        });

        if (result.structuredCards?.length > 0 && typeof onCards === 'function') {
            onCards(result.structuredCards);
        }

        if (result.sources?.length > 0 && typeof onSources === 'function') {
            onSources(result.sources);
        }

        if (typeof onChunk === 'function') {
            onChunk(result.message?.content);
        }

        if (typeof onDone === 'function') {
            await onDone({
                answer: result.message?.content,
                structuredCards: result.structuredCards,
                sources: result.sources,
                conversationId: result.conversationId
            });
        }

        return {
            answer: result.message?.content,
            structuredCards: result.structuredCards,
            sources: result.sources
        };
    }

    /**
     * Extract and save user preferences from text
     */
    static async extractAndSaveMemories(userMessage, userId) {
        return MemoryService.extractAndSavePreferences(userMessage, userId);
    }

    /**
     * Generate concise conversation title
     */
    static async generateConversationTitle(userMessage) {
        return MemoryService.generateTitle(userMessage);
    }
}

module.exports = SparklyService;
