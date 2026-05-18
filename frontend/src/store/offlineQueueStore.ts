import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../api/api';

export type QueueAction = {
  id: string;
  type: 'LIKE_POST' | 'COMMENT_POST' | 'SEND_MESSAGE' | 'CREATE_POST';
  payload: any;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  timestamp: number;
};

interface OfflineQueueState {
  queue: QueueAction[];
  isProcessing: boolean;
  
  enqueueAction: (action: Omit<QueueAction, 'id' | 'timestamp'>) => void;
  removeAction: (id: string) => void;
  processQueue: () => Promise<void>;
  clearQueue: () => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      isProcessing: false,

      enqueueAction: (action) => set((state) => ({
        queue: [
          ...state.queue,
          {
            ...action,
            id: Math.random().toString(36).substring(2, 9),
            timestamp: Date.now(),
          }
        ]
      })),

      removeAction: (id) => set((state) => ({
        queue: state.queue.filter(a => a.id !== id)
      })),

      processQueue: async () => {
        const { queue, isProcessing, removeAction } = get();
        if (isProcessing || queue.length === 0 || !navigator.onLine) return;

        set({ isProcessing: true });
        
        console.log(`🔄 Processing ${queue.length} offline actions...`);

        // Process sequentially to maintain order (e.g. create post then comment)
        for (const action of queue) {
          try {
            if (action.method === 'POST') {
              await api.post(action.endpoint, action.payload);
            } else if (action.method === 'PUT') {
              await api.put(action.endpoint, action.payload);
            } else if (action.method === 'DELETE') {
              // Delete typically sends data as data/params, handling simplified here
              await api.delete(action.endpoint, { data: action.payload });
            }
            console.log(`✅ Offline action ${action.type} synced successfully.`);
            removeAction(action.id);
          } catch (err: any) {
            // If it's a 4xx error (bad request, unauthorized), drop it so it doesn't block the queue forever
            if (err.response && err.response.status >= 400 && err.response.status < 500) {
              console.error(`❌ Offline action ${action.type} failed permanently (4xx), dropping from queue.`, err);
              removeAction(action.id);
            } else {
              console.warn(`⏳ Offline action ${action.type} failed (Network/5xx), will retry later.`);
              // Break out of the loop and try the rest later
              break;
            }
          }
        }

        set({ isProcessing: false });
      },

      clearQueue: () => set({ queue: [] })
    }),
    {
      name: 'sparkle-offline-queue',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
