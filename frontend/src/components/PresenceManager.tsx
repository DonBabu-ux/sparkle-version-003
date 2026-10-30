/**
 * PresenceManager
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Mounted ONCE at the root of the authenticated app (inside App.tsx).
 *
 * Responsibilities:
 *  1. Establishes & holds the singleton socket while the user is logged in.
 *  2. Sends presence:heartbeat every 20 s so the backend never times out.
 *  3. Listens to Page Visibility API (tab hidden/shown) to signal background.
 *  4. Listens to network online/offline events for graceful recovery.
 *  5. Reconnects automatically after network recovery.
 *  6. Emits a clean presence:offline before the browser tab closes.
 *
 * This component renders nothing â€” it is a pure side-effect manager.
 */
import { useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useUserStore } from '../store/userStore';
import { logger } from '../utils/logger';

const HEARTBEAT_INTERVAL_MS = 20_000;   // 20 s ping
const BACKGROUND_GRACE_MS   = 30_000;   // keep online 30 s after tab hides

export default function PresenceManager() {
  const socket  = useSocket();
  const { user, isAuthenticated } = useUserStore();
  // NOTE: this component previously rendered a second global "Reconnecting..."
  // banner. It duplicated the chat's connection UI, false-fired on routine
  // reconnects, and sat over content while the chat handled the same state
  // properly. Connection UI now lives in BlockingLoader (see Messages.tsx).

  const heartbeatTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundTimer   = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const isHiddenRef       = useRef(false);

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const clearHeartbeat = () => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
  };

  const startHeartbeat = (s: ReturnType<typeof useSocket>) => {
    if (!s) return;
    clearHeartbeat();
    heartbeatTimer.current = setInterval(() => {
      if (s.connected) {
        s.emit('sparkle-ping');
      } else {
        // Try to reconnect silently
        s.connect();
      }
    }, HEARTBEAT_INTERVAL_MS);
  };

  // â”€â”€â”€ Main effect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!socket || !isAuthenticated || !user) return;

    // Start heartbeat immediately
    startHeartbeat(socket);

    // â”€â”€ Socket lifecycle â”€â”€
    const onConnect = () => {
      logger.log('ðŸ“¡ PresenceManager: socket connected â†’ presence ONLINE');
      // Cancel any pending background offline timer
      if (backgroundTimer.current) {
        clearTimeout(backgroundTimer.current);
        backgroundTimer.current = null;
      }
      startHeartbeat(socket);
      // Re-announce presence immediately after reconnect so followers update without refresh
      socket.emit('sparkle-ping');
    };

    const onDisconnect = (reason: string) => {
      logger.warn('ðŸ“¡ PresenceManager: socket disconnected â†’', reason);
      // socket.io will auto-reconnect; do NOT immediately mark offline
    };

    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);

    // â”€â”€ Page Visibility (tab hidden / app backgrounded) â”€â”€
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        isHiddenRef.current = true;
        // Give a grace period before the server marks offline
        backgroundTimer.current = setTimeout(() => {
          if (isHiddenRef.current && socket.connected) {
            socket.emit('presence:background');
          }
        }, BACKGROUND_GRACE_MS);
      } else {
        isHiddenRef.current = false;
        if (backgroundTimer.current) {
          clearTimeout(backgroundTimer.current);
          backgroundTimer.current = null;
        }
        // Coming back to foreground â€” ensure socket is alive
        if (!socket.connected) {
          socket.connect();
        } else {
          socket.emit('sparkle-ping'); // immediate heartbeat
        }
      }
    };

    // â”€â”€ Network events â”€â”€
    const handleOnline = () => {
      logger.log('âœ… Network restored â€” reconnecting socket');
      if (!socket.connected) socket.connect();
    };

    const handleOffline = () => {
      logger.warn('âŒ Network lost â€” socket will auto-recover on reconnect');
    };

    // â”€â”€ Unload (tab/window close) â”€â”€
    const handleBeforeUnload = () => {
      // Best-effort synchronous emit before the page tears down
      if (socket.connected) {
        socket.emit('presence:offline');
      }
    };

    // â”€â”€ Manager Reconnect Events â”€â”€ (logging only â€” no UI, see BlockingLoader)
    const handleReconnectAttempt = (attempt: number) => {
      logger.log(`ðŸ“¡ Socket reconnecting... (Attempt ${attempt})`);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearHeartbeat();
      if (backgroundTimer.current) clearTimeout(backgroundTimer.current);
      socket.off('connect',    onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [socket, isAuthenticated, user?.user_id]);

  return null;
}

