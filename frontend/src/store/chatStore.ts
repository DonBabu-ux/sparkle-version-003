// src/store/chatStore.ts
import create from 'zustand';
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

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  editMessage: (msgId: string, newContent: string) => void;
  deleteMessage: (msgId: string) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  replyTarget?: string; // message_id being replied to
  setReplyTarget: (msgId?: string) => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set, get) => ({
        messages: [],
        addMessage: (msg) => set(state => ({ messages: [...state.messages, msg] })),
        editMessage: (msgId, newContent) =>
          set(state => ({
            messages: state.messages.map(m =>
              m.message_id === msgId
                ? { ...m, content: newContent, edited_at: new Date().toISOString(), is_edited: true }
                : m
            ),
          })),
        deleteMessage: (msgId) =>
          set(state => ({ messages: state.messages.filter(m => m.message_id !== msgId) })),
        setMessages: (msgs) => set(() => ({ messages: msgs })),
        replyTarget: undefined,
        setReplyTarget: (msgId) => set(() => ({ replyTarget: msgId })),
      }),
      { name: 'chat-storage' }
    )
  )
);
