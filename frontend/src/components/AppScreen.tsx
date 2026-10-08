import React from 'react';
import { useUserStore } from '../store/userStore';
import { StatusBarController } from './StatusBarController';
import type { StatusBarStyleType } from './StatusBarController';

interface AppScreenProps {
    children: React.ReactNode;
    statusBarStyle?: StatusBarStyleType;
    statusBarBg?: string;
    className?: string;
    style?: React.CSSProperties;
    /**
     * If true, safe area padding-top is bypassed to let immersive backgrounds (like feeds, streams, cameras) 
     * extend to the absolute top edge of the physical screen display!
     */
    immersive?: boolean;
    /**
     * If false, overflow-y is set to hidden on the wrapper to prevent native viewport panning
     * when the virtual keyboard is triggered.
     */
    scrollable?: boolean;
}

/** The element that actually scrolls inside an AppScreen (S9). */
function getContentScroller(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.sparkle-screen-content-wrapper');
}

/**
 * Scroll the real scroller to `top`. AppScreen owns the scroll container, so
 * `window.scrollTo()` is a no-op on every screen that renders one (S9).
 */
export function scrollTopTo(top = 0, behavior: ScrollBehavior = 'smooth'): void {
    const el = getContentScroller();
    if (el) el.scrollTo({ top, behavior });
    else window.scrollTo({ top, behavior });
}

/**
 * Ref-counted body+scroller scroll lock (S9). `document.body.style.overflow`
 * alone is a no-op when AppScreen's inner wrapper is the scroller, so modal
 * locks must target BOTH. Nested modals share one lock.
 */
let scrollLockCount = 0;
let prevBodyOverflow = '';
let prevScrollerOverflow = '';

export function lockScroll(): void {
    scrollLockCount += 1;
    if (scrollLockCount > 1) return;
    prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = getContentScroller();
    if (el) {
        prevScrollerOverflow = el.style.overflow;
        el.style.overflow = 'hidden';
    }
}

export function unlockScroll(): void {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount > 0) return;
    document.body.style.overflow = prevBodyOverflow;
    const el = getContentScroller();
    if (el) el.style.overflow = prevScrollerOverflow;
}

export const AppScreen: React.FC<AppScreenProps> = ({
    children,
    statusBarStyle,
    statusBarBg,
    className = '',
    style,
    immersive = false,
    scrollable = true
}) => {
    const theme = useUserStore((state) => state.theme);

    // 1. Resolve status bar style: Explicit override > Theme auto-switch
    const resolvedStyle: StatusBarStyleType = statusBarStyle || 
        (theme === 'dark' ? 'transparent-dark' : 'transparent-light');

    // 2. Resolve background color class based on theme
    const bgClass = theme === 'dark' ? 'bg-black text-white' : 'bg-[#f0f2f5] text-black';

    return (
        <div
            className={`sparkle-app-screen-container ${bgClass} ${className}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100dvh',
                position: 'relative',
                overflow: 'hidden',
                // Avoid visual shifting by setting up edge-to-edge containers
                boxSizing: 'border-box',
                paddingTop: 0,
                ...style
            }}
        >
            {/* Dynamic Native Status Bar controller */}
            <StatusBarController style={resolvedStyle} backgroundColor={statusBarBg} />

            {/* Layout Wrapper */}
            <div
                className="sparkle-screen-content-wrapper"
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflowY: scrollable ? 'auto' : 'hidden',
                    overflowX: 'hidden',
                    paddingTop: immersive ? 0 : 'var(--safe-area-inset-top, 0px)'
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default AppScreen;
