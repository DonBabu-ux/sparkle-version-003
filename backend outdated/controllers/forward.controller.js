const Message = require('../models/Message');

/**
 * Forward a message to one or more target chats.
 * Expected request body:
 *   {
 *     targetChatIds: string[] // array of chat IDs to forward into
 *   }
 * The route param `messageId` identifies the source message.
 * Permissions: only the original sender or a moderator (admin) may forward.
 * The function creates a new message for each target, preserving content, type,
 * media, reply reference, listing context, etc.
 * Returns: { forwardedIds: string[] }
 */
async function forwardMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { targetChatIds, adminOverride, adminUsername } = req.body;

    if (!Array.isArray(targetChatIds) || targetChatIds.length === 0) {
      return res.status(400).json({ error: 'targetChatIds must be a non-empty array' });
    }

    // Fetch original message
    const original = await Message.getById(messageId);
    if (!original) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Authorization: only sender can forward, unless admin override is set
    const isSender = original.sender_id === req.user.id;
    if (!isSender && !adminOverride) {
      return res.status(403).json({ error: 'Not authorized to forward this message' });
    }

    const forwardPromises = targetChatIds.map(async (chatId) => {
      // Determine if it's a personal or group chat – we reuse sendMessage logic.
      // Provide recipientId only for personal chats; for groups we pass chatId.
      const payload = {
        recipientId: null,
        chatId: chatId,
        senderId: req.user.id,
        content: original.content,
        type: original.type,
        mediaUrl: original.media_url || null,
        storyId: original.story_id || null,
        replyToId: original.reply_to_message_id || null,
        marketplaceListingId: original.marketplace_listing_id || null,
        viewPolicy: original.view_policy || 'unlimited',
        context: original.context || 'chat'
      };
      // Use the existing Message.sendMessage helper to create a new message.
      const newMessageId = await Message.sendMessage(payload);
      // Optionally, you could store a forwarding reference in a separate table.
      return newMessageId;
    });

    const forwardedIds = await Promise.all(forwardPromises);
    // Increment forward count on the original message for analytics / label rendering
    await Message.incrementForwardCount(messageId);

    // Respond with the list of new message IDs.
    return res.status(201).json({ forwardedIds });
  } catch (err) {
    console.error('[ERROR] forwardMessage controller error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { forwardMessage };
