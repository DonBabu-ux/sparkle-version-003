// src/store/chatStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface ChatMessage {
  message_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'gif' | 'audio' | 'document' | string;
  media_url?: string;
  created_at?: string;
  edited_at?: string;
  is_edited?: boolean;
  reply_to_message_id?: string;
  status?: 'sent' | 'delivered' | 'seen';
}

export interface ChatConversation {
  chat_id: string;
  partner_id: string;
  partner_avatar?: string;
  partner_name: string;
  partner_username?: string;
  partner_online?: boolean;
  is_archived?: boolean;
  is_group?: boolean;
  chat_type?: string;
  member_count?: number;
  group_online_count?: number;
  unread_count: number;
  last_message?: string;
  last_message_content?: string;
  last_message_time?: string;
  last_message_at?: string;
  last_message_status?: string;
  is_online?: number;
  last_seen_at?: string;
}

interface ChatState {
  // Messages are stored per chat_id for isolation
  messages: Record<string, ChatMessage[]>;
  addMessage: (chatId: string, msg: ChatMessage) => void;
  editMessage: (chatId: string, msgId: string, newContent: string) => void;
  deleteMessage: (chatId: string, msgId: string) => void;
  setMessages: (chatId: string, msgs: ChatMessage[]) => void;
  replyTarget?: string; // message_id being replied to
  setReplyTarget: (msgId?: string) => void;

  // Conversations (Inbox)
  conversations: ChatConversation[];
  setConversations: (
    convs: ChatConversation[] | ((prev: ChatConversation[]) => ChatConversation[])
  ) => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set, get) => ({
        messages: {},
        addMessage: (chatId, msg) => set(state => ({ messages: { ...state.messages, [chatId]: [...(state.messages[chatId] || []), msg] } })),
        editMessage: (chatId, msgId, newContent) =>
          set(state => ({
            messages: {
              ...state.messages,
              [chatId]: (state.messages[chatId] || []).map(m =>
                m.message_id === msgId
                  ? { ...m, content: newContent, edited_at: new Date().toISOString(), is_edited: true }
                  : m
              ),
            },
          })),
        deleteMessage: (chatId, msgId) =>
          set(state => ({
            messages: {
              ...state.messages,
              [chatId]: (state.messages[chatId] || []).filter(m => m.message_id !== msgId),
            },
          })),
        setMessages: (chatId, msgs) => set(state => ({ messages: { ...state.messages, [chatId]: msgs } })),
        replyTarget: undefined,
        setReplyTarget: (msgId) => set(() => ({ replyTarget: msgId })),

        // Conversations Implementation
        conversations: [],
        setConversations: (convs) =>
          set((state) => ({
            conversations:
              typeof convs === 'function'
                ? convs(state.conversations)
                : convs,
          })),
      }),
      { name: 'chat-storage' }
    )
  )
);

