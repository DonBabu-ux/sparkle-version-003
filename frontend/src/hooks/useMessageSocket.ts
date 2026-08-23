import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useMessageStore } from '../store/messageStore';
import { useChatStore } from '../store/chatStore';
import { useUserStore } from '../store/userStore';
import { useThemeStore } from '../store/themeStore';
import AudioSessionManager from '../audio/managers/AudioSessionManager';
import api from '../api/api';
import PersistentOfflineQueue from '../services/PersistentOfflineQueue';

export const useMessageSocket = () => {
  const socket = useSocket();
  const messageStore = useMessageStore();
  const chatStore = useChatStore();

  useEffect(() => {
    if (!socket) return;
    console.log('[TRACE] Registering enterprise message socket listeners');

    // Clean previous listeners to avoid duplicates
    socket.off('connect');
    socket.off('new-message');
    socket.off('receive_message');
    socket.off('message-delivered-update');
    socket.off('message-read-update');
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

    const triggerCursorSync = () => {
      const myUserId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
      if (!myUserId) return;

      // Find highest server_sequence stored across all conversations
      let maxCursor = 0;
      Object.values(chatStore.messagesByConversation).forEach((msgs) => {
        msgs.forEach((m) => {
          if (m.server_sequence && m.server_sequence > maxCursor) {
            maxCursor = m.server_sequence;
          }
        });
      });

      console.log('🔄 Triggering cursor-based delta sync from cursor:', maxCursor);
      socket.emit('cursor-sync-request', { lastCursor: maxCursor }, (res: any) => {
        if (res && res.success && Array.isArray(res.messages)) {
          res.messages.forEach((msg: any) => {
            const chatId = msg.conversation_id || msg.chat_id;
            if (chatId) {
              chatStore.addMessage(chatId, msg);
            }
          });
        }
      });

      // Flush persistent offline outgoing queue
      const dueMessages = PersistentOfflineQueue.getDueMessages();
      dueMessages.forEach((item) => {
        socket.emit('send-message', item, (ackRes: any) => {
          if (ackRes && ackRes.success) {
            PersistentOfflineQueue.acknowledge(item.messageId);
          } else {
            PersistentOfflineQueue.markFailed(item.messageId);
          }
        });
      });

      // Flush persistent offline interaction queue
      const dueInteractions = PersistentOfflineQueue.getDueInteractions();
      dueInteractions.forEach((item) => {
        socket.emit(item.type, item);
      });
    };

    const handleConnect = () => {
      console.log('⚡ Socket connected, triggering delta sync & privacy reconciliation');
      triggerCursorSync();
      const activeChatId = chatStore.activeConversationId;
      if (activeChatId && !activeChatId.startsWith('temp_')) {
        api.get(`/messages/${activeChatId}/privacy`)
          .then(res => {
            const enforced = res.data?.enforcedSettings || res.data;
            if (enforced) {
              SparkleStorage.setPrivacyCache(activeChatId, enforced).catch(() => {});
              try {
                localStorage.setItem(`sparkle_privacy_cache_${activeChatId}`, JSON.stringify(enforced));
              } catch (e) {}
            }
          })
          .catch(console.error);
      }
    };

    const handleNewMessage = (msg: any) => {
      const chatId = msg.conversation_id || msg.chat_id || chatStore.activeConversationId;
      const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;

      if (chatId) {
        chatStore.addMessage(chatId, msg);
      }

      // If message is from someone else, immediately send Enterprise Session Delivery ACK
      if (msg.sender_id && msg.sender_id !== myId) {
        const messageId = msg.message_id || msg.id;
        if (messageId) {
          socket.emit('message-delivered-ack', {
            messageId,
            sessionId: (socket as any).sessionId || null,
          });
        }
      }

      // ── Sparkle Audio: play receive / outchat sound ──
      if (msg.sender_id !== myId) {
        const conv = chatStore.conversations.find((c) => c.chat_id === chatId);
        if (!conv?.is_muted) {
          const activeChatId = chatStore.activeConversationId;
          const customSound = useThemeStore.getState().getNotificationSound(chatId);
          if (customSound && customSound !== 'default' && customSound !== 'system') {
            AudioSessionManager.playSound(customSound as any);
          } else {
            if (activeChatId && chatId === activeChatId) {
              AudioSessionManager.playSound('receive');
            } else {
              AudioSessionManager.playSound('outchat');
            }
          }
        }
      }
    };

    // Enterprise session-aware delivery update handler
    const handleMessageDeliveredUpdate = (data: { messageId: string; chatId: string; deliveredAt: string; recipientUserId: string }) => {
      const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
      chatStore.updateMessage(data.chatId, data.messageId, {
        delivered_at: data.deliveredAt,
        status: 'delivered',
      });
    };

    // Enterprise tri-condition read update handler
    const handleMessageReadUpdate = (data: { chatId: string; messageIds?: string[]; readAt: string; readerUserId: string }) => {
      const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
      if (data.readerUserId === myId) return;

      const msgs = chatStore.messagesByConversation[data.chatId] || [];
      msgs.forEach((m) => {
        if (m.sender_id === myId) {
          if (!data.messageIds || data.messageIds.includes(m.message_id || (m as any).id)) {
            chatStore.updateMessage(data.chatId, m.message_id || (m as any).id, {
              read_at: data.readAt,
              delivered_at: m.delivered_at || data.readAt,
              status: 'read',
              is_read: true,
            });
          }
        }
      });
    };

    const handleMessagesDelivered = (data: { chatId: string; messageId?: string; userId?: string }) => {
      const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
      if (data.userId === myId) return;

      const msgs = chatStore.messagesByConversation[data.chatId] || [];
      msgs.forEach((m) => {
        const isFromMe = m.sender_id === myId;
        if (isFromMe && m.status !== 'read' && (m.message_id === data.messageId || !data.messageId)) {
          chatStore.updateMessage(data.chatId, m.message_id, {
            status: 'delivered',
            delivered_at: new Date().toISOString(),
          });
        }
      });
    };

    const handleMessagesRead = (data: { chatId: string; readAt?: string; userId?: string }) => {
      chatStore.markRead(data.chatId, '');
    };

    const handleMessagePinned = (data: { messageId: string; chatId: string; pinnedBy: string }) => {
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
      chatStore.editMessage(data.chatId, data.messageId, data.content);
      messageStore.updateMessage(data.messageId, {
        content: data.content,
        is_edited: true,
      });
    };

    const handleMessageDeletedEveryone = (data: { messageId: string; chatId: string }) => {
      chatStore.deleteMessageForEveryone(data.chatId, data.messageId, 'This message was deleted');
      messageStore.deleteMessage(data.messageId);
    };

    const handleMessageDeletedMe = (data: { messageId: string; chatId: string }) => {
      chatStore.deleteMessageLocal(data.chatId, data.messageId);
      messageStore.deleteMessage(data.messageId);
    };

    const handleDeleteRejected = (data: { messageId: string; chatId: string; originalContent?: string; reason?: string }) => {
      console.warn(`[DeleteRejected] Deletion rejected by server for msg ${data.messageId}: ${data.reason}`);
      if (data.originalContent && data.chatId) {
        chatStore.editMessage(data.chatId, data.messageId, data.originalContent);
      }
    };

    const handleNewReaction = (data: { messageId: string; chatId: string; userId: string; emoji: string }) => {
      chatStore.addReaction(data.chatId, data.messageId, data.userId, data.emoji);
    };

    const handleReactionRemoved = (data: { messageId: string; chatId: string; userId: string; emoji: string }) => {
      chatStore.removeReaction(data.chatId, data.messageId, data.userId, data.emoji);
    };

    const handleNewGroupCreated = async (data: { chatId: string }) => {
      try {
        const res = await api.get('/messages/inbox');
        const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
        chatStore.setConversations(list);
      } catch (err) {
        console.error('Failed to update conversations on group creation event:', err);
      }
    };

    const handleOperationConfirmed = (data: { operationId?: string; event_id?: string; sequence_no?: number; type?: string }) => {
      if (data.operationId) {
        PersistentOfflineQueue.acknowledgeInteraction(data.operationId);
      }
    };

    const handleOperationFailed = (data: { operationId?: string; error?: string }) => {
      if (data.operationId) {
        PersistentOfflineQueue.acknowledgeInteraction(data.operationId);
      }
      console.warn('[MessageSocket] Interaction failed on server:', data.error);
    };

    const handleOnboardingStatusChanged = (data: { status: string; showOnboarding: boolean; completedAt?: string }) => {
      console.log('⚡ [Socket] Official onboarding status updated:', data);
      window.dispatchEvent(new CustomEvent('sparkle_onboarding_status_changed', { detail: data }));
    };

    const handleConversationPrivacyUpdated = (data: any) => {
      console.log('🔒 [Socket] conversation_privacy_updated received:', data);
      const chatId = data.chatId || data.chat_id;
      const senderId = data.senderId || data.sender_id || data.setterId;
      const privacyVersion = data.privacyVersion || data.privacy_version;

      const canCopy = data.permissions?.canCopy ?? (data.privacySettings ? (data.privacySettings.allow_copy !== 0 && !data.privacySettings.copyProtection) : true);
      const canForward = data.permissions?.canForward ?? (data.privacySettings ? (data.privacySettings.allow_forward !== 0 && !data.privacySettings.forwardProtection) : true);

      if (chatId && senderId) {
        chatStore.updateSenderMessagePermissions(chatId, senderId, { canCopy, canForward }, privacyVersion);
      }

      window.dispatchEvent(new CustomEvent('sparkle_privacy_updated', { detail: data }));
    };

    const handleMessagePinnedUpdated = (data: { messageId: string; chatId: string; pinned: boolean }) => {
      chatStore.updateMessage(data.chatId, data.messageId, { pinned: data.pinned });
      if (messageStore.messages[data.messageId]) {
        messageStore.updateMessage(data.messageId, { pinned: data.pinned });
      }
    };

    const handleSyncResponse = (data: { chatId: string; events?: any[] }) => {
      if (Array.isArray(data.events)) {
        data.events.forEach(evt => {
          let payload = evt.payload;
          if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch {}
          }
          if (evt.event_type === 'reaction_added') {
            chatStore.addReaction(data.chatId, payload.messageId, payload.userId, payload.emoji);
          } else if (evt.event_type === 'reaction_removed') {
            chatStore.removeReaction(data.chatId, payload.messageId, payload.userId, payload.emoji || '');
          } else if (evt.event_type === 'message_edited') {
            chatStore.editMessage(data.chatId, payload.messageId, payload.content);
          } else if (evt.event_type === 'message_deleted') {
            chatStore.deleteMessageForEveryone(data.chatId, payload.messageId, '[This message was deleted]');
          } else if (evt.event_type === 'message_pinned') {
            chatStore.updateMessage(data.chatId, payload.messageId, { pinned: true });
          } else if (evt.event_type === 'message_unpinned') {
            chatStore.updateMessage(data.chatId, payload.messageId, { pinned: false });
          }
        });
      }
    };

    // If socket is already connected when hook runs, trigger sync immediately
    if (socket.connected) {
      triggerCursorSync();
    }

    socket.on('connect', handleConnect);
    socket.on('new-message', handleNewMessage);
    socket.on('receive_message', handleNewMessage);
    socket.on('message-delivered-update', handleMessageDeliveredUpdate);
    socket.on('message-read-update', handleMessageReadUpdate);
    socket.on('messages-delivered', handleMessagesDelivered);
    socket.on('messages-read', handleMessagesRead);
    socket.on('message-pinned', handleMessagePinned);
    socket.on('message-unpinned', handleMessageUnpinned);
    socket.on('message-pinned-updated', handleMessagePinnedUpdated);
    socket.on('message-edited', handleMessageEdited);
    socket.on('message-deleted-everyone', handleMessageDeletedEveryone);
    socket.on('message-deleted-me', handleMessageDeletedMe);
    socket.on('delete-rejected', handleDeleteRejected);
    socket.on('new-reaction', handleNewReaction);
    socket.on('reaction-removed', handleReactionRemoved);
    socket.on('new_group_created', handleNewGroupCreated);
    socket.on('operation-confirmed', handleOperationConfirmed);
    socket.on('operation-failed', handleOperationFailed);
    socket.on('sync-response', handleSyncResponse);
    socket.on('official_onboarding_status_changed', handleOnboardingStatusChanged);
    socket.on('conversation_privacy_updated', handleConversationPrivacyUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('new-message', handleNewMessage);
      socket.off('receive_message', handleNewMessage);
      socket.off('message-delivered-update', handleMessageDeliveredUpdate);
      socket.off('message-read-update', handleMessageReadUpdate);
      socket.off('messages-delivered', handleMessagesDelivered);
      socket.off('messages-read', handleMessagesRead);
      socket.off('message-pinned', handleMessagePinned);
      socket.off('message-unpinned', handleMessageUnpinned);
      socket.off('message-pinned-updated', handleMessagePinnedUpdated);
      socket.off('message-edited', handleMessageEdited);
      socket.off('message-deleted-everyone', handleMessageDeletedEveryone);
      socket.off('message-deleted-me', handleMessageDeletedMe);
      socket.off('new-reaction', handleNewReaction);
      socket.off('reaction-removed', handleReactionRemoved);
      socket.off('new_group_created', handleNewGroupCreated);
      socket.off('operation-confirmed', handleOperationConfirmed);
      socket.off('operation-failed', handleOperationFailed);
      socket.off('sync-response', handleSyncResponse);
      socket.off('official_onboarding_status_changed', handleOnboardingStatusChanged);
      socket.off('conversation_privacy_updated', handleConversationPrivacyUpdated);
    };
  }, [socket, messageStore, chatStore]);
};
