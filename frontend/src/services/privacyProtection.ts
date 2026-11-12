import { registerPlugin } from '@capacitor/core';

/**
 * Native screen-capture protection (FLAG_SECURE on Android).
 *
 * Extracted from pages/Messages.tsx, where the registration sat among fourteen
 * UI components. It belongs here rather than in the page for the same reason
 * SparkleInsets lives in services/safeAreaInsets.ts and MediaStoreSaver lives
 * in services/mediaDownload.ts: it is a Capacitor bridge, not a component, and
 * the page only needs the handle.
 *
 * The interface is what the page actually calls. addListener's event payload is
 * typed loosely to match the bridge, which returns untyped JSON.
 */
export interface PrivacyProtectionPlugin {
  enablePrivacyProtection(): Promise<void>;
  disablePrivacyProtection(): Promise<void>;
  addListener(
    eventName: 'onScreenshotAttempt',
    listener: (eventData: any) => void
  ): Promise<{ remove: () => void }>;
}

export const PrivacyProtection = registerPlugin<PrivacyProtectionPlugin>('PrivacyProtection');
