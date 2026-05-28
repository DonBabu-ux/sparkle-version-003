// src/store/messageStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Message } from '../types/message';
import type { MessagePermissions } from '../types/messagePermissions';

export interface MessageState {
  messages: Record<string, Message>;
  // Synchronous actions
  addMessage: (msg: Message) => void;
  updateMessage: (id: string, partial: Partial<Message>) => void;
  deleteMessage: (id: string) => void;
  // Async actions for server‑side operations
  fetchPermissions: (id: string) => Promise<void>;
  pinMessage: (id: string, pinned: boolean) => Promise<void>;
  reactMessage: (id: string, emoji: string) => Promise<void>;
  removeReaction: (id: string, emoji: string) => Promise<void>;
  editMessage: (id: string, newContent: string) => Promise<void>;
  deleteForMe: (id: string) => Promise<void>;
  deleteForAll: (id: string) => Promise<void>;
  forwardMessage: (id: string) => Promise<void>;
}

export const useMessageStore = create<MessageState>()(
  devtools(
    persist(
      (set, get) => ({
        messages: {},
        // ----- Synchronous local mutations -----
        addMessage: (msg) =>
          set((state) => ({ messages: { ...state.messages, [msg.id]: msg } })),
        updateMessage: (id, partial) =>
          set((state) => ({
            messages: {
              ...state.messages,
              [id]: { ...state.messages[id], ...partial },
            },
          })),
        deleteMessage: (id) =>
          set((state) => {
            const { [id]: _, ...rest } = state.messages;
            return { messages: rest };
          }),
        // ----- Async server‑side actions -----
        fetchPermissions: async (id) => {
          try {
            const resp = await fetch(`/api/messages/${id}/allowed-actions`);
            if (!resp.ok) throw new Error('Failed to fetch permissions');
            const perms: MessagePermissions = await resp.json();
            const msg = get().messages[id];
            if (msg) {
              get().updateMessage(id, { permissions: perms } as any);
            }
          } catch (e) {
            console.error(e);
          }
        },
        pinMessage: async (id, pinned) => {
          try {
            const resp = await fetch(`/api/messages/${id}/pin`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pinned }),
            });
            if (!resp.ok) throw new Error('Pin request failed');
            const updated = await resp.json();
            // server returns the whole message; merge into store
            get().updateMessage(id, { permissions: updated.permissions } as any);
          } catch (e) {
            console.error(e);
          }
        },
        reactMessage: async (id, emoji) => {
          try {
            const resp = await fetch(`/api/messages/${id}/react`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ emoji }),
            });
            if (!resp.ok) throw new Error('React request failed');
            const data = await resp.json();
            // data contains updated reactions map
            get().updateMessage(id, { reactions: data.reactions } as any);
          } catch (e) {
            console.error(e);
          }
        },
        removeReaction: async (id, emoji) => {
          try {
            const resp = await fetch(`/api/messages/${id}/react`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ emoji }),
            });
            if (!resp.ok) throw new Error('Remove reaction failed');
            const data = await resp.json();
            get().updateMessage(id, { reactions: data.reactions } as any);
          } catch (e) {
            console.error(e);
          }
        },
        editMessage: async (id, newContent) => {
          try {
            const resp = await fetch(`/api/messages/${id}/edit`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: newContent }),
            });
            if (!resp.ok) throw new Error('Edit failed');
            const data = await resp.json();
            get().updateMessage(id, { text: data.text, permissions: data.permissions } as any);
          } catch (e) {
            console.error(e);
          }
        },
        deleteForMe: async (id) => {
          try {
            const resp = await fetch(`/api/messages/${id}/delete-for-me`, { method: 'DELETE' });
            if (!resp.ok) throw new Error('Delete‑for‑me failed');
            // soft delete removes from this user’s view – we can remove locally
            get().deleteMessage(id);
          } catch (e) {
            console.error(e);
          }
        },
        deleteForAll: async (id) => {
          try {
            const resp = await fetch(`/api/messages/${id}/delete-for-all`, { method: 'DELETE' });
            if (!resp.ok) throw new Error('Delete‑for‑all failed');
            get().deleteMessage(id);
          } catch (e) {
            console.error(e);
          }
        },
        forwardMessage: async (id) => {
          try {
            const resp = await fetch(`/api/messages/${id}/forward`, { method: 'POST' });
            if (!resp.ok) throw new Error('Forward failed');
            // after forwarding backend increments count; fetch updated message
            const updated = await resp.json();
            get().updateMessage(id, { forwardCount: updated.forwardCount } as any);
          } catch (e) {
            console.error(e);
          }
        },
      }),
      { name: 'message-store' }
    )
  )
);
