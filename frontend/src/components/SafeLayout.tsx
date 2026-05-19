import React, { useEffect, useState } from 'react';
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
  const bgClass = theme === 'dark' ? 'bg-black text-white' : 'bg-[#f0f2f5] text-black';
  
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
 * Uses VisualViewport API to dynamically resize the container so that
 * virtual keyboard opens without pushing or obscuring the input bar.
 */
export const KeyboardSafeContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, className = '', style }) => {
  const [viewportHeight, setViewportHeight] = useState<string>('100%');

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // Set height of container strictly to the visual viewport height
      setViewportHeight(`${vv.height}px`);
      // Prevent Android Chrome from natively scrolling the page and leaving a gap
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    handleResize();

    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  return (
    <div
      className={`flex flex-col w-full overflow-hidden transition-all duration-150 ${className}`}
      style={{
        height: viewportHeight,
        maxHeight: viewportHeight,
        position: 'relative',
        ...style
      }}
    >
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

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // If the visual viewport height is significantly less than window.innerHeight, the keyboard is open.
      const open = window.innerHeight - vv.height > 80;
      setIsKeyboardOpen(open);
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
        paddingBottom: isKeyboardOpen ? '6px' : 'calc(env(safe-area-inset-bottom) + 8px)',
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
}> = ({ children, className = '', style }) => {
  return (
    <KeyboardSafeContainer className={`flex-1 w-full bg-transparent ${className}`} style={style}>
      {children}
    </KeyboardSafeContainer>
  );
};
