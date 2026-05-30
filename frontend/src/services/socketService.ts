// socketService.ts
import { io, Socket } from 'socket.io-client';
import { useUserStore } from '../store/userStore';

// Determine the proper SOCKET_URL based on environment
const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.');
const isNative = window.location.protocol === 'capacitor:';
const LIVE_SOCKET_URL = 'https://sparkle-version-003-1-f4v3.onrender.com';
const LOCAL_SOCKET_URL = 'http://localhost:3000';
const SOCKET_URL = isNative ? LIVE_SOCKET_URL : (isLocalhost ? LOCAL_SOCKET_URL : LIVE_SOCKET_URL);

let _socket: Socket | null = null;
let _currentUserId: string | null = null;

/**
 * Create a new socket instance for the given user.
 * If a socket already exists for the same user, it is returned.
 * If a socket exists for a different user, it is disconnected and a new one is created.
 */
export const createSocket = (userId: string, token: string): Socket => {
  if (_socket && _currentUserId === userId) {
    if ((_socket as any).auth?.token !== token) {
      _socket.disconnect();
      _socket = null;
    }
  }

  if (!_socket) {
    _socket = io(SOCKET_URL, {
      auth: { token, userId },
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: false, // Don't connect immediately, allow connection error handling & refresh check
    });
    _currentUserId = userId;
    
    // Connect right after
    _socket.connect();

    // Basic event listeners (can be extended elsewhere)
    _socket.on('connect', () => {
      console.log('🔗 Socket connected for user', userId);
    });
    _socket.on('disconnect', (reason) => {
      console.warn('⚡ Socket disconnected:', reason);
    });
    // Handle connection errors, especially authentication failures
    _socket.on('connect_error', async (err) => {
      console.error('❌ Socket connection error:', err);
      // If the error indicates authentication failure, try refreshing the token
      if (err?.message?.includes('Authentication') || err?.message?.includes('jwt')) {
        try {
          // Call the auth refresh endpoint (API route)
          const refreshToken = useUserStore.getState().refreshToken;
          const response = await fetch(`${SOCKET_URL}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          if (response.ok) {
            const data = await response.json();
            const newToken = data.accessToken || data.token;
            if (newToken) {
              // Recreate socket with new token
              _socket?.disconnect();
              _socket = null;
              createSocket(_currentUserId!, newToken);
              console.log('🔄 Token refreshed and socket reconnected');
            }
          } else {
            console.warn('⚠️ Token refresh failed, socket will remain disconnected');
          }
        } catch (e) {
          console.error('⚠️ Error during token refresh:', e);
        }
      }
    });
// Duplicate connect_error listener removed

  }
  return _socket;
};

/** Retrieve existing socket if any */
export const getSocket = (): Socket | null => _socket;

/** Get existing socket or create a new one */
export const getOrCreateSocket = (userId: string, token: string): Socket => {
  if (_socket && _currentUserId === userId) {
    // Update token if changed (reconnect to apply new auth)
    if ((_socket as any).auth?.token !== token) {
      _socket.disconnect();
      _socket = null;
    }
  }
  if (!_socket) {
    return createSocket(userId, token);
  }
  return _socket;
};
