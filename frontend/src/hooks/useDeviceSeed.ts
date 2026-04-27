/**
 * useDeviceSeed.ts
 *
 * Generates a stable, permanent seed for the current device.
 * Seed = FNV-1a hash of (userId + deviceId).
 *
 * - deviceId is generated once and stored in localStorage forever.
 * - seed is recomputed whenever userId changes (account switch).
 * - This gives each device a unique but deterministic feed order.
 */
import { useMemo } from 'react';
import { useUserStore } from '../store/userStore';

/** FNV-1a 32-bit hash — same algorithm as server-side deviceSeedFromIds */
function fnv1a(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash;
}

/** Retrieve or create a permanent device identifier */
function getOrCreateDeviceId(): string {
    const KEY = 'sparkle_device_id';
    let id = localStorage.getItem(KEY);
    if (!id) {
        // crypto.randomUUID with fallback
        id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(KEY, id);
    }
    return id;
}

export function useDeviceSeed(): { seed: number; deviceId: string } {
    const userId = useUserStore(s => s.user?.user_id ?? '');

    return useMemo(() => {
        const deviceId = getOrCreateDeviceId();
        const seed = fnv1a(`${userId}:${deviceId}`);
        return { seed, deviceId };
    }, [userId]);
}
