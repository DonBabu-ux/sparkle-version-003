import React, { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import OtaService from '../services/OtaService';

export type StatusBarStyleType = 'light' | 'dark' | 'transparent-light' | 'transparent-dark';

interface StatusBarControllerProps {
    style: StatusBarStyleType;
    backgroundColor?: string; // Optional background override (for fallback platforms)
}

export const applyStatusBarStyle = async (style: StatusBarStyleType, customBg?: string) => {
    if (!OtaService.isMobile()) return;

    try {
        // 1. Enable translucent overlay to make layout run edge-to-edge behind status bar area
        await StatusBar.setOverlaysWebView({ overlay: true });

        // 2. Set dynamic theme text & icon contrast
        if (style === 'light' || style === 'transparent-light') {
            // "light" status bar style means white/light background -> dark icons!
            await StatusBar.setStyle({ style: Style.Light });
        } else {
            // "dark" status bar style means black/dark background -> light icons!
            await StatusBar.setStyle({ style: Style.Dark });
        }

        // 3. Blend color natively
        if (style === 'light' && customBg) {
            await StatusBar.setBackgroundColor({ color: customBg });
        } else if (style === 'dark' && customBg) {
            await StatusBar.setBackgroundColor({ color: customBg });
        } else {
            // Transparent/translucent style has 0 opacity background
            await StatusBar.setBackgroundColor({ color: '#00000000' });
        }
    } catch (err) {
        console.warn('⚠️ StatusBarController: Failed to apply native style:', err);
    }
};

export const StatusBarController: React.FC<StatusBarControllerProps> = ({ style, backgroundColor }) => {
    useEffect(() => {
        applyStatusBarStyle(style, backgroundColor);
    }, [style, backgroundColor]);

    return null; // Declarative controller: does not render anything to DOM
};

export default StatusBarController;
