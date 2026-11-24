'use client';
/**
 * useUniversities.ts
 * Fetch the campus/university list from the backend API
 * (GET /api/universities, seeded by migration 20261124_universities)
 * instead of a hardcoded array.
 *
 * Uses a module-level cache + in-flight dedupe so multiple components
 * (EditProfileModal, Signup) mount simultaneously without hammering the API.
 */
import { useEffect, useState, useCallback } from 'react';
import api from '../api/api';

interface University {
    id: number;
    name: string;
    country: string;
    state: string | null;
    city: string | null;
    is_active: number;
}

const cache = new Map<string, University[]>();
let inFlight: Promise<University[]> | null = null;

const fetchUniversities = async (): Promise<University[]> => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
        const { data } = await api.get<{ universities: University[] }>('/universities');
        const list = data?.universities ?? [];
        cache.set('all', list);
        inFlight = null;
        return list;
    })();
    return inFlight;
};

export function useUniversities() {
    const [universities, setUniversities] = useState<University[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const refetch = useCallback(async () => {
        setLoading(true);
        try {
            const list = await fetchUniversities();
            setUniversities(list);
            setError(false);
        } catch (err) {
            console.error('[useUniversities] failed to load:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const cached = cache.get('all');
        if (cached) {
            setUniversities(cached);
            setLoading(false);
            setError(false);
            // Still refresh in background if we want freshness, but don't block.
            void refetch();
            return;
        }
        void refetch();
    }, [refetch]);

    return { universities, loading, error, refetch };
}

export default useUniversities;
