import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { logger } from '../utils/logger';

/**
 * Publish the real keyboard height as a CSS variable.
 *
 * This exists because the composer was sitting under the keyboard, and the
 * mechanism that was supposed to prevent it was not doing so. Three things had
 * to be true and only one was:
 *
 *   1. SparkleInsetsPlugin's OnApplyWindowInsetsListener dispatching a non-zero
 *      IME inset to JS. Unverified — and the nearby --safe-area-inset-* values
 *      that appear to prove insets work actually come from env() in index.css,
 *      which Android WebView resolves on its own without the plugin.
 *   2. --ime-height being subtracted from the container. True.
 *   3. The app not being sized in a unit the resize cannot reach. False — the
 *      shell is 100dvh in 45 places.
 *
 * So this uses the plugin Capacitor provides for exactly this, whose
 * keyboardWillShow event carries the height the OS measured. It is the same
 * signal for a phone keyboard, a landscape split keyboard, a tablet, or a
 * hardware keyboard, which is what "works on other devices" actually requires:
 * a measured number rather than an assumed one.
 *
 * resize is configured as 'none' in capacitor.config.json rather than 'body',
 * because 'body' shrinks <body> and the app is sized in dvh, which is
 * viewport-relative and would not follow it. Doing both would shrink twice, so
 * exactly one mechanism is responsible.
 */

const VARIABLE = '--ime-height';
let subscribed = false;

function writeHeight(px: number) {
  const root = document.documentElement;
  const next = Math.max(0, Math.round(px));
  if (root.style.getPropertyValue(VARIABLE) !== `${next}px`) {
    root.style.setProperty(VARIABLE, `${next}px`);
  }
  root.classList.toggle('sparkle-keyboard-open', next > 0);
}

export function initKeyboardHeight(): void {
  if (subscribed || !Capacitor.isNativePlatform()) return;
  subscribed = true;

  // The reported height is 0 when the keyboard closes, which is the signal to
  // reset the variable rather than leaving the last height applied forever.
  Keyboard.addListener('keyboardWillShow', (info) => {
    writeHeight(info?.keyboardHeight ?? 0);
  }).catch((err) => logger.warn('[keyboard] show listener failed:', err));

  Keyboard.addListener('keyboardWillHide', () => {
    writeHeight(0);
  }).catch((err) => logger.warn('[keyboard] hide listener failed:', err));
}
