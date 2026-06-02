// controllers/ai.controller.js
// Core AI endpoints – currently stubbed with DeepSeek integration placeholder.

const pool = require('../config/database');
const axios = require('axios');

// Helper to fetch DeepSeek API key from env
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v3/chat/completions';

// Simple cache lookup (in‑memory for now – real implementation will use ai_prompt_cache table)
const promptCache = new Map();

/**
 * POST /api/ai/chat
 * Body: { messages: [{role: 'user'|'assistant'|'system', content: string}], model?: string }
 */
async function chat(req, res) {
  try {
    const { messages, model = 'deepseek-chat' } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'Messages array required' });
    }

    // Create a deterministic hash for caching (simple JSON stringify + base64)
    const hash = Buffer.from(JSON.stringify({ model, messages })).toString('base64');
    if (promptCache.has(hash)) {
      return res.json({ success: true, cached: true, data: promptCache.get(hash) });
    }

    // Call DeepSeek API (stream disabled for simplicity)
    const response = await axios.post(
      DEEPSEEK_ENDPOINT,
      { model, messages },
      { headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}` } }
    );

    const answer = response.data?.choices?.[0]?.message?.content || '';
    // Store in cache (in‑memory; DB persistence to be added later)
    promptCache.set(hash, { answer, usage: response.data?.usage });

    // Record usage (basic token tracking – placeholder)
    // TODO: insert into ai_usage table

    res.json({ success: true, cached: false, data: { answer, usage: response.data?.usage } });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { chat };
