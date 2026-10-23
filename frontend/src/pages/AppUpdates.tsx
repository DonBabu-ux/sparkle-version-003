import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Wifi,
  Signal,
  BellRing,
  Zap,
  PackageCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Shield,
  Radio,
} from 'lucide-react';
import UpdateService, {
  UpdateStatus,
  VersionInfo,
  UpdatePreferences,
} from '../services/UpdateService';
import { Capacitor } from '@capacitor/core';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

const STATUS_META: Record<UpdateStatus, { label: string; color: string; icon: React.ElementType }> = {
  idle:             { label: 'Ready',                 color: 'text-slate-500 dark:text-zinc-400',  icon: PackageCheck },
  checking:         { label: 'Checking for updates…', color: 'text-blue-500',                       icon: Loader2 },
  up_to_date:       { label: 'Up to date',            color: 'text-emerald-500',                    icon: CheckCircle2 },
  update_available: { label: 'Update available',      color: 'text-amber-500',                      icon: Download },
  waiting_for_wifi: { label: 'Waiting for Wi-Fi',     color: 'text-sky-500',                        icon: Wifi },
  downloading:      { label: 'Downloading…',          color: 'text-blue-500',                       icon: Loader2 },
  ready_to_apply:   { label: 'Ready to install',      color: 'text-emerald-500',                    icon: PackageCheck },
  applying:         { label: 'Applying update…',      color: 'text-violet-500',                     icon: Loader2 },
  failed:           { label: 'Update failed',         color: 'text-red-500',                        icon: AlertCircle },
  apk_required:     { label: 'Full upgrade required', color: 'text-orange-500',                     icon: Download },
  offline:          { label: 'No connection',         color: 'text-slate-400',                      icon: AlertCircle },
  unable_to_check:  { label: 'Unable to check',       color: 'text-red-400',                        icon: AlertCircle },
};

const isNative = Capacitor.isNativePlatform();

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        value ? 'bg-[#ff1493]' : 'bg-slate-300 dark:bg-zinc-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-2 px-1">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  description,
  right,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`flex items-center justify-between px-4 py-3.5 transition-all ${
        onClick && !disabled ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 active:scale-[0.99]' : ''
      } ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
        <div className="w-9 h-9 rounded-full bg-pink-500/10 text-[#ff1493] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{title}</p>
          {description && (
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AppUpdates() {
  const navigate = useNavigate();

  const [versionInfo, setVersionInfo] = useState<VersionInfo>(UpdateService.getVersionInfo());
  const [status, setStatus] = useState<UpdateStatus>(UpdateService.getStatus());
  const [prefs, setPrefs] = useState<UpdatePreferences>(UpdateService.getPreferencesSnapshot());
  const [checkLoading, setCheckLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Subscribe to UpdateService reactive state — fires immediately with cached values,
  // so the page renders content on the very first paint with no loading gate.
  useEffect(() => {
    const unsub = UpdateService.subscribe((info, s) => {
      setVersionInfo(info);
      setStatus(s);
    });

    // Defer initialization until after the first paint so the page opens
    // instantly regardless of network state. Any server calls run in the background.
    const timer = setTimeout(() => {
      UpdateService.initialize().catch(() => {});
    }, 100);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleCheckNow = async () => {
    if (checkLoading || status === 'checking') return;
    setCheckLoading(true);
    try {
      const result = await UpdateService.checkForUpdates(true);
      if (result.error) {
        showToast('error', result.error);
      } else if (!result.updateAvailable) {
        showToast('success', 'Sparkle is up to date!');
      }
    } catch {
      showToast('error', 'Failed to check for updates.');
    } finally {
      setCheckLoading(false);
    }
  };

  const handleDownload = async () => {
    const ok = await UpdateService.downloadUpdate(true);
    if (!ok) showToast('error', versionInfo.error || 'Download could not start.');
  };

  const handleApply = async () => {
    setApplyLoading(true);
    try {
      await UpdateService.applyUpdate();
    } catch {
      showToast('error', 'Failed to apply update.');
      setApplyLoading(false);
    }
  };

  const handlePrefChange = async (patch: Partial<UpdatePreferences>) => {
    const prev = { ...prefs };
    setPrefs(p => ({ ...p, ...patch }));
    try {
      await UpdateService.savePreferences(patch);
    } catch {
      setPrefs(prev);
      showToast('error', 'Failed to save preference.');
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const isSpinning = status === 'checking' || status === 'downloading' || status === 'applying';

  const isReadyToApply = status === 'ready_to_apply';
  const needsApk = status === 'apk_required';
  const canDownload = status === 'update_available';

  const installedLabel = isNative
    ? `v${versionInfo.installedVersion} (build ${versionInfo.installedBuild})`
    : 'Web Client';

  const bundleLabel = isNative
    ? versionInfo.activeBundleVersion === 'web'
      ? 'Built-in bundle'
      : `OTA bundle ${versionInfo.activeBundleVersion}`
    : 'Web Build';

  const networkLabel: Record<string, string> = {
    wifi: 'Wi-Fi', cellular: 'Mobile Data', other: 'Network',
    offline: 'Offline', unknown: 'Unknown',
  };

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950 pb-28 transition-colors">
      <div className="max-w-2xl mx-auto px-4 pt-4 sm:pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/settings')}
            className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:scale-105 active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">App Updates</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">OTA &amp; version management</p>
          </div>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                toast.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Hero Card */}
        <Card className="mb-6">
          <div className="p-5">
            {/* Status row */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                status === 'up_to_date' ? 'bg-emerald-500/10'
                : status === 'update_available' || status === 'waiting_for_wifi' ? 'bg-amber-500/10'
                : status === 'failed' || status === 'unable_to_check' || status === 'offline' ? 'bg-red-500/10'
                : status === 'apk_required' ? 'bg-orange-500/10'
                : 'bg-slate-100 dark:bg-zinc-800'
              }`}>
                <StatusIcon className={`w-5 h-5 ${meta.color} ${isSpinning ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${meta.color}`}>{meta.label}</p>
                {versionInfo.error && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 line-clamp-2">{versionInfo.error}</p>
                )}
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border shrink-0 ${
                versionInfo.networkType === 'wifi'
                  ? 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400'
                  : versionInfo.networkType === 'offline'
                  ? 'bg-red-500/10 border-red-500/20 text-red-500'
                  : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400'
              }`}>
                {versionInfo.networkType === 'wifi' ? <Wifi className="w-3 h-3" /> : <Signal className="w-3 h-3" />}
                {networkLabel[versionInfo.networkType] || 'Unknown'}
              </span>
            </div>

            {/* Version info grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-0.5">Installed</p>
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">{installedLabel}</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{bundleLabel}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-0.5">Latest</p>
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                  {versionInfo.latestVersion
                    ? `v${versionInfo.latestVersion}`
                    : versionInfo.latestApkVersion
                    ? `v${versionInfo.latestApkVersion}`
                    : '—'}
                </p>
                {versionInfo.downloadSize && (
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{formatBytes(versionInfo.downloadSize)}</p>
                )}
              </div>
            </div>

            {/* Last checked */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500 mb-4">
              <Clock className="w-3.5 h-3.5" />
              <span>Last checked: {formatRelativeTime(versionInfo.lastChecked)}</span>
            </div>

            {/* Download progress bar */}
            {status === 'downloading' && versionInfo.downloadProgress !== null && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-500 dark:text-zinc-400 mb-1">
                  <span>Downloading…</span>
                  <span>{versionInfo.downloadProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#ff1493] to-[#fb7185] rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${versionInfo.downloadProgress}%` }}
                    transition={{ ease: 'linear' }}
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {needsApk && (
                <button
                  onClick={() => UpdateService.openApkDownloadUrl()}
                  className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 transition-all active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  Download Latest APK
                </button>
              )}

              {isReadyToApply && isNative && (
                <button
                  onClick={handleApply}
                  disabled={applyLoading}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-50"
                >
                  {applyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {applyLoading ? 'Restarting…' : 'Install Update Now'}
                </button>
              )}

              {canDownload && isNative && (
                <button
                  onClick={handleDownload}
                  className="w-full py-3 rounded-xl bg-[#ff1493] hover:bg-pink-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-pink-500/25 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  Download Update{versionInfo.downloadSize ? ` (${formatBytes(versionInfo.downloadSize)})` : ''}
                </button>
              )}

              <button
                onClick={handleCheckNow}
                disabled={checkLoading || status === 'checking' || status === 'downloading' || status === 'applying'}
                className="w-full py-3 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checkLoading || status === 'checking' ? 'animate-spin' : ''}`} />
                {checkLoading || status === 'checking' ? 'Checking…' : 'Check for Updates'}
              </button>
            </div>
          </div>

          {/* Release notes expandable */}
          {(versionInfo.releaseNotes || versionInfo.releaseNotesUrl) && (
            <div className="border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={() => setShowReleaseNotes(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <span>Release Notes</span>
                {showReleaseNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <AnimatePresence>
                {showReleaseNotes && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3">
                      {versionInfo.releaseNotes && (
                        <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {versionInfo.releaseNotes}
                        </p>
                      )}
                      {versionInfo.releaseNotesUrl && (
                        <a
                          href={versionInfo.releaseNotesUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff1493] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View full release on GitHub
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </Card>

        {/* Update Preferences */}
        <SectionHeader title="Update Preferences" subtitle="Control how Sparkle handles automatic updates" />
        <Card className="mb-6 divide-y divide-slate-100 dark:divide-zinc-800/60">
          <Row
            icon={Zap}
            title="Automatic Updates"
            description="Allow Sparkle to check and apply updates in the background"
            right={<Toggle value={prefs.autoUpdateEnabled} onChange={v => handlePrefChange({ autoUpdateEnabled: v })} />}
          />
          <Row
            icon={RefreshCw}
            title="Auto-Check on Launch"
            description="Check for updates each time the app starts"
            disabled={!prefs.autoUpdateEnabled}
            right={<Toggle value={prefs.autoCheckEnabled} onChange={v => handlePrefChange({ autoCheckEnabled: v })} />}
          />
          <Row
            icon={Download}
            title="Auto-Download"
            description="Download approved updates automatically when available"
            disabled={!prefs.autoUpdateEnabled}
            right={<Toggle value={prefs.autoDownloadEnabled} onChange={v => handlePrefChange({ autoDownloadEnabled: v })} />}
          />
          <Row
            icon={PackageCheck}
            title="Auto-Apply"
            description="Apply and restart after download, without prompting you"
            disabled={!prefs.autoUpdateEnabled || !prefs.autoDownloadEnabled}
            right={<Toggle value={prefs.autoApplyEnabled} onChange={v => handlePrefChange({ autoApplyEnabled: v })} />}
          />
        </Card>

        {/* Network Policy */}
        <SectionHeader title="Download Network" subtitle="Choose which connections can trigger downloads" />
        <Card className="mb-6 divide-y divide-slate-100 dark:divide-zinc-800/60">
          <Row
            icon={Wifi}
            title="Wi-Fi Only"
            description="Only download over Wi-Fi — recommended to save mobile data"
            right={
              <Toggle
                value={prefs.updateWifiOnly && !prefs.updateCellular}
                onChange={(v) => {
                  if (v) handlePrefChange({ updateWifiOnly: true, updateCellular: false });
                  else handlePrefChange({ updateWifiOnly: false, updateCellular: true });
                }}
              />
            }
          />
          <Row
            icon={Signal}
            title="Also on Mobile Data"
            description="Download over cellular connections (may use your data allowance)"
            right={
              <Toggle
                value={prefs.updateCellular}
                onChange={v => handlePrefChange({ updateCellular: v, updateWifiOnly: !v })}
              />
            }
          />
        </Card>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <Card className="mb-6">
          <Row
            icon={BellRing}
            title="Update Notifications"
            description="Show a notification when a new update is available or ready"
            right={<Toggle value={prefs.notificationsEnabled} onChange={v => handlePrefChange({ notificationsEnabled: v })} />}
          />
        </Card>

        {/* Channel Selector — native only */}
        {isNative && (
          <>
            <SectionHeader title="Update Channel" subtitle="Advanced: switch your OTA release track" />
            <Card className="mb-6 divide-y divide-slate-100 dark:divide-zinc-800/60">
              {(['base', 'beta', 'canary'] as const).map(ch => (
                <div
                  key={ch}
                  onClick={() => handlePrefChange({ channel: ch })}
                  className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      ch === 'base' ? 'bg-pink-500/10 text-[#ff1493]'
                      : ch === 'beta' ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-violet-500/10 text-violet-500'
                    }`}>
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {ch === 'base' ? 'Stable' : ch === 'beta' ? 'Beta' : 'Canary (Edge)'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {ch === 'base'
                          ? 'Recommended — stable production releases'
                          : ch === 'beta'
                          ? 'Pre-release features with occasional rough edges'
                          : 'Bleeding-edge builds updated most frequently'}
                      </p>
                    </div>
                  </div>
                  {prefs.channel === ch && <CheckCircle2 className="w-4 h-4 text-[#ff1493] shrink-0" />}
                </div>
              ))}
            </Card>
          </>
        )}

        {/* Technical Details */}
        <SectionHeader title="Technical Details" />
        <Card className="mb-6">
          <div className="p-4 space-y-2.5">
            {([
              ['App ID', versionInfo.appId],
              ['Channel', versionInfo.channel],
              ['Active Bundle ID', versionInfo.activeBundleId],
              ...(versionInfo.activeBundleTimestamp
                ? [['Bundle Date', new Date(versionInfo.activeBundleTimestamp).toLocaleDateString()]]
                : []),
              ...(versionInfo.activeBundleSha256
                ? [['Bundle SHA-256', versionInfo.activeBundleSha256.slice(0, 16) + '…']]
                : []),
              ['Platform', isNative ? 'Android / Capacitor' : 'Web Browser'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <span className="text-xs text-slate-500 dark:text-zinc-400 shrink-0">{label}</span>
                <span className="text-xs font-mono font-semibold text-slate-800 dark:text-zinc-200 text-right truncate max-w-[60%]">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Security Notice */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/60 mb-6">
          <Shield className="w-4 h-4 text-slate-400 dark:text-zinc-500 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            All OTA bundles are cryptographically verified by OtaKit before installation. Tampered bundles are automatically rejected and rolled back.
          </p>
        </div>

      </div>
    </div>
  );
}
