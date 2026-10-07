import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { logger } from '../utils/logger';

// API URL resolved from env vars at build time. Same-origin '/api' by default.
// NOTE: native (APK) builds have no same-origin backend — set VITE_API_URL to
// the absolute backend URL when building for Capacitor/OTA.
const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const APK_VERSION = '1.0.0'; // PACKAGED NATIVE APK VERSION BOUNDS
const LOCAL_STORAGE_VERSION_KEY = 'sparkle_ota_js_version';
const ACTIVE_OTA_KEY = 'sparkle_active_ota';
const STABLE_FLAG_KEY = 'sparkle_ota_last_stable';
const BLACKLIST_KEY = 'sparkle_ota_blacklist';

export interface OtaVersionMetadata {
    version: string;
    jsUrl: string;
    cssUrl: string;
    hash: string;
    mandatory: boolean;
}

export class OtaService {
    private static isWatchdogActive = false;

    /**
     * Checks if the app is currently running in a native Capacitor mobile container (iOS/Android)
     */
    public static isMobile(): boolean {
        return Capacitor.isNativePlatform();
    }

    /**
     * Bootloader injection script
     * Runs in main.tsx before React renders to intercept loading and redirect to downloaded OTA assets.
     * Returns true if a dynamically downloaded JS bundle was successfully injected.
     */
    public static async bootstrap(): Promise<boolean> {
        if (!this.isMobile()) return false;

        try {
            const { value: activeOtaRaw } = await Preferences.get({ key: ACTIVE_OTA_KEY });
            if (!activeOtaRaw) return false;

            const activeOta: OtaVersionMetadata = JSON.parse(activeOtaRaw);
            logger.log(`🚀 OTA Bootloader: Found dynamic version ${activeOta.version}. Bootstrapping...`);

            // Start watchdog timer to detect instant boots crashes (self-healing rollback)
            this.startCrashWatchdog(activeOta.version);

            // Convert native file URI to dynamic localhost source
            const dynamicJsSrc = Capacitor.convertFileSrc(activeOta.jsUrl);
            const dynamicCssSrc = Capacitor.convertFileSrc(activeOta.cssUrl);

            // 1. Inject Stylesheet Link
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = dynamicCssSrc;
            document.head.appendChild(link);

            // 2. Inject Javascript Bundle (Module script)
            const script = document.createElement('script');
            script.type = 'module';
            script.src = dynamicJsSrc;
            
            // If dynamic script fails to load, trigger fallback instantly
            script.onerror = async () => {
                logger.error('❌ OTA Bootloader: Dynamic script failed to load. Rolling back...');
                await this.performEmergencyRollback();
                window.location.reload();
            };

            document.body.appendChild(script);
            return true;
        } catch (err) {
            logger.error('❌ OTA Bootloader: Exception in bootloader bootstrap:', err);
            await this.performEmergencyRollback();
            return false;
        }
    }

    /**
     * Start background update query checking and progressive downloading
     */
    public static async checkAndDownloadUpdate(): Promise<void> {
        if (!this.isMobile()) return;

        try {
            // Retrieve current active JS version from storage
            const { value: activeVersion } = await Preferences.get({ key: LOCAL_STORAGE_VERSION_KEY });
            const currentJsVersion = activeVersion || APK_VERSION;

            // Load blacklist of crashed versions
            const { value: blacklistRaw } = await Preferences.get({ key: BLACKLIST_KEY });
            const blacklist: string[] = blacklistRaw ? JSON.parse(blacklistRaw) : [];

            // Query backend server
            const url = `${DEFAULT_BASE_URL}/ota/version?apkVersion=${APK_VERSION}&jsVersion=${currentJsVersion}`;
            const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
            
            if (!response.ok) return;
            const data = await response.json();

            if (data.updateAvailable) {
                const targetVersion = data.version;

                if (blacklist.includes(targetVersion)) {
                    logger.warn(`⚠️ OTA Service: Skipping blacklisted crashing version ${targetVersion}`);
                    return;
                }

                logger.log(`🌐 OTA Service: Newer version found: ${targetVersion}. Initiating background download...`);
                await this.downloadAssets(targetVersion, data.bundleUrl, data.hash, data.mandatory);
            } else {
                logger.log('✅ OTA Service: Frontend is up to date.');
            }
        } catch (err) {
            logger.warn('⚠️ OTA Service check failed silently (Offline/Network error):', err);
        }
    }

    /**
     * Downloads JS and CSS assets asynchronously in the background and saves them locally on disk
     */
    private static async downloadAssets(
        version: string,
        bundleBaseUrl: string,
        expectedHash: string,
        mandatory: boolean
    ): Promise<void> {
        try {
            // Assume files are served under /bundles/v[version]/index.js and /bundles/v[version]/index.css
            const jsUrl = `${bundleBaseUrl}/index.js`;
            const cssUrl = `${bundleBaseUrl}/index.css`;

            logger.log(`📥 Downloading JS chunk: ${jsUrl}`);
            const jsResponse = await fetch(jsUrl);
            if (!jsResponse.ok) throw new Error('Failed to fetch dynamic JS chunk');
            const jsBytes = await jsResponse.arrayBuffer();

            // A.4 #3: the manifest's `bundle_hash` is the only trust link
            // between these bytes and what the server declared — verify it
            // BEFORE anything is written to disk or injected. Fail closed:
            // missing/malformed/mismatched hash = refuse the install.
            // (crypto.subtle needs a secure context — https://localhost in
            // Capacitor, https in prod; otherwise the undefined access throws
            // and the catch below refuses the install too.)
            const normalizedExpected = (expectedHash || '').trim().toLowerCase();
            if (!/^[0-9a-f]{64}$/.test(normalizedExpected)) {
                throw new Error(
                    `OTA integrity: manifest bundle_hash missing or not sha256-hex (got "${expectedHash || ''}") — refusing to install v${version}. ` +
                    `bundle_hash must be the lowercase SHA-256 hex of ${jsUrl}.`
                );
            }
            const digest = await crypto.subtle.digest('SHA-256', jsBytes);
            const actualHash = Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
            if (actualHash !== normalizedExpected) {
                throw new Error(
                    `OTA integrity: SHA-256 mismatch for ${jsUrl} — expected ${normalizedExpected}, got ${actualHash} — refusing to install v${version}.`
                );
            }
            const jsContent = new TextDecoder().decode(jsBytes);
            logger.log(`✅ OTA integrity: bundle v${version} verified (sha256 ${actualHash.slice(0, 12)}…).`);

            logger.log(`📥 Downloading CSS chunk: ${cssUrl}`);
            const cssResponse = await fetch(cssUrl);
            if (!cssResponse.ok) throw new Error('Failed to fetch dynamic CSS chunk');
            const cssContent = await cssResponse.text();

            // Create target folder under Filesystem Documents/Data
            const otaFolder = `ota_${version}`;
            try {
                await Filesystem.mkdir({
                    path: otaFolder,
                    directory: Directory.Data,
                    recursive: true
                });
            } catch (e) { /* ignore if already exists */ }

            // Write files securely
            const jsPath = `${otaFolder}/index.js`;
            const cssPath = `${otaFolder}/index.css`;

            const jsWriteResult = await Filesystem.writeFile({
                path: jsPath,
                data: jsContent,
                directory: Directory.Data,
                encoding: 'utf8'
            });

            const cssWriteResult = await Filesystem.writeFile({
                path: cssPath,
                data: cssContent,
                directory: Directory.Data,
                encoding: 'utf8'
            });

            // Register dynamic paths into preferences
            const meta: OtaVersionMetadata = {
                version,
                jsUrl: jsWriteResult.uri,
                cssUrl: cssWriteResult.uri,
                hash: expectedHash,
                mandatory
            };

            await Preferences.set({ key: ACTIVE_OTA_KEY, value: JSON.stringify(meta) });
            await Preferences.set({ key: LOCAL_STORAGE_VERSION_KEY, value: version });
            await Preferences.set({ key: STABLE_FLAG_KEY, value: 'false' }); // Reset stable flag for verification

            logger.log(`🎉 OTA Service: Successfully downloaded and prepared bundle v${version} for launch.`);

            if (mandatory) {
                logger.log('🔄 OTA Service: Mandatory patch. Restarting web container.');
                window.location.reload();
            }
        } catch (err) {
            logger.error('❌ OTA Service download error:', err);
        }
    }

    /**
     * Boot watchdog timer
     * Marks the current update stable if it boots and runs for 12 seconds without throwing fatal unhandled exceptions
     */
    private static startCrashWatchdog(version: string) {
        if (this.isWatchdogActive) return;
        this.isWatchdogActive = true;

        const timer = setTimeout(async () => {
            logger.log(`✅ OTA Watchdog: Bundle v${version} has booted successfully. Marking as stable.`);
            await Preferences.set({ key: STABLE_FLAG_KEY, value: 'true' });
        }, 12000);

        // Intercept global uncaught runtime errors during initial launch window
        const oldOnError = window.onerror;
        window.onerror = async (message, source, lineno, colno, error) => {
            clearTimeout(timer);
            logger.error('🔥 OTA Watchdog detected a fatal boot crash! Initiating recovery rollback...', message);

            // Blacklist the crashing version
            const { value: blacklistRaw } = await Preferences.get({ key: BLACKLIST_KEY });
            const blacklist: string[] = blacklistRaw ? JSON.parse(blacklistRaw) : [];
            if (!blacklist.includes(version)) {
                blacklist.push(version);
                await Preferences.set({ key: BLACKLIST_KEY, value: JSON.stringify(blacklist) });
            }

            await this.performEmergencyRollback();

            // Force immediate container refresh back to compiled native assets
            window.location.reload();

            if (oldOnError) {
                return oldOnError(message, source, lineno, colno, error);
            }
            return false;
        };
    }

    /**
     * Emergency self-healing recovery rollback
     * Erases dynamic updates configuration to default back to APK native packaged files
     */
    public static async performEmergencyRollback(): Promise<void> {
        logger.warn('⚠️ OTA Service: Initiating emergency rollback procedure...');
        try {
            await Preferences.remove({ key: ACTIVE_OTA_KEY });
            await Preferences.remove({ key: LOCAL_STORAGE_VERSION_KEY });
            await Preferences.set({ key: STABLE_FLAG_KEY, value: 'true' });
            logger.log('✅ OTA Service: Rollback successfully registered. Reverted back to packaged assets.');
        } catch (err) {
            logger.error('❌ OTA Service: Rollback cleanup failed:', err);
        }
    }
}
export default OtaService;
