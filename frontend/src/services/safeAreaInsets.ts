import { Capacitor, registerPlugin } from '@capacitor/core';
import { logger } from '../utils/logger';

/**
 * Authoritative safe-area inset source for the native app.
 *
 * Android WebView's support for `env(safe-area-inset-*)` is inconsistent across
 * Chrome versions, and the async `StatusBar.setOverlaysWebView` call only lands
 * after the first mount — both caused 0px → real-value reflows (visible as the
 * chat header jumping and content sitting under the camera cutout).
 *
 * The SparkleInsets native plugin reports the real system-bar/cutout insets in
 * CSS pixels and pushes updates whenever they change, so `--safe-area-inset-*`
 * is exact and stable from the first resolution onward. Web builds keep the
 * `env()` fallback defined in index.css.
 */
export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface SparkleInsetsPlugin {
  getSafeAreaInsets(): Promise<SafeAreaInsets>;
  addListener(
    eventName: 'insetsChanged',
    handler: (insets: InsetsPayload) => void
  ): Promise<{ remove: () => void }>;
}

/**
 * What the plugin actually emits. `imeHeight` is the live keyboard height in
 * CSS pixels — the OS reports it, so it is correct for Gboard, SwiftKey, a
 * landscape split keyboard, a tablet and a hardware keyboard without the app
 * choosing a number.
 */
interface InsetsPayload extends SafeAreaInsets {
  imeHeight?: number;
  imeVisible?: boolean;
}

const SparkleInsets = registerPlugin<SparkleInsetsPlugin>('SparkleInsets');

const CSS_VARS: Record<keyof SafeAreaInsets, string> = {
  top: '--safe-area-inset-top',
  bottom: '--safe-area-inset-bottom',
  left: '--safe-area-inset-left',
  right: '--safe-area-inset-right',
};

let initialized = false;
const current: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };
// Last keyboard height reported by the OS, in CSS pixels. 0 when hidden.
let currentImeHeight = 0;

function applyInsets(insets: Partial<InsetsPayload> | undefined): void {
  if (!insets) return;
  const root = document.documentElement;
  let changed = false;
  (Object.keys(CSS_VARS) as (keyof SafeAreaInsets)[]).forEach((key) => {
    const value = insets[key];
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    const rounded = Math.round(value * 100) / 100;
    if (current[key] !== rounded) {
      current[key] = rounded;
      changed = true;
    }
    root.style.setProperty(CSS_VARS[key], `${rounded}px`);
  });
  if (changed) {
    root.classList.add('sparkle-native-insets');
  }

  // Keyboard height, as its own variable so CSS can subtract exactly this
  // much. Writing it only on change avoids a style write per inset event,
  // and writing it at all — even 0 — means the chat layout always has a
  // defined value on native rather than falling back to a guess.
  if (typeof insets.imeHeight === 'number' && !Number.isNaN(insets.imeHeight)) {
    const ime = Math.max(0, Math.round(insets.imeHeight * 100) / 100);
    if (ime !== currentImeHeight) {
      currentImeHeight = ime;
      root.style.setProperty('--ime-height', `${ime}px`);
      // Lets CSS and tests branch on keyboard state without reading the number.
      root.classList.toggle('sparkle-keyboard-open', ime > 0);
    }
  }
}

/** Boot the native inset pipeline. Safe to call on web (no-op). */
export function initSafeAreaInsets(): void {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return;
  initialized = true;

  SparkleInsets.getSafeAreaInsets()
    .then(applyInsets)
    .catch((err) => logger.warn('safeAreaInsets: getSafeAreaInsets failed:', err));

  SparkleInsets.addListener('insetsChanged', (insets) => {
    applyInsets(insets);
  }).catch((err) => logger.warn('safeAreaInsets: listener failed:', err));
}

/** Latest known keyboard height in CSS pixels (0 when hidden). */
export function getKeyboardHeight(): number {
  return currentImeHeight;
}

/** Latest known insets (0 on web until env() is measured — see index.css). */
export function getSafeAreaInsets(): Readonly<SafeAreaInsets> {
  return { ...current };
}

export default { initSafeAreaInsets, getSafeAreaInsets, getKeyboardHeight };
