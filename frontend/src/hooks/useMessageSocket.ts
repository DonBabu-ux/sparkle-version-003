import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useMessageStore } from '../store/messageStore';
import { useChatStore } from '../store/chatStore';
import { useUserStore } from '../store/userStore';

export const useMessageSocket = () => {
  const socket = useSocket();
  const messageStore = useMessageStore();
  const chatStore = useChatStore();

  useEffect(() => {
    if (!socket) return;
    console.log('[TRACE] Registering message socket listeners');
    
    // Clean previous listeners to avoid duplicates
    socket.off('new-message');
    socket.off('receive_message');
    socket.off('messages-delivered');
    socket.off('messages-read');
    socket.off('message-pinned');
    socket.off('message-unpinned');
    socket.off('message-edited');
    socket.off('message_deleted');
    socket.off('message-deleted-everyone');
    socket.off('message-deleted-me');
    socket.off('new-reaction');
    socket.off('reaction-removed');

    const handleNewMessage = (msg: any) => {
      const chatId = msg.conversation_id || msg.chat_id || chatStore.activeConversationId;
      if (chatId) {
        chatStore.addMessage(chatId, msg);
      }
    };

    const handleMessagesDelivered = (data: { chatId: string; messageId?: string; userId?: string }) => {
      const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
      if (data.userId === myId) return;

      const msgs = chatStore.messagesByConversation[data.chatId] || [];
      msgs.forEach((m) => {
        const isFromMe = m.sender_id === myId;
        if (isFromMe && m.status !== 'read' && (m.message_id === data.messageId || !data.messageId)) {
          chatStore.updateMessage(data.chatId, m.message_id, { status: 'delivered' });
        }
      });
    };

    const handleMessagesRead = (data: { chatId: string; readAt?: string; userId?: string }) => {
      chatStore.markRead(data.chatId, '');
    };

    const handleMessagePinned = (data: { messageId: string; chatId: string; pinned: boolean; permissions?: any }) => {
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

    const handleMessageEdited = (data: { messageId: string; chatId: string; content: string; editedAt: string }) => {
      console.log('📡 Message edited event:', data);
      chatStore.editMessage(data.chatId, data.messageId, data.content);
      messageStore.updateMessage(data.messageId, {
        content: data.content,
        is_edited: true,
      });
    };

    const handleMessageDeletedEveryone = (data: { messageId: string; chatId: string }) => {
      console.log('📡 Message deleted for everyone event:', data);
      chatStore.deleteMessageForEveryone(data.chatId, data.messageId, 'This message was deleted');
      messageStore.deleteMessage(data.messageId);
    };

    const handleMessageDeletedMe = (data: { messageId: string; chatId: string }) => {
      console.log('📡 Message deleted for me event:', data);
      chatStore.deleteMessageLocal(data.chatId, data.messageId);
      messageStore.deleteMessage(data.messageId);
    };

    const handleNewReaction = (data: { messageId: string; chatId: string; userId: string; emoji: string }) => {
      chatStore.addReaction(data.chatId, data.messageId, data.userId, data.emoji);
    };

    const handleReactionRemoved = (data: { messageId: string; chatId: string; userId: string; emoji: string }) => {
      chatStore.removeReaction(data.chatId, data.messageId, data.userId, data.emoji);
    };

    socket.on('new-message', handleNewMessage);
    socket.on('receive_message', handleNewMessage);
    socket.on('messages-delivered', handleMessagesDelivered);
    socket.on('messages-read', handleMessagesRead);
    socket.on('message-pinned', handleMessagePinned);
    socket.on('message-edited', handleMessageEdited);
    socket.on('message-deleted-everyone', handleMessageDeletedEveryone);
    socket.on('message-deleted-me', handleMessageDeletedMe);
    socket.on('new-reaction', handleNewReaction);
    socket.on('reaction-removed', handleReactionRemoved);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('receive_message', handleNewMessage);
      socket.off('messages-delivered', handleMessagesDelivered);
      socket.off('messages-read', handleMessagesRead);
      socket.off('message-pinned', handleMessagePinned);
      socket.off('message-edited', handleMessageEdited);
      socket.off('message-deleted-everyone', handleMessageDeletedEveryone);
      socket.off('message-deleted-me', handleMessageDeletedMe);
      socket.off('new-reaction', handleNewReaction);
      socket.off('reaction-removed', handleReactionRemoved);
    };
  }, [socket, messageStore, chatStore]);
};
