// src/store/chatStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

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
  reactions?: { user_id: string; emoji: string }[];
  expiresAt?: string;
  pinned?: boolean | number;
  pinned_at?: string;
  pinned_by?: string;
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
  unreadCounts: Record<string, number>;
  onlineUsers: string[];
  socketStatus: 'connected' | 'disconnected' | 'connecting';
  replyTarget?: string; // message_id being replied to

  setConversations: (convs: ChatConversation[]) => void;
  updateConversation: (chatId: string, updates: Partial<ChatConversation>) => void;
  setActiveConversationId: (chatId: string | null) => void;
  setMessages: (chatId: string, msgs: ChatMessage[]) => void;
  addMessage: (chatId: string, msg: ChatMessage) => void;
  editMessage: (chatId: string, msgId: string, newContent: string) => void;
  deleteMessageLocal: (chatId: string, msgId: string) => void;
  deleteMessageForEveryone: (chatId: string, msgId: string, content: string) => void;
  setReplyTarget: (msgId?: string) => void;
  setOnlineUsers: (userIds: string[]) => void;
  setSocketStatus: (status: 'connected' | 'disconnected' | 'connecting') => void;
  setTyping: (chatId: string, userId: string, username: string, isTyping: boolean) => void;
  addReaction: (chatId: string, messageId: string, userId: string, emoji: string) => void;
  removeReaction: (chatId: string, messageId: string, userId: string, emoji: string) => void;
  clearUnreadCount: (chatId: string) => void;
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
        onlineUsers: [],
        socketStatus: 'disconnected',
        replyTarget: undefined,

        setConversations: (convs) => set(() => ({ conversations: convs })),

        updateConversation: (chatId, updates) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId ? { ...c, ...updates } : c
            ),
          })),

        setActiveConversationId: (chatId) => set(() => ({ activeConversationId: chatId })),

        setMessages: (chatId, msgs) =>
          set((state) => ({
            messagesByConversation: {
              ...state.messagesByConversation,
              [chatId]: msgs,
            },
          })),

        addMessage: (chatId, msg) =>
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            if (currentMsgs.some((m) => m.message_id === msg.message_id)) {
              return {};
            }
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: [...currentMsgs, msg],
              },
            };
          }),

        editMessage: (chatId, msgId, newContent) =>
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.map((m) =>
                  m.message_id === msgId
                    ? { ...m, content: newContent, edited_at: new Date().toISOString(), is_edited: true, edited: true }
                    : m
                ),
              },
            };
          }),

        deleteMessageLocal: (chatId, msgId) =>
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.filter((m) => m.message_id !== msgId),
              },
            };
          }),

        deleteMessageForEveryone: (chatId, msgId, content) =>
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.map((m) =>
                  m.message_id === msgId ? { ...m, is_deleted_for_everyone: true, content } : m
                ),
              },
            };
          }),

        setReplyTarget: (msgId) => set(() => ({ replyTarget: msgId })),

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

        addReaction: (chatId, messageId, userId, emoji) =>
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.map((m) => {
                  if (m.message_id !== messageId) return m;
                  const currentReactions = m.reactions || [];
                  const exists = currentReactions.some((r) => r.user_id === userId);
                  const updatedReactions = exists
                    ? currentReactions.map((r) => (r.user_id === userId ? { ...r, emoji } : r))
                    : [...currentReactions, { user_id: userId, emoji }];
                  return { ...m, reactions: updatedReactions };
                }),
              },
            };
          }),

        removeReaction: (chatId, messageId, userId, emoji) =>
          set((state) => {
            const currentMsgs = state.messagesByConversation[chatId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [chatId]: currentMsgs.map((m) => {
                  if (m.message_id !== messageId) return m;
                  const currentReactions = m.reactions || [];
                  return {
                    ...m,
                    reactions: currentReactions.filter((r) => !(r.user_id === userId && r.emoji === emoji)),
                  };
                }),
              },
            };
          }),

        clearUnreadCount: (chatId) =>
          set((state) => ({
            unreadCounts: {
              ...state.unreadCounts,
              [chatId]: 0,
            },
            conversations: state.conversations.map((c) =>
              c.chat_id === chatId ? { ...c, unread_count: 0 } : c
            ),
          })),
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