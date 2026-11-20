import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Mic,
  Bell,
  Image,
  MapPin,
  Users,
  Bluetooth,
  ShieldCheck,
  Settings as SettingsIcon,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import {
  PermissionService,
  useAllPermissions,
  type SparklePermission,
  type SparklePermissionStatus,
  PERMISSION_DEFINITIONS,
} from '../services/PermissionService';
import { PermissionRequestModal } from '../components/PermissionRequestModal';

const PERMISSION_ICONS: Record<SparklePermission, React.ComponentType<{ className?: string; size?: number }>> = {
  camera: Camera,
  microphone: Mic,
  notifications: Bell,
  media: Image,
  location: MapPin,
  contacts: Users,
  bluetooth: Bluetooth,
};

function getStatusBadge(status: SparklePermissionStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'granted':
      return {
        label: 'Enabled',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      };
    case 'limited':
      return {
        label: 'Limited access',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      };
    case 'permanently_denied':
      return {
        label: 'Permanently denied',
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      };
    case 'denied':
    case 'prompt':
      return {
        label: 'Not enabled',
        badgeClass: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
      };
    case 'unavailable':
      return {
        label: 'Not available on this device',
        badgeClass: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20',
      };
    case 'checking':
    default:
      return {
        label: 'Checking…',
        badgeClass: 'bg-slate-100 dark:bg-zinc-800 text-slate-400 animate-pulse border-slate-200 dark:border-zinc-700',
      };
  }
}

export default function PermissionsPage() {
  const navigate = useNavigate();
  const { permissions, loading, refresh } = useAllPermissions();
  const [selectedPermission, setSelectedPermission] = useState<SparklePermission | null>(null);
  const isNative = PermissionService.isNativeAndroid();

  // Refresh permissions on initial mount and when returning to view
  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAction = (permKey: SparklePermission, status: SparklePermissionStatus) => {
    if (status === 'permanently_denied') {
      PermissionService.openAppSettings();
      return;
    }
    setSelectedPermission(permKey);
  };

  const permissionKeys: SparklePermission[] = [
    'camera',
    'microphone',
    'notifications',
    'media',
    'location',
    'contacts',
    'bluetooth',
  ];

  return (
    <div className="min-h-dvh bg-[#fdf2f4] dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pb-[calc(env(safe-area-inset-bottom)+6rem)] transition-colors">
      <main className="max-w-2xl mx-auto px-4 pt-[calc(var(--safe-area-inset-top)+1rem)] sm:pt-[calc(var(--safe-area-inset-top)+1.5rem)]">
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="w-11 h-11 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:scale-105 active:scale-95 transition-all shadow-sm"
              aria-label="Back to Settings"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                Permissions
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-300">
                Manage the permissions Sparkle uses on your device
              </p>
            </div>
          </div>

          <button
            onClick={() => refresh()}
            disabled={loading}
            className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:scale-105 active:scale-95 transition-all shadow-sm disabled:opacity-50"
            title="Refresh Permissions"
            aria-label="Refresh Permissions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Informational Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 shadow-sm flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-pink-500/10 dark:bg-pink-500/15 text-[#ff1493] flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Privacy &amp; Device Control
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-300 mt-0.5 leading-relaxed">
              Sparkle only requests permissions when you actively use associated features like calling, media sharing, or notifications. You can change these permissions at any time.
            </p>
          </div>
        </div>

        {/* Permissions List Group */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-300 px-1 mb-2.5">
            Device Permissions
          </h2>

          <div className="bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl shadow-sm divide-y divide-slate-100 dark:divide-zinc-800/60 overflow-hidden">
            {permissionKeys.map((key) => {
              const def = PERMISSION_DEFINITIONS[key];
              const Icon = PERMISSION_ICONS[key] || ShieldCheck;
              const status = permissions[key] || 'checking';
              const { label, badgeClass } = getStatusBadge(status);
              const isEnabled = status === 'granted';
              const isPermDenied = status === 'permanently_denied';
              const isUnavailable = status === 'unavailable';

              return (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 transition-colors hover:bg-slate-50/60 dark:hover:bg-zinc-800/40"
                >
                  {/* Left: Icon & Details */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-pink-500/10 dark:bg-pink-500/15 text-[#ff1493] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
                          {def.name}
                        </h4>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}
                        >
                          {label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-300 mt-0.5 leading-snug">
                        {def.purpose}
                      </p>
                    </div>
                  </div>

                  {/* Right: Action */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-1 sm:pt-0">
                    {isEnabled ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-2 py-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Allowed</span>
                      </span>
                    ) : isPermDenied ? (
                      <button
                        type="button"
                        onClick={() => handleAction(key, status)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
                      >
                        <SettingsIcon className="w-3.5 h-3.5" />
                        <span>Settings</span>
                      </button>
                    ) : isUnavailable ? (
                      <span className="text-xs text-slate-400 dark:text-zinc-500 px-2 py-1">
                        Not supported
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAction(key, status)}
                        className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-95 text-white transition-all shadow-xs"
                      >
                        Enable
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Device Settings Deep Link Button */}
        {isNative && (
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-300">
                <SettingsIcon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Android Device Settings
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-300">
                  Open application details in your system settings
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => PermissionService.openAppSettings()}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 transition-all flex items-center gap-1 active:scale-95"
            >
              <span>Open</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </main>

      {/* Reusable Permission Request Modal */}
      {selectedPermission && (
        <PermissionRequestModal
          isOpen={true}
          permissionName={selectedPermission}
          onDismiss={() => setSelectedPermission(null)}
          onGranted={() => {
            setSelectedPermission(null);
            refresh();
          }}
          onPermanentlyDenied={() => {
            refresh();
          }}
        />
      )}
    </div>
  );
}
