// src/store/chatStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useUserStore } from './userStore';


export interface ChatMessage {
  message_id: string;
  sender_id: string;
  sender_name?: string;
  sender_username?: string;
  sender_avatar?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'gif' | 'audio' | 'document' | string;
  media_url?: string;
  sent_at?: string;
  created_at?: string;
  edited_at?: string;
  is_edited?: boolean;
  edited?: boolean;
  reply_to_message_id?: string;
  reply_content?: string;
  reply_type?: string;
  status?: 'sent' | 'delivered' | 'read' | string;
  is_read?: boolean;
  read_at?: string;
  is_deleted_for_everyone?: boolean;
  is_deleted?: boolean;
  reactions?: { user_id: string; emoji: string }[];
  expiresAt?: string;
  pinned?: boolean | number;
  pinned_at?: string;
  pinned_by?: string;

  // Enterprise Timestamp-Derived States & Sequence Fields
  delivered_at?: string | null;
  failed_at?: string | null;
  server_sequence?: number;
  version?: number;
  payload_hash?: string;

  // Normalized helper fields
  id?: string;
  chatId?: string;
  createdAt?: string;
}

export interface ChatConversation {
  chat_id: string;
  partner_id: string;
  partner_name: string;
  partner_avatar?: string;
  partner_username?: string;
  partner_online?: boolean;
  is_online?: number | boolean;
  last_seen_at?: string;
  unread_count: number;
  last_message?: string;
  last_message_content?: string;
  last_message_time?: string;
  last_message_at?: string;
  last_message_status?: string;
  last_message_sender_id?: string;
  is_archived?: boolean;
  is_muted?: boolean;
  is_pinned?: boolean | number;
  is_priority?: boolean;
  is_favorite?: boolean;
  chat_type?: string;
  member_count?: number;
  role?: string;
  disappearing_duration?: number;
  group_online_count?: number;
  is_group?: boolean;

  // Blocked Conversation State
  is_blocked?: boolean;
  is_blocked_by_me?: boolean;
  am_i_blocked?: boolean;
  conversation_status?: 'active' | 'blocked';
  can_send_messages?: boolean;
}

interface ChatState {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  messagesByConversation: Record<string, ChatMessage[]>;
  typingUsers: Record<string, { userId: string; username: string; timestamp: number }[]>;
  drafts: Record<string, string>;
  unreadCounts: Record<string, number>;
  editing: {
    messageId?: string;
    chatId?: string;
    originalContent?: string;
    startedAt?: number;
  };
  socketStatus: 'connected' | 'disconnected' | 'connecting';
  replyTargets: Record<string, string>; // chatId -> message_id being replied to

  normalizeMessage: (raw: any) => ChatMessage;
  findMessage: (chatId: string, lookupId: string) => ChatMessage | undefined;
  latestVisibleMessage: (chatId: string) => ChatMessage | null;
  refreshConversation: (chatId: string) => void;
  markRead: (chatId: string, lastReadMsgId: string) => void;

  setConversations: (
    convs: ChatConversation[] | ((prev: ChatConversation[]) => ChatConversation[])
  ) => void;
  updateConversation: (chatId: string, updates: Partial<ChatConversation>) => void;
  setConversationBlockState: (
    chatId: string,
    blockState: {
      is_blocked?: boolean;
      is_blocked_by_me?: boolean;
      am_i_blocked?: boolean;
      conversation_status?: 'active' | 'blocked';
      can_send_messages?: boolean;
    }
  ) => void;
  setActiveConversationId: (chatId: string | null) => void;
  setMessages: (chatId: string, msgs: ChatMessage[]) => void;
  addMessage: (chatId: string, msg: ChatMessage) => void;
  updateMessage: (chatId: string, msgId: string, updates: Partial<ChatMessage>) => void;
  editMessage: (chatId: string, msgId: string, newContent: string) => void;
  deleteMessageLocal: (chatId: string, msgId: string) => void;
  deleteMessagesBulkLocal: (chatId: string, msgIds: string[]) => void;
  deleteMessageForEveryone: (chatId: string, msgId: string, content: string) => void;

  // Canonical Conversation Mutations
  toggleArchive: (chatId: string, archived: boolean) => void;
  toggleDelete: (chatId: string) => void;
  togglePin: (chatId: string, pinned: boolean) => void;
  toggleMute: (chatId: string, muted: boolean) => void;
  toggleFavorite: (chatId: string, favorite: boolean) => void;
  togglePriority: (chatId: string, priority: boolean) => void;
  toggleUnread: (chatId: string, unread: boolean) => void;

  setReplyTarget: (chatId: string, msgId?: string) => void;
  setOnlineUsers: (userIds: string[]) => void;
  setSocketStatus: (status: 'connected' | 'disconnected' | 'connecting') => void;
  setTyping: (chatId: string, userId: string, username: string, isTyping: boolean) => void;
  addReaction: (chatId: string, messageId: string, userId: string, emoji: string) => void;
  removeReaction: (chatId: string, messageId: string, userId: string, emoji: string) => void;
  updateReaction: (chatId: string, messageId: string, userId: string, emoji: string) => void;
  clearUnreadCount: (chatId: string) => void;
  setEditing: (editing: { messageId?: string; chatId?: string; originalContent?: string; startedAt?: number }) => void;
  clearEditing: () => void;
  setDraft: (chatId: string, text: string) => void;
  startEdit: (chatId: string, messageId: string, content: string) => void;
  finishEdit: (chatId: string) => void;
  updateSenderMessagePermissions: (chatId: string, senderId: string, permissions: any, privacyVersion?: number) => void;
  removeExpiredMessages: (chatId: string, messageIds: string[]) => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set, get) => ({
        conversations: [],
        activeConversationId: null,
        messagesByConversation: {},
        typingUsers: {},
        unreadCounts: {},
        drafts: {},
        onlineUsers: [],
        socketStatus: 'disconnected',
        replyTargets: {},
        editing: {},

        normalizeMessage: (raw) => {
          if (!raw) return raw;
          const id = raw.id ?? raw.message_id ?? raw.uuid;
          const chatId = raw.chatId ?? raw.chat_id ?? raw.conversation_id;
          const createdAt = raw.created_at ?? raw.createdAt ?? raw.sent_at ?? new Date().toISOString();
          const senderId = raw.sender_id ?? raw.senderId;
          const mediaUrl = raw.media_url ?? raw.mediaUrl;

          const readAt = raw.read_at ?? raw.readAt ?? null;
          const deliveredAt = raw.delivered_at ?? raw.deliveredAt ?? null;
          const isRead = Boolean(raw.is_read === true || raw.is_read === 1 || !!readAt || raw.status === 'read' || raw.status === 'seen');

          let status = raw.status;
          if (isRead) {
            status = 'read';
          } else if (deliveredAt) {
            status = 'delivered';
          } else if (!status) {
            status = 'sent';
          }

          return {
            ...raw,
            id,
            chatId,
            message_id: id,
            sender_id: senderId,
            media_url: mediaUrl,
            createdAt,
            created_at: createdAt,
            sent_at: raw.sent_at || createdAt,
            delivered_at: deliveredAt,
            read_at: readAt,
            is_read: isRead,
            failed_at: raw.failed_at || null,
            server_sequence: raw.server_sequence ? Number(raw.server_sequence) : undefined,
            status,
          } as ChatMessage;
        },

        findMessage: (chatId, lookupId) => {
          const msgs = get().messagesByConversation[chatId] || [];
          return msgs.find(
            (m) =>
              m.id === lookupId ||
              m.message_id === lookupId ||
              (m as any).uuid === lookupId ||
              (m as any).tempId === lookupId
          );
        },

        latestVisibleMessage: (chatId) => {
          const msgs = get().messagesByConversation[chatId] || [];
          const visible = msgs.filter((m) => !m.is_deleted_for_everyone && !m.is_deleted);
          if (visible.length === 0) return null;
          const sorted = [...visible].sort(
            (a, b) => new Date(a.createdAt || a.created_at || a.sent_at || 0).getTime() -
                      new Date(b.createdAt || b.created_at || b.sent_at || 0).getTime()
          );
          return sorted[sorted.length - 1];
        },

        refreshConversation: (chatId) => {
          const latest = get().latestVisibleMessage(chatId);
          if (!latest) return;

          const getPreviewText = (msg?: ChatMessage | null) => {
            if (!msg) return '';
            if (msg.is_deleted_for_everyone) return 'This message was deleted';
            const type = msg.type || 'text';

            if (type === 'image' || type === 'photo') {
              return msg.content ? `📷 Photo · ${msg.content}` : '📷 Photo';
            }
            if (type === 'video') {
              return msg.content ? `🎥 Video · ${msg.content}` : '🎥 Video';
            }
            if (type === 'audio' || type === 'voice') {
              const dur = (msg as any).duration || (msg as any).mediaDuration || '0:18';
              return `🎤 Voice message · ${dur}`;
            }
            if (type === 'document' || type === 'file' || type === 'pdf') {
              const filename = (msg as any).fileName || (msg as any).mediaName || msg.content || 'Document.pdf';
              return `📄 ${filename}`;
            }
            if (type === 'location') {
              if (msg.content && msg.content.startsWith('{')) {
                try {
                  const p = JSON.parse(msg.content);
                  if (p.name || p.address) return `📍 ${p.name || p.address}`;
                } catch (e) {}
              }
              return '📍 Location';
            }
            if (type === 'live_location') {
              return '📍 Live Location';
            }

            return msg.content || `Sent a ${type}`;
          };

          const previewText = getPreviewText(latest);
          const lastMsgText = (latest.type && latest.type !== 'text') ? previewText : (latest.content || previewText);
          const latestTime = latest.createdAt || latest.created_at || latest.sent_at || new Date().toISOString();

          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            const sortedMsgs = [...currentMsgs].sort(
              (a, b) => new Date(a.createdAt || a.created_at || a.sent_at || 0).getTime() -
                        new Date(b.createdAt || b.created_at || b.sent_at || 0).getTime()
            );

            const exists = state.conversations.some((c) => c.chat_id === chatId);
            const isActive = state.activeConversationId === chatId;

            let updatedConversations = [...state.conversations];

            if (exists) {
              updatedConversations = state.conversations.map((c) => {
                if (c.chat_id !== chatId) return c;
                const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
                const latestSenderId = latest.sender_id || (latest as any).senderId;
                const isFromMe = String(latestSenderId) === String(myId);
                return {
                  ...c,
                  last_message: lastMsgText,
                  last_message_content: previewText,
                  last_message_time: latestTime,
                  last_message_status: latest.status || c.last_message_status || 'sent',
                  last_message_sender_id: latestSenderId,
                  unread_count: isActive ? 0 : (isFromMe ? 0 : c.unread_count),
                };
              });
            } else {
              const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
              const latestSenderId = latest.sender_id || (latest as any).senderId;
              const isFromMe = String(latestSenderId) === String(myId);
              const newConv: ChatConversation = {
                chat_id: chatId,
                partner_id: isFromMe ? ((latest as any).recipient_id || '') : latestSenderId,
                partner_name: latest.sender_name || latest.sender_username || 'New Contact',
                partner_avatar: latest.sender_avatar || '',
                partner_username: latest.sender_username || '',
                unread_count: isActive ? 0 : (isFromMe ? 0 : 1),
                last_message: lastMsgText,
                last_message_content: previewText,
                last_message_time: latestTime,
                last_message_status: latest.status || 'sent',
                last_message_sender_id: latestSenderId,
                partner_online: true,
              };
              updatedConversations = [newConv, ...state.conversations];
            }

            const updatedIndex = updatedConversations.findIndex((c) => c.chat_id === chatId);
            if (updatedIndex > 0) {
              const [updatedConv] = updatedConversations.splice(updatedIndex, 1);
              updatedConversations.unshift(updatedConv);
            }

            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: sortedMsgs,
              },
              conversations: updatedConversations,
            };
          });
        },

        markRead: (chatId, _lastReadMsgId) => {
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
            const updatedMsgs = currentMsgs.map((m) => {
              const isFromMe = String(m.sender_id || (m as any).senderId) === String(myId);
              // CRITICAL: Opening a chat ONLY marks incoming messages from OTHER USER as read locally.
              // Messages sent by ME (isFromMe) must NEVER be modified to 'read' locally — read status on sent messages
              // is strictly authoritative from recipient read-receipt socket events!
              if (isFromMe) {
                return m;
              }
              if (!m.is_read || m.status !== 'read') {
                return { ...m, is_read: true, status: 'read', read_at: m.read_at || new Date().toISOString() };
              }
              return m;
            });
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: updatedMsgs,
              },
            };
          });
          get().clearUnreadCount(chatId);
        },

        setConversations: (convs) =>
            set((state) => {
              const current = Array.isArray(state.conversations) ? state.conversations : [];
              const nextConvs = typeof convs === 'function' ? convs(current) : convs;
              const safeConvs = Array.isArray(nextConvs) ? nextConvs : [];
              return {
                conversations: safeConvs.map((c) => ({
                  ...c,
                  partner_name: c.partner_name || c.partner_username || 'Sparkle User',
                  partner_username: c.partner_username || '',
                })),
              };
            }),

        updateConversation: (chatId, updates) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId || c.partner_id === chatId ? { ...c, ...updates } : c
            ),
          })),

        setConversationBlockState: (chatId, blockState) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId || c.partner_id === chatId
                ? {
                    ...c,
                    is_blocked: blockState.is_blocked,
                    is_blocked_by_me: blockState.is_blocked_by_me,
                    am_i_blocked: blockState.am_i_blocked,
                    conversation_status: blockState.conversation_status,
                    can_send_messages: blockState.can_send_messages,
                  }
                : c
            ),
          })),

        // Canonical Conversation Mutations
        toggleArchive: (chatId, archived) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId ? { ...c, is_archived: archived } : c
            ),
          })),

        toggleDelete: (chatId) =>
          set((state) => ({
            conversations: state.conversations.filter((c) => c.chat_id !== chatId),
            messagesByConversation: { ...state.messagesByConversation, [chatId]: [] }
          })),

        togglePin: (chatId, pinned) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId ? { ...c, is_pinned: pinned } : c
            ),
          })),

        toggleMute: (chatId, muted) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId ? { ...c, is_muted: muted } : c
            ),
          })),

        toggleFavorite: (chatId, favorite) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId ? { ...c, is_favorite: favorite } : c
            ),
          })),

        togglePriority: (chatId, priority) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId ? { ...c, is_priority: priority } : c
            ),
          })),

        toggleUnread: (chatId, unread) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId ? { ...c, unread_count: unread ? 1 : 0 } : c
            ),
            unreadCounts: { ...state.unreadCounts, [chatId]: unread ? 1 : 0 }
          })),

        setActiveConversationId: (chatId) => {
          const currentEditing = get().editing;
          set((_state) => {
            const updates: any = { activeConversationId: chatId };
            if (currentEditing.chatId && currentEditing.chatId !== chatId) {
              updates.editing = {};
            }
            return updates;
          });
          if (chatId) {
            get().clearUnreadCount(chatId);
          }
        },

        setMessages: (chatId, msgs) => {
          let deletedSet = new Set<string>();
          try {
            const raw = localStorage.getItem('sparkle_deleted_msg_ids');
            if (raw) deletedSet = new Set(JSON.parse(raw));
          } catch (e) {}

          const normalized = msgs
            .map((m) => get().normalizeMessage(m))
            .filter((m) => !deletedSet.has(m.message_id) && !deletedSet.has(m.id));

          set((state) => ({
            messagesByConversation: {
              ...state.messagesByConversation,
              [chatId]: normalized,
            },
          }));
          get().refreshConversation(chatId);
        },

        updateSenderMessagePermissions: (chatId, senderId, newPermissions, privacyVersion) => {
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId];
            if (!currentMsgs || currentMsgs.length === 0) return state;

            const updatedMsgs = currentMsgs.map((msg) => {
              if (String(msg.sender_id || (msg as any).senderId) === String(senderId)) {
                const currentVer = (msg as any).privacyVersion || (msg as any).permissions?.privacyVersion || 0;
                if (privacyVersion && currentVer && Number(privacyVersion) < Number(currentVer)) {
                  return msg;
                }
                const canCopy = newPermissions?.canCopy !== undefined
                  ? !!newPermissions.canCopy
                  : !!(msg as any).permissions?.canCopy;
                const canForward = newPermissions?.canForward !== undefined
                  ? !!newPermissions.canForward
                  : !!(msg as any).permissions?.canForward;

                return {
                  ...msg,
                  permissions: {
                    ...(msg as any).permissions,
                    ...newPermissions,
                    canCopy,
                    canForward,
                    ui: {
                      ...((msg as any).permissions?.ui || {}),
                      ...(newPermissions?.ui || {}),
                      showCopy: canCopy,
                      showForward: canForward,
                      showShare: canForward,
                    },
                    security: {
                      ...((msg as any).permissions?.security || {}),
                      ...(newPermissions?.security || {}),
                      canCopy,
                      canForward,
                      canExport: canCopy && canForward,
                    },
                  },
                  privacyVersion: privacyVersion || (msg as any).privacyVersion,
                };
              }
              return msg;
            });

            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: updatedMsgs,
              },
            };
          });
          get().refreshConversation(chatId);
        },

        addMessage: (chatId, msg) => {
          const normalized = get().normalizeMessage(msg);
          const incomingId = normalized.message_id || normalized.id || (normalized as any).uuid;

          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];

            // ── Deduplication Strategy (order matters) ──
            // 1. Exact UUID match — already in store, update in-place (handles socket echo)
            const exactIndex = currentMsgs.findIndex(
              (m) => m.message_id === incomingId || m.id === incomingId || (m as any).uuid === incomingId
            );
            if (exactIndex !== -1) {
              // Message exists — merge in any new fields (e.g. permissions, status upgrade)
              // but never downgrade a status (sent > sending, read > delivered, etc.)
              const existing = currentMsgs[exactIndex];
              const STATUS_RANK: Record<string, number> = { sending: 0, pending: 0, sent: 1, delivered: 2, read: 3, failed: -1 };
              const incomingRank = STATUS_RANK[normalized.status || ''] ?? 0;
              const existingRank = STATUS_RANK[existing.status || ''] ?? 0;
              const bestStatus = incomingRank >= existingRank ? normalized.status : existing.status;
              const bestReadAt = normalized.read_at || existing.read_at || null;
              const bestDeliveredAt = normalized.delivered_at || existing.delivered_at || null;
              const bestIsRead = Boolean(normalized.is_read || existing.is_read || bestReadAt);

              const merged = {
                ...existing,
                ...normalized,
                status: bestStatus,
                read_at: bestReadAt,
                delivered_at: bestDeliveredAt,
                is_read: bestIsRead,
              };
              const updatedMsgs = [...currentMsgs];
              updatedMsgs[exactIndex] = merged;
              return {
                messagesByConversation: { ...state.messagesByConversation, [chatId]: updatedMsgs },
              };
            }

            // 2. Optimistic bubble match — client UUID in store matches incoming message_id
            //    This handles: client sent UUID → server ACK → socket echo arrives
            const optimisticIndex = currentMsgs.findIndex(
              (m) =>
                (m.status === 'sending' || (m.id && String(m.id).startsWith('temp'))) &&
                m.content === normalized.content &&
                String(m.sender_id) === String(normalized.sender_id)
            );
            if (optimisticIndex !== -1) {
              const updatedMsgs = [...currentMsgs];
              updatedMsgs[optimisticIndex] = { ...updatedMsgs[optimisticIndex], ...normalized, status: normalized.status || 'sent' };
              const isActive = state.activeConversationId === chatId;
              const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
              const isFromMe = String(normalized.sender_id) === String(myId);
              const updatedConversations = state.conversations.map((c) => {
                if (c.chat_id !== chatId) return c;
                return {
                  ...c,
                  last_message_sender_id: normalized.sender_id,
                  unread_count: isActive ? 0 : (isFromMe ? 0 : c.unread_count + 1)
                };
              });
              return {
                messagesByConversation: { ...state.messagesByConversation, [chatId]: updatedMsgs },
                conversations: updatedConversations,
              };
            }

            // 3. Genuinely new message — append
            const isActive = state.activeConversationId === chatId;
            const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
            const isFromMe = String(normalized.sender_id) === String(myId);
            const updatedConversations = state.conversations.map((c) => {
              if (c.chat_id !== chatId) return c;
              const unread_count = isActive ? 0 : (isFromMe ? 0 : c.unread_count + 1);
              return {
                ...c,
                last_message_sender_id: normalized.sender_id,
                unread_count
              };
            });
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: [...currentMsgs, normalized],
              },
              conversations: updatedConversations,
              drafts: isFromMe ? { ...state.drafts, [chatId]: '' } : state.drafts,
            };
          });
          get().refreshConversation(chatId);
        },


        updateMessage: (chatId, msgId, updates) => {
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.map((m) =>
                  m.message_id === msgId || m.id === msgId ? { ...m, ...updates } : m
                ),
              },
            };
          });
          get().refreshConversation(chatId);
        },

        editMessage: (chatId, msgId, newContent) => {
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.map((m) =>
                  m.message_id === msgId || m.id === msgId
                    ? { ...m, content: newContent, edited_at: new Date().toISOString(), is_edited: true, edited: true }
                    : m
                ),
              },
            };
          });
          get().refreshConversation(chatId);
        },

        deleteMessageLocal: (chatId, msgId) => {
          try {
            const raw = localStorage.getItem('sparkle_deleted_msg_ids');
            const setIds: string[] = raw ? JSON.parse(raw) : [];
            if (!setIds.includes(msgId)) {
              setIds.push(msgId);
              localStorage.setItem('sparkle_deleted_msg_ids', JSON.stringify(setIds));
            }
          } catch (e) {}

          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.filter((m) => m.message_id !== msgId && m.id !== msgId),
              },
            };
          });
          get().refreshConversation(chatId);
        },

        deleteMessagesBulkLocal: (chatId, msgIds) => {
          try {
            const raw = localStorage.getItem('sparkle_deleted_msg_ids');
            const setIds: string[] = raw ? JSON.parse(raw) : [];
            let changed = false;
            msgIds.forEach((id) => {
              if (!setIds.includes(id)) {
                setIds.push(id);
                changed = true;
              }
            });
            if (changed) {
              localStorage.setItem('sparkle_deleted_msg_ids', JSON.stringify(setIds));
            }
          } catch (e) {}

          const idSet = new Set(msgIds);
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.filter((m) => !idSet.has(m.message_id) && !idSet.has(m.id)),
              },
            };
          });
          get().refreshConversation(chatId);
        },

        deleteMessageForEveryone: (chatId, msgId, content) => {
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.map((m) =>
                  m.message_id === msgId || m.id === msgId ? { ...m, is_deleted_for_everyone: true, content } : m
                ),
              },
            };
          });
          get().refreshConversation(chatId);
        },

        setEditing: (editing) => set(() => ({ editing })),
        clearEditing: () => set(() => ({ editing: {} })),
        updateReaction: (chatId, messageId, userId, emoji) => {
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.map((m) => {
                  if (m.message_id !== messageId && m.id !== messageId) return m;
                  const currentReactions = m.reactions || [];
                  const exists = currentReactions.some((r) => r.user_id === userId);
                  const updatedReactions = exists
                    ? currentReactions.map((r) => (r.user_id === userId ? { ...r, emoji } : r))
                    : [...currentReactions, { user_id: userId, emoji }];
                  return { ...m, reactions: updatedReactions };
                }),
              },
            };
          });
          get().refreshConversation(chatId);
        },
        setReplyTarget: (chatId, msgId) => set((state) => {
          const updated = { ...state.replyTargets };
          if (msgId) {
            updated[chatId] = msgId;
          } else {
            delete updated[chatId];
          }
          return { replyTargets: updated };
        }),

        setOnlineUsers: (userIds) => set(() => ({ onlineUsers: userIds })),

        setSocketStatus: (status) => set(() => ({ socketStatus: status })),

        setTyping: (chatId, userId, username, isTyping) =>
          set((state) => {
            const currentTyping = state.typingUsers[chatId] || [];
            let updated;
            if (isTyping) {
              if (currentTyping.some((u) => u.userId === userId)) return {};
              updated = [...currentTyping, { userId, username, timestamp: Date.now() }];
            } else {
              updated = currentTyping.filter((u) => u.userId !== userId);
            }
            return {
              typingUsers: {
                ...state.typingUsers,
                [chatId]: updated,
              },
            };
          }),
        // Set draft text for a conversation (per-chat input)
        setDraft: (chatId, text) => set(state => ({
          drafts: { ...state.drafts, [chatId]: text },
        })),

        addReaction: (chatId, messageId, userId, emoji) => {
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.map((m) => {
                  if (m.message_id !== messageId && m.id !== messageId) return m;
                  const currentReactions = m.reactions || [];
                  const exists = currentReactions.some((r) => r.user_id === userId);
                  const updatedReactions = exists
                    ? currentReactions.map((r) => (r.user_id === userId ? { ...r, emoji } : r))
                    : [...currentReactions, { user_id: userId, emoji }];
                  return { ...m, reactions: updatedReactions };
                }),
              },
            };
          });
          get().refreshConversation(chatId);
        },

        removeReaction: (chatId, messageId, userId, emoji) => {
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.map((m) => {
                  if (m.message_id !== messageId && m.id !== messageId) return m;
                  const currentReactions = m.reactions || [];
                  return {
                    ...m,
                    reactions: currentReactions.filter((r) => !(r.user_id === userId && r.emoji === emoji)),
                  };
                }),
              },
            };
          });
          get().refreshConversation(chatId);
        },

        clearUnreadCount: (chatId) => {
          set((state) => ({
            unreadCounts: {
              ...state.unreadCounts,
              [chatId]: 0,
            },
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId ? { ...c, unread_count: 0 } : c
            ),
          }));
          get().refreshConversation(chatId);
        },
        startEdit: (chatId, messageId, content) => {
          set((state) => ({
            editing: {
              messageId,
              chatId,
              originalContent: content,
              startedAt: Date.now(),
            },
            drafts: {
              ...state.drafts,
              [chatId]: content,
            },
          }));
        },
        removeExpiredMessages: (chatId, messageIds) => {
          if (!messageIds || messageIds.length === 0) return;
          const idSet = new Set(messageIds.map(String));
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            const remaining = currentMsgs.filter(
              (m) => !idSet.has(String(m.message_id)) && !idSet.has(String(m.id))
            );
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: remaining,
              },
            };
          });
          get().refreshConversation(chatId);
        },
        finishEdit: (chatId) => {
          set((state) => ({
            editing: {},
            drafts: chatId ? {
              ...state.drafts,
              [chatId]: '',
            } : state.drafts,
          }));
        },
      }),
      {
        name: 'sparkle-chat-storage',
        partialize: (state) => ({
          conversations: state.conversations,
          messagesByConversation: state.messagesByConversation,
        }),
      }
    )
  )
);