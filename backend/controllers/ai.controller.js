// controllers/ai.controller.js
// Core AI endpoints & Sparkly Bot Assistant Engine — with SSE Streaming

const pool = require('../config/database');
const crypto = require('crypto');
const { createHash } = crypto;
const redisService = require('../services/redis.service');

/**
 * Vision results are deterministic per (url, prompt); 1h is plenty for the
 * composer to stop re-paying for the same analysis.
 */
const AI_VISION_CACHE_TTL_SECONDS = 3600;
const logger = require('../utils/logger');
const { apiError } = require('../utils/serverError');
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

const SparklyController = require('./sparkly.controller');
const LLMService = require('../services/sparkly/llm.service');

/**
 * POST /api/ai/analyze-media
 * Sparkle AI media (vision) analysis for the full-screen media viewer.
 * Body: { url: string, prompt?: string }
 */
async function analyzeMedia(req, res) {
    try {
        const user = normalizeUser(req.user);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { url, prompt } = req.body || {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ success: false, message: 'url is required' });
        }

const resolvedPrompt = (typeof prompt === 'string' && prompt.trim())
  ? prompt.trim().slice(0, 500)
  : 'Describe this image concisely. If it contains text, transcribe it.';
const imageUrl = url.trim();

// Vision analysis of a given URL + prompt is deterministic and is the most
// expensive call in this controller (a third-party model round trip). The
// same media is re-analyzed whenever the composer re-opens it, so cache on
// the (url, prompt) pair. A Redis failure falls through to the live call.
let cachedResult = null;
try {
  cachedResult = await redisService.get(
    `ai:vision:${createHash('sha256').update(imageUrl + '\u0000' + resolvedPrompt).digest('hex')}`
  );
} catch (_) { /* cache is best-effort */ }

if (cachedResult?.text) {
  return res.json({ success: true, text: cachedResult.text, provider: cachedResult.provider, model: cachedResult.model, cached: true });
}

const result = await LLMService.runVision({
  imageUrl,
  prompt: resolvedPrompt
});

        if (!result?.success) {
            return res.status(502).json({
                success: false,
                message: result?.error || 'Media analysis is unavailable right now. Try again later.'
            });
        }

        if (result?.success && result.content) {
  try {
    await redisService.set(
      `ai:vision:${createHash('sha256').update(imageUrl + '\u0000' + resolvedPrompt).digest('hex')}`,
      { text: result.content, provider: result.provider, model: result.model },
      { ex: AI_VISION_CACHE_TTL_SECONDS }
    );
  } catch (_) { /* best-effort */ }
}

res.json({ success: true, text: result.content, provider: result.provider, model: result.model });
    } catch (err) {
        logger.error('Analyze media error:', err);
        res.status(500).json({ success: false, message: 'Failed to analyze media' });
    }
}

/**
 * POST /api/ai/sparkly/chat
 * Primary Sparkly Assistant chat endpoint (non-streaming JSON)
 */
async function sparklyChat(req, res) {
    return SparklyController.chat(req, res);
}

/**
 * POST /api/ai/sparkly/chat/stream
 * SSE streaming chat endpoint — streams AI response tokens progressively
 */
async function sparklyChatStream(req, res) {
    return SparklyController.chatStream(req, res);
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
        apiError(res, err);
    }
}

module.exports = {
    sparklyChat,
    sparklyChatStream,
    analyzeMedia,
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
