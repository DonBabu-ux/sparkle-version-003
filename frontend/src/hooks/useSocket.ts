import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserStore } from '../store/userStore';

const SOCKET_URL = 'https://sparkle-version-003-1-f4v3.onrender.com';

// ─── Module-level singleton ───────────────────────────────────────────────────
// One socket instance shared across the entire application lifetime.
// Navigation between pages will NEVER disconnect or recreate this socket.
let _socket: Socket | null = null;
let _currentUserId: string | null = null;

const getOrCreateSocket = (userId: string, token: string): Socket => {
  // If already connected for this user, return the existing socket
  if (_socket && _socket.connected && _currentUserId === userId) {
    return _socket;
  }

  // If there's a stale socket for a different user (account switch), disconnect it
  if (_socket && _currentUserId !== userId) {
    _socket.disconnect();
    _socket = null;
  }

  // Create a new singleton socket
  const s = io(SOCKET_URL, {
    query: { userId },
    auth: { token },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['polling', 'websocket'],
  });

  s.on('connect', () => {
    console.log('📡 Sparkle Matrix connected — presence is ONLINE globally.');
    s.emit('sparkle-ping');
  });

  s.on('connect_error', (err) => {
    console.warn('📡 Sparkle Matrix connection error:', err.message);
  });

  _socket = s;
  _currentUserId = userId;
  return s;
};

/**
 * useSocket — returns the app-wide singleton socket.
 * Safe to call from any page; will never create a second socket instance.
 */
export const useSocket = (): Socket | null => {
  const { user, token } = useUserStore();
  const [socket, setSocket] = useState<Socket | null>(_socket);

  useEffect(() => {
    if (!user || !token) {
      // Not authenticated — disconnect any lingering socket
      if (_socket) {
        _socket.disconnect();
        _socket = null;
        _currentUserId = null;
      }
      setSocket(null);
      return;
    }

    const userId = user.id || user.user_id;
    if (!userId) return;

    const s = getOrCreateSocket(String(userId), token);
    setSocket(s);

    // If socket already exists but was disconnected (network loss), reconnect
    if (!s.connected) {
      s.connect();
    }

    // No cleanup / disconnect on unmount — presence must survive page navigation
  }, [user?.id, user?.user_id, token]);

  return socket;
};

/** Direct accessor for the singleton socket (for non-hook contexts). */
export const getSocket = (): Socket | null => _socket;
