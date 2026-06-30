// useSocket.ts
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useUserStore } from '../store/userStore';
import { getOrCreateSocket, getSocket } from '../services/socketService';

/**
 * useSocket – provides the app‑wide singleton Socket instance.
 * The socket is created lazily when the user is authenticated and is never
 * recreated on navigation, preventing duplicate connections and reconnection storms.
 */
export const useSocket = (namespace = ''): Socket | null => {
  const { user, token } = useUserStore();
  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialise or disconnect socket based on auth state
  useEffect(() => {
    if (!user || !token) {
      const existing = getSocket(namespace);
      if (existing) {
        existing.disconnect();
      }
      setSocket(null);
      return;
    }

    const userId = (user.id || user.user_id) as string;
    const s = getOrCreateSocket(userId, token, namespace);
    setSocket(s);

    if (!s.connected) {
      s.connect();
    }
  }, [user?.id, user?.user_id, token, namespace]);

  return socket;
};
