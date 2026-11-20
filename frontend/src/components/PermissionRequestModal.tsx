import React, { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { Camera, Mic, Bell, Image, MapPin, Users, Bluetooth, AlertCircle, Settings as SettingsIcon, X } from 'lucide-react';
import { PermissionService, type SparklePermission, type SparklePermissionStatus } from '../services/PermissionService';
import { lockScroll, unlockScroll } from './AppScreen';

export interface PermissionModalDetails {
  title: string;
  message: string;
  actionText: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

export const PERMISSION_MODAL_CONFIG: Record<SparklePermission, PermissionModalDetails> = {
  camera: {
    title: 'Camera access required',
    message: 'Sparkle needs access to your camera so you can make video calls and create content.',
    actionText: 'Enable camera',
    icon: Camera,
  },
  microphone: {
    title: 'Microphone access required',
    message: 'Allow microphone access to make voice calls and communicate during video calls.',
    actionText: 'Enable microphone',
    icon: Mic,
  },
  notifications: {
    title: 'Stay connected',
    message: 'Enable notifications to receive messages, incoming-call alerts and important Sparkle updates.',
    actionText: 'Enable notifications',
    icon: Bell,
  },
  media: {
    title: 'Media access required',
    message: 'Allow Sparkle to access the media you choose to upload and share.',
    actionText: 'Enable access',
    icon: Image,
  },
  location: {
    title: 'Location access required',
    message: 'Allow Sparkle to access your location to share live location and discover campus features.',
    actionText: 'Enable location',
    icon: MapPin,
  },
  contacts: {
    title: 'Contacts access required',
    message: 'Allow Sparkle to access your contacts to help you find friends and classmates.',
    actionText: 'Enable contacts',
    icon: Users,
  },
  bluetooth: {
    title: 'Bluetooth access required',
    message: 'Allow Bluetooth access for wireless headphones and audio routing during calls.',
    actionText: 'Enable Bluetooth',
    icon: Bluetooth,
  },
};

export interface PermissionRequestModalProps {
  permissionName: SparklePermission;
  isOpen: boolean;
  onDismiss: () => void;
  onGranted?: () => void;
  onPermanentlyDenied?: () => void;
  customTitle?: string;
  customMessage?: string;
}

export const PermissionRequestModal: React.FC<PermissionRequestModalProps> = ({
  permissionName,
  isOpen,
  onDismiss,
  onGranted,
  onPermanentlyDenied,
  customTitle,
  customMessage,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [isPermanentlyDenied, setIsPermanentlyDenied] = useState(false);
  const [denialExplanation, setDenialExplanation] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const config = PERMISSION_MODAL_CONFIG[permissionName] || PERMISSION_MODAL_CONFIG.microphone;
  const IconComponent = config.icon;

  // Manage body scroll lock and escape key
  useEffect(() => {
    if (!isOpen) {
      setIsPermanentlyDenied(false);
      setDenialExplanation(null);
      setIsRequesting(false);
      return;
    }

    lockScroll();

    // Check initial state when modal opens
    PermissionService.checkPermission(permissionName).then((status) => {
      if (status === 'permanently_denied') {
        setIsPermanentlyDenied(true);
      } else if (status === 'granted') {
        onGranted?.();
        onDismiss();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRequesting) {
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unlockScroll();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, permissionName, onGranted, onDismiss, isRequesting]);

  if (!isOpen) return null;

  const handleEnable = async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    setDenialExplanation(null);

    try {
      const resultStatus = await PermissionService.requestPermission(permissionName);

      if (resultStatus === 'granted' || resultStatus === 'limited') {
        setIsRequesting(false);
        onGranted?.();
        onDismiss();
        return;
      }

      if (resultStatus === 'permanently_denied') {
        setIsPermanentlyDenied(true);
        onPermanentlyDenied?.();
      } else {
        setDenialExplanation('Permission was not granted. Sparkle requires this permission to continue.');
      }
    } catch {
      setDenialExplanation('Unable to request permission. You can enable it in device settings.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleOpenSettings = async () => {
    await PermissionService.openAppSettings();
    onDismiss();
  };

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans"
    >
      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200/90 dark:border-zinc-800 shadow-2xl text-center space-y-4">
        {/* Dismiss X button */}
        <button
          onClick={onDismiss}
          disabled={isRequesting}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Dynamic Icon */}
        <div className="relative mx-auto my-2 w-16 h-16 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-pink-500/10 animate-ping opacity-40" />
          <div className="relative w-14 h-14 rounded-full bg-pink-500/10 dark:bg-pink-500/20 text-[#ff1493] dark:text-pink-400 flex items-center justify-center shadow-sm">
            {isPermanentlyDenied ? (
              <AlertCircle className="w-7 h-7 text-rose-500" />
            ) : (
              <IconComponent className="w-7 h-7" />
            )}
          </div>
        </div>

        {/* Content based on permanent denial vs standard request */}
        {isPermanentlyDenied ? (
          <div className="space-y-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Permission disabled in device settings
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed text-left bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-2xl border border-slate-200/60 dark:border-zinc-700/60">
              Sparkle cannot request this permission again through the normal system dialog.
              <br />
              <br />
              <strong>To enable it:</strong>
              <br />
              1. Open device settings.
              <br />
              2. Select <strong>Permissions</strong>.
              <br />
              3. Allow the required access.
              <br />
              4. Return to Sparkle.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              {customTitle || config.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              {customMessage || config.message}
            </p>
            {denialExplanation && (
              <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 pt-1">
                {denialExplanation}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isRequesting}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold text-xs transition-colors active:scale-95 disabled:opacity-50"
          >
            {isPermanentlyDenied ? 'Cancel' : 'Not now'}
          </button>

          {isPermanentlyDenied ? (
            <button
              type="button"
              onClick={handleOpenSettings}
              className="w-full py-2.5 px-3 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-95 text-white font-semibold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Open settings</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnable}
              disabled={isRequesting}
              className="w-full py-2.5 px-3 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-95 text-white font-semibold text-xs transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center"
            >
              {isRequesting ? 'Checking...' : config.actionText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Smart Context Provider for App-wide Permission Requests ─────────────────

interface PermissionModalContextType {
  requestWithModal: (
    permission: SparklePermission,
    options?: {
      customTitle?: string;
      customMessage?: string;
    }
  ) => Promise<boolean>;
}

const PermissionModalContext = createContext<PermissionModalContextType>({
  requestWithModal: async () => false,
});

export const PermissionModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    permission: SparklePermission;
    customTitle?: string;
    customMessage?: string;
    resolve: (granted: boolean) => void;
  } | null>(null);

  const requestWithModal = useCallback(
    async (
      permission: SparklePermission,
      options?: { customTitle?: string; customMessage?: string }
    ): Promise<boolean> => {
      // 1. Check current status first
      const current = await PermissionService.checkPermission(permission);
      if (current === 'granted' || current === 'limited') {
        return true;
      }

      // 2. Open modal to explain requirement to user
      return new Promise<boolean>((resolve) => {
        setModalState({
          isOpen: true,
          permission,
          customTitle: options?.customTitle,
          customMessage: options?.customMessage,
          resolve,
        });
      });
    },
    []
  );

  const handleDismiss = () => {
    if (modalState) {
      modalState.resolve(false);
      setModalState(null);
    }
  };

  const handleGranted = () => {
    if (modalState) {
      modalState.resolve(true);
      setModalState(null);
    }
  };

  return (
    <PermissionModalContext.Provider value={{ requestWithModal }}>
      {children}
      {modalState && (
        <PermissionRequestModal
          isOpen={modalState.isOpen}
          permissionName={modalState.permission}
          customTitle={modalState.customTitle}
          customMessage={modalState.customMessage}
          onDismiss={handleDismiss}
          onGranted={handleGranted}
        />
      )}
    </PermissionModalContext.Provider>
  );
};

export function usePermissionModal() {
  return useContext(PermissionModalContext);
}
