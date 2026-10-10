import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useMessageStore } from '../store/messageStore';
import { useChatStore } from '../store/chatStore';
import { useUserStore } from '../store/userStore';
import { useThemeStore } from '../store/themeStore';
import AudioSessionManager from '../audio/managers/AudioSessionManager';
import api from '../api/api';
import PersistentOfflineQueue from '../services/PersistentOfflineQueue';
import { reconcilePrivacySettings } from '../services/privacyReconcile';
import { logger } from '../utils/logger';

let isSyncInProgress = false;

export const useMessageSocket = () => {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    logger.log('[TRACE] Registering enterprise message socket listeners');

    const getChatStore  = () => useChatStore.getState();
    const getMsgStore   = () => useMessageStore.getState();

    const runReconnectSyncSequence = async () => {
      if (isSyncInProgress || !socket.connected) return;
      isSyncInProgress = true;
      logger.log('🔄 [SyncCoordinator:SYNC_START] Outbox & delta sync sequence initiated');
      getChatStore().setSocketStatus('connecting');

      try {
        // Step 1: Outbox Sync (Flush pending outgoing messages)
        const pending = PersistentOfflineQueue.getPendingMessagesImmediate();
        if (pending.length > 0) {
          logger.log(`📤 [SyncCoordinator:OUTBOX_RECONCILED] Flushing ${pending.length} pending outbox messages...`);
          const batchSize = 3;
          for (let i = 0; i < pending.length; i += batchSize) {
            const batch = pending.slice(i, i + batchSize);
            await Promise.all(
              batch.map((item) => {
                return new Promise<void>((resolve) => {
                  logger.log(`🚀 [SyncCoordinator:MESSAGE_SEND_ATTEMPT] Attempting send for messageId=${item.messageId}`);
                  
                  // Start individual 10-second timer for this specific message
                  PersistentOfflineQueue.startMessageTimeout(item.messageId, () => {
                    logger.warn(`⏰ [SyncCoordinator:MESSAGE_SYNC_TIMEOUT] 10s timeout for messageId=${item.messageId}`);
                    getChatStore().updateMessage(item.chatId, item.messageId, { status: 'failed' });
                    window.dispatchEvent(new CustomEvent('sparkle_messages_synced', { detail: { chatId: item.chatId } }));
                  });

                  socket.emit('send-message', item, (ackRes: any) => {
                    if (ackRes && ackRes.success) {
                      logger.log(`✅ [SyncCoordinator:MESSAGE_SERVER_ACK] Message ACKed: ${item.messageId}`);
                      PersistentOfflineQueue.acknowledge(item.messageId);
                      getChatStore().updateMessage(item.chatId, item.messageId, {
                        status: 'sent',
                        sent_at: ackRes.sentAt || new Date().toISOString(),
                      });
                      window.dispatchEvent(new CustomEvent('sparkle_messages_synced', { detail: { chatId: item.chatId } }));
                    } else if (ackRes?.isBlocked || ackRes?.code === 'MESSAGE_BLOCKED' || ackRes?.error?.includes('blocked')) {
                      logger.warn(`⛔ [SyncCoordinator] Outbox message permanently BLOCKED: ${item.messageId}`);
                      PersistentOfflineQueue.markBlocked(item.messageId);
                      getChatStore().updateMessage(item.chatId, item.messageId, { status: 'blocked' });
                      getChatStore().setConversationBlockState(item.chatId, {
                        is_blocked: true,
                        conversation_status: 'blocked',
                        can_send_messages: false
                      });
                      window.dispatchEvent(new CustomEvent('sparkle_messages_synced', { detail: { chatId: item.chatId } }));
                    } else {
                      logger.warn(`⚠️ [SyncCoordinator] Outbox message ACK failed for ${item.messageId}`);
                      PersistentOfflineQueue.markFailed(item.messageId);
                      getChatStore().updateMessage(item.chatId, item.messageId, { status: 'failed' });
                    }
                    resolve();
                  });
                });
              })
            );
          }
        }

        // Step 2: Incoming Delta Sync
        let maxCursor = 0;
        Object.values(getChatStore().messagesByConversation).forEach((msgs: any) => {
          msgs.forEach((m: any) => {
            if (m.server_sequence && m.server_sequence > maxCursor) {
              maxCursor = m.server_sequence;
            }
          });
        });

        const affectedChatIds = new Set<string>();

        await new Promise<void>((resolve) => {
          socket.emit('cursor-sync-request', { lastCursor: maxCursor }, (res: any) => {
            if (res && res.success && Array.isArray(res.messages)) {
              logger.log(`📥 [SyncCoordinator:SYNC_MESSAGES_RECEIVED] ${res.messages.length} messages from cursor ${maxCursor}`);
              res.messages.forEach((msg: any) => {
                const chatId = msg.conversation_id || msg.chat_id;
                if (chatId) {
                  getChatStore().addMessage(chatId, msg);
                  affectedChatIds.add(chatId);
                }
              });
            }
            resolve();
          });
        });

        // Notify active chat views of newly synced messages
        affectedChatIds.forEach((chatId) => {
          logger.log(`⚡ [SyncCoordinator:ACTIVE_CHAT_UPDATED] Dispatching sync re-render for chatId: ${chatId}`);
          window.dispatchEvent(new CustomEvent('sparkle_messages_synced', { detail: { chatId } }));
        });

        // Step 3: Flush persistent offline interaction queue
        const dueInteractions = PersistentOfflineQueue.getDueInteractions();
        dueInteractions.forEach((item) => {
          socket.emit(item.type, item);
        });

        getChatStore().setSocketStatus('connected');
        logger.log('✅ [SyncCoordinator:SYNC_COMPLETE] Normal Realtime Mode restored');
      } catch (err) {
        logger.error('❌ [SyncCoordinator] Reconnection sync error:', err);
        getChatStore().setSocketStatus('connected');
      } finally {
        isSyncInProgress = false;
      }
    };

    const handleConnect = () => {
      logger.log('⚡ Socket connected, triggering delta sync & privacy reconciliation');
      runReconnectSyncSequence();
      const activeChatId = getChatStore().activeConversationId;
      if (activeChatId && !activeChatId.startsWith('temp_')) {
        reconcilePrivacySettings(activeChatId);
      }
    };

    const handleNewMessage = (msg: any) => {
      const chatStore = getChatStore();
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
      const chatStore = getChatStore();
      chatStore.updateMessage(data.chatId, data.messageId, {
        delivered_at: data.deliveredAt,
        status: 'delivered',
      });
      // Advance the chat-list status ratchet so the tick updates without a refresh
      chatStore.updateConversationReceipt(data.chatId, 'delivered', data.deliveredAt);
    };

    // Enterprise tri-condition read update handler
    const handleMessageReadUpdate = (data: { chatId: string; messageIds?: string[]; readAt?: string; readerUserId?: string; userId?: string }) => {
      const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
      const readerId = data.readerUserId || data.userId;
      
      // If the read event came from another user, mark ALL our sent messages in this chat as READ (blue ticks)
      if (readerId && myId && String(readerId).toLowerCase() === String(myId).toLowerCase()) {
        return;
      }

      const readTime = data.readAt || new Date().toISOString();
      const chatStore = getChatStore();
      const msgs = chatStore.messagesByConversation[data.chatId] || [];

      msgs.forEach((m) => {
        const msgSenderId = m.sender_id || (m as any).senderId;
        const isFromMe = msgSenderId && myId && String(msgSenderId).toLowerCase() === String(myId).toLowerCase();

        if (isFromMe) {
          const msgId = m.message_id || (m as any).id;
          if (!data.messageIds || data.messageIds.length === 0 || data.messageIds.includes(msgId)) {
            chatStore.updateMessage(data.chatId, msgId, {
              read_at: readTime,
              delivered_at: m.delivered_at || readTime,
              status: 'read',
              is_read: true,
            });
          }
        }
      });

      // Advance the chat-list status ratchet so blue ticks appear without a page refresh
      chatStore.updateConversationReceipt(data.chatId, 'read', readTime);
    };

    const handleMessagesDelivered = (data: { chatId: string; messageId?: string; userId?: string }) => {
      const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
      if (data.userId && myId && String(data.userId).toLowerCase() === String(myId).toLowerCase()) return;

      const chatStore = getChatStore();
      const msgs = chatStore.messagesByConversation[data.chatId] || [];
      const deliveredAt = new Date().toISOString();
      msgs.forEach((m) => {
        const msgSenderId = m.sender_id || (m as any).senderId;
        const isFromMe = msgSenderId && myId && String(msgSenderId).toLowerCase() === String(myId).toLowerCase();
        if (isFromMe && m.status !== 'read' && (m.message_id === data.messageId || !data.messageId)) {
          chatStore.updateMessage(data.chatId, m.message_id || (m as any).id, {
            status: 'delivered',
            delivered_at: deliveredAt,
          });
        }
      });
      // Advance chat-list status ratchet
      chatStore.updateConversationReceipt(data.chatId, 'delivered', deliveredAt);
    };

    const handleMessagesRead = (data: { chatId: string; readAt?: string; userId?: string; readerUserId?: string }) => {
      const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
      const readerId = data.readerUserId || data.userId;

      if (readerId && myId && String(readerId).toLowerCase() !== String(myId).toLowerCase()) {
        handleMessageReadUpdate(data);
      } else {
        getChatStore().markRead(data.chatId, '');
      }
    };

    const handleMessagePinned = (data: { messageId: string; chatId: string; pinnedBy: string }) => {
      getChatStore().updateMessage(data.chatId, data.messageId, { pinned: true, pinned_by: data.pinnedBy });
      const existing = getMsgStore().messages[data.messageId];
      if (existing) {
        getMsgStore().updateMessage(data.messageId, {
          pinned: true,
          pinned_by: data.pinnedBy,
        });
      }
    };

    const handleMessageUnpinned = (data: { messageId: string; chatId: string }) => {
      getChatStore().updateMessage(data.chatId, data.messageId, { pinned: false, pinned_by: null });
      const existing = getMsgStore().messages[data.messageId];
      if (existing) {
        getMsgStore().updateMessage(data.messageId, {
          pinned: false,
          pinned_by: null,
        });
      }
    };

    const handleMessageEdited = (data: { messageId: string; chatId: string; content: string; editedAt: string }) => {
      getChatStore().editMessage(data.chatId, data.messageId, data.content);
      getMsgStore().updateMessage(data.messageId, {
        content: data.content,
        is_edited: true,
      });
    };

    const handleMessageDeletedEveryone = (data: { messageId: string; chatId: string }) => {
      getChatStore().deleteMessageForEveryone(data.chatId, data.messageId, 'This message was deleted');
      getMsgStore().deleteMessage(data.messageId);
    };

    const handleMessageDeletedMe = (data: { messageId: string; chatId: string }) => {
      getChatStore().deleteMessageLocal(data.chatId, data.messageId);
      getMsgStore().deleteMessage(data.messageId);
    };

    const handleDeleteRejected = (data: { messageId: string; chatId: string; originalContent?: string; reason?: string }) => {
      logger.warn(`[DeleteRejected] Deletion rejected by server for msg ${data.messageId}: ${data.reason}`);
      if (data.originalContent && data.chatId) {
        getChatStore().editMessage(data.chatId, data.messageId, data.originalContent);
      }
    };

    const handleNewReaction = (data: { messageId: string; chatId: string; userId: string; emoji: string }) => {
      getChatStore().addReaction(data.chatId, data.messageId, data.userId, data.emoji);
    };

    const handleReactionRemoved = (data: { messageId: string; chatId: string; userId: string; emoji: string }) => {
      getChatStore().removeReaction(data.chatId, data.messageId, data.userId, data.emoji);
    };

    const handleNewGroupCreated = async (data: { chatId: string }) => {
      try {
        const res = await api.get('/messages/inbox');
        const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
        getChatStore().setConversations(list);
      } catch (err) {
        logger.error('Failed to update conversations on group creation event:', err);
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
      logger.warn('[MessageSocket] Interaction failed on server:', data.error);
    };

    const handleOnboardingStatusChanged = (data: { status: string; showOnboarding: boolean; completedAt?: string }) => {
      logger.log('⚡ [Socket] Official onboarding status updated:', data);
      window.dispatchEvent(new CustomEvent('sparkle_onboarding_status_changed', { detail: data }));
    };

    const handleConversationPrivacyUpdated = (data: any) => {
      logger.log('🔒 [Socket] conversation_privacy_updated received:', data);
      const chatId = data.chatId || data.chat_id;
      const senderId = data.senderId || data.sender_id || data.setterId;
      const privacyVersion = data.privacyVersion || data.privacy_version;

      const canCopy = data.permissions?.canCopy !== undefined
        ? (data.permissions.canCopy === true || data.permissions.canCopy === 1)
        : (data.privacySettings
            ? (data.privacySettings.allow_copy !== 0 && data.privacySettings.allow_copy !== false && data.privacySettings.allow_copy !== '0' && data.privacySettings.allow_copy !== 'false' && !data.privacySettings.copyProtection)
            : false);

      const canForward = data.permissions?.canForward !== undefined
        ? (data.permissions.canForward === true || data.permissions.canForward === 1)
        : (data.privacySettings
            ? (data.privacySettings.allow_forward !== 0 && data.privacySettings.allow_forward !== false && data.privacySettings.allow_forward !== '0' && data.privacySettings.allow_forward !== 'false' && !data.privacySettings.forwardProtection)
            : false);

      if (chatId && senderId) {
        getChatStore().updateSenderMessagePermissions(chatId, senderId, { canCopy, canForward }, privacyVersion);
      }

      window.dispatchEvent(new CustomEvent('sparkle_privacy_updated', { detail: data }));
    };

    const handleMessagePinnedUpdated = (data: { messageId: string; chatId: string; pinned: boolean }) => {
      getChatStore().updateMessage(data.chatId, data.messageId, { pinned: data.pinned });
      if (getMsgStore().messages[data.messageId]) {
        getMsgStore().updateMessage(data.messageId, { pinned: data.pinned });
      }
    };

    const handleSyncResponse = (data: { chatId: string; events?: any[] }) => {
      if (Array.isArray(data.events)) {
        const chatStore = getChatStore();
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

    const handleConversationUpdated = (data: { chatId: string; action: string; userId?: string; [key: string]: any }) => {
      const chatStore = getChatStore();
      const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
      // We process this even if it's from us, in case it's a different tab syncing
      if (data.action === 'archived' || data.action === 'unarchived') {
        chatStore.toggleArchive(data.chatId, data.action === 'archived');
      } else if (data.action === 'deleted') {
        chatStore.toggleDelete(data.chatId);
      } else if (data.action === 'pinned' || data.action === 'unpinned') {
        chatStore.togglePin(data.chatId, data.action === 'pinned');
      } else if (data.action === 'favorited' || data.action === 'unfavorited') {
        chatStore.toggleFavorite(data.chatId, data.action === 'favorited');
      } else if (data.action === 'priority_on' || data.action === 'priority_off') {
        chatStore.togglePriority(data.chatId, data.action === 'priority_on');
      }
    };

    const handleSparklyStreamChunk = (data: { chatId: string; messageId: string; text: string; fullContent: string }) => {
      getChatStore().updateMessage(data.chatId, data.messageId, {
        content: data.fullContent
      });
    };

    const handleSparklyStreamCards = (data: { chatId: string; messageId: string; cards: any[] }) => {
      getChatStore().updateMessage(data.chatId, data.messageId, {
        structured_data: { cards: data.cards } as any
      });
    };

    const handleSparklyStreamComplete = (data: { chatId: string; messageId: string; finalMessage: any }) => {
      getChatStore().updateMessage(data.chatId, data.messageId, {
        ...data.finalMessage,
        is_sparkly_bot: true
      });
    };

    const handleOnlineOrFocus = () => {
      if (socket.connected) {
        logger.log('⚡ Connection/Focus trigger detected, running SyncCoordinator sequence');
        runReconnectSyncSequence();
      }
    };

    window.addEventListener('online', handleOnlineOrFocus);
    window.addEventListener('focus', handleOnlineOrFocus);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleOnlineOrFocus();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // If socket is already connected when hook runs, trigger sync immediately
    if (socket.connected) {
      runReconnectSyncSequence();
    }

    const handleConversationBlocked = (data: { chatId?: string; partnerId?: string; isBlockedByMe?: boolean; amIBlocked?: boolean }) => {
      logger.log('⛔ [Socket] conversation_blocked event received:', data);
      const chatStore = getChatStore();
      const targetId = data.chatId || data.partnerId;
      if (targetId) {
        chatStore.setConversationBlockState(targetId, {
          is_blocked: true,
          is_blocked_by_me: !!data.isBlockedByMe,
          am_i_blocked: !!data.amIBlocked,
          conversation_status: 'blocked',
          can_send_messages: false
        });
      }
      window.dispatchEvent(new CustomEvent('sparkle_conversation_blocked', { detail: data }));
    };

    const handleConversationUnblocked = (data: { chatId?: string; partnerId?: string }) => {
      logger.log('🟢 [Socket] conversation_unblocked event received:', data);
      const chatStore = getChatStore();
      const targetId = data.chatId || data.partnerId;
      if (targetId) {
        chatStore.setConversationBlockState(targetId, {
          is_blocked: false,
          is_blocked_by_me: false,
          am_i_blocked: false,
          conversation_status: 'active',
          can_send_messages: true
        });
      }
      window.dispatchEvent(new CustomEvent('sparkle_conversation_unblocked', { detail: data }));
    };

    const handleMessageError = (data: { error?: string; code?: string; isBlocked?: boolean; chatId?: string; clientMessageId?: string }) => {
      logger.warn('⚠️ [Socket] message-error received:', data);
      if (data.isBlocked || data.code === 'MESSAGE_BLOCKED' || data.error?.includes('blocked')) {
        if (data.clientMessageId) {
          PersistentOfflineQueue.markBlocked(data.clientMessageId);
        }
        if (data.chatId && data.clientMessageId) {
          getChatStore().updateMessage(data.chatId, data.clientMessageId, { status: 'blocked' });
          getChatStore().setConversationBlockState(data.chatId, {
            is_blocked: true,
            conversation_status: 'blocked',
            can_send_messages: false
          });
        }
      }
    };

    const handleMessagesExpired = (data: { chatId: string; messageIds: string[] }) => {
      if (data?.chatId && Array.isArray(data.messageIds)) {
        getChatStore().removeExpiredMessages(data.chatId, data.messageIds);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('new-message', handleNewMessage);
    socket.on('receive_message', handleNewMessage);
    socket.on('message-delivered-update', handleMessageDeliveredUpdate);
    socket.on('message-read-update', handleMessageReadUpdate);
    socket.on('messages-delivered', handleMessagesDelivered);
    socket.on('messages-read', handleMessagesRead);
    socket.on('messages_expired', handleMessagesExpired);
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
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('sparkly-stream-chunk', handleSparklyStreamChunk);
    socket.on('sparkly-stream-cards', handleSparklyStreamCards);
    socket.on('sparkly-stream-complete', handleSparklyStreamComplete);
    socket.on('conversation_blocked', handleConversationBlocked);
    socket.on('conversation_unblocked', handleConversationUnblocked);
    socket.on('message-error', handleMessageError);

    // Live Location Listeners
    const handleLiveLocationStarted = (data: any) => {
      window.dispatchEvent(new CustomEvent('sparkle_live_location_started', { detail: data }));
    };
    const handleLiveLocationUpdate = (data: any) => {
      window.dispatchEvent(new CustomEvent('sparkle_live_location_update', { detail: data }));
    };
    const handleLiveLocationStopped = (data: any) => {
      window.dispatchEvent(new CustomEvent('sparkle_live_location_stopped', { detail: data }));
    };

    socket.on('live_location_started', handleLiveLocationStarted);
    socket.on('live_location_update', handleLiveLocationUpdate);
    socket.on('live_location_stopped', handleLiveLocationStopped);

    return () => {
      window.removeEventListener('online', handleOnlineOrFocus);
      window.removeEventListener('focus', handleOnlineOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      socket.off('connect', handleConnect);
      socket.off('new-message', handleNewMessage);
      socket.off('receive_message', handleNewMessage);
      socket.off('message-delivered-update', handleMessageDeliveredUpdate);
      socket.off('message-read-update', handleMessageReadUpdate);
      socket.off('messages-delivered', handleMessagesDelivered);
      socket.off('messages-read', handleMessagesRead);
      socket.off('messages_expired', handleMessagesExpired);
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
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('sparkly-stream-chunk', handleSparklyStreamChunk);
      socket.off('sparkly-stream-cards', handleSparklyStreamCards);
      socket.off('sparkly-stream-complete', handleSparklyStreamComplete);
      socket.off('conversation_blocked', handleConversationBlocked);
      socket.off('conversation_unblocked', handleConversationUnblocked);
      socket.off('message-error', handleMessageError);
      socket.off('live_location_started', handleLiveLocationStarted);
      socket.off('live_location_update', handleLiveLocationUpdate);
      socket.off('live_location_stopped', handleLiveLocationStopped);
    };
  }, [socket]);
};
