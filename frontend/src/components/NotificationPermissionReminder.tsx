import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff, Settings as SettingsIcon, X, Shield } from 'lucide-react';
import { PermissionService } from '../services/PermissionService';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useUserStore } from '../store/userStore';

const SESSION_DISMISS_KEY = 'sparkle_notif_reminder_session_dismissed';
const LAST_DISMISSED_AT_KEY = 'sparkle_notif_reminder_last_dismissed_at';
const COOLDOWN_HOURS = 24; // 24-hour cooldown between launch alerts if previously dismissed

export const NotificationPermissionReminder: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const waitingForReturnFromSettings = useRef(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useUserStore();

  const isWithinCooldown = useCallback(() => {
    // 1. Session level mute: do not interrupt user again during the same active browser/app session
    if (sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true') {
      return true;
    }

    // 2. Persistent 24h cooldown
    const lastDismissed = localStorage.getItem(LAST_DISMISSED_AT_KEY);
    if (lastDismissed) {
      const elapsedHours = (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60);
      if (elapsedHours < COOLDOWN_HOURS) {
        return true;
      }
    }

    return false;
  }, []);

  const evaluateNotificationState = useCallback(async (isResume = false) => {
    // Only check for logged-in users
    if (!useUserStore.getState().isAuthenticated) return;

    try {
      const status = await PermissionService.checkPermission('notifications');

      // If user enabled notifications, immediately dismiss warning
      if (status === 'granted') {
        waitingForReturnFromSettings.current = false;
        setIsOpen(false);
        return;
      }

      // If notifications are disabled/denied in system settings
      if (status === 'denied' || status === 'permanently_denied') {
        // If user was specifically in Android Settings to toggle notifications, show again
        if (waitingForReturnFromSettings.current) {
          setIsOpen(true);
          return;
        }

        // On launch / resume: respect dismissal cooldown to never annoy users
        if (!isWithinCooldown()) {
          setIsOpen(true);
        }
      }
    } catch {
      // Graceful fallback
    }
  }, [isWithinCooldown]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Check after 2 seconds on app startup so first paint is completely unimpeded
    const startupTimer = setTimeout(() => {
      evaluateNotificationState(false);
    }, 2000);

    // Check on app resume from background
    let resumeHandle: any = null;
    if (Capacitor.isNativePlatform()) {
      try {
        resumeHandle = App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            evaluateNotificationState(true);
          }
        });
      } catch {}
    }

    const handleFocus = () => {
      evaluateNotificationState(true);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(startupTimer);
      if (resumeHandle) {
        resumeHandle.then((h: any) => h?.remove?.()).catch(() => {});
      }
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, evaluateNotificationState]);

  const handleOpenSettings = async () => {
    waitingForReturnFromSettings.current = true;
    setIsVerifying(true);
    try {
      await PermissionService.openNotificationSettings();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDismiss = () => {
    waitingForReturnFromSettings.current = false;
    sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    localStorage.setItem(LAST_DISMISSED_AT_KEY, Date.now().toString());
    setIsOpen(false);
  };

  const handleGoToPermissions = () => {
    handleDismiss();
    navigate('/settings/permissions');
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans"
    >
      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200/90 dark:border-zinc-800 shadow-2xl text-center space-y-4">
        {/* Dismiss X button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* WhatsApp-Style Notification Bell Icon with Badge */}
        <div className="relative mx-auto my-2 w-16 h-16 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-pink-500/10 animate-ping opacity-40" />
          <div className="relative w-14 h-14 rounded-full bg-pink-500/10 dark:bg-pink-500/20 text-[#ff1493] dark:text-pink-400 flex items-center justify-center shadow-sm">
            <BellOff className="w-7 h-7" />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            You're missing Sparkle notifications
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed px-1">
            Notifications are currently turned off. You may miss incoming calls, new messages and important updates.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold text-xs transition-colors active:scale-95"
          >
            Not now
          </button>

          <button
            type="button"
            onClick={handleOpenSettings}
            disabled={isVerifying}
            className="w-full py-2.5 px-3 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-95 text-white font-semibold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Open settings</span>
          </button>
        </div>

        {/* Deep link to Permissions Centre */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleGoToPermissions}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-[#ff1493] dark:text-zinc-500 dark:hover:text-pink-400 transition-colors"
          >
            <Shield size={12} />
            <span>Manage all permissions</span>
          </button>
        </div>
      </div>
    </div>
  );
};
