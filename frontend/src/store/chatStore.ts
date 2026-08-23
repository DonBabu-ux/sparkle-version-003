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
  is_archived?: boolean;
  is_muted?: boolean;
  is_pinned?: boolean | number;
  chat_type?: string;
  member_count?: number;
  role?: string;
  disappearing_duration?: number;
  group_online_count?: number;
  is_group?: boolean;
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
  setActiveConversationId: (chatId: string | null) => void;
  setMessages: (chatId: string, msgs: ChatMessage[]) => void;
  addMessage: (chatId: string, msg: ChatMessage) => void;
  updateMessage: (chatId: string, msgId: string, updates: Partial<ChatMessage>) => void;
  editMessage: (chatId: string, msgId: string, newContent: string) => void;
  deleteMessageLocal: (chatId: string, msgId: string) => void;
  deleteMessagesBulkLocal: (chatId: string, msgIds: string[]) => void;
  deleteMessageForEveryone: (chatId: string, msgId: string, content: string) => void;
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
            delivered_at: raw.delivered_at || null,
            read_at: raw.read_at || null,
            failed_at: raw.failed_at || null,
            server_sequence: raw.server_sequence ? Number(raw.server_sequence) : undefined,
            status: raw.status || 'sent',
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
            if (type === 'multi_image' || type === 'photos') {
              const count = (msg as any).mediaCount || 3;
              return `🖼 ${count} Photos`;
            }

            return msg.content || `Sent a ${type}`;
          };

          const previewText = getPreviewText(latest);
          const lastMsgText = latest.content || previewText;
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
                return {
                  ...c,
                  last_message: lastMsgText,
                  last_message_content: previewText,
                  last_message_time: latestTime,
                  last_message_status: latest.status || c.last_message_status || 'sent',
                  unread_count: isActive ? 0 : c.unread_count,
                };
              });
            } else {
              const isFromMe = latest.sender_id === (useUserStore.getState().user?.user_id || useUserStore.getState().user?.id);
              const newConv: ChatConversation = {
                chat_id: chatId,
                partner_id: isFromMe ? ((latest as any).recipient_id || '') : latest.sender_id,
                partner_name: latest.sender_name || latest.sender_username || 'New Contact',
                partner_avatar: latest.sender_avatar || '',
                partner_username: latest.sender_username || '',
                unread_count: isActive ? 0 : (isFromMe ? 0 : 1),
                last_message: lastMsgText,
                last_message_content: previewText,
                last_message_time: latestTime,
                last_message_status: latest.status || 'sent',
                partner_online: true,
              };
              updatedConversations = [newConv, ...state.conversations];
            }

            // Move the active/updated conversation to the top
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

        markRead: (chatId, lastReadMsgId) => {
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            const myId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;
            const updatedMsgs = currentMsgs.map((m) => {
              const isFromMe = m.sender_id === myId;
              if (lastReadMsgId) {
                if (lastReadMsgId === myId && !isFromMe && m.status !== 'read') {
                  return { ...m, status: 'read', read_at: new Date().toISOString() };
                }
                if (lastReadMsgId !== myId && isFromMe && m.status !== 'read') {
                  return { ...m, status: 'read', read_at: new Date().toISOString() };
                }
              } else {
                if (m.status !== 'read') {
                  return { ...m, status: 'read', read_at: new Date().toISOString() };
                }
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
          set((state) => ({
            conversations:
              typeof convs === 'function'
                ? convs(state.conversations)
                : convs,
          })),

        updateConversation: (chatId, updates) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId ? { ...c, ...updates } : c
            ),
          })),

        setActiveConversationId: (chatId) => {
          const currentEditing = get().editing;
          set((state) => {
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
                return {
                  ...msg,
                  permissions: {
                    ...(msg as any).permissions,
                    ...newPermissions,
                    ui: {
                      ...((msg as any).permissions?.ui || {}),
                      ...(newPermissions?.ui || {}),
                      showCopy: newPermissions?.canCopy ?? newPermissions?.ui?.showCopy ?? true,
                      showForward: newPermissions?.canForward ?? newPermissions?.ui?.showForward ?? true,
                    },
                    security: {
                      ...((msg as any).permissions?.security || {}),
                      ...(newPermissions?.security || {}),
                      canCopy: newPermissions?.canCopy ?? true,
                      canForward: newPermissions?.canForward ?? true,
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
              const merged = { ...existing, ...normalized, status: bestStatus };
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
              const isFromMe = normalized.sender_id === (useUserStore.getState().user?.user_id || useUserStore.getState().user?.id);
              const updatedConversations = state.conversations.map((c) => {
                if (c.chat_id !== chatId) return c;
                return { ...c, unread_count: isActive ? 0 : (isFromMe ? 0 : c.unread_count + 1) };
              });
              return {
                messagesByConversation: { ...state.messagesByConversation, [chatId]: updatedMsgs },
                conversations: updatedConversations,
              };
            }

            // 3. Genuinely new message — append
            const isActive = state.activeConversationId === chatId;
            const isFromMe = normalized.sender_id === (useUserStore.getState().user?.user_id || useUserStore.getState().user?.id);
            const updatedConversations = state.conversations.map((c) => {
              if (c.chat_id !== chatId) return c;
              const unread_count = isActive ? 0 : (isFromMe ? 0 : c.unread_count + 1);
              return { ...c, unread_count };
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