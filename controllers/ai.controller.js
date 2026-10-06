// controllers/ai.controller.js
// Core AI endpoints & Sparkly Bot Assistant Engine — with SSE Streaming

const pool = require('../config/database');
const logger = require('../utils/logger');
const SparklyService = require('../services/sparkly.service');
const SparklyModel = require('../models/sparkly.model');
const IntentService = require('../services/intent.service');
const ToolRegistryService = require('../services/toolRegistry.service');
const ContextService = require('../services/context.service');
const AIProviderService = require('../services/aiProvider.service');

/**
 * Normalize user object from request
 */
function normalizeUser(reqUser) {
    if (!reqUser) return null;
    return {
        user_id: reqUser.user_id || reqUser.id || reqUser.userId,
        id: reqUser.user_id || reqUser.id || reqUser.userId,
        username: reqUser.username || reqUser.name || 'Sparkle Member',
        name: reqUser.name || reqUser.username || 'Sparkle Member',
        campus: reqUser.campus || 'main_campus'
    };
}

/**
 * POST /api/ai/sparkly/chat
 * Primary Sparkly Assistant chat endpoint (non-streaming JSON)
 */
async function sparklyChat(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user || !user.user_id) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const { message, conversationId } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        let activeConvId = conversationId;

        if (!activeConvId) {
            const newConv = await SparklyModel.createConversation(user.user_id, message.substring(0, 30));
            activeConvId = newConv.id;
        }

        await SparklyModel.saveMessage(activeConvId, user.user_id, 'user', message.trim());

        const result = await SparklyService.processChat({
            userId: user.user_id,
            conversationId: activeConvId,
            messageText: message.trim(),
            userProfile: user
        });

        res.json({
            success: true,
            conversationId: activeConvId,
            conversationTitle: result.conversationTitle || null,
            answer: result.answer,
            structuredCards: result.structuredCards || [],
            savedMessage: result.savedMessage
        });
    } catch (err) {
        logger.error('Sparkly chat error:', err);
        res.status(500).json({
            success: false,
            message: err.message || 'SparkleAI is having trouble connecting right now. Try again in a moment.'
        });
    }
}

/**
 * POST /api/ai/sparkly/chat/stream
 * SSE streaming chat endpoint — streams AI response tokens progressively
 * 
 * Event types sent to client:
 *   event: meta       — { conversationId, conversationTitle }
 *   event: token      — { token: "chunk text" }
 *   event: cards      — { cards: [...structuredCards] }
 *   event: message    — { savedMessage: {...} }
 *   event: done       — {}
 *   event: error      — { message: "..." }
 */
async function sparklyChatStream(req, res) {
    const user = normalizeUser(req.user);
    if (!user || !user.user_id) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { message, conversationId } = req.body;
    if (!message || !message.trim()) {
        return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Set up SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    const sendSSE = (event, data) => {
        try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (e) {
            // Client disconnected
            logger.debug('SSE write failed (client disconnected)', e?.message || e);
        }
    };

    let aborted = false;
    req.on('close', () => { aborted = true; });

    try {
        let activeConvId = conversationId;

        if (!activeConvId) {
            const newConv = await SparklyModel.createConversation(user.user_id, message.substring(0, 30));
            activeConvId = newConv.id;
        }

        logger.info(`[SparklyLifecycle] REQUEST_START user=${user.user_id} conv=${activeConvId} msg="${message.trim().substring(0, 40)}"`);

        // Save user message
        await SparklyModel.saveMessage(activeConvId, user.user_id, 'user', message.trim());

        // Send conversation meta immediately
        sendSSE('meta', { type: 'init', conversationId: activeConvId });

        // Memory extraction (background)
        SparklyService.extractAndSaveMemories(message.trim(), user.user_id).catch(() => {});

        // Fetch conversation history for follow-up context
        const existingMessages = activeConvId
            ? await SparklyModel.getConversationMessages(activeConvId, user.user_id, 10)
            : [];

        // Intent classification (with conversation history)
        const { primaryIntent, toolsToCall } = IntentService.classifyIntent(message.trim(), existingMessages);
        logger.info(`[SparklyLifecycle] INTENT_DETECTED intent=${primaryIntent} tools=${toolsToCall.map(t=>t.tool).join(',')}`);

        // Tool execution
        const toolResults = [];
        let structuredCards = [];
        let webSources = [];
        let contextKnowledgeBlock = '';

        for (const item of toolsToCall) {
            if (aborted) break;
            try {
                if (item.tool === 'searchMarketplace') {
                    logger.info(`[SparklyLifecycle] MARKETPLACE_SEARCH_START query="${item.params?.query}" maxPrice=${item.params?.maxPrice}`);
                }
                const toolRes = await ToolRegistryService.executeTool(item.tool, item.params, user);
                toolResults.push(toolRes);

                if (toolRes.structuredCards?.length > 0) {
                    structuredCards = [...structuredCards, ...toolRes.structuredCards];
                }

                if (toolRes.tool === 'webSearch' && toolRes.results?.length > 0) {
                    webSources = toolRes.results;
                }

                if (item.tool === 'searchMarketplace') {
                    logger.info(`[SparklyLifecycle] MARKETPLACE_SEARCH_SUCCESS count=${toolRes.count || structuredCards.length}`);
                }

                if (toolRes.tool === 'searchKnowledge' && toolRes.results?.length > 0) {
                    contextKnowledgeBlock += `\nVERIFIED SPARKLE KNOWLEDGE RETRIEVAL:\n` +
                        toolRes.results.map((r, i) => `${i + 1}. [Title: ${r.title}] ${r.content}`).join('\n');
                }
            } catch (err) {
                logger.error(`[Stream] Tool error ${item.tool}:`, err.message);
            }
        }

        if (aborted) { res.end(); return; }

        // Send structured cards if any
        if (structuredCards.length > 0) {
            sendSSE('cards', { type: 'cards', cards: structuredCards });
        }

        // Send web sources if any
        if (webSources.length > 0) {
            sendSSE('sources', { type: 'sources', sources: webSources });
        }

        // Build messages payload
        const memories = await SparklyModel.getUserMemories(user.user_id);
        const memoryPrompt = memories.length > 0
            ? `USER SAVED PREFERENCES:\n${memories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n')}`
            : '';

        const userContextPrompt = ContextService.buildUserContext(user);

        const messagesPayload = [
            { role: 'system', content: AIProviderService.getSystemInstructions() }
        ];

        let combinedContext = userContextPrompt;
        if (memoryPrompt) combinedContext += `\n\n${memoryPrompt}`;
        if (contextKnowledgeBlock) combinedContext += `\n\n${contextKnowledgeBlock}`;
        messagesPayload.push({ role: 'system', content: combinedContext });

        // Add conversation history (excluding the just-saved user message to avoid dupe)
        existingMessages.slice(0, -1).forEach(m => {
            if (m.role === 'user' || m.role === 'assistant') {
                let textContent = m.content || '';
                if (m.role === 'assistant' && m.structured_data?.cards?.length > 0) {
                    const cardList = m.structured_data.cards.map(c => `- ${c.title} (KES ${c.price}, ${c.campus || 'Main Campus'})`).join('\n');
                    textContent += `\n[LISTINGS DISPLAYED TO USER]:\n${cardList}`;
                }
                messagesPayload.push({ role: m.role, content: textContent });
            }
        });

        messagesPayload.push({ role: 'user', content: message.trim() });

        logger.info(`[SparklyLifecycle] AI_RESPONSE_START`);
        // Stream AI response
        const fullAnswer = await AIProviderService.generateStreamingResponse(
            messagesPayload,
            { toolResults, primaryIntent, query: message.trim() },
            (token) => {
                if (!aborted) {
                    sendSSE('token', { type: 'chunk', text: token, token: token });
                }
            }
        );

        if (aborted) { res.end(); return; }

        logger.info(`[SparklyLifecycle] AI_RESPONSE_COMPLETE len=${fullAnswer?.length}`);

        // Save assistant message
        const savedMessage = await SparklyModel.saveMessage(
            activeConvId,
            user.user_id,
            'assistant',
            fullAnswer,
            structuredCards.length > 0 ? { cards: structuredCards } : null
        );

        // Generate title for new conversations
        let updatedTitle = null;
        if (existingMessages.length <= 2) {
            updatedTitle = await SparklyService.generateConversationTitle(message.trim(), fullAnswer);
            await SparklyModel.updateConversationTitle(activeConvId, user.user_id, updatedTitle);
        }

        sendSSE('message', { type: 'message', savedMessage });
        if (updatedTitle) {
            sendSSE('meta', { type: 'init', conversationId: activeConvId, conversationTitle: updatedTitle });
        }
        sendSSE('done', { type: 'done', conversationId: activeConvId, savedMessage });
        logger.info(`[SparklyLifecycle] REQUEST_COMPLETE conv=${activeConvId}`);
        res.end();
    } catch (err) {
        logger.error('Sparkly stream error:', err);
        sendSSE('error', { type: 'error', message: err.message || 'Something went wrong. Please try again.' });
        res.end();
    }
}

/**
 * GET /api/ai/sparkly/conversations
 */
async function getConversations(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const conversations = await SparklyModel.getUserConversations(user.user_id);
        res.json({ success: true, conversations });
    } catch (err) {
        logger.error('Get Sparkly conversations error:', err);
        res.status(500).json({ success: false, message: 'Failed to load conversations' });
    }
}

/**
 * GET /api/ai/sparkly/conversations/search?q=...
 */
async function searchConversations(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const query = req.query.q || '';
        if (!query.trim()) {
            return res.json({ success: true, conversations: [] });
        }

        const conversations = await SparklyModel.searchConversations(user.user_id, query.trim());
        res.json({ success: true, conversations });
    } catch (err) {
        logger.error('Search Sparkly conversations error:', err);
        res.status(500).json({ success: false, message: 'Failed to search conversations' });
    }
}

/**
 * POST /api/ai/sparkly/conversations
 */
async function createConversation(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { title } = req.body;
        const conv = await SparklyModel.createConversation(user.user_id, title || 'New Chat');
        res.status(201).json({ success: true, conversation: conv });
    } catch (err) {
        logger.error('Create Sparkly conversation error:', err);
        res.status(500).json({ success: false, message: 'Failed to create conversation' });
    }
}

/**
 * GET /api/ai/sparkly/conversations/:id/messages
 */
async function getMessages(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { id } = req.params;
        const messages = await SparklyModel.getConversationMessages(id, user.user_id);
        res.json({ success: true, messages });
    } catch (err) {
        logger.error('Get Sparkly messages error:', err);
        res.status(500).json({ success: false, message: 'Failed to load messages' });
    }
}

/**
 * DELETE /api/ai/sparkly/conversations/:id
 */
async function deleteConversation(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { id } = req.params;
        const success = await SparklyModel.deleteConversation(id, user.user_id);
        res.json({ success });
    } catch (err) {
        logger.error('Delete Sparkly conversation error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete conversation' });
    }
}

/**
 * GET /api/ai/sparkly/memories
 */
async function getMemories(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const memories = await SparklyModel.getUserMemories(user.user_id);
        res.json({ success: true, memories });
    } catch (err) {
        logger.error('Get Sparkly memories error:', err);
        res.status(500).json({ success: false, message: 'Failed to load memories' });
    }
}

/**
 * DELETE /api/ai/sparkly/memories/:id
 */
async function deleteMemory(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { id } = req.params;
        const success = await SparklyModel.deleteMemory(user.user_id, id);
        res.json({ success });
    } catch (err) {
        logger.error('Delete Sparkly memory error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete memory' });
    }
}

/**
 * DELETE /api/ai/sparkly/memories
 */
async function clearMemories(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const success = await SparklyModel.clearAllUserMemories(user.user_id);
        res.json({ success });
    } catch (err) {
        logger.error('Clear Sparkly memories error:', err);
        res.status(500).json({ success: false, message: 'Failed to clear memories' });
    }
}

/**
 * POST /api/ai/sparkly/messages/:id/feedback
 * Supports: { feedbackType: 'like'|'dislike', dislikeCategory?, dislikeReason? }
 * If feedbackType matches existing feedback, removes it (toggle off).
 */
async function postFeedback(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { id } = req.params;
        const { feedbackType, dislikeCategory, dislikeReason } = req.body;
        if (!['like', 'dislike'].includes(feedbackType)) {
            return res.status(400).json({ success: false, message: 'Invalid feedback type' });
        }

        const success = await SparklyModel.saveMessageFeedback(user.user_id, id, feedbackType, {
            dislikeCategory: dislikeCategory || null,
            dislikeReason: dislikeReason || null
        });
        res.json({ success, feedbackType });
    } catch (err) {
        logger.error('Post Sparkly feedback error:', err);
        res.status(500).json({ success: false, message: 'Failed to save feedback' });
    }
}

/**
 * DELETE /api/ai/sparkly/messages/:id/feedback
 * Remove feedback for a message
 */
async function removeFeedback(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { id } = req.params;
        const success = await SparklyModel.removeMessageFeedback(user.user_id, id);
        res.json({ success });
    } catch (err) {
        logger.error('Remove Sparkly feedback error:', err);
        res.status(500).json({ success: false, message: 'Failed to remove feedback' });
    }
}

/**
 * POST /api/ai/sparkly/conversations/:id/branch
 */
async function branchConversation(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { id } = req.params;
        const { messageId } = req.body;
        if (!messageId) {
            return res.status(400).json({ success: false, message: 'messageId is required' });
        }

        const newConv = await SparklyModel.branchConversation(user.user_id, id, messageId);
        res.json({ success: true, conversation: newConv });
    } catch (err) {
        logger.error('Branch Sparkly conversation error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to branch conversation' });
    }
}

module.exports = {
    sparklyChat,
    sparklyChatStream,
    getConversations,
    searchConversations,
    createConversation,
    getMessages,
    deleteConversation,
    getMemories,
    deleteMemory,
    clearMemories,
    postFeedback,
    removeFeedback,
    branchConversation
};
