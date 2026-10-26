/**
 * Dual-write mirror: Sparkle messages -> Turso (libSQL).
 *
 * TEMPORARY by design - when the local-first SQLite path proves itself,
 * this file and the one call site in Message.sendMessage are the entire
 * removal surface. Disable without code changes: TURSO_DUAL_WRITE=false.
 *
 * Never blocks or breaks the MySQL write: the caller invokes this
 * fire-and-forget (setImmediate), and every failure is logged, not thrown.
 */
const { getTurso } = require('../config/turso');

function enabled() {
  return process.env.TURSO_DUAL_WRITE !== 'false';
}

async function mirrorMessage({ messageId, chatId, senderId, content, mediaUrl }) {
  if (!enabled() || !messageId || !chatId || !senderId) return { mirrored: false, reason: 'skipped' };
  if (!process.env.TURSO_AUTH_TOKEN) return { mirrored: false, reason: 'turso-not-configured' };

  const db = getTurso();
  await db.execute({
    sql: `INSERT OR IGNORE INTO messages (message_id, conversation_id, sender_id, body, media_url)
          VALUES (?, ?, ?, ?, ?)`,
    args: [String(messageId), String(chatId), String(senderId), content ?? '', mediaUrl ?? null],
  });

  const row = await db.execute({
    sql: 'SELECT seq FROM messages WHERE message_id = ?',
    args: [String(messageId)],
  });
  const seq = row.rows[0] ? Number(row.rows[0].seq) : null;

  if (seq != null) {
    await db.execute({
      sql: `INSERT INTO sync_state (conversation_id, last_seq) VALUES (?, ?)
            ON CONFLICT(conversation_id) DO UPDATE SET last_seq = MAX(last_seq, excluded.last_seq)`,
      args: [String(chatId), seq],
    }).catch(() => {});
  }

  return { mirrored: true, seq };
}

function mirrorLater(message) {
  if (!enabled()) return;
  setImmediate(async () => {
    try {
      await mirrorMessage(message);
    } catch (err) {
      console.warn('[turso-mirror] dual-write failed (non-fatal):', err.message);
    }
  });
}

module.exports = { enabled, mirrorMessage, mirrorLater };
