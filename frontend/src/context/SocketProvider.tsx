// src/context/SocketProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getOrCreateSocket, getSocket } from '../services/socketService';
import { useUserStore } from '../store/userStore';

// Create a React context for the socket instance
const SocketContext = createContext<Socket | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useUserStore();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user || !token) {
      // Ensure any existing socket is disconnected when user logs out
      const existing = getSocket();
      if (existing) {
        existing.disconnect();
      }
      setSocket(null);
      return;
    }

    let isSubscribed = true;

    // Hard Guard validation lifecycle: Ensure token is valid (or refresh it if expired) before connecting socket.
    const initializeSessionAndSocket = async () => {
      try {
        // Run quick validation endpoint call to check token freshness
        await require('../api/api').authApi.validateToken();
      } catch (err) {
        // If validate fails due to expiration, the axios interceptor automatically refreshes the token.
        // We retrieve the updated token from the store.
      }

      if (!isSubscribed) return;

      const freshToken = useUserStore.getState().token || token;
      const userId = (user.id || user.user_id) as string;
      const s = getOrCreateSocket(userId, freshToken);
      setSocket(s);

      // Reconnect if disconnected
      if (!s.connected) {
        s.connect();
      }
    };

    initializeSessionAndSocket();

    // Cleanup on unmount
    return () => {
      isSubscribed = false;
      // Keep socket alive for the app life‑time; we only disconnect on logout above.
    };
  }, [user?.id, user?.user_id, token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

// Hook for components to consume the socket
export const useSocket = (): Socket | null => {
  return useContext(SocketContext);
};
