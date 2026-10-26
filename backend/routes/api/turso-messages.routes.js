const express = require('express');
const router = express.Router();

const { getTurso } = require('../../config/turso');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { getIO } = require('../../socket');

router.use(authMiddleware);

// NOTE: there is intentionally no POST /send here. Writes go through the
// MySQL funnel (Message.sendMessage) which dual-writes to Turso via
// services/tursoMirror.js. One writer, one mirror - never two writers.

// Watermark sync pull - what the APK calls on reconnect (or first load).
// `after` is the seq watermark from the previous pull.
router.get('/conversations/:chatId/messages', async (req, res) => {
  try {
    const chatId = String(req.params.chatId);
    const after = Number(req.query.after || 0);
    const limit = Math.min(Number(req.query.limit || 50), 100);

    const db = getTurso();
    const rs = await db.execute({
      sql: `SELECT seq, message_id, conversation_id AS chatId, sender_id, body, media_url, created_at
            FROM messages
            WHERE conversation_id = ? AND seq > ?
            ORDER BY seq
            LIMIT ?`,
      args: [chatId, after, limit],
    });

    res.json({
      messages: rs.rows,
      watermark: rs.rows.length ? Number(rs.rows[rs.rows.length - 1].seq) : after,
    });
  } catch (error) {
    console.error('[turso-messages] pull error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health probe for the APK - cheap, no writes.
router.get('/health', async (req, res) => {
  try {
    const db = getTurso();
    const rs = await db.execute('SELECT 1 AS ok');
    res.json({ status: 'ok', turso: rs.rows[0] ? true : false });
  } catch (error) {
    res.status(503).json({ status: 'error', error: error.message });
  }
});

module.exports = router;
