import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useMessageStore } from '../store/messageStore';
import { useChatStore } from '../store/chatStore';

export const useMessageSocket = () => {
  const socket = useSocket();
  const messageStore = useMessageStore();
  const chatStore = useChatStore();

  useEffect(() => {
    if (!socket) return;
    console.log('[TRACE] Registering message socket listeners');
    // Clean previous listeners to avoid duplicates
    socket.off('message-pinned');
    socket.off('new-reaction');
    socket.off('message-edited');
    socket.off('message_deleted');
    socket.off('message-deleted-everyone');

    const handleMessagePinned = (data: { messageId: string; pinned: boolean; permissions?: any }) => {
      console.log('[TRACE_MESSAGE_PINNED]', data);
      console.log('📡 Message pinned event:', data);
      const existing = messageStore.messages[data.messageId];
      if (existing) {
        messageStore.updateMessage(data.messageId, {
          permissions: {
            ...existing.permissions,
            pinned: data.pinned,
            ...(data.permissions || {}),
          },
        });
      }
    };

    const handleReactionUpdated = (data: { messageId: string; reactions: any }) => {
      console.log('[TRACE_REACTION_UPDATED]', data);
      console.log('📡 Reaction updated event:', data);
      messageStore.updateMessage(data.messageId, { reactions: data.reactions });
    };

    const handleMessageEdited = (data: { messageId: string; content: string; is_edited: boolean; permissions?: any }) => {
      console.log('[TRACE_MESSAGE_EDITED]', data);
      console.log('📡 Message edited event:', data);
      messageStore.updateMessage(data.messageId, {
        content: data.content,
        is_edited: data.is_edited,
        ...(data.permissions ? { permissions: data.permissions } : {}),
      });
      // Sync with chatStore activeConversation if needed
      const chatId = chatStore.activeConversationId;
      if (chatId) {
        // Safe check for chatStore actions if exists
        const activeMsgs = chatStore.messages?.[chatId] || [];
        const existsInChat = activeMsgs.some((m: any) => m.message_id === data.messageId);
        if (existsInChat && chatStore.editMessage) {
          // Prevent infinite loops if editMessage emits same event, update state directly or let it slide
        }
      }
    };

    const handleMessageDeleted = (data: { messageId: string; mode: 'forMe' | 'forAll'; deletedBy?: string }) => {
      console.log('[TRACE_MESSAGE_DELETED]', data);
      console.log('📡 Message deleted event:', data);
      if (data.mode === 'forAll') {
        messageStore.deleteMessage(data.messageId);
        const chatId = chatStore.activeConversationId;
        if (chatId && chatStore.deleteMessageForEveryone) {
          chatStore.deleteMessageForEveryone(chatId, data.messageId, 'This message was deleted');
        }
      }
    };

    // New handler for global delete emitted via 'message-deleted-everyone'
    const handleMessageDeletedEveryone = (data: { messageId: string; chatId: string }) => {
      console.log('[TRACE_MESSAGE_DELETED_EVERYONE]', data);
      console.log('[DELETE_RECEIVED]', data);
      console.log('📡 Message deleted for everyone event:', data);
      // Remove from message store
      messageStore.deleteMessage(data.messageId);
      // Update chat store for the specific chat
      if (chatStore.deleteMessageForEveryone) {
        chatStore.deleteMessageForEveryone(data.chatId, data.messageId, 'This message was deleted');
      }
    };

    socket.on('message-pinned', handleMessagePinned);
    socket.on('new-reaction', handleReactionUpdated);
    socket.on('message-edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message-deleted-everyone', handleMessageDeletedEveryone);

    return () => {
      socket.off('message-pinned', handleMessagePinned);
      socket.off('new-reaction', handleReactionUpdated);
      socket.off('message-edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message-deleted-everyone', handleMessageDeletedEveryone);
    };
  }, [socket, messageStore, chatStore]);
};
