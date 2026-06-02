const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch'); // ensure node-fetch is available

// Helper to upsert usage stats (per user per day)
async function recordUsage(userId, ip, tokens) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  await db.query(`
    INSERT INTO ai_usage (user_id, ip_address, date, tokens_used, requests)
    VALUES (?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      tokens_used = tokens_used + VALUES(tokens_used),
      requests = requests + 1;
  `, [userId, ip, today, tokens]);
}

// Create a new conversation if needed
async function ensureConversation(userId, conversationId = null) {
  if (conversationId) {
    // verify it exists (optional)
    const [rows] = await db.query('SELECT conversation_id FROM ai_conversations WHERE conversation_id = ? AND user_id = ?', [conversationId, userId]);
    if (rows.length > 0) return conversationId;
  }
  const newId = uuidv4();
  await db.query('INSERT INTO ai_conversations (conversation_id, user_id) VALUES (?, ?)', [newId, userId]);
  return newId;
}

// Main chat handler
exports.chat = async (req, res) => {
  try {
    const user = req.user; // auth middleware attaches user
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { prompt, conversationId: providedConversationId } = req.body;
    if (!prompt) return res.status(400).json({ success: false, message: 'Prompt is required' });

    const conversationId = await ensureConversation(user.user_id, providedConversationId);

    // Store user message
    const userMessageId = uuidv4();
    await db.query(
      'INSERT INTO ai_messages (message_id, conversation_id, role, content) VALUES (?, ?, ?, ?)',
      [userMessageId, conversationId, 'user', prompt]
    );

    // Call DeepSeek API
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'AI API key not configured' });
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-coder', // or another model you prefer
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek error:', response.status, errText);
      return res.status(502).json({ success: false, message: 'AI service error', details: errText });
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || '';
    const tokenUsage = data.usage?.total_tokens || 0;

    // Store assistant message
    const assistantMessageId = uuidv4();
    await db.query(
      'INSERT INTO ai_messages (message_id, conversation_id, role, content, token_count) VALUES (?, ?, ?, ?, ?)',
      [assistantMessageId, conversationId, 'assistant', assistantMessage, tokenUsage]
    );

    // Record usage
    await recordUsage(user.user_id, req.ip, tokenUsage);

    return res.json({
      success: true,
      conversationId,
      response: assistantMessage,
      usage: tokenUsage,
    });
  } catch (err) {
    console.error('AI chat error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Placeholder handlers for future features (study, caption, etc.)
exports.studyAssistant = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.captionGenerator = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.bioGenerator = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.searchAssistant = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.friendDiscovery = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.moderateContent = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
