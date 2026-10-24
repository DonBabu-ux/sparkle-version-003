import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { LocalNotifications } from '@capacitor/local-notifications';
import { OtaKit, BundleStatus } from '@otakit/capacitor-updater';
import api from '../api/api';
import { logger } from '../utils/logger';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up_to_date'
  | 'update_available'
  | 'waiting_for_wifi'
  | 'downloading'
  | 'ready_to_apply'
  | 'applying'
  | 'failed'
  | 'apk_required'
  | 'offline'
  | 'unable_to_check';

export type NetworkType = 'wifi' | 'cellular' | 'other' | 'offline' | 'unknown';

export interface UpdatePreferences {
  autoUpdateEnabled: boolean;
  updateWifiOnly: boolean;
  updateCellular: boolean;
  autoCheckEnabled: boolean;
  autoDownloadEnabled: boolean;
  autoApplyEnabled: boolean;
  notificationsEnabled: boolean;
  channel: string;
}

export interface VersionInfo {
  installedVersion: string;
  installedBuild: string;
  appId: string;
  activeBundleId: string;
  activeBundleVersion: string;
  activeBundleTimestamp: string | null;
  activeBundleSha256: string | null;
  latestVersion: string | null;
  latestApkVersion: string | null;
  latestApkBuild: number | null;
  apkDownloadUrl: string | null;
  channel: string;
  lastChecked: string | null;
  releaseNotes: string | null;
  releaseNotesUrl: string | null;
  downloadSize: number | null;
  downloadProgress: number | null;
  error: string | null;
  isMandatory: boolean;
  networkType: NetworkType;
}

const PREF_KEYS = {
  AUTO_UPDATE_ENABLED: 'sparkle_update_auto_enabled',
  UPDATE_WIFI_ONLY: 'sparkle_update_wifi_only',
  UPDATE_CELLULAR: 'sparkle_update_cellular',
  AUTO_CHECK: 'sparkle_update_auto_check',
  AUTO_DOWNLOAD: 'sparkle_update_auto_download',
  AUTO_APPLY: 'sparkle_update_auto_apply',
  NOTIFICATIONS: 'sparkle_update_notifications',
  LAST_CHECK: 'sparkle_update_last_check',
  CHANNEL: 'sparkle_update_channel',
} as const;

const DEFAULT_PREFERENCES: UpdatePreferences = {
  autoUpdateEnabled: true,
  updateWifiOnly: true,
  updateCellular: false,
  autoCheckEnabled: true,
  autoDownloadEnabled: true,
  autoApplyEnabled: false, // Default false: avoids interrupting user in-session
  notificationsEnabled: true,
  channel: 'base',
};

const CANONICAL_FALLBACK = {
  version: '1.0.5',
  versionCode: 6,
  appId: 'com.sparkleapp',
  otaAppId: 'eccc57fa-7ba0-47ee-951f-688f6516afd1',
  channel: 'base',
  apkUrl: 'https://github.com/DonBabu-ux/sparkle-version-003/releases/download/latest/sparkle.apk',
  releaseNotesUrl: 'https://github.com/DonBabu-ux/sparkle-version-003/releases/tag/latest',
  changelog: 'Sparkle Rolling Release — all future updates arrive automatically over the air (OtaKit).',
};

type StateListener = (versionInfo: VersionInfo, status: UpdateStatus) => void;

class UpdateServiceClass {
  private status: UpdateStatus = 'idle';
  private preferences: UpdatePreferences = { ...DEFAULT_PREFERENCES };
  private initialized = false;
  private listeners: Set<StateListener> = new Set();
  private isChecking = false;
  private isDownloading = false;

  private versionInfo: VersionInfo = {
    installedVersion: CANONICAL_FALLBACK.version,
    installedBuild: String(CANONICAL_FALLBACK.versionCode),
    appId: CANONICAL_FALLBACK.appId,
    activeBundleId: 'builtin',
    activeBundleVersion: '0.0.0',
    activeBundleTimestamp: null,
    activeBundleSha256: null,
    latestVersion: null,
    latestApkVersion: null,
    latestApkBuild: null,
    apkDownloadUrl: CANONICAL_FALLBACK.apkUrl,
    channel: CANONICAL_FALLBACK.channel,
    lastChecked: null,
    releaseNotes: null,
    releaseNotesUrl: CANONICAL_FALLBACK.releaseNotesUrl,
    downloadSize: null,
    downloadProgress: null,
    error: null,
    isMandatory: false,
    networkType: 'unknown',
  };

  constructor() {
    this.setupNetworkListener();
  }

  // ── Network Detection & Policy ──

  public getNetworkType(): NetworkType {
    if (typeof navigator === 'undefined') return 'unknown';
    if (!navigator.onLine) return 'offline';

    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      const type = conn.type;
      if (type === 'wifi' || type === 'ethernet') return 'wifi';
      if (type === 'cellular') return 'cellular';
      if (type === 'none') return 'offline';
      if (type === 'other') return 'other';

      // Fallback: examine effectiveType if type isn't explicit
      const effectiveType = conn.effectiveType;
      if (effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g' || effectiveType === '4g') {
        // If on native platform and type is unknown, check whether cellular is reported
        return 'cellular';
      }
    }

    // Default for web/desktop when online: typically broadband/wifi
    return 'wifi';
  }

  private setupNetworkListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.versionInfo.networkType = this.getNetworkType();
      this.notify();
      // If we were waiting for Wi-Fi and Wi-Fi came online, trigger download
      if (this.status === 'waiting_for_wifi' && this.versionInfo.networkType === 'wifi' && this.preferences.autoDownloadEnabled) {
        this.downloadUpdate(false);
      }
    });

    window.addEventListener('offline', () => {
      this.versionInfo.networkType = 'offline';
      if (this.status === 'checking' || this.status === 'downloading') {
        this.status = 'offline';
        this.versionInfo.error = 'Network disconnected';
      }
      this.notify();
    });

    const conn = (navigator as any).connection;
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', () => {
        this.versionInfo.networkType = this.getNetworkType();
        this.notify();
        if (this.status === 'waiting_for_wifi' && this.versionInfo.networkType === 'wifi' && this.preferences.autoDownloadEnabled) {
          this.downloadUpdate(false);
        }
      });
    }
  }

  public canDownloadPayload(isManual = false): { allowed: boolean; reason?: string; requiresWarning?: boolean } {
    const net = this.getNetworkType();

    if (net === 'offline') {
      return { allowed: false, reason: 'Device is offline' };
    }

    // Manual action override: respect user click, but show data warning on cellular
    if (isManual) {
      if (net === 'cellular') {
        return { allowed: true, requiresWarning: true, reason: 'Connected to mobile data' };
      }
      return { allowed: true };
    }

    // Automatic download checks
    if (!this.preferences.autoUpdateEnabled) {
      return { allowed: false, reason: 'Automatic updates are disabled in settings' };
    }

    if (!this.preferences.autoDownloadEnabled) {
      return { allowed: false, reason: 'Automatic download is disabled' };
    }

    // Wi-Fi only policy
    if (this.preferences.updateWifiOnly && !this.preferences.updateCellular) {
      if (net === 'wifi') return { allowed: true };
      return { allowed: false, reason: 'Waiting for Wi-Fi connection' };
    }

    // Cellular only policy
    if (!this.preferences.updateWifiOnly && this.preferences.updateCellular) {
      if (net === 'cellular') return { allowed: true };
      return { allowed: false, reason: 'Configured for cellular data only' };
    }

    // Both Wi-Fi and Cellular allowed
    if (this.preferences.updateWifiOnly && this.preferences.updateCellular) {
      return { allowed: true, requiresWarning: net === 'cellular' };
    }

    // Neither enabled (explicit restriction)
    return { allowed: false, reason: 'No network connection allowed for automatic downloads' };
  }

  // ── Initialization & Persistence ──

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    this.versionInfo.networkType = this.getNetworkType();

    // All Capacitor plugin calls (Preferences, OtaKit, CapApp) throw on web —
    // skip them entirely so the page renders without triggering the crash watchdog.
    if (!Capacitor.isNativePlatform()) {
      this.versionInfo.activeBundleId = 'web-client';
      this.versionInfo.activeBundleVersion = 'web';
      this.status = 'idle';
      this.notify();
      return;
    }

    await this.loadPreferences();
    await this.loadInstalledVersion();

    this.attachOtaKitListeners();

    // Automatic check on boot if enabled
    if (this.preferences.autoUpdateEnabled && this.preferences.autoCheckEnabled) {
      this.checkForUpdates(false).catch((err) => {
        logger.warn('[UpdateService] Initial background check silenced:', err);
      });
    }
  }

  public async loadPreferences(): Promise<UpdatePreferences> {
    // Capacitor Preferences plugin throws on web — use defaults on non-native.
    if (!Capacitor.isNativePlatform()) {
      this.preferences = { ...DEFAULT_PREFERENCES };
      return { ...this.preferences };
    }

    try {
      const [
        autoEnabled,
        wifiOnly,
        cellular,
        autoCheck,
        autoDownload,
        autoApply,
        notifications,
        lastCheck,
        channel,
      ] = await Promise.all([
        Preferences.get({ key: PREF_KEYS.AUTO_UPDATE_ENABLED }),
        Preferences.get({ key: PREF_KEYS.UPDATE_WIFI_ONLY }),
        Preferences.get({ key: PREF_KEYS.UPDATE_CELLULAR }),
        Preferences.get({ key: PREF_KEYS.AUTO_CHECK }),
        Preferences.get({ key: PREF_KEYS.AUTO_DOWNLOAD }),
        Preferences.get({ key: PREF_KEYS.AUTO_APPLY }),
        Preferences.get({ key: PREF_KEYS.NOTIFICATIONS }),
        Preferences.get({ key: PREF_KEYS.LAST_CHECK }),
        Preferences.get({ key: PREF_KEYS.CHANNEL }),
      ]);

      this.preferences = {
        autoUpdateEnabled: autoEnabled.value !== null ? autoEnabled.value === 'true' : DEFAULT_PREFERENCES.autoUpdateEnabled,
        updateWifiOnly: wifiOnly.value !== null ? wifiOnly.value === 'true' : DEFAULT_PREFERENCES.updateWifiOnly,
        updateCellular: cellular.value !== null ? cellular.value === 'true' : DEFAULT_PREFERENCES.updateCellular,
        autoCheckEnabled: autoCheck.value !== null ? autoCheck.value === 'true' : DEFAULT_PREFERENCES.autoCheckEnabled,
        autoDownloadEnabled: autoDownload.value !== null ? autoDownload.value === 'true' : DEFAULT_PREFERENCES.autoDownloadEnabled,
        autoApplyEnabled: autoApply.value !== null ? autoApply.value === 'true' : DEFAULT_PREFERENCES.autoApplyEnabled,
        notificationsEnabled: notifications.value !== null ? notifications.value === 'true' : DEFAULT_PREFERENCES.notificationsEnabled,
        channel: channel.value || DEFAULT_PREFERENCES.channel,
      };

      if (lastCheck.value) {
        this.versionInfo.lastChecked = lastCheck.value;
      }
    } catch (err) {
      logger.warn('[UpdateService] Error loading preferences, using defaults:', err);
      this.preferences = { ...DEFAULT_PREFERENCES };
    }

    return { ...this.preferences };
  }

  public async savePreferences(updates: Partial<UpdatePreferences>): Promise<UpdatePreferences> {
    const previous = { ...this.preferences };
    const next = { ...this.preferences, ...updates };

    // On web, just update in-memory state — Capacitor Preferences throws on non-native.
    if (!Capacitor.isNativePlatform()) {
      this.preferences = next;
      this.notify();
      return { ...this.preferences };
    }

    try {
      const promises: Promise<void>[] = [];

      if (updates.autoUpdateEnabled !== undefined) {
        promises.push(Preferences.set({ key: PREF_KEYS.AUTO_UPDATE_ENABLED, value: String(next.autoUpdateEnabled) }));
      }
      if (updates.updateWifiOnly !== undefined) {
        promises.push(Preferences.set({ key: PREF_KEYS.UPDATE_WIFI_ONLY, value: String(next.updateWifiOnly) }));
      }
      if (updates.updateCellular !== undefined) {
        promises.push(Preferences.set({ key: PREF_KEYS.UPDATE_CELLULAR, value: String(next.updateCellular) }));
      }
      if (updates.autoCheckEnabled !== undefined) {
        promises.push(Preferences.set({ key: PREF_KEYS.AUTO_CHECK, value: String(next.autoCheckEnabled) }));
      }
      if (updates.autoDownloadEnabled !== undefined) {
        promises.push(Preferences.set({ key: PREF_KEYS.AUTO_DOWNLOAD, value: String(next.autoDownloadEnabled) }));
      }
      if (updates.autoApplyEnabled !== undefined) {
        promises.push(Preferences.set({ key: PREF_KEYS.AUTO_APPLY, value: String(next.autoApplyEnabled) }));
      }
      if (updates.notificationsEnabled !== undefined) {
        promises.push(Preferences.set({ key: PREF_KEYS.NOTIFICATIONS, value: String(next.notificationsEnabled) }));
      }
      if (updates.channel !== undefined) {
        promises.push(Preferences.set({ key: PREF_KEYS.CHANNEL, value: next.channel }));
        OtaKit.setChannel({ channel: next.channel === 'base' ? null : next.channel }).catch((err) => {
          logger.warn('[UpdateService] OtaKit setChannel failed:', err);
        });
      }

      await Promise.all(promises);
      this.preferences = next;
      this.notify();
      return { ...this.preferences };
    } catch (err) {
      logger.error('[UpdateService] Failed to save preferences:', err);
      this.preferences = previous;
      this.notify();
      throw err;
    }
  }

  // ── Version Discovery ──

  private async loadInstalledVersion(): Promise<void> {
    try {
      // 1. Native app info via @capacitor/app
      if (Capacitor.isNativePlatform()) {
        try {
          const info = await CapApp.getInfo();
          if (info.version) this.versionInfo.installedVersion = info.version;
          if (info.build) this.versionInfo.installedBuild = info.build;
          if (info.id) this.versionInfo.appId = info.id;
        } catch (appErr) {
          logger.warn('[UpdateService] CapApp.getInfo unavailable:', appErr);
        }

        // 2. OtaKit active bundle state
        try {
          const otaState = await OtaKit.getState();
          if (otaState.current) {
            this.versionInfo.activeBundleId = otaState.current.id || 'builtin';
            this.versionInfo.activeBundleVersion = otaState.current.version || otaState.builtinVersion || '0.0.0';
            this.versionInfo.activeBundleTimestamp = otaState.current.downloadedAt || null;
            this.versionInfo.activeBundleSha256 = otaState.current.sha256 || null;
          }
          if (otaState.staged) {
            this.status = 'ready_to_apply';
            this.versionInfo.latestVersion = otaState.staged.version;
          }
        } catch (otaErr) {
          logger.warn('[UpdateService] OtaKit.getState failed:', otaErr);
        }

        try {
          const ch = await OtaKit.getChannel();
          if (ch.channel) this.versionInfo.channel = ch.channel;
        } catch { /* ignore */ }
      } else {
        this.versionInfo.activeBundleId = 'web-client';
        this.versionInfo.activeBundleVersion = 'web';
      }
    } catch (err) {
      logger.error('[UpdateService] Error loading installed version:', err);
    }
  }

  // ── Check for Updates ──

  public async checkForUpdates(isManual = false): Promise<{
    updateAvailable: boolean;
    latestVersion?: string;
    requiresApk?: boolean;
    error?: string;
  }> {
    if (this.isChecking) {
      return { updateAvailable: this.status === 'update_available' || this.status === 'ready_to_apply' };
    }

    const net = this.getNetworkType();
    if (net === 'offline') {
      this.status = 'offline';
      this.versionInfo.error = 'No internet connection';
      this.notify();
      return { updateAvailable: false, error: 'Device is offline' };
    }

    this.isChecking = true;
    this.status = 'checking';
    this.versionInfo.error = null;
    this.notify();

    try {
      let otaCheckResult: any = null;
      let otaAvailable = false;
      let latestOtaVersion: string | null = null;
      let otaSize: number | null = null;
      let isForced = false;

      // 1. Query live OtaKit manifest if running on native mobile
      if (Capacitor.isNativePlatform()) {
        try {
          otaCheckResult = await OtaKit.check();
          logger.log('[UpdateService] OtaKit.check() result:', otaCheckResult);

          if (otaCheckResult.kind === 'update_available') {
            otaAvailable = true;
            latestOtaVersion = otaCheckResult.latest?.version || null;
            otaSize = otaCheckResult.latest?.size || null;
            isForced = !!otaCheckResult.latest?.forceImmediate;
          } else if (otaCheckResult.kind === 'already_staged') {
            this.status = 'ready_to_apply';
            this.versionInfo.latestVersion = otaCheckResult.latest?.version || null;
            this.isChecking = false;
            this.notify();
            return { updateAvailable: true, latestVersion: this.versionInfo.latestVersion || undefined };
          }
        } catch (otaErr: any) {
          logger.warn('[UpdateService] OtaKit check warning:', otaErr);
        }
      }

      // 2. Query backend /api/ota/info to fetch authoritative release info & APK version
      let backendInfo: any = null;
      try {
        const res = await api.get('/ota/info', {
          params: { channel: this.preferences.channel },
          timeout: 8000,
        });
        if (res.data?.success) {
          backendInfo = res.data;
        }
      } catch (beErr) {
        logger.warn('[UpdateService] Backend /ota/info unreachable:', beErr);
      }

      // If both OtaKit and Backend failed, try direct GitHub tag query
      if (!otaCheckResult && !backendInfo) {
        try {
          const ghRes = await fetch('https://api.github.com/repos/DonBabu-ux/sparkle-version-003/releases/tags/latest', {
            headers: { 'User-Agent': 'Sparkle-App' },
          });
          if (ghRes.ok) {
            const ghData = await ghRes.json();
            backendInfo = {
              latestApkVersion: CANONICAL_FALLBACK.version,
              latestVersionCode: CANONICAL_FALLBACK.versionCode,
              apkDownloadUrl: CANONICAL_FALLBACK.apkUrl,
              releaseNotesUrl: CANONICAL_FALLBACK.releaseNotesUrl,
              changelog: ghData.body || CANONICAL_FALLBACK.changelog,
            };
          }
        } catch (ghErr) {
          logger.warn('[UpdateService] GitHub tag fallback failed:', ghErr);
        }
      }

      // If completely unable to reach any release server:
      if (!otaCheckResult && !backendInfo) {
        this.status = 'unable_to_check';
        this.versionInfo.error = 'Unable to reach update servers. Please check your connection.';
        this.isChecking = false;
        this.notify();
        return { updateAvailable: false, error: this.versionInfo.error };
      }

      // 3. Update cached release metadata
      const now = new Date().toISOString();
      this.versionInfo.lastChecked = now;
      if (Capacitor.isNativePlatform()) {
        await Preferences.set({ key: PREF_KEYS.LAST_CHECK, value: now });
      }

      if (backendInfo) {
        this.versionInfo.latestApkVersion = backendInfo.latestApkVersion || CANONICAL_FALLBACK.version;
        this.versionInfo.latestApkBuild = backendInfo.latestVersionCode || CANONICAL_FALLBACK.versionCode;
        this.versionInfo.apkDownloadUrl = backendInfo.apkDownloadUrl || CANONICAL_FALLBACK.apkUrl;
        this.versionInfo.releaseNotes = backendInfo.changelog || CANONICAL_FALLBACK.changelog;
        this.versionInfo.releaseNotesUrl = backendInfo.releaseNotesUrl || CANONICAL_FALLBACK.releaseNotesUrl;
      }

      // 4. Check if native APK upgrade is required
      const currentBuild = parseInt(this.versionInfo.installedBuild, 10) || 0;
      const latestBuild = this.versionInfo.latestApkBuild || 0;
      const requiresApk = latestBuild > currentBuild;

      if (requiresApk) {
        this.status = 'apk_required';
        this.versionInfo.latestVersion = this.versionInfo.latestApkVersion;
        this.isChecking = false;
        this.notify();

        if (this.preferences.notificationsEnabled) {
          this.sendLocalNotification(
            'Sparkle Update Required',
            `A new native version of Sparkle (v${this.versionInfo.latestApkVersion}) is available. Tap to download.`
          );
        }

        return { updateAvailable: true, latestVersion: this.versionInfo.latestApkVersion || undefined, requiresApk: true };
      }

      // 5. Check if OTA bundle update is available
      if (otaAvailable && latestOtaVersion) {
        this.versionInfo.latestVersion = latestOtaVersion;
        this.versionInfo.downloadSize = otaSize;
        this.versionInfo.isMandatory = isForced;

        // Verify network policy for automatic download
        const networkPolicy = this.canDownloadPayload(isManual);
        if (networkPolicy.allowed && this.preferences.autoDownloadEnabled) {
          this.isChecking = false;
          // Trigger download in background
          this.downloadUpdate(false);
          return { updateAvailable: true, latestVersion: latestOtaVersion };
        } else if (!networkPolicy.allowed && networkPolicy.reason === 'Waiting for Wi-Fi connection') {
          this.status = 'waiting_for_wifi';
          this.isChecking = false;
          this.notify();
          return { updateAvailable: true, latestVersion: latestOtaVersion };
        } else {
          this.status = 'update_available';
          this.isChecking = false;
          this.notify();

          if (this.preferences.notificationsEnabled && isManual === false) {
            this.sendLocalNotification(
              'Sparkle Update Available',
              `A new version (${latestOtaVersion}) is available to install.`
            );
          }

          return { updateAvailable: true, latestVersion: latestOtaVersion };
        }
      }

      // No updates available — frontend is up to date
      this.status = 'up_to_date';
      this.versionInfo.latestVersion = this.versionInfo.activeBundleVersion || this.versionInfo.installedVersion;
      this.isChecking = false;
      this.notify();
      return { updateAvailable: false };
    } catch (err: any) {
      logger.error('[UpdateService] Check exception:', err);
      this.status = 'unable_to_check';
      this.versionInfo.error = err.message || 'Check failed';
      this.isChecking = false;
      this.notify();
      return { updateAvailable: false, error: this.versionInfo.error };
    }
  }

  // ── Download Update ──

  public async downloadUpdate(isManual = false): Promise<boolean> {
    if (this.isDownloading) return false;

    // Check network policy
    const policy = this.canDownloadPayload(isManual);
    if (!policy.allowed) {
      if (policy.reason === 'Waiting for Wi-Fi connection') {
        this.status = 'waiting_for_wifi';
        this.versionInfo.error = 'Download paused: Waiting for Wi-Fi';
      } else {
        this.status = 'failed';
        this.versionInfo.error = policy.reason || 'Network policy disallowed download';
      }
      this.notify();
      return false;
    }

    if (!Capacitor.isNativePlatform()) {
      logger.log('[UpdateService] Web environment cannot download native OTA bundles.');
      return false;
    }

    this.isDownloading = true;
    this.status = 'downloading';
    this.versionInfo.error = null;
    this.versionInfo.downloadProgress = 10;
    this.notify();

    try {
      const res = await OtaKit.download();
      logger.log('[UpdateService] OtaKit.download() completed:', res);

      if (res.kind === 'staged') {
        this.status = 'ready_to_apply';
        this.versionInfo.downloadProgress = 100;
        this.versionInfo.latestVersion = res.bundle?.version || this.versionInfo.latestVersion;
        this.isDownloading = false;
        this.notify();

        if (this.preferences.notificationsEnabled) {
          this.sendLocalNotification(
            'Sparkle Update Ready',
            `Update ${this.versionInfo.latestVersion} has been downloaded and is ready to apply.`
          );
        }

        // Apply automatically only if explicit preference enabled
        if (this.preferences.autoApplyEnabled) {
          await this.applyUpdate();
        }

        return true;
      } else {
        this.status = 'up_to_date';
        this.isDownloading = false;
        this.notify();
        return false;
      }
    } catch (err: any) {
      logger.error('[UpdateService] Download failed:', err);
      this.status = 'failed';
      this.versionInfo.error = err.message || 'Download failed. Will retry automatically.';
      this.isDownloading = false;
      this.notify();
      return false;
    }
  }

  // ── Apply Update ──

  public async applyUpdate(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // OTA apply is a native-only operation; do nothing on web to avoid an
      // infinite reload loop (reload → mount → initialize → applyUpdate → reload …)
      logger.log('[UpdateService] applyUpdate() is a no-op on web.');
      this.status = 'up_to_date';
      this.notify();
      return;
    }

    this.status = 'applying';
    this.notify();

    try {
      logger.log('[UpdateService] Triggering OtaKit.apply()...');
      await OtaKit.apply();
    } catch (err: any) {
      logger.error('[UpdateService] Apply failed:', err);
      this.status = 'failed';
      this.versionInfo.error = err.message || 'Failed to apply update';
      this.notify();
    }
  }

  // ── Open APK download ──

  public openApkDownloadUrl(): void {
    const url = this.versionInfo.apkDownloadUrl || CANONICAL_FALLBACK.apkUrl;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  // ── Local Notifications ──

  private async sendLocalNotification(title: string, body: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() % 100000),
            title,
            body,
            channelId: 'system',
            smallIcon: 'ic_launcher',
          },
        ],
      });
    } catch (err) {
      logger.warn('[UpdateService] Local notification schedule silenced:', err);
    }
  }

  // ── OtaKit Native Event Listeners ──

  private attachOtaKitListeners(): void {
    try {
      OtaKit.addListener('updateAvailable', (latest) => {
        logger.log('[UpdateService] Event: updateAvailable', latest);
        this.versionInfo.latestVersion = latest.version;
        this.versionInfo.downloadSize = latest.size;
        this.status = 'update_available';
        this.notify();
      });

      OtaKit.addListener('updateStaged', (evt) => {
        logger.log('[UpdateService] Event: updateStaged', evt);
        this.versionInfo.latestVersion = evt.bundle.version;
        this.status = 'ready_to_apply';
        this.notify();
      });

      OtaKit.addListener('downloadFailed', (evt) => {
        logger.warn('[UpdateService] Event: downloadFailed', evt);
        this.status = 'failed';
        this.versionInfo.error = `Download failed: ${evt.reason}`;
        this.notify();
      });

      OtaKit.addListener('rollback', (evt) => {
        logger.error('[UpdateService] Event: rollback detected', evt);
        this.status = 'failed';
        this.versionInfo.error = `Rolled back from ${evt.version} due to ${evt.reason}`;
        this.loadInstalledVersion();
        this.notify();
      });
    } catch (err) {
      logger.warn('[UpdateService] Could not attach OtaKit event listeners:', err);
    }
  }

  // ── Subscription Pattern ──

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getVersionInfo(), this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const info = this.getVersionInfo();
    const currentStatus = this.status;
    this.listeners.forEach((listener) => {
      try {
        listener(info, currentStatus);
      } catch (e) {
        logger.error('[UpdateService] Listener error:', e);
      }
    });
  }

  public getVersionInfo(): VersionInfo {
    return { ...this.versionInfo };
  }

  public getStatus(): UpdateStatus {
    return this.status;
  }

  public getPreferencesSnapshot(): UpdatePreferences {
    return { ...this.preferences };
  }
}

export const UpdateService = new UpdateServiceClass();
export default UpdateService;
