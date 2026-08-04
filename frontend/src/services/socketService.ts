// socketService.ts
import { io, Socket } from 'socket.io-client';
import realtimeLogger from '../utils/realtimeTrace';
import { useUserStore } from '../store/userStore';

// Socket URL resolved from env vars at build time.
// Production builds (.env.production) point to Render; dev builds (.env) point to localhost.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let _socket: Socket | null = null;
let _currentUserId: string | null = null;
const _sockets = new Map<string, Socket>();

/**
 * Create a new socket instance for the given user and namespace.
 */
export const createSocket = (userId: string, token: string, namespace = ''): Socket => {
  const key = `${userId}:${namespace}`;
  let s = _sockets.get(key);

  if (!s) {
    const url = namespace ? `${SOCKET_URL}${namespace}` : SOCKET_URL;
    s = io(url, {
      auth: (cb) => {
        const currentToken = useUserStore.getState().token;
        const currentUserId = useUserStore.getState().user?.user_id;
        cb({ token: currentToken, userId: currentUserId });
      },
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: false,
    });

    _sockets.set(key, s);

    if (namespace === '') {
      _socket = s;
      _currentUserId = userId;
    }

    s.connect();

    s.on('connect', () => {
      console.log(`🔗 Socket connected for user ${userId} in namespace ${namespace || '/'}`);
    });
    s.on('disconnect', (reason) => {
      console.warn(`⚡ Socket disconnected from namespace ${namespace || '/'}:`, reason);
    });

    s.on('connect_error', async (err) => {
      console.error(`❌ Socket connection error in namespace ${namespace || '/'}:`, err);
      const isAuthError =
        err?.message?.includes('Authentication') ||
        err?.message?.includes('jwt') ||
        err?.message?.includes('token') ||
        err?.message?.includes('expired') ||
        err?.message?.includes('Expired');
      if (isAuthError) {
        try {
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
            const newRefresh = data.refreshToken || refreshToken;
            if (newToken) {
              useUserStore.getState().setToken(newToken, newRefresh);
              if (s) {
                s.auth = { token: newToken, userId };
                s.connect();
              }
              console.log(`🔄 Token refreshed and socket reconnected in namespace ${namespace || '/'}`);
            }
          } else {
            console.warn(`⚠️ Token refresh failed, socket in namespace ${namespace || '/'} will remain disconnected`);
          }
        } catch (e) {
          console.error(`⚠️ Error during token refresh for namespace ${namespace || '/'}:`, e);
        }
      }
    });
  }
  return s;
};

/** Retrieve existing socket if any */
export const getSocket = (namespace = ''): Socket | null => {
  if (namespace === '') return _socket;
  for (const [key, s] of _sockets.entries()) {
    if (key.endsWith(`:${namespace}`)) {
      return s;
    }
  }
  return null;
};

/** Get existing socket or create a new one */
export const getOrCreateSocket = (userId: string, token: string, namespace = ''): Socket => {
  const key = `${userId}:${namespace}`;
  const existing = _sockets.get(key);

  // Reuse the existing socket for this user+namespace.
  // The auth callback in createSocket already reads the freshest token from
  // the store on every connection attempt, so we do NOT need to recreate the
  // socket when the token rotates — that was causing a disconnect/reconnect
  // storm because socket.auth is a function (not { token }), so the old
  // `.auth?.token !== token` check always returned true.
  if (existing) {
    return existing;
  }

  return createSocket(userId, token, namespace);
};

// Helper to send a message with tracing
export const sendMessageWithTrace = (socket: Socket, payload: any, callback?: (response: any) => void) => {
  const traceId = realtimeLogger.generateTraceId();
  realtimeLogger.trace(traceId, "CLIENT_SEND", { chatId: payload.chatId, senderId: payload.senderId, type: payload.type });
  const enrichedPayload = { ...payload, traceId };
  socket.emit('send-message', enrichedPayload, (response) => {
    if (response?.success) {
      realtimeLogger.trace(traceId, "SERVER_ACK", { messageId: response.messageId, sentAt: response.sentAt });
    } else {
      realtimeLogger.error(traceId, "SERVER_ACK_ERROR", new Error(response?.error || 'unknown'), response);
    }
    if (callback) callback(response);
  });
};
