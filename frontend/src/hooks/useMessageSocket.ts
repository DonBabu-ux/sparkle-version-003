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

    const handleMessagePinned = (data: { messageId: string; pinned: boolean; permissions?: any }) => {
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
      console.log('📡 Reaction updated event:', data);
      messageStore.updateMessage(data.messageId, { reactions: data.reactions });
    };

    const handleMessageEdited = (data: { messageId: string; content: string; is_edited: boolean; permissions?: any }) => {
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
      console.log('📡 Message deleted event:', data);
      if (data.mode === 'forAll') {
        messageStore.deleteMessage(data.messageId);
        const chatId = chatStore.activeConversationId;
        if (chatId && chatStore.deleteMessageForEveryone) {
          chatStore.deleteMessageForEveryone(chatId, data.messageId, 'This message was deleted');
        }
      }
    };

    socket.on('message_pinned', handleMessagePinned);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.off('message_pinned', handleMessagePinned);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [socket, messageStore, chatStore]);
};
