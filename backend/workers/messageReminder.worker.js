const cron = require('node-cron');
const pool = require('../config/database');
const logger = require('../utils/logger');
const MessageReminderService = require('../services/messageReminderService');
const NotificationService = require('../services/notification.service');

// Every 30 minutes, staggered from the marketplace inactivity notifier
// (*/30 on the same schedule would collide). 10 past the half hour.
const SCHEDULE = '10,40 * * * *';

const sendReminder = async (row) => {
  const senderLabel = row.sender_name || row.sender_username || 'Someone';
  const count = Number(row.unread_count) || 1;
  const plural = count === 1 ? 'message' : 'messages';

  await NotificationService.send({
    type: 'message',
    priority: 'NORMAL',
    recipients: [row.recipient_id],
    data: {
      title: `You've got ${count} unread ${plural}!`,
      content: `Don't leave your conversations hanging. ${senderLabel} is waiting for your reply.`,
      url: `/messages/${row.chat_id}`,
      chatId: row.chat_id,
      unreadCount: String(count),
    },
  });
};

cron.schedule(SCHEDULE, async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Snapshot every unanswered conversation. Deliberately not FOR UPDATE
    // SKIP LOCKED: the eligibility decision needs the CURRENT unread count,
    // which is only trustworthy outside a long-held transaction, and the
    // reminder row itself is the lock (UNIQUE(user_id, chat_id)).
    //
    // sender_id is in the GROUP BY because MariaDB defaults to
    // ONLY_FULL_GROUP_BY, which would otherwise reject sender.username/name.
    const [candidates] = await connection.query(
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
       ORDER BY oldest_unread_at ASC
       LIMIT ?`,
      [MessageReminderService.UNANSWERED_THRESHOLD_HOURS, MessageReminderService.BATCH_LIMIT]
    );

    await connection.commit();

    let sent = 0;
    let cleared = 0;

    for (const row of candidates) {
      const chatId = row.chat_id;
      const recipientId = row.recipient_id;
      const unreadCount = Number(row.unread_count) || 0;

      // ── Cancellation checks ────────────────────────────────────────────
      if (unreadCount === 0) {
        // Read since the snapshot. Drop the row rather than marking it, so the
        // next unanswered stretch begins a fresh schedule.
        await MessageReminderService.clearReminder({ userId: recipientId, chatId });
        cleared += 1;
        continue;
      }

      // A reply means the user has engaged; the schedule restarts.
      if (await MessageReminderService.hasRepliedSinceOldestUnread(chatId, recipientId)) {
        await MessageReminderService.clearReminder({ userId: recipientId, chatId });
        cleared += 1;
        continue;
      }

      // ── Cadence checks ────────────────────────────────────────────────
      if (row.reminder_id) {
        const remindersSent = Number(row.reminders_sent) || 0;
        if (remindersSent >= MessageReminderService.MAX_REMINDERS_PER_CHAT) {
          // Already nudged as often as policy allows. Clear it so this
          // conversation can be reminded again after they return and new
          // messages arrive, but never badgered in between.
          await MessageReminderService.clearReminder({ userId: recipientId, chatId });
          cleared += 1;
          continue;
        }
        const lastAt = new Date(row.last_reminded_at).getTime();
        const dueAt = lastAt + MessageReminderService.ESCALATION_INTERVAL_MINUTES * 60 * 1000;
        if (Date.now() < dueAt) continue; // too soon to escalate
      }

      // ── Deliver ────────────────────────────────────────────────────────
      try {
        await sendReminder(row);
        // Record only after a successful send, so a Failure is retried next
        // sweep instead of being counted as delivered.
        await MessageReminderService.recordReminder({
          userId: recipientId,
          chatId,
          unreadCount,
        });
        sent += 1;
      } catch (notifErr) {
        logger.error(
          `[messageReminder] failed to deliver reminder for user ${recipientId} in chat ${chatId}: ${notifErr.message}`
        );
      }
    }

    if (sent > 0 || cleared > 0) {
      logger.info(
        `[messageReminder] sweep done: ${sent} reminder(s) sent, ${cleared} schedule(s) cleared, ` +
        `${candidates.length} unanswered conversation(s) examined`
      );
    }
  } catch (error) {
    logger.error('[messageReminder] sweep failed:', error.message);
  } finally {
    if (connection) {
      try { await connection.release(); } catch (_) { /* already closed */ }
    }
  }
});

logger.info('[messageReminder] worker scheduled (' + SCHEDULE + ')');

module.exports = { SCHEDULE };
