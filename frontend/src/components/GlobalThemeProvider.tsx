import React, { useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import OtaService from '../services/OtaService';

export const GlobalThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const theme = useUserStore((state) => state.theme);

    useEffect(() => {
        // 1. Sync Dark/Light theme class to the document node
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            root.style.colorScheme = 'dark';
        } else {
            root.classList.remove('dark');
            root.style.colorScheme = 'light';
        }

        // 2. Set dynamic CSS variables for safe area insets to prevent double padding gaps!
        if (OtaService.isMobile()) {
            // Native mobile safe status bar padding - evaluate dynamically from browser!
            root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 24px)');
            root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 12px)');
        } else {
            // Web / Chrome preview standard boundaries
            root.style.setProperty('--safe-area-inset-top', '0px');
            root.style.setProperty('--safe-area-inset-bottom', '0px');
        }
    }, [theme]);

    return (
        <div 
            className="sparkle-global-theme-wrapper" 
            style={{ 
                width: '100%', 
                height: '100%', 
                backgroundColor: theme === 'dark' ? '#000000' : '#f0f2f5',
                // Smooth hardware-accelerated color scheme transitions like Telegram/Discord
                transition: 'background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {children}
        </div>
    );
};

export default GlobalThemeProvider;
