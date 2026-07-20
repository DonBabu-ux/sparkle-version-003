import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useMessageStore } from '../store/messageStore';
import { useChatStore } from '../store/chatStore';
import { useUserStore } from '../store/userStore';
import { useThemeStore } from '../store/themeStore';
import AudioSessionManager from '../audio/managers/AudioSessionManager';
import api from '../api/api';

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
    socket.off('new_group_created');

    const handleNewMessage = (msg: any) => {
      const chatId = msg.conversation_id || msg.chat_id || chatStore.activeConversationId;
      if (chatId) {
        chatStore.addMessage(chatId, msg);
      }

      // ── Sparkle Audio: play receive / outchat sound ──
      const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
      if (msg.sender_id !== myId) {
        const conv = chatStore.conversations.find(c => c.chat_id === chatId);
        if (!conv?.is_muted) {
          const activeChatId = chatStore.activeConversationId;
          const customSound = useThemeStore.getState().getNotificationSound(chatId);
          if (customSound && customSound !== 'default' && customSound !== 'system') {
            AudioSessionManager.playSound(customSound as any);
          } else {
            if (activeChatId && chatId === activeChatId) {
              // User is viewing this conversation → in-chat receive ping
              AudioSessionManager.playSound('receive');
            } else {
              // User is elsewhere → out-of-chat notification bubble
              AudioSessionManager.playSound('outchat');
            }
          }
        }
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

    const handleMessagePinned = (data: { messageId: string; chatId: string; pinnedBy: string }) => {
      console.log('📡 Message pinned event:', data);
      chatStore.updateMessage(data.chatId, data.messageId, { pinned: true, pinned_by: data.pinnedBy });
      const existing = messageStore.messages[data.messageId];
      if (existing) {
        messageStore.updateMessage(data.messageId, {
          pinned: true,
          pinned_by: data.pinnedBy,
        });
      }
    };

    const handleMessageUnpinned = (data: { messageId: string; chatId: string }) => {
      console.log('📡 Message unpinned event:', data);
      chatStore.updateMessage(data.chatId, data.messageId, { pinned: false, pinned_by: null });
      const existing = messageStore.messages[data.messageId];
      if (existing) {
        messageStore.updateMessage(data.messageId, {
          pinned: false,
          pinned_by: null,
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

    const handleNewGroupCreated = async (data: { chatId: string }) => {
      console.log('📡 New group created event received:', data);
      try {
        const res = await api.get('/messages/inbox');
        const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
        chatStore.setConversations(list);
      } catch (err) {
        console.error('Failed to update conversations on group creation event:', err);
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('receive_message', handleNewMessage);
    socket.on('messages-delivered', handleMessagesDelivered);
    socket.on('messages-read', handleMessagesRead);
    socket.on('message-pinned', handleMessagePinned);
    socket.on('message-unpinned', handleMessageUnpinned);
    socket.on('message-edited', handleMessageEdited);
    socket.on('message-deleted-everyone', handleMessageDeletedEveryone);
    socket.on('message-deleted-me', handleMessageDeletedMe);
    socket.on('new-reaction', handleNewReaction);
    socket.on('reaction-removed', handleReactionRemoved);
    socket.on('new_group_created', handleNewGroupCreated);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('receive_message', handleNewMessage);
      socket.off('messages-delivered', handleMessagesDelivered);
      socket.off('messages-read', handleMessagesRead);
      socket.off('message-pinned', handleMessagePinned);
      socket.off('message-unpinned', handleMessageUnpinned);
      socket.off('message-edited', handleMessageEdited);
      socket.off('message-deleted-everyone', handleMessageDeletedEveryone);
      socket.off('message-deleted-me', handleMessageDeletedMe);
      socket.off('new-reaction', handleNewReaction);
      socket.off('reaction-removed', handleReactionRemoved);
      socket.off('new_group_created', handleNewGroupCreated);
    };
  }, [socket, messageStore, chatStore]);
};
