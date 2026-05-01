import { useEffect, useCallback } from 'react';
import { useMarketplaceStore } from '../store/marketplaceStore';
import api from '../api/api';

const LOCATION_CACHE_KEY = 'sparkle_last_location';

export const useLocationDetection = () => {
  const { setFilters, location } = useMarketplaceStore();

  const resolveWithBackend = useCallback(async (coords?: { lat: number; lon: number }) => {
    try {
      const response = await api.post('/location/resolve', coords || {});
      if (response.data.success) {
        const newLoc = response.data.location;
        setFilters({ 
          location: {
            lat: newLoc.lat,
            lng: newLoc.lng,
            name: newLoc.name,
            source: newLoc.source
          }
        });
        localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(newLoc));
      }
    } catch (err) {
      console.error('Failed to resolve location via backend:', err);
    }
  }, [setFilters]);

  const detectLocation = useCallback(() => {
    // 1. Check LocalStorage Cache
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setFilters({ location: parsed });
        // Optionally refresh in background
      } catch (e) {
        localStorage.removeItem(LOCATION_CACHE_KEY);
      }
    }

    // 2. Try Browser GPS
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          resolveWithBackend({ lat: latitude, lon: longitude });
        },
        (error) => {
          console.warn('GPS detection failed:', error.message);
          // 3. Fallback to IP via Backend
          resolveWithBackend();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    } else {
      // No Geolocation API, fallback to IP
      resolveWithBackend();
    }
  }, [resolveWithBackend, setFilters]);

  return { detectLocation };
};
