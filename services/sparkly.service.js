// services/sparkly.service.js - Refactored Sparkly AI Core Service Engine
const logger = require('../utils/logger');
const SparklyModel = require('../models/sparkly.model');
const IntentService = require('./intent.service');
const ToolRegistryService = require('./toolRegistry.service');
const ContextService = require('./context.service');
const AIProviderService = require('./aiProvider.service');

class SparklyService {
    /**
     * Auto-summarize Q&A turn to generate concise ChatGPT-style conversation title
     */
    static async generateConversationTitle(userMessage, aiAnswer) {
        const cleaned = userMessage
            .trim()
            .replace(/^(hi|hello|hey|can you|please|find|show me|search for|looking for|i want|where is|how much is)\s+/i, '')
            .replace(/[^\w\s-]/gi, '');
        
        if (!cleaned || cleaned.length < 2) {
            return 'Marketplace Inquiry';
        }

        const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        return title.length > 32 ? title.substring(0, 30) + '...' : title;
    }

    /**
     * Memory Extraction: Detect preferences and save to user's sparkly_user_memories table in MySQL
     */
    static async extractAndSaveMemories(userMessage, userId) {
        if (!userId) return;
        const msg = userMessage.toLowerCase();
        
        const budgetMatch = msg.match(/(?:my budget is|looking for.*under|budget of)\s*(?:kes|shillings)?\s*(\d+(?:,\d+)?|\d+k)/i);
        if (budgetMatch) {
            let val = budgetMatch[1].toLowerCase().replace(',', '');
            let budgetNum = val.endsWith('k') ? parseFloat(val.replace('k', '')) * 1000 : parseFloat(val);
            if (budgetNum > 0) {
                await SparklyModel.saveMemory(userId, 'preferred_max_budget', `KES ${budgetNum.toLocaleString()}`, 'preference');
            }
        }

        if (/looking for a (laptop|phone|iphone|macbook|ipad|tv|subwoofer|fridge|bed|table|camera|sneaker|shoes)/i.test(msg)) {
            const catMatch = msg.match(/looking for a (laptop|phone|iphone|macbook|ipad|tv|subwoofer|fridge|bed|table|camera|sneaker|shoes)/i);
            if (catMatch) {
                await SparklyModel.saveMemory(userId, 'category_interest', catMatch[1], 'interest');
            }
        }
    }

    /**
     * Main Sparkly Chat Processor
     * Pipeline: Auth -> Conversation -> Intent -> Tool Selection -> Tool Execution -> Context Assembly -> AI Provider -> Persistence
     */
    static async processChat({ userId, conversationId, messageText, userProfile }) {
        // Step 1: Memory Extraction (Asynchronous in background)
        this.extractAndSaveMemories(messageText, userId).catch(() => {});

        const existingMessages = conversationId 
            ? await SparklyModel.getConversationMessages(conversationId, userId, 10)
            : [];

        // Step 2: Intent Classification & Routing (with conversation history for follow-ups)
        const { primaryIntent, toolsToCall } = IntentService.classifyIntent(messageText, existingMessages);
        logger.info(`[SparklyService] Classified intent: "${primaryIntent}" for query: "${messageText.substring(0, 50)}"`);

        // Step 3: Server-side Allowlisted Tool Execution
        const toolResults = [];
        let structuredCards = [];
        let contextKnowledgeBlock = '';

        for (const item of toolsToCall) {
            try {
                const res = await ToolRegistryService.executeTool(item.tool, item.params, userProfile);
                toolResults.push(res);

                if (res.structuredCards && res.structuredCards.length > 0) {
                    structuredCards = [...structuredCards, ...res.structuredCards];
                }

                if (res.tool === 'searchKnowledge' && res.results && res.results.length > 0) {
                    contextKnowledgeBlock += `\nVERIFIED SPARKLE KNOWLEDGE RETRIEVAL:\n` +
                        res.results.map((r, i) => `${i + 1}. [Title: ${r.title}] ${r.content}`).join('\n');
                }
            } catch (err) {
                logger.error(`[SparklyService] Error executing tool ${item.tool}:`, err.message);
            }
        }

        // Step 4: Assemble Context & Message History
        const memories = await SparklyModel.getUserMemories(userId);
        const memoryPrompt = memories.length > 0
            ? `USER SAVED PREFERENCES:\n${memories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n')}`
            : '';

        const userContextPrompt = ContextService.buildUserContext(userProfile);

        const messagesPayload = [
            { role: 'system', content: AIProviderService.getSystemInstructions() }
        ];

        let combinedContext = userContextPrompt;
        if (memoryPrompt) combinedContext += `\n\n${memoryPrompt}`;
        if (contextKnowledgeBlock) combinedContext += `\n\n${contextKnowledgeBlock}`;

        messagesPayload.push({ role: 'system', content: combinedContext });

        existingMessages.forEach(m => {
            if (m.role === 'user' || m.role === 'assistant') {
                messagesPayload.push({ role: m.role, content: m.content });
            }
        });

        messagesPayload.push({ role: 'user', content: messageText });

        // Step 5: Replaceable AI Provider Layer (with deterministic response fallback)
        const aiAnswer = await AIProviderService.generateResponse(messagesPayload, {
            toolResults,
            primaryIntent,
            query: messageText
        });

        // Step 6: Save Message to MySQL Conversation Database
        let savedMessage = null;
        let updatedTitle = null;

        if (conversationId) {
            savedMessage = await SparklyModel.saveMessage(
                conversationId,
                userId,
                'assistant',
                aiAnswer,
                structuredCards.length > 0 ? { cards: structuredCards } : null
            );

            if (existingMessages.length <= 1) {
                updatedTitle = await this.generateConversationTitle(messageText, aiAnswer);
                await SparklyModel.updateConversationTitle(conversationId, userId, updatedTitle);
            }
        }

        return {
            answer: aiAnswer,
            structuredCards,
            savedMessage,
            conversationTitle: updatedTitle
        };
    }

    /**
     * Stream processor for Sparkly mentions inside normal chats or streaming UI
     */
    static async processMessageStream({ userId, userMessage, conversationId, replyToMessageId, persona, responseStyle, onInit, onChunk, onCards, onDone }) {
        if (typeof onInit === 'function') onInit();

        // Memory extraction
        this.extractAndSaveMemories(userMessage, userId).catch(() => {});

        // Fetch Replied-to message context if user is replying to Sparkly
        let replyContextBlock = '';
        if (replyToMessageId) {
            try {
                const pool = require('../config/database');
                const [rRows] = await pool.query('SELECT content, metadata FROM messages WHERE message_id = ? LIMIT 1', [replyToMessageId]);
                if (rRows && rRows.length > 0) {
                    const rMsg = rRows[0];
                    let rCards = [];
                    if (rMsg.metadata) {
                        try {
                            const metaObj = typeof rMsg.metadata === 'string' ? JSON.parse(rMsg.metadata) : rMsg.metadata;
                            if (Array.isArray(metaObj.cards)) rCards = metaObj.cards;
                        } catch (e) {
                            logger.debug('processMessageStream: reply message metadata JSON.parse fallback', e?.message || e);
                        }
                    }
                    replyContextBlock = `\n[REPLIED_TO_SPARKLY_MESSAGE]:\n"${rMsg.content || ''}"`;
                    if (rCards.length > 0) {
                        replyContextBlock += `\n[REPLIED_TO_MARKETPLACE_LISTINGS]:\n` +
                            rCards.map(c => `- ${c.title} (KES ${c.price}, ${c.campus || 'Main Campus'})`).join('\n');
                    }
                }
            } catch (rErr) {
                logger.warn('[SparklyService] Failed to load replyToMessage context:', rErr.message);
            }
        }

        // Intent classification
        const { primaryIntent, toolsToCall } = IntentService.classifyIntent(userMessage);

        // Tool execution
        const toolResults = [];
        let structuredCards = [];
        let contextKnowledgeBlock = '';

        for (const item of toolsToCall) {
            try {
                const res = await ToolRegistryService.executeTool(item.tool, item.params, { user_id: userId, id: userId });
                toolResults.push(res);

                if (res.structuredCards && res.structuredCards.length > 0) {
                    structuredCards = [...structuredCards, ...res.structuredCards];
                }

                if (res.tool === 'searchKnowledge' && res.results && res.results.length > 0) {
                    contextKnowledgeBlock += `\nVERIFIED SPARKLE KNOWLEDGE RETRIEVAL:\n` +
                        res.results.map((r, i) => `${i + 1}. [Title: ${r.title}] ${r.content}`).join('\n');
                }
            } catch (err) {
                logger.error(`[SparklyService] Error executing tool ${item.tool}:`, err.message);
            }
        }

        if (structuredCards.length > 0 && typeof onCards === 'function') {
            onCards(structuredCards);
        }

        // Build messages payload
        const userContextPrompt = ContextService.buildUserContext({ user_id: userId, id: userId });
        const memories = await SparklyModel.getUserMemories(userId);
        const memoryPrompt = memories.length > 0
            ? `USER SAVED PREFERENCES:\n${memories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n')}`
            : '';

        const messagesPayload = [
            { role: 'system', content: AIProviderService.getSystemInstructions() }
        ];

        let combinedContext = userContextPrompt;
        if (memoryPrompt) combinedContext += `\n\n${memoryPrompt}`;
        if (contextKnowledgeBlock) combinedContext += `\n\n${contextKnowledgeBlock}`;
        if (replyContextBlock) combinedContext += `\n\n${replyContextBlock}`;
        messagesPayload.push({ role: 'system', content: combinedContext });
        messagesPayload.push({ role: 'user', content: userMessage });

        // Stream AI response
        const fullAnswer = await AIProviderService.generateStreamingResponse(
            messagesPayload,
            { toolResults, primaryIntent, query: userMessage },
            (token) => {
                if (typeof onChunk === 'function') onChunk(token);
            }
        );

        if (typeof onDone === 'function') {
            await onDone({
                answer: fullAnswer,
                structuredCards,
                conversationId
            });
        }

        return {
            answer: fullAnswer,
            structuredCards
        };
    }
}

module.exports = SparklyService;
