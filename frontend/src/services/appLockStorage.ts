import localforage from 'localforage';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// On native Android / iOS, use Capacitor Preferences (durable SharedPreferences / NSUserDefaults)
// On Web / PWA, use IndexedDB via isolated localforage instance (survives cookie deletion)
const webStorage = localforage.createInstance({
  name: 'SparkleSecurityStore',
  storeName: 'app_lock_secrets',
  description: 'Durable client-side storage for local app lock verifiers'
});

export const appLockStorage = {
  async get(key: string): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    const val = await webStorage.getItem<string>(key);
    return val ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value });
      return;
    }
    await webStorage.setItem(key, value);
  },

  async remove(key: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key });
      return;
    }
    await webStorage.removeItem(key);
  },

  async clear(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key: 'sparkle_app_pin_enabled' });
      await Preferences.remove({ key: 'sparkle_app_pin_hash' });
      await Preferences.remove({ key: 'sparkle_app_pin_salt' });
      await Preferences.remove({ key: 'sparkle_app_lock_timeout' });
      await Preferences.remove({ key: 'sparkle_app_pin_failed_attempts' });
      await Preferences.remove({ key: 'sparkle_app_pin_lockout_until' });
      return;
    }
    await webStorage.clear();
  }
};
