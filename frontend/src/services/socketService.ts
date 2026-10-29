// socketService.ts
import { io, Socket } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';
import realtimeLogger from '../utils/realtimeTrace';
import { useUserStore } from '../store/userStore';
import { refreshTokenOnce, ensureFreshAccessToken } from './tokenRefresh';
import { decodeTokenPayload } from '../utils/tokenUtils';
import { EnvironmentService } from './EnvironmentService';
import { ServerFailoverManager } from './ServerFailoverManager';
import { logger } from '../utils/logger';

let _socket: Socket | null = null;
const _sockets = new Map<string, Socket>();

/**
 * Whenever ServerFailoverManager triggers a failover, rebuild sockets
 * against the new server origin and reconnect seamlessly.
 */
ServerFailoverManager.onServerChange((newServer, previousServer) => {
  logger.warn(`🔌 [SocketService] Active server changed (${previousServer.id} -> ${newServer.id}). Reconnecting all sockets...`);
  
  _sockets.forEach((sock, key) => {
    try {
      sock.disconnect();
      sock.removeAllListeners();
    } catch {}
  });
  _sockets.clear();
  _socket = null;

  // If user is logged in, recreate the default socket immediately
  const user = useUserStore.getState().user;
  const token = useUserStore.getState().token;
  const userId = user?.user_id || user?.id;
  if (userId && token) {
    createSocket(String(userId), token);
  }
});

let consecutiveConnectErrors = 0;

/**
 * Create a new socket instance for the given user and namespace.
 */
export const createSocket = (userId: string, _token: string, namespace = ''): Socket => {
  const key = `${userId}:${namespace}`;
  let s = _sockets.get(key);

  if (!s) {
    const socketOrigin = EnvironmentService.getSocketUrl();
    const url = namespace ? `${socketOrigin}${namespace}` : socketOrigin;
    
    s = io(url, {
      auth: (cb) => {
        const currentToken = useUserStore.getState().token;
        const currentUser = useUserStore.getState().user;
        const currentUserId = currentUser?.user_id || currentUser?.id;
        let fcmToken: string | null = null;
        try {
          fcmToken = localStorage.getItem('sparkle_fcm_token');
        } catch { /* storage unavailable */ }
        cb({ token: currentToken, userId: currentUserId, pushToken: fcmToken, platform: Capacitor.getPlatform() });
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
    }

    const sock = s;
    const prepConnect = async (): Promise<void> => {
      let tok: string | null = null;
      try {
        tok = await ensureFreshAccessToken(30_000);
      } catch {
        tok = null;
      }
      const store = useUserStore.getState();
      if (!store.isAuthenticated || !store.token) return;
      const exp = decodeTokenPayload(tok || store.token)?.exp;
      if (typeof exp === 'number' && exp * 1000 <= Date.now()) {
        logger.warn(`⏳ Socket namespace ${namespace || '/'}: access token expired and refresh unavailable — deferring connect`);
        setTimeout(() => { void prepConnect(); }, 5000);
        return;
      }
      sock.connect();
    };
    void prepConnect();

    s.on('connect', () => {
      consecutiveConnectErrors = 0;
      logger.log(`🔗 Socket connected for user ${userId} in namespace ${namespace || '/'} at ${EnvironmentService.getSocketUrl()}`);
    });
    s.on('disconnect', (reason) => {
      logger.warn(`⚡ Socket disconnected from namespace ${namespace || '/'}:`, reason);
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
        logger.error('Failed to handle profile_updated event:', err);
      }
    });

    s.on('connect_error', async (err) => {
      if (!useUserStore.getState().token) {
        logger.warn(`⚠️ Socket auth rejected with no active session in namespace ${namespace || '/'} — staying disconnected`);
        s.disconnect();
        return;
      }

      consecutiveConnectErrors++;

      // If socket failed to connect 3+ times in a row, test failover
      if (consecutiveConnectErrors >= 3) {
        const active = ServerFailoverManager.getActiveServer();
        const secondary = ServerFailoverManager.getSecondaryServer();
        if (!ServerFailoverManager.isQuarantined(secondary.id)) {
          logger.warn(`🚨 Socket connection failed ${consecutiveConnectErrors} times to ${active.id}. Switching to ${secondary.id}...`);
          ServerFailoverManager.switchActiveServer(secondary.id, 'Socket connect_error threshold reached');
          return;
        }
      }

      if (err?.message === 'ServiceUnavailable') {
        logger.warn(`⚠️ Socket auth temporarily unavailable (backend) in namespace ${namespace || '/'} — will retry`);
        return;
      }
      const msg = String(err?.message || '');
      const isAuthError =
        msg.includes('Authentication') ||
        msg.includes('jwt') ||
        msg.includes('token') ||
        msg.includes('expired') ||
        msg.includes('Expired');
      if (isAuthError) {
        logger.warn(`⚠️ Socket auth rejected in namespace ${namespace || '/'} (${msg}) — will refresh and retry`);
        try {
          await refreshTokenOnce();
          s.connect();
          logger.log(`🔄 Token refreshed and socket reconnected in namespace ${namespace || '/'}`);
        } catch (e) {
          logger.warn(`⚠️ Token refresh failed, socket in namespace ${namespace || '/'} will remain disconnected`);
        }
        return;
      }
      logger.error(`❌ Socket connection error in namespace ${namespace || '/'}:`, err);
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
