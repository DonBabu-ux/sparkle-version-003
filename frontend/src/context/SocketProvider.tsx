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
    const userId = (user.id || user.user_id) as string;
    const s = getOrCreateSocket(userId, token);
    setSocket(s);
    // Reconnect if disconnected due to network issues
    if (!s.connected) {
      s.connect();
    }
    // Cleanup on unmount
    return () => {
      // Keep socket alive for the app life‑time; we only disconnect on logout above.
    };
  }, [user?.id, user?.user_id, token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

// Hook for components to consume the socket
export const useSocket = (): Socket | null => {
  return useContext(SocketContext);
};
