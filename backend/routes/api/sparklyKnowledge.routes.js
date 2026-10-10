// routes/api/sparklyKnowledge.routes.js - Knowledge Base Admin APIs & Sparkly Health Check
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const SparklyKnowledgeService = require('../../services/knowledge.service');
const { checkPgHealth } = require('../../config/postgres');
const pool = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * GET /api/sparkly/health
 * Public/Internal Health Check endpoint for Sparkly Backend & PostgreSQL Knowledge Engine
 */
router.get('/health', async (req, res) => {
    try {
        const pgHealth = await checkPgHealth();
        let mysqlStatus = 'unknown';

        try {
            await pool.query('SELECT 1');
            mysqlStatus = 'connected';
        } catch (err) {
            mysqlStatus = 'disconnected';
        }

        const aiConfigured = Boolean(process.env.DEEPSEEK_API_KEY || process.env.SPARKLE_BOT_API || process.env.OPENAI_API_KEY);

        res.json({
            status: 'ok',
            service: 'Sparkly AI Backend & Knowledge Engine',
            timestamp: new Date().toISOString(),
            databases: {
                postgresKnowledge: pgHealth,
                mysqlMain: mysqlStatus
            },
            aiProvider: {
                configured: aiConfigured,
                mode: aiConfigured ? 'external_llm_gateway' : 'deterministic_tool_fallback'
            }
        });
    } catch (err) {
        logger.error('[SparklyHealth] Error running health check:', err);
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// Authenticated Routes
router.use(authMiddleware);

/**
 * GET /api/sparkly/knowledge/search?q=query
 * Internal/Authenticated search endpoint
 */
router.get('/knowledge/search', async (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q || !q.trim()) {
            return res.status(400).json({ success: false, message: 'Search query "q" is required' });
        }
        const results = await SparklyKnowledgeService.searchKnowledge(q.trim(), { limit: parseInt(limit, 10) || 5 });
        res.json({ success: true, count: results.length, results });
    } catch (err) {
        logger.error('Knowledge search endpoint error:', err);
        res.status(500).json({ success: false, message: 'Knowledge search failed' });
    }
});

// Helper: Admin Check Middleware
function adminOnlyMiddleware(req, res, next) {
    if (req.user && (req.user.user_role === 'admin' || req.user.userType === 'admin' || req.user.is_admin === 1)) {
        return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
}

/**
 * POST /api/sparkly/knowledge (Admin Only)
 */
router.post('/knowledge', adminOnlyMiddleware, async (req, res) => {
    try {
        const { title, category, content, source, status, metadata } = req.body;
        const doc = await SparklyKnowledgeService.createDocument({ title, category, content, source, status, metadata });
        res.status(201).json({ success: true, document: doc });
    } catch (err) {
        logger.error('Create document endpoint error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to create document' });
    }
});

/**
 * PUT /api/sparkly/knowledge/:id (Admin Only)
 */
router.put('/knowledge/:id', adminOnlyMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await SparklyKnowledgeService.updateDocument(id, req.body);
        if (!updated) return res.status(404).json({ success: false, message: 'Document not found' });
        res.json({ success: true, document: updated });
    } catch (err) {
        logger.error('Update document endpoint error:', err);
        res.status(500).json({ success: false, message: 'Failed to update document' });
    }
});

/**
 * PATCH /api/sparkly/knowledge/:id/publish (Admin Only)
 */
router.patch('/knowledge/:id/publish', adminOnlyMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await SparklyKnowledgeService.publishDocument(id);
        res.json({ success: true, document: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to publish document' });
    }
});

/**
 * PATCH /api/sparkly/knowledge/:id/unpublish (Admin Only)
 */
router.patch('/knowledge/:id/unpublish', adminOnlyMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await SparklyKnowledgeService.unpublishDocument(id);
        res.json({ success: true, document: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to unpublish document' });
    }
});

/**
 * DELETE /api/sparkly/knowledge/:id (Admin Only)
 */
router.delete('/knowledge/:id', adminOnlyMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await SparklyKnowledgeService.deleteDocument(id);
        res.json({ success: deleted });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete document' });
    }
});

module.exports = router;
