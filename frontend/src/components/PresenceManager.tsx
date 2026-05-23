/**
 * PresenceManager
 * ─────────────────────────────────────────────────────────────────────────────
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
 * This component renders nothing — it is a pure side-effect manager.
 */
import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useUserStore } from '../store/userStore';

const HEARTBEAT_INTERVAL_MS = 20_000;   // 20 s ping
const BACKGROUND_GRACE_MS   = 30_000;   // keep online 30 s after tab hides

export default function PresenceManager() {
  const socket  = useSocket();
  const { user, isAuthenticated } = useUserStore();
  const [isReconnecting, setIsReconnecting] = useState(false);

  const heartbeatTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundTimer   = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const isHiddenRef       = useRef(false);

  // ─── Helpers ────────────────────────────────────────────────────────────────
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

  // ─── Main effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isAuthenticated || !user) return;

    // Start heartbeat immediately
    startHeartbeat(socket);

    // ── Socket lifecycle ──
    const onConnect = () => {
      console.log('📡 PresenceManager: socket connected → presence ONLINE');
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
      console.warn('📡 PresenceManager: socket disconnected →', reason);
      // socket.io will auto-reconnect; do NOT immediately mark offline
    };

    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);

    // ── Page Visibility (tab hidden / app backgrounded) ──
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
        // Coming back to foreground — ensure socket is alive
        if (!socket.connected) {
          socket.connect();
        } else {
          socket.emit('sparkle-ping'); // immediate heartbeat
        }
      }
    };

    // ── Network events ──
    const handleOnline = () => {
      console.log('🌐 Network restored — reconnecting socket');
      if (!socket.connected) socket.connect();
    };

    const handleOffline = () => {
      console.warn('🌐 Network lost — socket will auto-recover on reconnect');
    };

    // ── Unload (tab/window close) ──
    const handleBeforeUnload = () => {
      // Best-effort synchronous emit before the page tears down
      if (socket.connected) {
        socket.emit('presence:offline');
      }
    };

    // ── Manager Reconnect Events ──
    const handleReconnectAttempt = (attempt: number) => {
      console.log(`📡 Socket reconnecting... (Attempt ${attempt})`);
      setIsReconnecting(true);
    };
    const handleReconnect = () => {
      setIsReconnecting(false);
    };
    const handleReconnectFailed = () => {
      setIsReconnecting(false);
    };

    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.io.on('reconnect', handleReconnect);
    socket.io.on('reconnect_failed', handleReconnectFailed);

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
      socket.io.off('reconnect', handleReconnect);
      socket.io.off('reconnect_failed', handleReconnectFailed);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [socket, isAuthenticated, user?.user_id]);

  if (!isReconnecting) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#f59e0b',
      color: '#fff',
      padding: '6px 16px',
      borderRadius: '20px',
      fontSize: '0.875rem',
      fontWeight: 500,
      zIndex: 9999,
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <div style={{
        width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 1s linear infinite'
      }} />
      Reconnecting...
    </div>
  );
}

