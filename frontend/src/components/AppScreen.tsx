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
                height: '100vh',
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
