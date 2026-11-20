import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

export type SparklePermission =
  | 'camera'
  | 'microphone'
  | 'notifications'
  | 'media'
  | 'location'
  | 'contacts'
  | 'bluetooth';

export type SparklePermissionStatus =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'limited'
  | 'permanently_denied'
  | 'unavailable'
  | 'checking';

export interface PermissionMeta {
  id: SparklePermission;
  name: string;
  purpose: string;
}

export const PERMISSION_DEFINITIONS: Record<SparklePermission, PermissionMeta> = {
  camera: {
    id: 'camera',
    name: 'Camera',
    purpose: 'Video calls, taking photos and creating content',
  },
  microphone: {
    id: 'microphone',
    name: 'Microphone',
    purpose: 'Voice calls, video calls and recording content',
  },
  notifications: {
    id: 'notifications',
    name: 'Notifications',
    purpose: 'Messages, call alerts and activity notifications',
  },
  media: {
    id: 'media',
    name: 'Photos and videos',
    purpose: 'Selecting and uploading media',
  },
  location: {
    id: 'location',
    name: 'Location',
    purpose: 'Location-based features, where available',
  },
  contacts: {
    id: 'contacts',
    name: 'Contacts',
    purpose: 'Contact discovery and synchronization, if supported',
  },
  bluetooth: {
    id: 'bluetooth',
    name: 'Bluetooth',
    purpose: 'Audio device routing, where applicable',
  },
};

interface NativePermissionsPlugin {
  checkAllPermissions(): Promise<Record<SparklePermission, SparklePermissionStatus>>;
  requestSinglePermission(options: { name: SparklePermission }): Promise<{ name: string; status: SparklePermissionStatus }>;
  openAppSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  checkCallPermissions(): Promise<{
    microphone: string;
    camera: string;
    hasMicrophone: boolean;
    hasCamera: boolean;
  }>;
  requestCallPermissions(options: { mode: 'voice' | 'video' }): Promise<{
    microphone: string;
    camera: string;
    hasMicrophone: boolean;
    hasCamera: boolean;
  }>;
}

const NativeCallPermissions = registerPlugin<NativePermissionsPlugin>('CallPermissions');

type PermissionChangeListener = (permissions: Record<SparklePermission, SparklePermissionStatus>) => void;

class PermissionManager {
  private listeners: Set<PermissionChangeListener> = new Set();
  private cache: Record<SparklePermission, SparklePermissionStatus> = {
    camera: 'checking',
    microphone: 'checking',
    notifications: 'checking',
    media: 'checking',
    location: 'checking',
    contacts: 'checking',
    bluetooth: 'checking',
  };
  private isChecking = false;
  private initialized = false;

  constructor() {
    this.setupResumeListeners();
  }

  private setupResumeListeners() {
    if (typeof window === 'undefined') return;

    if (Capacitor.isNativePlatform()) {
      try {
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            this.refreshAll().catch(() => {});
          }
        });
      } catch (e) {
        logger.debug('[PermissionService] Failed to bind App appStateChange listener:', e);
      }
    }

    window.addEventListener('focus', () => {
      this.refreshAll().catch(() => {});
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.refreshAll().catch(() => {});
      }
    });
  }

  public isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  public async openAppSettings(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeCallPermissions.openAppSettings();
      } catch (e) {
        logger.warn('[PermissionService] Failed to open native app settings:', e);
      }
    } else {
      logger.info('[PermissionService] Opening app settings is only available on native mobile.');
    }
  }

  public async openNotificationSettings(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeCallPermissions.openNotificationSettings();
      } catch (e) {
        logger.warn('[PermissionService] Failed to open native notification settings:', e);
        // Fallback to general app settings
        await this.openAppSettings();
      }
    } else {
      logger.info('[PermissionService] Opening notification settings is only available on native mobile.');
    }
  }

  public async checkAllPermissions(): Promise<Record<SparklePermission, SparklePermissionStatus>> {
    if (this.isChecking) {
      return { ...this.cache };
    }

    this.isChecking = true;
    try {
      if (Capacitor.isNativePlatform()) {
        const nativeResults = await NativeCallPermissions.checkAllPermissions();
        this.cache = {
          camera: nativeResults.camera || 'prompt',
          microphone: nativeResults.microphone || 'prompt',
          notifications: nativeResults.notifications || 'prompt',
          media: nativeResults.media || 'prompt',
          location: nativeResults.location || 'prompt',
          contacts: nativeResults.contacts || 'prompt',
          bluetooth: nativeResults.bluetooth || 'granted',
        };
      } else {
        // Browser / Web environment fallback
        this.cache = await this.checkBrowserPermissions();
      }

      this.initialized = true;
      this.notifyListeners();
      return { ...this.cache };
    } catch (err) {
      logger.warn('[PermissionService] Error querying permission status:', err);
      return { ...this.cache };
    } finally {
      this.isChecking = false;
    }
  }

  private async checkBrowserPermissions(): Promise<Record<SparklePermission, SparklePermissionStatus>> {
    const res: Record<SparklePermission, SparklePermissionStatus> = {
      camera: 'prompt',
      microphone: 'prompt',
      notifications: 'prompt',
      media: 'granted', // Browser file pickers don't require runtime OS permission
      location: 'prompt',
      contacts: 'unavailable',
      bluetooth: 'unavailable',
    };

    // Notifications API
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') res.notifications = 'granted';
      else if (Notification.permission === 'denied') res.notifications = 'denied';
      else res.notifications = 'prompt';
    } else {
      res.notifications = 'unavailable';
    }

    // Permissions API (Camera, Microphone, Geolocation)
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      try {
        const cam = await navigator.permissions.query({ name: 'camera' as PermissionName });
        res.camera = (cam.state as SparklePermissionStatus) || 'prompt';
      } catch {}

      try {
        const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        res.microphone = (mic.state as SparklePermissionStatus) || 'prompt';
      } catch {}

      try {
        const geo = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        res.location = (geo.state as SparklePermissionStatus) || 'prompt';
      } catch {}
    }

    // Contacts Picker API support
    if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      res.contacts = 'prompt';
    }

    // Web Bluetooth support
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      res.bluetooth = 'prompt';
    }

    return res;
  }

  public async checkPermission(name: SparklePermission): Promise<SparklePermissionStatus> {
    const all = await this.checkAllPermissions();
    return all[name];
  }

  public async requestPermission(name: SparklePermission): Promise<SparklePermissionStatus> {
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await NativeCallPermissions.requestSinglePermission({ name });
        const updatedStatus = res.status || 'denied';
        this.cache[name] = updatedStatus;
        this.notifyListeners();
        return updatedStatus;
      }

      // Browser requests
      if (name === 'notifications' && typeof Notification !== 'undefined') {
        const status = await Notification.requestPermission();
        const mapped = status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'prompt';
        this.cache.notifications = mapped;
        this.notifyListeners();
        return mapped;
      }

      if ((name === 'camera' || name === 'microphone') && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: name === 'microphone' || name === 'camera',
            video: name === 'camera',
          });
          stream.getTracks().forEach((t) => t.stop());
          this.cache[name] = 'granted';
          this.notifyListeners();
          return 'granted';
        } catch (e: any) {
          const isDenied = e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError';
          const status = isDenied ? 'denied' : 'prompt';
          this.cache[name] = status;
          this.notifyListeners();
          return status;
        }
      }

      if (name === 'location' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              this.cache.location = 'granted';
              this.notifyListeners();
              resolve('granted');
            },
            () => {
              this.cache.location = 'denied';
              this.notifyListeners();
              resolve('denied');
            },
            { timeout: 8000 }
          );
        });
      }

      // Photos & videos on web are standard file input
      if (name === 'media') {
        this.cache.media = 'granted';
        this.notifyListeners();
        return 'granted';
      }

      return this.cache[name] || 'unavailable';
    } catch (err) {
      logger.warn(`[PermissionService] Error requesting permission "${name}":`, err);
      await this.refreshAll();
      return this.cache[name] || 'denied';
    }
  }

  public async refreshAll(): Promise<Record<SparklePermission, SparklePermissionStatus>> {
    return this.checkAllPermissions();
  }

  public getCachedPermissions(): Record<SparklePermission, SparklePermissionStatus> {
    return { ...this.cache };
  }

  public isReady(): boolean {
    return this.initialized;
  }

  public subscribe(listener: PermissionChangeListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.cache });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const snapshot = { ...this.cache };
    this.listeners.forEach((l) => {
      try {
        l(snapshot);
      } catch (e) {
        logger.error('[PermissionService] Listener error:', e);
      }
    });
  }
}

export const PermissionService = new PermissionManager();

// ── React Hooks ─────────────────────────────────────────────────────────────

export function useAllPermissions() {
  const [permissions, setPermissions] = useState<Record<SparklePermission, SparklePermissionStatus>>(
    PermissionService.getCachedPermissions()
  );
  const [loading, setLoading] = useState(!PermissionService.isReady());

  const refresh = useCallback(async () => {
    setLoading(true);
    const updated = await PermissionService.refreshAll();
    setPermissions(updated);
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsub = PermissionService.subscribe((updated) => {
      setPermissions(updated);
      setLoading(false);
    });

    if (!PermissionService.isReady()) {
      refresh().catch(() => {});
    }

    return () => {
      unsub();
    };
  }, [refresh]);

  return { permissions, loading, refresh };
}

export function usePermission(name: SparklePermission) {
  const [status, setStatus] = useState<SparklePermissionStatus>(
    PermissionService.getCachedPermissions()[name] || 'checking'
  );

  const refresh = useCallback(async () => {
    const updated = await PermissionService.checkPermission(name);
    setStatus(updated);
    return updated;
  }, [name]);

  const request = useCallback(async () => {
    const updated = await PermissionService.requestPermission(name);
    setStatus(updated);
    return updated;
  }, [name]);

  useEffect(() => {
    const unsub = PermissionService.subscribe((all) => {
      setStatus(all[name]);
    });
    return unsub;
  }, [name]);

  return { status, refresh, request };
}
