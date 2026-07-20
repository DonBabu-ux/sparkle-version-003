// useSound.ts — Convenience hook for the Sparkle Audio Experience Framework
import { useContext, useCallback } from 'react';
import { SoundContext } from '../context/SoundProvider';
import type { SoundKey } from '../audio/managers/SoundManager';

/**
 * Hook to interact with the Sparkle Audio system.
 *
 * Usage:
 * ```tsx
 * const { playSound, getSettings, updateSettings } = useSound();
 * playSound('send');
 * ```
 */
export function useSound() {
  const ctx = useContext(SoundContext);

  const play = useCallback(
    (key: SoundKey, options?: { rate?: number }) => {
      ctx.playSound(key, options);
    },
    [ctx]
  );

  const stop = useCallback(
    (key: SoundKey) => {
      ctx.stopSound(key);
    },
    [ctx]
  );

  return {
    /** Play a sound by key, respecting focus/ducking/settings */
    playSound: play,
    /** Stop all active instances of a specific sound key */
    stopSound: stop,
    /** Stop every active sound in every pool */
    stopAll: ctx.stopAll,
    /** Read current sound settings snapshot */
    getSettings: ctx.getSettings,
    /** Merge partial updates into persisted sound settings */
    updateSettings: ctx.updateSettings,
    /** Read real-time audio engine diagnostics */
    getDiagnostics: ctx.getDiagnostics,
  };
}

export default useSound;
