import React, { useEffect, useRef, useState } from 'react';
import { useUserStore } from '../store/userStore';

/**
 * 1. EdgeBackgroundLayer
 * A full edge-to-edge visual background container.
 * Extends behind status bar, notch, and home indicators.
 */
export const EdgeBackgroundLayer: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, className = '', style }) => {
  const theme = useUserStore((state) => state.theme);
  const bgClass = theme === 'dark' ? 'bg-black text-white' : 'bg-[#f8e7ed] text-[#18181b]';
  
  return (
    <div
      className={`absolute inset-0 w-full h-full -z-10 transition-colors duration-300 ${bgClass} ${className}`}
      style={{
        pointerEvents: 'none',
        ...style
      }}
    >
      {children}
    </div>
  );
};

/**
 * 2. StatusBarBackground
 * A visual overlay strip that matches the active page status bar background.
 * Adapts dynamically to page colors/themes.
 */
export const StatusBarBackground: React.FC<{
  backgroundColor?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ backgroundColor, className = '', style }) => {
  const theme = useUserStore((state) => state.theme);
  const defaultBg = theme === 'dark' ? '#000000' : '#ffffff';
  
  return (
    <div
      className={`w-full shrink-0 z-50 transition-all duration-300 ${className}`}
      style={{
        height: 'var(--safe-area-inset-top, 24px)',
        backgroundColor: backgroundColor || defaultBg,
        position: 'relative',
        ...style
      }}
    />
  );
};

/**
 * 3. SafeContentContainer
 * Wraps interactive screen contents, applying safe padding-top
 * to keep UI/buttons strictly below the status bar/notch display.
 */
export const SafeContentContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, className = '', style }) => {
  return (
    <div
      className={`flex flex-col w-full h-full ${className}`}
      style={{
        paddingTop: 'var(--safe-area-inset-top, 0px)',
        boxSizing: 'border-box',
        ...style
      }}
    >
      {children}
    </div>
  );
};

/**
 * 4. ScreenContentWrapper
 * standard scrollable content container respecting top/bottom safe areas.
 */
export const ScreenContentWrapper: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}> = ({ children, className = '', style, onScroll }) => {
  return (
    <div
      onScroll={onScroll}
      className={`flex-1 w-full overflow-y-auto overflow-x-hidden ${className}`}
      style={{
        paddingBottom: 'var(--safe-area-inset-bottom, 0px)',
        boxSizing: 'border-box',
        ...style
      }}
    >
      {children}
    </div>
  );
};

/**
 * 5. KeyboardSafeContainer & KeyboardAwareChatLayout
 *
 * Architecture for keyboard-safe chat layout (Android edge-to-edge):
 *
 *   AndroidManifest: windowSoftInputMode="adjustNothing"
 *   SparkleInsetsPlugin: pads WebView bottom by IME inset height
 *
 * When the IME opens, the WebView's CSS layout viewport shrinks from the
 * bottom (via the native padding set by SparkleInsetsPlugin).  The flex
 * column inside KeyboardSafeContainer compresses:
 *
 *   ┌──────────────────────────────┐  ← stable (not affected by IME)
 *   │  Conversation Header         │  shrink-0, NO sticky, outside gesture
 *   ├──────────────────────────────┤
 *   │  Message List (flex-1)       │  compresses when keyboard opens  ↕
 *   ├──────────────────────────────┤
 *   │  Composer / ChatInputDock    │  shrink-0, sits above keyboard  ↕
 *   └──────────────────────────────┘  ← keyboard sits here
 *
 * Critical invariants:
 *   • The conversation header MUST be a direct flex child of the main column
 *     with shrink-0 — NOT inside a scroll container or gesture wrapper.
 *   • No transform/translate is applied to any ancestor of the header.
 *   • adjustNothing prevents the system from panning/resizing the window.
 *   • ChatInputDock adjusts its own paddingBottom via visualViewport to drop
 *     the safe-area pad when the keyboard is open (no double-adjustment).
 */
export const KeyboardSafeContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  'data-chat-mode'?: 'light' | 'dark';
}> = ({ children, className = '', style, 'data-chat-mode': chatMode }) => {
  // Use static full viewport height to allow browser to handle keyboard overlays.
  const containerStyle: React.CSSProperties = {
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
    position: 'relative',
    ...style,
    // Ensure any additional className can override.
  };
  return (
    <div className={`flex flex-col w-full ${className}`} style={containerStyle} data-chat-mode={chatMode}>
      {children}
    </div>
  );
};

/**
 * 6. ChatInputDock
 * Keeps the chat input dock elevated perfectly above the keyboard
 * and properly padded at the bottom when keyboard is closed.
 */
export const ChatInputDock: React.FC<{
  children: React.ReactNode;
  backgroundColor?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, backgroundColor, className = '', style }) => {
  const theme = useUserStore((state) => state.theme);
  const defaultBg = theme === 'dark' ? '#000000' : '#ffffff';
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const baseHeightRef = useRef<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const lastWidthRef = { current: null as number | null };

    const handleResize = () => {
      const height = vv.height ?? window.innerHeight;
      const width = vv.width ?? window.innerWidth;

      // A keyboard does not change the viewport width, so a width jump means the
      // device rotated (or the window resized). Re-baseline in that case, or the
      // stale portrait height keeps reporting "keyboard open" forever after a
      // rotation with the keyboard up.
      if (lastWidthRef.current !== null && Math.abs(lastWidthRef.current - width) > 2) {
        baseHeightRef.current = height;
      }
      lastWidthRef.current = width;

      if (baseHeightRef.current === null) baseHeightRef.current = height;

      // Keyboard is open when the viewport shrank meaningfully below the
      // keyboard-closed baseline (150px covers URL-bar jitter, not keyboards).
      const shrink = baseHeightRef.current - height;
      if (shrink > 150) {
        setIsKeyboardOpen(true);
      } else {
        baseHeightRef.current = height;
        setIsKeyboardOpen(false);
      }
    };

    vv.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      vv.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      className={`w-full shrink-0 border-t border-white/5 z-30 transition-all duration-150 ${className}`}
      style={{
        backgroundColor: backgroundColor || defaultBg,
        paddingBottom: isKeyboardOpen ? '6px' : 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 8px)',
        boxSizing: 'border-box',
        ...style
      }}
    >
      <div className="w-full max-w-[1200px] mx-auto">
        {children}
      </div>
    </div>
  );
};

/**
 * 7. KeyboardAwareChatLayout
 * Wraps chat view layout completely to ensure header is safe, list resizes, and input docks.
 */
export const KeyboardAwareChatLayout: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Mirrors the app's light/dark choice onto the chat shell (see index.css). */
  'data-chat-mode'?: 'light' | 'dark';
  }> = ({ children, className = '', style, 'data-chat-mode': chatMode }) => {
  return (
    // No bg-* utility here: it would fight the caller's .chat-shell-bg /
    // .chat-panel-bg background declaration on this same element.
    // data-chat-mode lives on THIS element (not an inner wrapper) because CSS
    // custom properties only inherit downward: the --chat-* variables must be
    // scoped on the same element that consumes them via .chat-shell-bg.
    <KeyboardSafeContainer className={`flex-1 w-full ${className}`} style={style} data-chat-mode={chatMode}>
      {children}
    </KeyboardSafeContainer>
  );
};
