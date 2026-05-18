import React, { useEffect } from 'react';
import { useNetworkStore } from '../store/networkStore';
import type { NetworkQuality } from '../store/networkStore';
import { useOfflineQueueStore } from '../store/offlineQueueStore';

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const { setOffline, setQuality, setSaveDataMode } = useNetworkStore();
  const { processQueue } = useOfflineQueueStore();

  useEffect(() => {
    // 1. Online/Offline Listeners
    const handleOnline = () => {
      setOffline(false);
      processQueue(); // Sync offline actions
    };
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    setOffline(!navigator.onLine);

    // 2. Network Information API (Bandwidth/Connection Type)
    // TypeScript workaround since standard TS dom doesn't fully support NetworkInformation yet
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    const updateConnectionStatus = () => {
      if (!connection) return;

      const type = connection.effectiveType; // 'slow-2g', '2g', '3g', or '4g'
      const saveData = connection.saveData === true;
      const downlink = connection.downlink; // effective bandwidth in Mbps

      setSaveDataMode(saveData || type === '2g' || type === 'slow-2g' || type === '3g');

      let quality: NetworkQuality = 'strong';
      if (!navigator.onLine) {
        quality = 'offline';
      } else if (type === 'slow-2g' || type === '2g' || (downlink && downlink < 1)) {
        quality = 'unstable';
      } else if (type === '3g' || (downlink && downlink < 3)) {
        quality = 'weak';
      } else {
        quality = 'strong';
      }

      setQuality(quality);
      
      console.log(`📡 Network Status: ${quality.toUpperCase()} | Type: ${type} | Speed: ${downlink} Mbps | SaveData: ${saveData}`);
    };

    if (connection) {
      updateConnectionStatus();
      connection.addEventListener('change', updateConnectionStatus);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateConnectionStatus);
      }
    };
  }, [setOffline, setQuality, setSaveDataMode]);

  return <>{children}</>;
}
