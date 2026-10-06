// socketService.ts
import { io, Socket } from 'socket.io-client';
import realtimeLogger from '../utils/realtimeTrace';
import { useUserStore } from '../store/userStore';
import { refreshTokenOnce, ensureFreshAccessToken } from './tokenRefresh';

// Socket URL resolved from env vars at build time. Same-origin by default:
// prod connects straight to Render; dev goes through the Vite /socket.io proxy.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

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
        const currentUser = useUserStore.getState().user;
        const currentUserId = currentUser?.user_id || currentUser?.id;
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

    // H21: first connect gets a fresh token when the stored one is expiring,
    // avoiding the "Token expired" connect_error → refresh → reconnect cycle.
    // The auth callback re-reads the store at connect time, so the refreshed
    // token is picked up automatically. connect_error below stays as fallback.
    const sock = s;
    void ensureFreshAccessToken(30_000).finally(() => sock.connect());

    s.on('connect', () => {
      console.log(`🔗 Socket connected for user ${userId} in namespace ${namespace || '/'}`);
    });
    s.on('disconnect', (reason) => {
      console.warn(`⚡ Socket disconnected from namespace ${namespace || '/'}:`, reason);
    });

    s.on('profile_updated', (updatedProfile: any) => {
      try {
        const currentUser = useUserStore.getState().user;
        const currentUserId = currentUser?.user_id || currentUser?.id;
        if (currentUser && String(currentUserId) === String(updatedProfile.user_id)) {
          useUserStore.getState().setUser({
            ...currentUser,
            ...updatedProfile
          });
        }
        window.dispatchEvent(new CustomEvent('sparkle:profile_updated', { detail: updatedProfile }));
      } catch (err) {
        console.error('Failed to handle profile_updated event:', err);
      }
    });

    s.on('connect_error', async (err) => {
      // H23: with no session in the store the auth callback sends an empty
      // token — retrying can never succeed. Stop the loop instead of
      // spamming console.error + refresh attempts while logged out.
      if (!useUserStore.getState().token) {
        console.warn(`⚠️ Socket auth rejected with no active session in namespace ${namespace || '/'} — staying disconnected`);
        s.disconnect();
        return;
      }
      console.error(`❌ Socket connection error in namespace ${namespace || '/'}:`, err);
      const isAuthError =
        err?.message?.includes('Authentication') ||
        err?.message?.includes('jwt') ||
        err?.message?.includes('token') ||
        err?.message?.includes('expired') ||
        err?.message?.includes('Expired');
      if (isAuthError) {
        try {
          // Single-flight refresh shared with api.ts (dedupes concurrent refreshes)
          // and targeted at the configured API base, not the socket origin.
          await refreshTokenOnce();
          s.connect();
          console.log(`🔄 Token refreshed and socket reconnected in namespace ${namespace || '/'}`);
        } catch (e) {
          console.warn(`⚠️ Token refresh failed, socket in namespace ${namespace || '/'} will remain disconnected`);
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
