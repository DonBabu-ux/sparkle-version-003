// SoundProvider.tsx - React context that bootstraps the Sparkle Audio Experience Framework
import React, { createContext, useEffect, useRef, useCallback } from 'react';
import AudioSessionManager from '../audio/managers/AudioSessionManager';
import type { SoundKey } from '../audio/managers/SoundManager';
import { logger } from '../utils/logger';

// ── Notification type → sound key mapping ──
const NOTIFICATION_SOUND_MAP: Record<string, SoundKey> = {
  like: 'like',
  comment: 'comment',
  follow: 'follow',
  mention: 'mention',
  tag: 'tag',
  share: 'share',
  story: 'story',
  story_reply: 'story_reply',
  story_like: 'story_like',
  moment_like: 'moment_like',
  moment_comment: 'moment_comment',
  order: 'order',
  offer: 'offer',
  payment: 'payment',
  ai_response: 'ai_response',
  ai_finished: 'ai_finished',
  message: 'outchat',
};

export interface SoundContextValue {
  playSound: (key: SoundKey, options?: { rate?: number }) => void;
  stopSound: (key: SoundKey) => void;
  stopAll: () => void;
  getSettings: () => any;
  updateSettings: (partial: any) => void;
  getDiagnostics: () => any;
}

export const SoundContext = createContext<SoundContextValue>({
  playSound: () => {},
  stopSound: () => {},
  stopAll: () => {},
  getSettings: () => ({}),
  updateSettings: () => {},
  getDiagnostics: () => ({
    loadedCount: 0,
    activeInstances: 0,
    cachedSize: '0 MB',
    latency: '0 ms',
    ctxState: 'Not initialized',
    failures: 0,
  }),
});

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const gestureHandled = useRef(false);
  const initDone = useRef(false);

  // ── 1. Bootstrap Audio Engine on mount ──
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    // Initialize the AudioSessionManager (validates assets, warms pools, etc.)
    AudioSessionManager.init().then(() => {
      logger.log('[SoundProvider] AudioSessionManager initialized.');
    });
  }, []);

  // ── 2. Resume AudioContext on first user gesture (autoplay policy) ──
  useEffect(() => {
    const handleFirstGesture = () => {
      if (gestureHandled.current) return;
      gestureHandled.current = true;

      AudioSessionManager.handleUserGesture();

      // Remove listeners once handled
      document.removeEventListener('click', handleFirstGesture);
      document.removeEventListener('touchstart', handleFirstGesture);
      document.removeEventListener('keydown', handleFirstGesture);
    };

    document.addEventListener('click', handleFirstGesture, { once: false, passive: true });
    document.addEventListener('touchstart', handleFirstGesture, { once: false, passive: true });
    document.addEventListener('keydown', handleFirstGesture, { once: false, passive: true });

    return () => {
      document.removeEventListener('click', handleFirstGesture);
      document.removeEventListener('touchstart', handleFirstGesture);
      document.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  // ── Context value (stable references) ──
  const playSound = useCallback((key: SoundKey, options?: { rate?: number }) => {
    AudioSessionManager.playSound(key, options);
  }, []);

  const stopSound = useCallback((key: SoundKey) => {
    AudioSessionManager.stopSound(key);
  }, []);

  const stopAll = useCallback(() => {
    AudioSessionManager.stopAll();
  }, []);

  const getSettings = useCallback(() => {
    return AudioSessionManager.getSettings();
  }, []);

  const updateSettings = useCallback((partial: any) => {
    AudioSessionManager.updateSettings(partial);
  }, []);

  const getDiagnostics = useCallback(() => {
    return AudioSessionManager.getDiagnostics();
  }, []);

  const contextValue: SoundContextValue = {
    playSound,
    stopSound,
    stopAll,
    getSettings,
    updateSettings,
    getDiagnostics,
  };

  return <SoundContext.Provider value={contextValue}>{children}</SoundContext.Provider>;
};

/**
 * Maps an incoming socket notification to the appropriate sound key and plays it.
 * Call this from a socket listener (e.g. `socket.on('new-notification', handleNotificationSound)`).
 */
export function handleNotificationSound(notification: { type?: string; category?: string }): void {
  const typeKey = (notification.type || notification.category || '').toLowerCase();
  const soundKey = NOTIFICATION_SOUND_MAP[typeKey];

  if (soundKey) {
    AudioSessionManager.playSound(soundKey);
  }
}

export default SoundProvider;
