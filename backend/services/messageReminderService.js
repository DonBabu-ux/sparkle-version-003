'use strict';

/**
 * services/messageReminderService.js
 *
 * Eligibility rules for Engagement Engine Phase 1a — consolidated unread
 * message reminders.
 *
 * The rules, taken from the spec:
 *   - a conversation unanswered for an extended period (12h) triggers one
 *     consolidated reminder covering ALL its unread messages, not one per
 *     message
 *   - if the user still has not returned, one more reminder an hour later,
 *     provided the conversation is still eligible
 *   - if the unread count reaches zero, nothing is sent
 *   - if the user responds, the schedule resets
 *   - never remind about a conversation already addressed
 *
 * How each is enforced without hooking every read path:
 *
 *   unread count / read     the count is recomputed every sweep from
 *                           messages.is_read. Reading a chat flips those
 *                           rows to 1, so the count falls to zero on its
 *                           own and the reminder row is deleted.
 *
 *   responded              a message from the user sent AFTER the oldest
 *                           unread incoming message means they replied.
 *                           That deletes the row, so the next unanswered
 *                           stretch starts a fresh schedule rather than
 *                           continuing an escalation the user already
 *                           answered.
 *
 *   not repeatedly         deletion rather than a flag, so "no row" is the
 *                           single source of truth for "not currently
 *                           reminding".
 *
 * Quiet hours and per-category preferences are NOT re-implemented here:
 * createNotification already reads dnd_enabled, dnd_start/end_time and the
 * notifications_messages toggle, and returns null when suppressed. Inserting
 * a second check would let the two disagree.
 */

const pool = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Tunables. Kept in one place so the cadence is reviewable as a policy rather
// than scattered through the query strings.
const UNANSWERED_THRESHOLD_HOURS = 12; // how long a message can sit before the first nudge
const ESCALATION_INTERVAL_MINUTES = 60; // gap between subsequent nudges
const MAX_REMINDERS_PER_CHAT = 3; // stop after this many, so a user can be left alone
const BATCH_LIMIT = 50; // claim size per sweep

class MessageReminderService {
  /**
   * Current unread incoming count for one user in one personal chat.
   */
  static async getUnreadCount(chatId, userId) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS n
       FROM messages
       WHERE conversation_id = ?
         AND is_read = 0
         AND sender_id != ?`,
      [chatId, userId]
    );
    return Number(rows[0].n);
  }

  /**
   * Has the user sent anything since the oldest unread incoming message?
   * A reply resets the schedule, per the spec.
   */
  static async hasRepliedSinceOldestUnread(chatId, userId) {
    const [rows] = await pool.query(
      `SELECT
         (SELECT MIN(sent_at) FROM messages
          WHERE conversation_id = ? AND is_read = 0 AND sender_id != ?) AS oldest_unread,
         (SELECT MAX(sent_at) FROM messages
          WHERE conversation_id = ? AND sender_id = ?) AS my_last_reply`,
      [chatId, userId, chatId, userId]
    );
    const r = rows[0];
    if (!r.oldest_unread || !r.my_last_reply) return false;
    return new Date(r.my_last_reply).getTime() >= new Date(r.oldest_unread).getTime();
  }

  /**
   * Chats that still have unread incoming messages older than the threshold,
   * for users who have no active reminder row. This is the "first nudge"
   * set; findEligibleConversations covers the escalation set.
   */
  static async findUnremindedConversations() {
    return this._collectUnanswered(true);
  }

  /**
   * The same set, but including chats already carrying a reminder row. Used
   * by the sweep to decide whether a given row's conversation is still
   * eligible at all.
   */
  static async findEligibleIncludingReminded() {
    return this._collectUnanswered(false);
  }

  static async _collectUnanswered(unremindedOnly) {
    // sender_id is in the GROUP BY on purpose. MariaDB defaults to
    // ONLY_FULL_GROUP_BY, which rejects selecting sender.username/name while
    // grouping only by conversation_id — those columns are not functionally
    // dependent on the grouped key from the server's point of view. Grouping
    // on (conversation_id, sender_id) makes them valid, and matches the
    // reality that unread incoming messages in a personal chat come from the
    // other single participant.
    const [rows] = await pool.query(
      `SELECT
         CASE WHEN pc.participant1_id = m.sender_id
              THEN pc.participant2_id
              ELSE pc.participant1_id END AS recipient_id,
         m.conversation_id               AS chat_id,
         m.sender_id                     AS sender_id,
         COUNT(*)                        AS unread_count,
         MIN(m.sent_at)                  AS oldest_unread_at,
         sender.username                 AS sender_username,
         sender.name                     AS sender_name,
         r.reminder_id,
         r.reminders_sent,
         r.last_reminded_at
       FROM messages m
       JOIN personal_chats pc ON pc.chat_id = m.conversation_id
       JOIN users sender      ON sender.user_id = m.sender_id
       LEFT JOIN message_reminders r
              ON r.chat_id = m.conversation_id
             AND r.user_id = CASE WHEN pc.participant1_id = m.sender_id
                                  THEN pc.participant2_id
                                  ELSE pc.participant1_id END
       WHERE m.is_read = 0
       GROUP BY m.conversation_id, m.sender_id, recipient_id, r.reminder_id
       HAVING MIN(m.sent_at) <= NOW() - INTERVAL ? HOUR
          AND COUNT(*) > 0
          ${unremindedOnly ? 'AND r.reminder_id IS NULL' : ''}
       ORDER BY oldest_unread_at ASC
       LIMIT ?`,
      [UNANSWERED_THRESHOLD_HOURS, BATCH_LIMIT]
    );
    return rows;
  }

  /**
   * Record that a reminder was delivered. Called only after a successful
   * send, so a failed attempt is retried on the next sweep rather than
   * silently swallowed.
   */
  static async recordReminder({ userId, chatId, unreadCount }) {
    const reminderId = uuidv4();
    await pool.query(
      `INSERT INTO message_reminders
         (reminder_id, user_id, chat_id, unread_count, reminders_sent,
          first_reminded_at, last_reminded_at)
       VALUES (?, ?, ?, ?, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         unread_count   = VALUES(unread_count),
         reminders_sent = reminders_sent + 1,
         last_reminded_at = NOW()`,
      [reminderId, userId, chatId, unreadCount]
    );
  }

  /**
   * Drop a reminder row so the next unanswered stretch starts a fresh
   * schedule. Called when a conversation stops being eligible: read to zero,
   * replied to, or already nudged MAX times.
   */
  static async clearReminder({ userId, chatId }) {
    await pool.query(
      'DELETE FROM message_reminders WHERE user_id = ? AND chat_id = ?',
      [userId, chatId]
    );
  }

  /**
   * How many reminder rows exist — used by the sweep log and by tests.
   */
  static async countActiveReminders() {
    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM message_reminders');
    return Number(rows[0].n);
  }
}

module.exports = MessageReminderService;
module.exports.UNANSWERED_THRESHOLD_HOURS = UNANSWERED_THRESHOLD_HOURS;
module.exports.ESCALATION_INTERVAL_MINUTES = ESCALATION_INTERVAL_MINUTES;
module.exports.MAX_REMINDERS_PER_CHAT = MAX_REMINDERS_PER_CHAT;
module.exports.BATCH_LIMIT = BATCH_LIMIT;
