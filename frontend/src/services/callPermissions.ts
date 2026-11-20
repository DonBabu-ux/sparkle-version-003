import { Capacitor, registerPlugin } from '@capacitor/core';
import { logger } from '../utils/logger';

export type NativeAudioRoute = 'speaker' | 'earpiece' | 'bluetooth' | 'headphones';

export interface NativeAudioOutputDevice {
  deviceId: string;
  label: string;
  type: NativeAudioRoute | 'headphones' | 'unknown';
}

export interface CallPermissionsPluginInterface {
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
  openAppSettings(): Promise<void>;
  setAudioRoute(options: { route: NativeAudioRoute; deviceId?: string }): Promise<{ success: boolean; route: string }>;
  getAudioDevices(): Promise<{ devices: NativeAudioOutputDevice[] }>;
  requestBluetoothPermission(): Promise<{ granted: boolean }>;
  resetAudioRoute(): Promise<void>;
}

export const NativeCallPermissions = registerPlugin<CallPermissionsPluginInterface>('CallPermissions');

/**
 * Pre-checks and requests required microphone/camera permissions before WebRTC
 * media acquisition. On native Android APK, handles native runtime dialogs
 * and detects permanently denied permissions to guide users to Settings.
 */
export async function ensureCallPermissions(mode: 'voice' | 'video'): Promise<{
  granted: boolean;
  error?: string;
  isPermanentlyDenied?: boolean;
}> {
  if (Capacitor.isNativePlatform()) {
    try {
      const initial = await NativeCallPermissions.checkCallPermissions();
      const needsCamera = mode === 'video';

      if (initial.hasMicrophone && (!needsCamera || initial.hasCamera)) {
        return { granted: true };
      }

      // Request missing permissions via native dialog
      const result = await NativeCallPermissions.requestCallPermissions({ mode });
      const micGranted = result.hasMicrophone || result.microphone === 'granted';
      const camGranted = result.hasCamera || result.camera === 'granted';

      if (!micGranted) {
        return {
          granted: false,
          error: 'Microphone permission is required to make calls on Sparkle.',
          isPermanentlyDenied: result.microphone === 'denied',
        };
      }

      if (needsCamera && !camGranted) {
        // Microphone granted, but camera denied: allow voice fallback
        return {
          granted: true,
          error: 'Camera permission denied. Proceeding with voice only.',
        };
      }

      return { granted: true };
    } catch (err) {
      logger.warn('[CallPermissions] Native permission check error, falling back to browser API:', err);
    }
  }

  return { granted: true };
}

/**
 * Opens native Android App Settings when permissions are disabled.
 */
export async function openCallAppSettings(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeCallPermissions.openAppSettings();
    } catch (e) {
      logger.warn('[CallPermissions] Failed to open app settings:', e);
    }
  }
}

/**
 * Sets native Android audio routing (speakerphone, earpiece receiver, bluetooth SCO).
 */
export async function setNativeAudioRoute(route: NativeAudioRoute, deviceId?: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await NativeCallPermissions.setAudioRoute({ route, deviceId });
      return Boolean(result?.success);
    } catch (e) {
      logger.debug('[CallPermissions] Failed to set native audio route:', e);
    }
  }
  return true;
}

export async function requestBluetoothPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const result = await NativeCallPermissions.requestBluetoothPermission();
    return Boolean(result?.granted);
  } catch (e) {
    logger.debug('[CallPermissions] Failed to request Bluetooth permission:', e);
    return false;
  }
}

export async function getNativeAudioDevices(): Promise<NativeAudioOutputDevice[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const result = await NativeCallPermissions.getAudioDevices();
    return Array.isArray(result?.devices) ? result.devices : [];
  } catch (e) {
    logger.debug('[CallPermissions] Failed to enumerate native audio devices:', e);
    return [];
  }
}

/**
 * Resets native Android audio routing to normal communication mode.
 */
export async function resetNativeAudioRoute(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeCallPermissions.resetAudioRoute();
    } catch (e) {
      logger.debug('[CallPermissions] Failed to reset native audio route:', e);
    }
  }
}
