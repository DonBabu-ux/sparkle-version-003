import React, { createContext, useContext, useState, useEffect } from 'react';
import OtaService from '../services/OtaService';
import type { OtaVersionMetadata } from '../services/OtaService';
import { Preferences } from '@capacitor/preferences';

interface OtaContextProps {
    currentVersion: string;
    isUpdateReady: boolean;
    isReloading: boolean;
    updateMetadata: OtaVersionMetadata | null;
    triggerDynamicReload: () => Promise<void>;
    rollbackToNative: () => Promise<void>;
}

const OtaContext = createContext<OtaContextProps | undefined>(undefined);

export const OTAUpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');
    const [isUpdateReady, setIsUpdateReady] = useState<boolean>(false);
    const [isReloading, setIsReloading] = useState<boolean>(false);
    const [updateMetadata, setUpdateMetadata] = useState<OtaVersionMetadata | null>(null);
    const [remountKey, setRemountKey] = useState<number>(0);

    useEffect(() => {
        const checkOtaStatus = async () => {
            if (!OtaService.isMobile()) return;

            try {
                // Fetch the active version loaded from storage
                const { value: activeVersion } = await Preferences.get({ key: 'sparkle_ota_js_version' });
                if (activeVersion) {
                    setCurrentVersion(activeVersion);
                }

                // Check if a background update has finished downloading and is queued in preferences
                const { value: queuedOtaRaw } = await Preferences.get({ key: 'sparkle_active_ota' });
                if (queuedOtaRaw) {
                    const queuedOta: OtaVersionMetadata = JSON.parse(queuedOtaRaw);
                    if (queuedOta.version !== activeVersion) {
                        setIsUpdateReady(true);
                        setUpdateMetadata(queuedOta);
                    }
                }
            } catch (err) {
                console.error('❌ OTAProvider: Error reading version state:', err);
            }
        };

        checkOtaStatus();

        // Listen for standard updates check trigger intervals
        const interval = setInterval(checkOtaStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    /**
     * Hot-swaps the current React Native / Capacitor screen tree by purging cached DOM trees,
     * resetting context keys, and initiating a smooth, flicker-free rehydration reload!
     */
    const triggerDynamicReload = async () => {
        setIsReloading(true);
        console.log('🔄 OTAProvider: Starting global screen invalidation and reload...');

        try {
            // 1. Force state persistence checkpoint
            await Preferences.set({ key: 'sparkle_last_reload_timestamp', value: String(Date.now()) });

            // 2. Short fade delay to prevent ugly white flashes/layout jumps
            await new Promise((resolve) => setTimeout(resolve, 350));

            // 3. Increment remount key to tear down and rebuild the entire React component tree
            setRemountKey((prev) => prev + 1);

            // 4. Force browser/container window location reload to guarantee
            // the new files in Capacitor filesystem are properly mounted by bootstrap()
            window.location.reload();
        } catch (err) {
            console.error('❌ OTAProvider: Reload failed:', err);
            setIsReloading(false);
        }
    };

    /**
     * Clear all dynamic updates and return back to native bundled APK assets
     */
    const rollbackToNative = async () => {
        setIsReloading(true);
        await OtaService.performEmergencyRollback();
        window.location.reload();
    };

    return (
        <OtaContext.Provider
            value={{
                currentVersion,
                isUpdateReady,
                isReloading,
                updateMetadata,
                triggerDynamicReload,
                rollbackToNative
            }}
        >
            {/* The root container key resets the React DOM virtual tree to purge all stale memory states */}
            <div key={remountKey} className="ota-provider-root-container" style={{ width: '100%', height: '100%' }}>
                {children}

                {/* Micro-Interaction Overlay: Loading reload state (Instagram/Telegram premium design style) */}
                {isReloading && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(10, 10, 12, 0.96)',
                            backdropFilter: 'blur(16px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 99999,
                            transition: 'opacity 0.3s ease'
                        }}
                    >
                        <div
                            style={{
                                width: 48,
                                height: 48,
                                border: '3px solid rgba(255, 255, 255, 0.1)',
                                borderTop: '3px solid #6366f1',
                                borderRadius: '50%',
                                animation: 'ota-spin 0.8s linear infinite'
                            }}
                        />
                        <p
                            style={{
                                color: '#ffffff',
                                marginTop: 20,
                                fontSize: '15px',
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 500,
                                letterSpacing: '0.5px'
                            }}
                        >
                            Syncing Sparkle Update...
                        </p>
                        <style>{`
                            @keyframes ota-spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                )}
            </div>
        </OtaContext.Provider>
    );
};

export const useOta = () => {
    const context = useContext(OtaContext);
    if (!context) {
        throw new Error('useOta must be used within an OTAUpdateProvider');
    }
    return context;
};
