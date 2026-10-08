// controllers/sparkly.controller.js
// Production-grade controller for Sparkly AI Assistant

const SparklyOrchestrator = require('../services/sparkly/sparkly.orchestrator');
const SparklyModel = require('../models/sparkly.model');
const logger = require('../utils/logger');
const pool = require('../config/database');

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
        campus: reqUser.campus || 'main_campus',
        language: reqUser.language || 'en'
    };
}

class SparklyController {
    /**
     * POST /api/sparkly/chat
     * Standard non-streaming chat endpoint matching Section 29 API specification
     */
    static async chat(req, res) {
        try {
            const user = normalizeUser(req.user);
            if (!user || !user.user_id) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }

            const { message, conversationId, context } = req.body;
            if (!message || typeof message !== 'string' || !message.trim()) {
                return res.status(400).json({ success: false, message: 'Message is required' });
            }

            const response = await SparklyOrchestrator.processChatRequest({
                user,
                message: message.trim(),
                conversationId: conversationId || null,
                clientContext: context || {}
            });

            // Return response matching Section 29 format + backward compatibility
            return res.json({
                success: true,
                message: response.message,
                answer: response.message?.content, // for backwards-compatibility with SparklyBot.tsx
                sources: response.sources || [],
                structuredCards: response.structuredCards || [],
                conversationId: response.conversationId,
                savedMessage: response.savedMessage,
                metadata: response.metadata
            });
        } catch (error) {
            logger.error('[SparklyController] chat error:', error);
            return res.status(500).json({
                success: false,
                message: "I'm having trouble reaching Sparkly's AI service right now. Please try again in a moment.",
                error: error.message
            });
        }
    }

    /**
     * POST /api/sparkly/chat/stream or POST /api/sparkly/stream
     * Server-Sent Events (SSE) token streaming endpoint
     */
    static async chatStream(req, res) {
        try {
            const user = normalizeUser(req.user);
            if (!user || !user.user_id) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }

            const { message, conversationId, context } = req.body;
            if (!message || typeof message !== 'string' || !message.trim()) {
                return res.status(400).json({ success: false, message: 'Message is required' });
            }

            await SparklyOrchestrator.processChatStream({
                user,
                message: message.trim(),
                conversationId: conversationId || null,
                clientContext: context || {},
                res
            });
        } catch (error) {
            logger.error('[SparklyController] chatStream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Streaming failed' });
            }
        }
    }

    /**
     * GET /api/sparkly/conversations
     */
    static async getConversations(req, res) {
        try {
            const user = normalizeUser(req.user);
            const convs = await SparklyModel.getUserConversations(user.user_id);
            res.json({ success: true, conversations: convs });
        } catch (error) {
            logger.error('[SparklyController] getConversations error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
        }
    }

    /**
     * POST /api/sparkly/conversations
     */
    static async createConversation(req, res) {
        try {
            const user = normalizeUser(req.user);
            const { title } = req.body;
            const conv = await SparklyModel.createConversation(user.user_id, title || 'New Chat');
            res.status(201).json({ success: true, conversation: conv });
        } catch (error) {
            logger.error('[SparklyController] createConversation error:', error);
            res.status(500).json({ success: false, message: 'Failed to create conversation' });
        }
    }

    /**
     * GET /api/sparkly/conversations/:id/messages
     */
    static async getMessages(req, res) {
        try {
            const user = normalizeUser(req.user);
            const { id } = req.params;
            const messages = await SparklyModel.getConversationMessages(id, user.user_id, 50);
            res.json({ success: true, messages });
        } catch (error) {
            logger.error('[SparklyController] getMessages error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch messages' });
        }
    }

    /**
     * DELETE /api/sparkly/conversations/:id
     */
    static async deleteConversation(req, res) {
        try {
            const user = normalizeUser(req.user);
            const { id } = req.params;
            await SparklyModel.deleteConversation(id, user.user_id);
            res.json({ success: true, message: 'Conversation deleted' });
        } catch (error) {
            logger.error('[SparklyController] deleteConversation error:', error);
            res.status(500).json({ success: false, message: 'Failed to delete conversation' });
        }
    }

    /**
     * POST /api/sparkly/conversations/:id/branch
     */
    static async branchConversation(req, res) {
        try {
            const user = normalizeUser(req.user);
            const { id } = req.params;
            const { messageId } = req.body;

            const originalMessages = await SparklyModel.getConversationMessages(id, user.user_id, 100);
            const cutoffIndex = originalMessages.findIndex(m => m.id === messageId);
            const branchedMessages = cutoffIndex >= 0 ? originalMessages.slice(0, cutoffIndex + 1) : originalMessages;

            const newConv = await SparklyModel.createConversation(user.user_id, `Branch of Chat`);
            for (const m of branchedMessages) {
                await SparklyModel.saveMessage(newConv.id, user.user_id, m.role, m.content, m.structured_data);
            }

            res.status(201).json({ success: true, conversation: newConv });
        } catch (error) {
            logger.error('[SparklyController] branchConversation error:', error);
            res.status(500).json({ success: false, message: 'Failed to branch conversation' });
        }
    }

    /**
     * GET /api/sparkly/memories
     */
    static async getMemories(req, res) {
        try {
            const user = normalizeUser(req.user);
            const memories = await SparklyModel.getUserMemories(user.user_id);
            res.json({ success: true, memories });
        } catch (error) {
            logger.error('[SparklyController] getMemories error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch memories' });
        }
    }

    /**
     * DELETE /api/sparkly/memories/:id
     */
    static async deleteMemory(req, res) {
        try {
            const user = normalizeUser(req.user);
            const { id } = req.params;
            await SparklyModel.deleteMemory(id, user.user_id);
            res.json({ success: true, message: 'Memory deleted' });
        } catch (error) {
            logger.error('[SparklyController] deleteMemory error:', error);
            res.status(500).json({ success: false, message: 'Failed to delete memory' });
        }
    }

    /**
     * DELETE /api/sparkly/memories
     */
    static async clearMemories(req, res) {
        try {
            const user = normalizeUser(req.user);
            await SparklyModel.clearUserMemories(user.user_id);
            res.json({ success: true, message: 'All memories cleared' });
        } catch (error) {
            logger.error('[SparklyController] clearMemories error:', error);
            res.status(500).json({ success: false, message: 'Failed to clear memories' });
        }
    }

    /**
     * POST /api/sparkly/messages/:id/feedback
     */
    static async postFeedback(req, res) {
        try {
            const user = normalizeUser(req.user);
            const { id } = req.params;
            const { feedbackType, category, reason } = req.body;
            await SparklyModel.saveFeedback(user.user_id, id, feedbackType, category, reason);
            res.json({ success: true });
        } catch (error) {
            logger.error('[SparklyController] postFeedback error:', error);
            res.status(500).json({ success: false, message: 'Failed to save feedback' });
        }
    }

    /**
     * DELETE /api/sparkly/messages/:id/feedback
     */
    static async removeFeedback(req, res) {
        try {
            const user = normalizeUser(req.user);
            const { id } = req.params;
            await SparklyModel.deleteFeedback(user.user_id, id);
            res.json({ success: true });
        } catch (error) {
            logger.error('[SparklyController] removeFeedback error:', error);
            res.status(500).json({ success: false, message: 'Failed to remove feedback' });
        }
    }

    /**
     * GET /api/sparkly/health
     */
    static async getHealth(req, res) {
        let dbOk = false;
        try {
            await pool.query('SELECT 1');
            dbOk = true;
        } catch (e) {}

        const hasBytez = Boolean(process.env.BYTEZ_API_KEY || process.env.SPARKLE_BOT_API);

        res.json({
            status: 'ok',
            service: 'Sparkly AI Assistant Gateway',
            version: '2.0.0',
            database: dbOk ? 'connected' : 'disconnected',
            aiProvider: {
                provider: 'Bytez',
                configured: hasBytez,
                model: process.env.SPARKLY_MODEL_ID || 'openai/gpt-4o-mini'
            },
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = SparklyController;
