import { showError, showSuccess } from '../utils/toast';
import { scrollTopTo } from '../components/AppScreen';
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bell, Volume2, Shield, Lock, UserX, MessageCircle, ChevronRight, ChevronLeft, RotateCcw, Play, Smartphone, Eye, EyeOff, Trash2, Palette, Wifi, Check, HelpCircle, Info, Archive, LogOut, AlertTriangle, Activity, Copy, Share2, Camera, Monitor, Vibrate, BellOff } from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { useThemeStore, PRESET_THEMES } from '../store/themeStore';
import type { SparkleTheme } from '../store/themeStore';
import AudioSessionManager from '../audio/managers/AudioSessionManager';
import type { SoundTheme } from '../audio/settings/ThemeController';
import type { SoundKey } from '../audio/managers/SoundManager';
import { getAvatarUrl } from '../utils/imageUtils';
import { sanitizePartnerName } from '../utils/nameSanitizer';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const AVAILABLE_NOTIFICATION_SOUNDS = [
  { key: 'default', label: 'Device Default / System Sound', soundKey: 'outchat' as SoundKey },
  { key: 'iphone', label: 'iPhone Classic Style', soundKey: 'iphone' as SoundKey },
  { key: 'facebook_notification', label: 'Facebook Style Notification', soundKey: 'facebook_notification' as SoundKey },
  { key: 'inchat_receive', label: 'In-Chat Message Receive', soundKey: 'inchat_receive' as SoundKey },
  { key: 'outchat_notification', label: 'Out-Chat Bubble Ping', soundKey: 'outchat_notification' as SoundKey },
] as const;

const SOUND_THEMES: { key: SoundTheme; label: string; desc: string }[] = [
  { key: 'Sparkle Original', label: 'Sparkle Original', desc: 'Default Sparkle sound pack' },
  { key: 'Classic', label: 'Classic', desc: 'Timeless notification tones' },
  { key: 'Soft', label: 'Soft (Lowpass DSP)', desc: 'Gentle, muted audio profile' },
  { key: 'Minimal', label: 'Minimal (Pitch Up DSP)', desc: 'Short, crisp pitch-shifted tones' },
];

const MOCK_DEVICE_SESSIONS = [
  {
    id: 'session-001',
    device: 'Chrome on Windows',
    isCurrent: true,
    ip: '192.168.x.x',
    location: 'Nairobi, Kenya',
    time: 'Active now',
    suspicious: false,
    macAddress: null,
  },
  {
    id: 'session-002',
    device: 'Android Device',
    isCurrent: false,
    ip: '41.80.x.x',
    location: 'Nairobi, Kenya',
    time: '2 hours ago',
    suspicious: false,
    macAddress: null,
  },
];

type SectionView =
  | 'home'
  | 'active-status'
  | 'active-status-learn-more'
  | 'notifications'
  | 'behavior-security'
  | 'message-privacy'
  | 'media-storage'
  | 'chat-themes'
  | 'chat-lock'
  | 'archived-chats'
  | 'blocked-contacts'
  | 'device-logins';

// ─────────────────────────────────────────────────────────────────────────────
// TOUCH-SAFE SWITCH
// ─────────────────────────────────────────────────────────────────────────────

interface TouchSafeSwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

const TouchSafeSwitch: React.FC<TouchSafeSwitchProps> = ({
  id,
  checked,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
}) => {
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current || disabled) return;
    const touch = e.changedTouches[0];
    if (touch) {
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 8 || dy > 8) {
        touchStartPos.current = null;
        return;
      }
    }
    touchStartPos.current = null;
    e.preventDefault();
    e.stopPropagation();
    onChange(!checked);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) onChange(!checked);
  };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      className={`relative inline-flex h-[28px] w-[50px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff1493] focus-visible:ring-offset-2 focus-visible:ring-offset-white select-none ${
        checked ? 'bg-[#ff1493]' : 'bg-gray-200'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-[23px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS ROW
// ─────────────────────────────────────────────────────────────────────────────

interface SettingsRowProps {
  icon: ReactNode;
  iconBg?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  onClick?: () => void;
  rightElement?: ReactNode;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  iconBg = 'bg-gray-100',
  title,
  subtitle,
  badge,
  badgeColor = 'bg-blue-100 text-blue-700',
  onClick,
  rightElement,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left ${
      onClick ? 'cursor-pointer' : 'cursor-default'
    }`}
  >
    <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900 leading-tight">{title}</span>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed truncate">{subtitle}</p>}
    </div>
    {rightElement || (onClick && <ChevronRight size={16} className="text-gray-300 shrink-0" />)}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// SIDE SHEET
// ─────────────────────────────────────────────────────────────────────────────

interface SideSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const SideSheet: React.FC<SideSheetProps> = ({ open, onClose, title, children }) => (
  <div
    className={`fixed inset-0 z-(--z-modal) flex justify-end transition-all duration-300 ${
      open ? 'pointer-events-auto' : 'pointer-events-none'
    }`}
  >
    <div
      className={`absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
        open ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    />
    <div
      className={`relative z-10 w-full max-w-sm bg-white h-full flex flex-col shadow-2xl transform transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          aria-label="Close panel"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SUB PAGE WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

interface SubPageProps {
  title: string;
  onBack: () => void;
  children: ReactNode;
}

const SubPage: React.FC<SubPageProps> = ({ title, onBack, children }) => (
  <div className="flex flex-col min-h-full">
    <div className="sticky top-0 bg-white border-b border-gray-100 z-10 shadow-xs">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900 tracking-tight">{title}</h1>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto">{children}</div>
  </div>
);

const SectionHeader: React.FC<{ title: string; description?: string }> = ({ title, description }) => (
  <div className="px-4 pt-6 pb-2">
    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</h3>
    {description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>}
  </div>
);

const Divider = () => <div className="h-px bg-gray-100 mx-4" />;

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  confirmDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmDanger = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <div className="text-sm text-gray-500 mt-2 leading-relaxed">{message}</div>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${
              confirmDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-[#ff1493] hover:bg-[#e0127f]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MESSAGES SETTINGS COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function MessagesSettings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialChatId = searchParams.get('chat');
  const { user, setUser } = useUserStore();

  const [view, setView] = useState<SectionView>('home');
  const [learnMorePage, setLearnMorePage] = useState(0);

  // Conversations
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string>(initialChatId || '');
  const [chatMuteState, setChatMuteState] = useState<boolean>(false);
  const [chatSoundState, setChatSoundState] = useState<string>('default');

  // Global settings from user store
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.push_notifications !== 0);
  const [messagePrivacy, setMessagePrivacy] = useState(user?.message_privacy || 'followers');
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState(user?.last_seen_privacy || 'everyone');
  const [activeStatusEnabled, setActiveStatusEnabled] = useState(
    (user?.last_seen_privacy || 'everyone') !== 'no_one'
  );

  // Advanced server settings
  const [defaultReadReceipts, setDefaultReadReceipts] = useState(true);
  const [defaultTypingIndicator, setDefaultTypingIndicator] = useState(true);
  const [defaultAllowForwarding, setDefaultAllowForwarding] = useState(true);
  const [defaultAllowCopyText, setDefaultAllowCopyText] = useState(true);
  const [defaultScreenshotNotification, setDefaultScreenshotNotification] = useState(true);
  const [blurScreenRecording, setBlurScreenRecording] = useState(true);

  // Media & Storage
  const [autoDownloadMedia, setAutoDownloadMedia] = useState('wifi');
  const [linkPreviewsEnabled, setLinkPreviewsEnabled] = useState(true);
  const [mediaQuality, setMediaQuality] = useState('standard');

  // Audio Engine
  const [audioTheme, setAudioTheme] = useState<SoundTheme>(
    () => AudioSessionManager.themeController.getCurrentTheme()
  );
  const [audioVolumes, setAudioVolumes] = useState(
    () => AudioSessionManager.volumeController.getAll()
  );
  const [audioToggles, setAudioToggles] = useState<Record<string, boolean>>(
    () => (AudioSessionManager.getSettings() as Record<string, boolean>) || {}
  );
  const [globalNotificationSound, setGlobalNotificationSound] = useState<string>(() => {
    try {
      return localStorage.getItem('sparkle_default_notification_sound') || 'default';
    } catch {
      return 'default';
    }
  });

  // Chat Lock (Local per-device only)
  const [lockedChats, setLockedChats] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('sparkle_locked_chats');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [hiddenLockedChats, setHiddenLockedChats] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sparkle_hidden_locked_chats') === 'true';
    } catch {
      return false;
    }
  });
  const [pinSet, setPinSet] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('sparkle_chat_lock_pin_hash');
    } catch {
      return false;
    }
  });
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPinValue, setNewPinValue] = useState('');
  const [pinError, setPinError] = useState('');

  // Archived chats
  const [archivedChats, setArchivedChats] = useState<any[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  // Blocked contacts
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Device logins
  const [deviceSessions] = useState(MOCK_DEVICE_SESSIONS);
  const hasSuspiciousSession = deviceSessions.some(s => s.suspicious);

  // Side sheets
  const [soundThemeSheet, setSoundThemeSheet] = useState(false);
  const [notifSoundSheet, setNotifSoundSheet] = useState(false);
  const [chatSoundSheet, setChatSoundSheet] = useState(false);
  const [chatSelectSheet, setChatSelectSheet] = useState(false);
  const [mediaDownloadSheet, setMediaDownloadSheet] = useState(false);
  const [mediaQualitySheet, setMediaQualitySheet] = useState(false);
  const [whoCanMessageSheet, setWhoCanMessageSheet] = useState(false);
  const [chatThemeGlobalSheet, setChatThemeGlobalSheet] = useState(false);

  // Confirm modals
  const [resetAudioModal, setResetAudioModal] = useState(false);
  const [clearHistoryModal, setClearHistoryModal] = useState(false);
  const [unblockUserId, setUnblockUserId] = useState<string | null>(null);
  const [unarchiveChatId, setUnarchiveChatId] = useState<string | null>(null);

  // Toast

  // Global Chat Theme
  const [globalChatThemeId, setGlobalChatThemeId] = useState<string>(
    user?.chat_theme || 'whatsapp_v5'
  );

  const updateSetting = useCallback(
    async (key: string, value: string | number | boolean) => {
      try {
        await api.put('/users/settings', { [key]: value });
        if (user) setUser({ ...user, [key]: value });
        showSuccess('Saved');
      } catch {
        showError("Couldn't save. Try again.");
      }
    },
    [user, setUser, showToast]
  );

  const updateAdvancedSetting = useCallback(
    async (key: string, value: boolean) => {
      try {
        await api.put('/users/advanced-settings', { [key]: value ? 1 : 0 });
        showSuccess('Saved');
      } catch {
        showError("Couldn't save. Try again.");
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (user) {
      setNotificationsEnabled(user.push_notifications !== 0);
      setMessagePrivacy(user.message_privacy || 'followers');
      const lsp = user.last_seen_privacy || 'everyone';
      setLastSeenPrivacy(lsp);
      setActiveStatusEnabled(lsp !== 'no_one');
      setGlobalChatThemeId(user.chat_theme || 'whatsapp_v5');
      if (user.auto_download_media) setAutoDownloadMedia(user.auto_download_media);
      if (user.link_previews_enabled !== undefined)
        setLinkPreviewsEnabled(user.link_previews_enabled !== 0);
      if (user.media_quality) setMediaQuality(user.media_quality);
    }
  }, [user]);

  useEffect(() => {
    api
      .get('/users/advanced-settings')
      .then(res => {
        if (res.data?.success && res.data.settings) {
          const s = res.data.settings;
          if (s.default_read_receipts !== undefined)
            setDefaultReadReceipts(!!s.default_read_receipts);
          if (s.default_typing_indicator !== undefined)
            setDefaultTypingIndicator(!!s.default_typing_indicator);
          if (s.default_allow_forwarding !== undefined)
            setDefaultAllowForwarding(!!s.default_allow_forwarding);
          if (s.default_allow_copy_text !== undefined)
            setDefaultAllowCopyText(!!s.default_allow_copy_text);
          if (s.default_screenshot_notification !== undefined)
            setDefaultScreenshotNotification(!!s.default_screenshot_notification);
          if (s.blur_screen_recording !== undefined)
            setBlurScreenRecording(!!s.blur_screen_recording);
          if (s.auto_download_media) setAutoDownloadMedia(s.auto_download_media);
          if (s.link_previews_enabled !== undefined)
            setLinkPreviewsEnabled(s.link_previews_enabled !== 0);
          if (s.media_quality) setMediaQuality(s.media_quality);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingConversations(true);
    api
      .get('/messages/inbox')
      .then(res => {
        const chats = res.data?.conversations || res.data || [];
        if (Array.isArray(chats)) {
          setConversations(chats);
          if (initialChatId) {
            const found = chats.find((c: any) => c.chat_id === initialChatId);
            if (found) {
              setChatMuteState(!!found.is_muted);
              setChatSoundState(useThemeStore.getState().getNotificationSound(initialChatId));
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConversations(false));
  }, [initialChatId]);

  const fetchArchivedChats = useCallback(() => {
    setLoadingArchived(true);
    api
      .get('/messages/archived')
      .then(res => {
        const chats = res.data?.conversations || res.data || [];
        setArchivedChats(Array.isArray(chats) ? chats : []);
      })
      .catch(() => setArchivedChats([]))
      .finally(() => setLoadingArchived(false));
  }, []);

  const fetchBlockedUsers = useCallback(() => {
    setLoadingBlocked(true);
    api
      .get('/users/blocks')
      .then(res => setBlockedUsers(res.data || []))
      .catch(() => setBlockedUsers([]))
      .finally(() => setLoadingBlocked(false));
  }, []);

  const goTo = useCallback(
    (v: SectionView) => {
      if (v === 'archived-chats') fetchArchivedChats();
      if (v === 'blocked-contacts') fetchBlockedUsers();
      setView(v);
      scrollTopTo(0, 'smooth');
    },
    [fetchArchivedChats, fetchBlockedUsers]
  );

  const goBack = useCallback(() => {
    if (learnMorePage > 0) {
      setLearnMorePage(0);
      return;
    }
    setView('home');
    scrollTopTo(0, 'smooth');
  }, [learnMorePage]);

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    if (!chatId) {
      setChatMuteState(false);
      setChatSoundState('default');
      return;
    }
    const found = conversations.find((c: any) => c.chat_id === chatId);
    if (found) {
      setChatMuteState(!!found.is_muted);
      setChatSoundState(useThemeStore.getState().getNotificationSound(chatId) || 'default');
    }
    setChatSelectSheet(false);
  };

  const handleToggleChatMute = async (targetChatId: string, newVal: boolean) => {
    setChatMuteState(newVal);
    setConversations(prev =>
      prev.map(c => (c.chat_id === targetChatId ? { ...c, is_muted: newVal } : c))
    );
    try {
      await api.post(`/messages/chat/${targetChatId}/mute`, { muted: newVal });
      const chat = conversations.find(c => c.chat_id === targetChatId);
      const name = chat ? sanitizePartnerName(chat.partner_name, chat.partner_username) : 'Chat';
      showSuccess(newVal ? `Muted ${name}` : `Unmuted ${name}`);
    } catch {
      setChatMuteState(!newVal);
      setConversations(prev =>
        prev.map(c => (c.chat_id === targetChatId ? { ...c, is_muted: !newVal } : c))
      );
      showError('Failed to update');
    }
  };

  const handleSetChatSound = (soundKey: string) => {
    if (!selectedChatId) return;
    setChatSoundState(soundKey);
    useThemeStore.getState().setNotificationSound(selectedChatId, soundKey);
    const tone =
      AVAILABLE_NOTIFICATION_SOUNDS.find(s => s.key === soundKey)?.soundKey || 'outchat';
    AudioSessionManager.playSound(tone);
    setChatSoundSheet(false);
    showSuccess('Chat tone updated');
  };

  const handleThemeChange = async (theme: SoundTheme) => {
    setAudioTheme(theme);
    await AudioSessionManager.setTheme(theme);
    setAudioToggles(AudioSessionManager.getSettings() as Record<string, boolean>);
    AudioSessionManager.playSound('send');
    setSoundThemeSheet(false);
    showSuccess(`Theme: ${theme}`);
  };

  const handleGlobalNotificationSoundChange = (soundKey: string) => {
    setGlobalNotificationSound(soundKey);
    try {
      localStorage.setItem('sparkle_default_notification_sound', soundKey);
    } catch {}
    const tone =
      AVAILABLE_NOTIFICATION_SOUNDS.find(s => s.key === soundKey)?.soundKey || 'outchat';
    AudioSessionManager.playSound(tone);
    setNotifSoundSheet(false);
    showSuccess('Default tone updated');
  };

  const handleVolumeChange = (
    category: 'master' | 'messages' | 'notifications' | 'ui',
    value: number
  ) => {
    AudioSessionManager.setVolume(category, value);
    setAudioVolumes(AudioSessionManager.volumeController.getAll());
  };

  const handleAudioToggle = (key: string, val: boolean) => {
    AudioSessionManager.updateSettings({ [key]: val });
    setAudioToggles(AudioSessionManager.getSettings() as Record<string, boolean>);
    showSuccess(val ? 'Enabled' : 'Disabled');
  };

  const handleResetAudio = () => {
    AudioSessionManager.resetSettings();
    setAudioTheme(AudioSessionManager.themeController.getCurrentTheme());
    setAudioVolumes(AudioSessionManager.volumeController.getAll());
    setAudioToggles(AudioSessionManager.getSettings() as Record<string, boolean>);
    setGlobalNotificationSound('default');
    try {
      localStorage.setItem('sparkle_default_notification_sound', 'default');
    } catch {}
    setResetAudioModal(false);
    AudioSessionManager.playSound('send');
    showSuccess('Audio settings restored');
  };

  const handleTestPreview = (type: 'send' | 'receive' | 'notification') => {
    if (type === 'send') {
      AudioSessionManager.playSound('send');
    } else if (type === 'receive') {
      AudioSessionManager.playSound('receive');
    } else {
      const active =
        selectedChatId && chatSoundState !== 'default'
          ? chatSoundState
          : globalNotificationSound !== 'default'
          ? globalNotificationSound
          : 'default';
      const sk = AVAILABLE_NOTIFICATION_SOUNDS.find(s => s.key === active)?.soundKey || 'outchat';
      AudioSessionManager.playSound(sk);
    }
  };

  const handleActiveStatusToggle = async (val: boolean) => {
    setActiveStatusEnabled(val);
    const newPrivacy = val ? 'everyone' : 'no_one';
    setLastSeenPrivacy(newPrivacy);
    await updateSetting('last_seen_privacy', newPrivacy);
  };

  const toggleLockChat = (chatId: string) => {
    setLockedChats(prev => {
      const next = prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId];
      try {
        localStorage.setItem('sparkle_locked_chats', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const toggleHiddenLockedChats = (val: boolean) => {
    setHiddenLockedChats(val);
    try {
      localStorage.setItem('sparkle_hidden_locked_chats', val ? 'true' : 'false');
    } catch {}
  };

  const savePin = () => {
    if (!/^\d{4}$/.test(newPinValue)) {
      setPinError('Please enter exactly 4 digits');
      return;
    }
    try {
      const hash = btoa(`sparkle_pin:${newPinValue}`);
      localStorage.setItem('sparkle_chat_lock_pin_hash', hash);
      setPinSet(true);
      setShowPinSetup(false);
      setNewPinValue('');
      setPinError('');
      showSuccess('PIN saved locally');
    } catch {
      setPinError('Could not save PIN');
    }
  };

  const clearPin = () => {
    try {
      localStorage.removeItem('sparkle_chat_lock_pin_hash');
      localStorage.removeItem('sparkle_locked_chats');
      localStorage.removeItem('sparkle_hidden_locked_chats');
      setPinSet(false);
      setLockedChats([]);
      setHiddenLockedChats(false);
      showSuccess('Chat lock removed');
    } catch {}
  };

  const handleUnarchive = async (chatId: string) => {
    try {
      await api.post(`/messages/chat/${chatId}/unarchive`);
      setArchivedChats(prev => prev.filter(c => c.chat_id !== chatId));
      showSuccess('Chat unarchived');
    } catch {
      showError('Failed to unarchive');
    }
    setUnarchiveChatId(null);
  };

  const handleUnblock = async (userId: string) => {
    try {
      await api.delete(`/users/block/${userId}`);
      setBlockedUsers(prev => prev.filter(u => u.user_id !== userId));
      showSuccess('User unblocked');
    } catch {
      showError('Failed to unblock');
    }
    setUnblockUserId(null);
  };

  const handleGlobalChatThemeChange = (theme: SparkleTheme) => {
    setGlobalChatThemeId(theme.id);
    updateSetting('chat_theme', theme.id);
    setChatThemeGlobalSheet(false);
    showSuccess(`Global theme: ${theme.name}`);
  };

  const selectedConversation = conversations.find(c => c.chat_id === selectedChatId);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: HOME LIST
  // ─────────────────────────────────────────────────────────────────────────

  const renderHome = () => (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10 shadow-xs">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <button
            type="button"
            onClick={() =>
              navigate(initialChatId ? `/messages?chat=${initialChatId}` : '/messages')
            }
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors active:scale-95"
            aria-label="Back to messages"
          >
            <ArrowLeft size={18} className="text-gray-700" />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900 tracking-tight">Messages Settings</h1>
            <p className="text-[11px] text-gray-400 font-medium">Sparkle Messaging Architecture</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {hasSuspiciousSession && (
          <div className="mx-4 mt-4 mb-1 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800">Security notice</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Suspicious login activity detected on your account.
              </p>
            </div>
          </div>
        )}

        <div className="mt-2">
          <SectionHeader title="Activity" />
          <div className="bg-white rounded-2xl mx-4 shadow-sm border border-gray-100 overflow-hidden mb-3">
            <SettingsRow
              icon={<Activity size={18} className="text-green-600" />}
              iconBg="bg-green-50"
              title="Active Status"
              subtitle="Control who can see when you are active"
              onClick={() => goTo('active-status')}
            />
          </div>

          <SectionHeader title="Notifications & Sound" />
          <div className="bg-white rounded-2xl mx-4 shadow-sm border border-gray-100 overflow-hidden mb-3">
            <SettingsRow
              icon={<Bell size={18} className="text-blue-600" />}
              iconBg="bg-blue-50"
              title="Notifications & Sounds"
              subtitle="Alert tones, volumes, haptics, and per-chat overrides"
              onClick={() => goTo('notifications')}
            />
          </div>

          <SectionHeader title="Messaging" />
          <div className="bg-white rounded-2xl mx-4 shadow-sm border border-gray-100 overflow-hidden mb-3">
            <SettingsRow
              icon={<MessageCircle size={18} className="text-purple-600" />}
              iconBg="bg-purple-50"
              title="Messages Behavior & Security"
              subtitle="Push notifications, who can message you, chat lock"
              onClick={() => goTo('behavior-security')}
            />
            <Divider />
            <SettingsRow
              icon={<Shield size={18} className="text-pink-600" />}
              iconBg="bg-pink-50"
              title="Message Privacy Defaults"
              subtitle="Read receipts, typing, forwarding, copy, screenshot"
              onClick={() => goTo('message-privacy')}
            />
            <Divider />
            <SettingsRow
              icon={<Palette size={18} className="text-orange-500" />}
              iconBg="bg-orange-50"
              title="Chat Themes"
              subtitle="Default appearance for conversations"
              onClick={() => goTo('chat-themes')}
            />
          </div>

          <SectionHeader title="Privacy & Security" />
          <div className="bg-white rounded-2xl mx-4 shadow-sm border border-gray-100 overflow-hidden mb-3">
            <SettingsRow
              icon={<Lock size={18} className="text-gray-700" />}
              iconBg="bg-gray-100"
              title="Chat Lock"
              subtitle="Lock selected conversations with a local PIN"
              onClick={() => goTo('chat-lock')}
            />
            <Divider />
            <SettingsRow
              icon={<Archive size={18} className="text-indigo-600" />}
              iconBg="bg-indigo-50"
              title="Archived Chats"
              subtitle="View and manage your archived conversations"
              onClick={() => goTo('archived-chats')}
            />
            <Divider />
            <SettingsRow
              icon={<UserX size={18} className="text-red-600" />}
              iconBg="bg-red-50"
              title="Blocked Contacts"
              subtitle="Manage contacts you have blocked"
              onClick={() => goTo('blocked-contacts')}
            />
            <Divider />
            <SettingsRow
              icon={<Smartphone size={18} className="text-gray-700" />}
              iconBg="bg-gray-100"
              title="Device Logins"
              subtitle="Review where you are logged in"
              badge={hasSuspiciousSession ? '1 alert' : undefined}
              badgeColor="bg-red-100 text-red-600"
              onClick={() => goTo('device-logins')}
            />
          </div>

          <SectionHeader title="Data & Storage" />
          <div className="bg-white rounded-2xl mx-4 shadow-sm border border-gray-100 overflow-hidden mb-6">
            <SettingsRow
              icon={<Wifi size={18} className="text-teal-600" />}
              iconBg="bg-teal-50"
              title="Media & Storage"
              subtitle="Auto-download, link previews, media quality, history"
              onClick={() => goTo('media-storage')}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVE STATUS
  // ─────────────────────────────────────────────────────────────────────────

  const renderActiveStatus = () => (
    <SubPage title="Active Status" onBack={goBack}>
      <div className="pb-24">
        <div className="bg-white mx-4 mt-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-4 flex items-start gap-4 justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Show when you are active</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Your active status is visible to people you are connected to on Sparkle according to your privacy settings.
              </p>
            </div>
            <TouchSafeSwitch
              checked={activeStatusEnabled}
              onChange={handleActiveStatusToggle}
              aria-label="Show when active"
            />
          </div>
          {!activeStatusEnabled && (
            <div className="px-4 pb-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                <EyeOff size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  When your active status is off, you will not be able to see other people's active status either.
                </p>
              </div>
            </div>
          )}
        </div>

        <SectionHeader title="Who can see your active status" />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {[
            { value: 'everyone', label: 'Everyone', desc: 'All Sparkle users' },
            { value: 'followers', label: 'Followers only', desc: 'Only people who follow you' },
            { value: 'no_one', label: 'No one', desc: 'Active status hidden from all' },
          ].map((opt, i) => (
            <React.Fragment key={opt.value}>
              {i > 0 && <Divider />}
              <button
                type="button"
                onClick={() => {
                  setLastSeenPrivacy(opt.value);
                  setActiveStatusEnabled(opt.value !== 'no_one');
                  updateSetting('last_seen_privacy', opt.value);
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 text-left">{opt.label}</p>
                  <p className="text-xs text-gray-500 text-left">{opt.desc}</p>
                </div>
                {lastSeenPrivacy === opt.value && <Check size={18} className="text-[#ff1493]" />}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="mx-4 mt-4 p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-600 leading-relaxed">
            Turn off your active status everywhere you use Sparkle. This preference is applied to your account across all devices.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setView('active-status-learn-more');
            setLearnMorePage(0);
          }}
          className="mx-4 mt-4 flex items-center gap-2 text-sm font-semibold text-[#ff1493] hover:text-[#e0127f] transition-colors"
        >
          <HelpCircle size={16} />
          Learn more about Active Status
        </button>
      </div>
    </SubPage>
  );

  const learnMorePages = [
    {
      title: 'What Active Status means',
      icon: <Activity size={24} className="text-green-600" />,
      content: [
        {
          head: 'Active Now',
          body: 'When you are using Sparkle, your contacts may see an Active Now indicator next to your name. This means you have the app open and are browsing or chatting.',
        },
        {
          head: 'Recent Activity',
          body: 'If you have not opened Sparkle recently, contacts may see a timestamp such as Active 2 hours ago. This updates automatically based on your last app session.',
        },
        {
          head: 'When it disappears',
          body: 'Your active status stops showing when you close Sparkle, or when your device goes to sleep. It may also update with a minor server delay.',
        },
        {
          head: 'Privacy implications',
          body: 'Showing your active status is optional. You can turn it off at any time. When your status is off, you lose visibility into others statuses as well.',
        },
      ],
    },
    {
      title: 'Who can see your active status',
      icon: <Eye size={24} className="text-blue-600" />,
      content: [
        {
          head: 'Connected users',
          body: 'Your active status is visible to people you have an active conversation with, or who follow you, depending on your privacy setting.',
        },
        {
          head: 'Following and follow requests',
          body: 'If your account is set to Followers only, only approved followers see your status. Pending follow requests do not grant visibility.',
        },
        {
          head: 'Blocked users',
          body: 'Blocked users cannot see your active status regardless of your privacy setting.',
        },
        {
          head: 'Privacy restrictions',
          body: 'Your active status setting interacts with Sparkle broader privacy rules. If someone is restricted or blocked, they will never see your status.',
        },
      ],
    },
    {
      title: 'Your privacy choices',
      icon: <Shield size={24} className="text-pink-600" />,
      content: [
        {
          head: 'Turning active status off',
          body: 'When you turn off active status, Sparkle stops broadcasting your online and last-seen state.',
        },
        {
          head: 'Reciprocal visibility',
          body: 'Turning off your active status also means you cannot see other users statuses. This ensures fairness and mutual privacy.',
        },
        {
          head: 'How Sparkle handles the preference',
          body: 'Your preference is stored on Sparkle servers and synchronized immediately across all your devices and sessions.',
        },
        {
          head: 'Instant propagation',
          body: 'When you change your active status setting, the update is applied immediately.',
        },
      ],
    },
  ];

  const renderLearnMore = () => {
    const page = learnMorePages[learnMorePage] || learnMorePages[0];
    return (
      <SubPage title="Active Status" onBack={goBack}>
        <div className="pb-24">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex gap-1.5">
              {learnMorePages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLearnMorePage(i)}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === learnMorePage ? 'w-6 bg-[#ff1493]' : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-400 font-medium">
              {learnMorePage + 1} / {learnMorePages.length}
            </span>
          </div>

          <div className="px-4 pt-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                {page.icon}
              </div>
              <h2 className="text-lg font-bold text-gray-900">{page.title}</h2>
            </div>
            <div className="space-y-4">
              {page.content.map((item, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-sm font-bold text-gray-900 mb-1">{item.head}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 mt-6">
            {learnMorePage > 0 ? (
              <button
                type="button"
                onClick={() => setLearnMorePage(p => p - 1)}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft size={16} /> Previous
              </button>
            ) : (
              <div />
            )}
            {learnMorePage < learnMorePages.length - 1 ? (
              <button
                type="button"
                onClick={() => setLearnMorePage(p => p + 1)}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#ff1493] hover:text-[#e0127f] transition-colors"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setView('active-status')}
                className="text-sm font-semibold text-[#ff1493] hover:text-[#e0127f] transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </SubPage>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS & SOUNDS
  // ─────────────────────────────────────────────────────────────────────────

  const renderNotifications = () => (
    <SubPage title="Notifications & Sounds" onBack={goBack}>
      <div className="pb-24">
        <SectionHeader
          title="Conversation Alert Settings"
          description="Select a conversation to configure its dedicated mute state and custom alert tone."
        />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setChatSelectSheet(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {selectedConversation ? (
                <img
                  src={getAvatarUrl(
                    selectedConversation.partner_avatar,
                    selectedConversation.partner_name
                  )}
                  className="w-8 h-8 rounded-full object-cover border border-gray-100"
                  alt=""
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <MessageCircle size={14} className="text-gray-400" />
                </div>
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">
                  {selectedConversation
                    ? sanitizePartnerName(
                        selectedConversation.partner_name,
                        selectedConversation.partner_username
                      )
                    : 'Choose a conversation'}
                </p>
                {selectedConversation && (
                  <p className="text-xs text-[#ff1493] font-medium">
                    {chatMuteState ? 'Muted' : 'Notifications active'} · Per-Chat Scope
                  </p>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>

          {selectedConversation && (
            <>
              <Divider />
              <div className="px-4 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Mute Conversation</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Silence all notification sounds and popups for this chat.
                  </p>
                </div>
                <TouchSafeSwitch
                  checked={chatMuteState}
                  onChange={val => handleToggleChatMute(selectedChatId, val)}
                  aria-label="Mute conversation"
                />
              </div>
              <Divider />
              <button
                type="button"
                onClick={() => setChatSoundSheet(true)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">Chat Notification Tone</p>
                  <p className="text-xs text-[#ff1493] font-medium mt-0.5">
                    {AVAILABLE_NOTIFICATION_SOUNDS.find(s => s.key === chatSoundState)?.label ||
                      'Device Default'}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            </>
          )}
        </div>

        <SectionHeader
          title="Sound Theme Profile"
          description="Applies to all sounds across Sparkle."
        />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setSoundThemeSheet(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Active Theme Pack</p>
              <p className="text-xs text-[#ff1493] font-medium mt-0.5">{audioTheme}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Swaps the audio profile across the platform instantly.
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        </div>

        <SectionHeader
          title="Default Notification Sound"
          description="Alert tone when no per-chat override is configured."
        />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setNotifSoundSheet(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Select Notification Tone</p>
              <p className="text-xs text-[#ff1493] font-medium mt-0.5">
                {AVAILABLE_NOTIFICATION_SOUNDS.find(s => s.key === globalNotificationSound)?.label ||
                  'Device Default'}
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        </div>

        <SectionHeader
          title="Volume Levels"
          description="Adjust master, message, notification, and UI audio channels."
        />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {(
            [
              { label: 'Master Volume', key: 'master' as const },
              { label: 'Message Sounds', key: 'messages' as const },
              { label: 'Notifications', key: 'notifications' as const },
              { label: 'UI Interactions', key: 'ui' as const },
            ] as const
          ).map((vol, i) => (
            <React.Fragment key={vol.key}>
              {i > 0 && <Divider />}
              <div className="px-4 py-3.5">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-gray-700">{vol.label}</span>
                  <span className="font-mono font-bold text-[#ff1493]">
                    {Math.round(((audioVolumes as any)[vol.key] ?? 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(((audioVolumes as any)[vol.key] ?? 1) * 100)}
                  onChange={e => handleVolumeChange(vol.key, parseInt(e.target.value) / 100)}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#ff1493] bg-gray-200"
                  aria-label={vol.label}
                />
              </div>
            </React.Fragment>
          ))}
        </div>

        <SectionHeader
          title="Toggles & Customization"
          description="Independently enable or disable each audio category."
        />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {[
            {
              key: 'masterSounds',
              label: 'Master Sound Effects',
              icon: <Volume2 size={16} className="text-blue-600" />,
              desc: 'Enable or disable all platform audio sound effects',
            },
            {
              key: 'messageSounds',
              label: 'Message Sound Effects',
              icon: <MessageCircle size={16} className="text-purple-600" />,
              desc: 'In-app send, receive, and read receipt chimes',
            },
            {
              key: 'outChatIncoming',
              label: 'Out of Chat Incoming Ping',
              icon: <BellOff size={16} className="text-orange-500" />,
              desc: 'Notification sound when a message arrives while browsing other pages',
            },
            {
              key: 'playHaptics',
              label: 'Haptic Feedback',
              icon: <Vibrate size={16} className="text-green-600" />,
              desc: 'Tactile vibration on send, reactions, and key interactions',
            },
          ].map((item, i) => (
            <React.Fragment key={item.key}>
              {i > 0 && <Divider />}
              <div className="px-4 py-3.5 flex items-center gap-4 justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <TouchSafeSwitch
                  checked={!!audioToggles[item.key]}
                  onChange={val => handleAudioToggle(item.key, val)}
                  aria-label={item.label}
                />
              </div>
            </React.Fragment>
          ))}
        </div>

        <SectionHeader
          title="Test Preview"
          description="Audit sound and vibration response safely without sending real messages."
        />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-4 grid grid-cols-3 gap-3">
            {(['send', 'receive', 'notification'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => handleTestPreview(t)}
                className="py-2.5 px-2 bg-gray-50 hover:bg-gray-100 active:scale-95 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 flex items-center justify-center gap-1.5 transition-all capitalize"
              >
                <Play size={11} fill="currentColor" className="text-[#ff1493]" />
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-4 mt-4">
          <button
            type="button"
            onClick={() => setResetAudioModal(true)}
            className="w-full py-3 bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 rounded-xl text-sm font-semibold text-gray-500 hover:text-red-600 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <RotateCcw size={15} />
            Reset Audio Settings
          </button>
        </div>
      </div>
    </SubPage>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // BEHAVIOR & SECURITY
  // ─────────────────────────────────────────────────────────────────────────

  const renderBehaviorSecurity = () => (
    <SubPage title="Messages Behavior & Security" onBack={goBack}>
      <div className="pb-24">
        <SectionHeader title="Account General" />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 flex items-start gap-4 justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Push Notifications</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Receive system notifications when new messages arrive. System permissions must also be granted in device settings.
              </p>
            </div>
            <TouchSafeSwitch
              checked={notificationsEnabled}
              onChange={val => {
                setNotificationsEnabled(val);
                updateSetting('push_notifications', val ? 1 : 0);
              }}
              aria-label="Push notifications"
            />
          </div>

          <Divider />

          <button
            type="button"
            onClick={() => setWhoCanMessageSheet(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Who Can Message You</p>
              <p className="text-xs text-[#ff1493] font-medium mt-0.5">
                {messagePrivacy === 'everyone'
                  ? 'Everyone'
                  : messagePrivacy === 'followers'
                  ? 'Followers only'
                  : 'No one'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Server-enforced — controls who can open new conversations with you.
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        </div>

        <SectionHeader title="Security" />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <SettingsRow
            icon={<Lock size={18} className="text-gray-700" />}
            iconBg="bg-gray-100"
            title="Chat Lock"
            subtitle="Lock selected conversations with a local PIN on this device"
            onClick={() => goTo('chat-lock')}
          />
          <Divider />
          <SettingsRow
            icon={<Smartphone size={18} className="text-gray-700" />}
            iconBg="bg-gray-100"
            title="Device Logins"
            subtitle="Review and manage active login sessions"
            badge={hasSuspiciousSession ? '1 alert' : undefined}
            badgeColor="bg-red-100 text-red-600"
            onClick={() => goTo('device-logins')}
          />
        </div>
      </div>
    </SubPage>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // MESSAGE PRIVACY DEFAULTS
  // ─────────────────────────────────────────────────────────────────────────

  const renderMessagePrivacy = () => (
    <SubPage title="Message Privacy Defaults" onBack={goBack}>
      <div className="pb-24">
        <div className="mx-4 mt-4 p-3 bg-pink-50 border border-pink-100 rounded-xl flex gap-2">
          <Info size={14} className="text-[#ff1493] shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            These are <strong>global defaults</strong>. If a chat has not set an explicit override in its conversation settings, it inherits these values.
          </p>
        </div>

        <SectionHeader title="Global Defaults" />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {[
            {
              label: 'Read Receipts',
              desc: 'Let contacts see when you have read their messages.',
              key: 'default_read_receipts',
              value: defaultReadReceipts,
              setter: setDefaultReadReceipts,
              icon: <Eye size={16} className="text-blue-600" />,
            },
            {
              label: 'Typing Indicators',
              desc: 'Broadcast real-time typing status when composing messages.',
              key: 'default_typing_indicator',
              value: defaultTypingIndicator,
              setter: setDefaultTypingIndicator,
              icon: <MessageCircle size={16} className="text-purple-600" />,
            },
            {
              label: 'Allow Message Forwarding',
              desc: 'Allow recipients to forward messages you sent to other chats.',
              key: 'default_allow_forwarding',
              value: defaultAllowForwarding,
              setter: setDefaultAllowForwarding,
              icon: <Share2 size={16} className="text-green-600" />,
            },
            {
              label: 'Allow Text Copying',
              desc: 'Allow recipients to copy text from your sent messages.',
              key: 'default_allow_copy_text',
              value: defaultAllowCopyText,
              setter: setDefaultAllowCopyText,
              icon: <Copy size={16} className="text-orange-500" />,
            },
          ].map((item, i) => (
            <React.Fragment key={item.key}>
              {i > 0 && <Divider />}
              <div className="px-4 py-3.5 flex items-start gap-4 justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
                <TouchSafeSwitch
                  checked={item.value}
                  onChange={val => {
                    item.setter(val);
                    updateAdvancedSetting(item.key, val);
                  }}
                  aria-label={item.label}
                />
              </div>
            </React.Fragment>
          ))}
        </div>

        <SectionHeader
          title="Screen Protection"
          description="Android-native security features — availability depends on platform support."
        />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {[
            {
              label: 'Screenshot Notifications',
              desc: 'Receive alert banners when a recipient attempts a screenshot.',
              key: 'default_screenshot_notification',
              value: defaultScreenshotNotification,
              setter: setDefaultScreenshotNotification,
              icon: <Camera size={16} className="text-gray-600" />,
            },
            {
              label: 'Screen Recording Blur',
              desc: 'Automatically obscure conversation contents when background screen recording is detected.',
              key: 'blur_screen_recording',
              value: blurScreenRecording,
              setter: setBlurScreenRecording,
              icon: <Monitor size={16} className="text-gray-600" />,
            },
          ].map((item, i) => (
            <React.Fragment key={item.key}>
              {i > 0 && <Divider />}
              <div className="px-4 py-3.5 flex items-start gap-4 justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
                <TouchSafeSwitch
                  checked={item.value}
                  onChange={val => {
                    item.setter(val);
                    updateAdvancedSetting(item.key, val);
                  }}
                  aria-label={item.label}
                />
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </SubPage>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // CHAT THEMES
  // ─────────────────────────────────────────────────────────────────────────

  const renderChatThemes = () => {
    const currentGlobalTheme =
      PRESET_THEMES.find(t => t.id === globalChatThemeId) || PRESET_THEMES[0];
    return (
      <SubPage title="Chat Themes" onBack={goBack}>
        <div className="pb-24">
          <div className="mx-4 mt-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-600 leading-relaxed">
              This is the <strong>global default theme</strong> applied to all conversations that do not have a per-chat theme override. Changing the global theme does not affect conversations with explicit overrides set in their individual chat settings.
            </p>
          </div>

          <SectionHeader title="Global Default Theme" />
          <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setChatThemeGlobalSheet(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl border-2 border-white shadow-md"
                  style={{ background: currentGlobalTheme.colors.primary }}
                />
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">{currentGlobalTheme.name}</p>
                  <p className="text-xs text-gray-500">{currentGlobalTheme.category}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          </div>

          <SectionHeader title="How themes work" />
          <div className="mx-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            {[
              { label: 'Global Default', desc: 'Applied to all chats without an explicit override.' },
              {
                label: 'Per-Chat Override',
                desc: 'Set from within any individual conversation settings. Overrides the global default.',
              },
              {
                label: 'Effective theme',
                desc: 'Per-chat override -> falls back to Global default if not set.',
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ff1493] mt-1.5 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-gray-800">{item.label}: </span>
                  <span className="text-xs text-gray-500">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SubPage>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CHAT LOCK
  // ─────────────────────────────────────────────────────────────────────────

  const renderChatLock = () => (
    <SubPage title="Chat Lock" onBack={goBack}>
      <div className="pb-24">
        <div className="mx-4 mt-4 p-3 bg-gray-50 border border-gray-200 rounded-xl flex gap-2">
          <Lock size={14} className="text-gray-600 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            Chat Lock is a <strong>local device security</strong> feature. Locked conversations require a PIN to open on this device only. The PIN is never sent to Sparkle servers. Locking does not delete messages, affect delivery, alter read receipts, or block the other person.
          </p>
        </div>

        <SectionHeader title="PIN" />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {pinSet ? (
            <>
              <div className="px-4 py-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <Check size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">PIN configured</p>
                  <p className="text-xs text-gray-500">Stored locally on this device only.</p>
                </div>
              </div>
              <Divider />
              <button
                type="button"
                onClick={() => setShowPinSetup(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-[#ff1493]"
              >
                <span className="text-sm font-semibold">Change PIN</span>
              </button>
              <Divider />
              <button
                type="button"
                onClick={clearPin}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition-colors text-red-500"
              >
                <span className="text-sm font-semibold">Remove PIN & Clear All Locks</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowPinSetup(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Lock size={16} className="text-gray-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Set PIN</p>
                <p className="text-xs text-gray-500">Required to lock conversations.</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 ml-auto" />
            </button>
          )}
        </div>

        {pinSet && (
          <>
            <SectionHeader title="Visibility" />
            <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3.5 flex items-start gap-4 justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Hide Locked Chats</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    When on, locked conversations are removed from the normal messages list. They can be revealed by entering your PIN in the Messages search field.
                  </p>
                </div>
                <TouchSafeSwitch
                  checked={hiddenLockedChats}
                  onChange={toggleHiddenLockedChats}
                  aria-label="Hide locked chats"
                />
              </div>
            </div>

            {hiddenLockedChats && (
              <div className="mx-4 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2">
                <Info size={13} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Hidden locked chats can be revealed from the Messages search field using your private access PIN. The PIN is only checked locally — it is never transmitted to the server.
                </p>
              </div>
            )}

            <SectionHeader
              title="Locked Conversations"
              description="Select which conversations to lock."
            />
            <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {loadingConversations ? (
                <div className="px-4 py-6 text-center text-xs text-gray-400">
                  Loading conversations...
                </div>
              ) : conversations.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-gray-400">
                  No conversations found.
                </div>
              ) : (
                conversations.map((c: any, i) => {
                  const isLocked = lockedChats.includes(c.chat_id);
                  const name = sanitizePartnerName(c.partner_name, c.partner_username);
                  return (
                    <React.Fragment key={c.chat_id}>
                      {i > 0 && <Divider />}
                      <button
                        type="button"
                        onClick={() => toggleLockChat(c.chat_id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                      >
                        <img
                          src={getAvatarUrl(c.partner_avatar, c.partner_name)}
                          className="w-8 h-8 rounded-full object-cover border border-gray-100"
                          alt=""
                        />
                        <span className="flex-1 text-sm font-semibold text-gray-900 text-left">
                          {name}
                        </span>
                        {isLocked && <Lock size={14} className="text-[#ff1493] shrink-0" />}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isLocked ? 'bg-[#ff1493] border-[#ff1493]' : 'border-gray-300'
                          }`}
                        >
                          {isLocked && <Check size={11} className="text-white" />}
                        </div>
                      </button>
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {showPinSetup && (
        <div className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xs w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center mx-auto mb-4">
              <Lock size={22} className="text-[#ff1493]" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center">
              {pinSet ? 'Change PIN' : 'Set 4-Digit PIN'}
            </h3>
            <p className="text-xs text-gray-500 text-center mt-1">
              This PIN is stored only on this device and is never sent to Sparkle.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              placeholder="••••"
              value={newPinValue}
              onChange={e => {
                setNewPinValue(e.target.value.replace(/\D/g, '').slice(0, 4));
                setPinError('');
              }}
              className="w-full mt-4 text-center text-2xl font-mono tracking-widest bg-gray-50 border border-gray-200 rounded-xl py-3 text-gray-900 outline-none focus:border-[#ff1493] focus:ring-2 focus:ring-[#ff1493]/20"
            />
            {pinError && (
              <p className="text-xs text-red-500 text-center mt-1.5 font-medium">{pinError}</p>
            )}
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setShowPinSetup(false);
                  setNewPinValue('');
                  setPinError('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePin}
                className="flex-1 py-2.5 rounded-xl bg-[#ff1493] text-sm font-bold text-white hover:bg-[#e0127f] transition-colors"
              >
                Save PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </SubPage>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ARCHIVED CHATS
  // ─────────────────────────────────────────────────────────────────────────

  const renderArchivedChats = () => (
    <SubPage title="Archived Chats" onBack={goBack}>
      <div className="pb-24">
        <div className="mx-4 mt-4 p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 leading-relaxed">
            Archived conversations remain fully intact — all messages are preserved. Archiving does not delete or block any conversation.
          </p>
        </div>

        {loadingArchived ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading archived chats...</div>
        ) : archivedChats.length === 0 ? (
          <div className="py-12 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Archive size={24} className="text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No archived chats</p>
            <p className="text-xs text-gray-400 mt-1">Archived conversations will appear here.</p>
          </div>
        ) : (
          <>
            <SectionHeader
              title={`${archivedChats.length} archived conversation${
                archivedChats.length !== 1 ? 's' : ''
              }`}
            />
            <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {archivedChats.map((c: any, i) => {
                const name = sanitizePartnerName(c.partner_name, c.partner_username);
                return (
                  <React.Fragment key={c.chat_id}>
                    {i > 0 && <Divider />}
                    <div className="px-4 py-3.5 flex items-center gap-3">
                      <img
                        src={getAvatarUrl(c.partner_avatar, c.partner_name)}
                        className="w-10 h-10 rounded-full object-cover border border-gray-100"
                        alt=""
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                        {c.last_message && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{c.last_message}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setUnarchiveChatId(c.chat_id)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-600 rounded-lg transition-colors shrink-0"
                      >
                        Unarchive
                      </button>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </>
        )}
      </div>
    </SubPage>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // BLOCKED CONTACTS
  // ─────────────────────────────────────────────────────────────────────────

  const renderBlockedContacts = () => (
    <SubPage title="Blocked Contacts" onBack={goBack}>
      <div className="pb-24">
        {loadingBlocked ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading blocked users...</div>
        ) : blockedUsers.length === 0 ? (
          <div className="py-12 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <UserX size={24} className="text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No blocked contacts</p>
            <p className="text-xs text-gray-400 mt-1">Users you block will appear here.</p>
          </div>
        ) : (
          <>
            <SectionHeader
              title={`${blockedUsers.length} blocked contact${
                blockedUsers.length !== 1 ? 's' : ''
              }`}
            />
            <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {blockedUsers.map((u: any, i) => (
                <React.Fragment key={u.user_id}>
                  {i > 0 && <Divider />}
                  <div className="px-4 py-3.5 flex items-center gap-3">
                    <img
                      src={u.avatar_url || '/uploads/avatars/default.png'}
                      className="w-10 h-10 rounded-full object-cover border border-gray-100"
                      alt=""
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {u.name || u.username}
                      </p>
                      <p className="text-xs text-gray-400">@{u.username}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUnblockUserId(u.user_id)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-600 rounded-lg transition-colors shrink-0"
                    >
                      Unblock
                    </button>
                  </div>
                </React.Fragment>
              ))}
            </div>
            <div className="mx-4 mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl flex gap-2">
              <Shield size={13} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Blocked users cannot message you, see your posts, or view your profile. They will not be notified that they have been blocked.
              </p>
            </div>
          </>
        )}
      </div>
    </SubPage>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // DEVICE LOGINS
  // ─────────────────────────────────────────────────────────────────────────

  const renderDeviceLogins = () => (
    <SubPage title="Device Logins" onBack={goBack}>
      <div className="pb-24">
        <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Demonstration session data.</strong> This view shows current and recent login sessions. MAC addresses are marked as unavailable because they cannot be obtained over internet HTTP requests.
          </p>
        </div>

        <SectionHeader
          title="Where you are logged in"
          description="Review devices that have recently accessed your Sparkle account."
        />

        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {deviceSessions.map((session, i) => (
            <React.Fragment key={session.id}>
              {i > 0 && <Divider />}
              <div className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      session.isCurrent ? 'bg-green-50' : 'bg-gray-100'
                    }`}
                  >
                    <Smartphone
                      size={18}
                      className={session.isCurrent ? 'text-green-600' : 'text-gray-500'}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">{session.device}</p>
                      {session.isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Current
                        </span>
                      )}
                      {session.suspicious && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Suspicious
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      <p>IP: {session.ip}</p>
                      <p>Location: {session.location}</p>
                      <p>MAC address: {session.macAddress || 'Unavailable (not accessible via internet)'}</p>
                      <p>{session.time}</p>
                    </div>
                    {!session.isCurrent && (
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 rounded-lg transition-colors"
                        >
                          Log out
                        </button>
                        {session.suspicious && (
                          <button
                            type="button"
                            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-xs font-bold text-red-700 rounded-lg transition-colors"
                          >
                            Report
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {deviceSessions.length > 1 && (
          <div className="mx-4 mt-4">
            <button
              type="button"
              className="w-full py-3 bg-white border border-red-200 hover:border-red-300 hover:bg-red-50 rounded-xl text-sm font-bold text-red-500 hover:text-red-600 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={15} />
              Log out all other devices
            </button>
          </div>
        )}
      </div>
    </SubPage>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // MEDIA & STORAGE
  // ─────────────────────────────────────────────────────────────────────────

  const renderMediaStorage = () => (
    <SubPage title="Media & Storage" onBack={goBack}>
      <div className="pb-24">
        <SectionHeader title="Network & Downloads" />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setMediaDownloadSheet(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Auto-Download Media</p>
              <p className="text-xs text-[#ff1493] font-medium mt-0.5">
                {autoDownloadMedia === 'wifi'
                  ? 'When using Wi-Fi'
                  : autoDownloadMedia === 'always'
                  ? 'Always (Cellular & Wi-Fi)'
                  : 'Never'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Choose when images and files automatically download.
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>

          <Divider />

          <div className="px-4 py-3.5 flex items-start gap-4 justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Rich Link Previews</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Automatically fetch thumbnail and title metadata for links shared in chats.
              </p>
            </div>
            <TouchSafeSwitch
              checked={linkPreviewsEnabled}
              onChange={val => {
                setLinkPreviewsEnabled(val);
                updateSetting('link_previews_enabled', val ? 1 : 0);
              }}
              aria-label="Rich link previews"
            />
          </div>

          <Divider />

          <button
            type="button"
            onClick={() => setMediaQualitySheet(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Media Upload Quality</p>
              <p className="text-xs text-[#ff1493] font-medium mt-0.5">
                {mediaQuality === 'high' ? 'High Quality' : 'Standard (Compressed)'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                High Quality uploads at higher resolution with balanced compression.
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        </div>

        <SectionHeader title="Data Management" />
        <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setClearHistoryModal(true)}
            className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-red-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <Trash2 size={18} className="text-red-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-red-500">Clear Local Message Cache</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Clear locally cached data. Active threads can be re-synced from the server.
              </p>
            </div>
          </button>
        </div>
      </div>
    </SubPage>
  );

  const renderView = () => {
    switch (view) {
      case 'active-status':
        return renderActiveStatus();
      case 'active-status-learn-more':
        return renderLearnMore();
      case 'notifications':
        return renderNotifications();
      case 'behavior-security':
        return renderBehaviorSecurity();
      case 'message-privacy':
        return renderMessagePrivacy();
      case 'chat-themes':
        return renderChatThemes();
      case 'chat-lock':
        return renderChatLock();
      case 'archived-chats':
        return renderArchivedChats();
      case 'blocked-contacts':
        return renderBlockedContacts();
      case 'device-logins':
        return renderDeviceLogins();
      case 'media-storage':
        return renderMediaStorage();
      default:
        return renderHome();
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900 font-sans selection:bg-pink-100 animate-in fade-in duration-200">
      <div className="min-h-dvh max-w-lg mx-auto bg-gray-50 relative shadow-xl border-x border-gray-100">
        {renderView()}
      </div>

      {/* Side Sheets */}
      <SideSheet
        open={soundThemeSheet}
        onClose={() => setSoundThemeSheet(false)}
        title="Sound Theme"
      >
        <p className="px-4 pt-4 text-xs text-gray-500">
          Select a theme to swap the audio profile across the platform.
        </p>
        <div className="mt-2">
          {SOUND_THEMES.map((t, i) => (
            <React.Fragment key={t.key}>
              {i > 0 && <Divider />}
              <button
                type="button"
                onClick={() => handleThemeChange(t.key)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                  <p className="text-xs text-gray-500">{t.desc}</p>
                </div>
                {audioTheme === t.key && <Check size={18} className="text-[#ff1493]" />}
              </button>
            </React.Fragment>
          ))}
        </div>
      </SideSheet>

      <SideSheet
        open={notifSoundSheet}
        onClose={() => setNotifSoundSheet(false)}
        title="Default Notification Sound"
      >
        <p className="px-4 pt-4 text-xs text-gray-500">
          Standard alert tone used when no chat-specific override is configured.
        </p>
        <div className="mt-2">
          {AVAILABLE_NOTIFICATION_SOUNDS.map((s, i) => (
            <React.Fragment key={s.key}>
              {i > 0 && <Divider />}
              <button
                type="button"
                onClick={() => handleGlobalNotificationSoundChange(s.key)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-900">{s.label}</span>
                {globalNotificationSound === s.key && <Check size={18} className="text-[#ff1493]" />}
              </button>
            </React.Fragment>
          ))}
        </div>
      </SideSheet>

      <SideSheet
        open={chatSoundSheet}
        onClose={() => setChatSoundSheet(false)}
        title="Chat Notification Tone"
      >
        <p className="px-4 pt-4 text-xs text-gray-500">
          Custom alert sound for this conversation only. Does not change the global default.
        </p>
        <div className="mt-2">
          {AVAILABLE_NOTIFICATION_SOUNDS.map((s, i) => (
            <React.Fragment key={s.key}>
              {i > 0 && <Divider />}
              <button
                type="button"
                onClick={() => handleSetChatSound(s.key)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-900">{s.label}</span>
                {chatSoundState === s.key && <Check size={18} className="text-[#ff1493]" />}
              </button>
            </React.Fragment>
          ))}
        </div>
      </SideSheet>

      <SideSheet
        open={chatSelectSheet}
        onClose={() => setChatSelectSheet(false)}
        title="Select Conversation"
      >
        <p className="px-4 pt-4 text-xs text-gray-500">
          Choose a conversation to configure its per-chat notification settings.
        </p>
        <div className="mt-2">
          {loadingConversations ? (
            <div className="py-8 text-center text-xs text-gray-400">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">No conversations found.</div>
          ) : (
            conversations.map((c: any, i) => {
              const name = sanitizePartnerName(c.partner_name, c.partner_username);
              return (
                <React.Fragment key={c.chat_id}>
                  {i > 0 && <Divider />}
                  <button
                    type="button"
                    onClick={() => handleSelectChat(c.chat_id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <img
                      src={getAvatarUrl(c.partner_avatar, c.partner_name)}
                      className="w-8 h-8 rounded-full object-cover border border-gray-100"
                      alt=""
                    />
                    <span className="flex-1 text-sm font-semibold text-gray-900 text-left">
                      {name}
                    </span>
                    {c.is_muted && <BellOff size={13} className="text-gray-400" />}
                    {selectedChatId === c.chat_id && <Check size={16} className="text-[#ff1493]" />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      </SideSheet>

      <SideSheet
        open={mediaDownloadSheet}
        onClose={() => setMediaDownloadSheet(false)}
        title="Auto-Download Media"
      >
        <div className="mt-2">
          {[
            {
              value: 'wifi',
              label: 'When using Wi-Fi',
              desc: 'Download automatically on Wi-Fi only',
            },
            {
              value: 'always',
              label: 'Always (Cellular & Wi-Fi)',
              desc: 'Download on any connection',
            },
            { value: 'never', label: 'Never', desc: 'Download only when manually requested' },
          ].map((opt, i) => (
            <React.Fragment key={opt.value}>
              {i > 0 && <Divider />}
              <button
                type="button"
                onClick={() => {
                  setAutoDownloadMedia(opt.value);
                  updateSetting('auto_download_media', opt.value);
                  setMediaDownloadSheet(false);
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
                {autoDownloadMedia === opt.value && <Check size={18} className="text-[#ff1493]" />}
              </button>
            </React.Fragment>
          ))}
        </div>
      </SideSheet>

      <SideSheet
        open={mediaQualitySheet}
        onClose={() => setMediaQualitySheet(false)}
        title="Media Upload Quality"
      >
        <div className="mt-2">
          {[
            {
              value: 'standard',
              label: 'Standard',
              desc: 'Fast, compressed. Recommended for most users.',
            },
            {
              value: 'high',
              label: 'High Quality',
              desc: 'Higher resolution. Note: server may still apply compression.',
            },
          ].map((opt, i) => (
            <React.Fragment key={opt.value}>
              {i > 0 && <Divider />}
              <button
                type="button"
                onClick={() => {
                  setMediaQuality(opt.value);
                  updateSetting('media_quality', opt.value);
                  setMediaQualitySheet(false);
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
                {mediaQuality === opt.value && <Check size={18} className="text-[#ff1493]" />}
              </button>
            </React.Fragment>
          ))}
        </div>
      </SideSheet>

      <SideSheet
        open={whoCanMessageSheet}
        onClose={() => setWhoCanMessageSheet(false)}
        title="Who Can Message You"
      >
        <p className="px-4 pt-4 text-xs text-gray-500">
          Server-enforced. Controls who can open new direct conversations with your account.
        </p>
        <div className="mt-2">
          {[
            {
              value: 'everyone',
              label: 'Everyone',
              desc: 'Any Sparkle user can start a conversation',
            },
            {
              value: 'followers',
              label: 'Followers only',
              desc: 'Only approved followers can message you',
            },
            { value: 'no_one', label: 'No one', desc: 'No new conversations can be started' },
          ].map((opt, i) => (
            <React.Fragment key={opt.value}>
              {i > 0 && <Divider />}
              <button
                type="button"
                onClick={() => {
                  setMessagePrivacy(opt.value);
                  updateSetting('message_privacy', opt.value);
                  setWhoCanMessageSheet(false);
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
                {messagePrivacy === opt.value && <Check size={18} className="text-[#ff1493]" />}
              </button>
            </React.Fragment>
          ))}
        </div>
      </SideSheet>

      <SideSheet
        open={chatThemeGlobalSheet}
        onClose={() => setChatThemeGlobalSheet(false)}
        title="Global Chat Theme"
      >
        <p className="px-4 pt-4 text-xs text-gray-500">
          Sets the default theme for all conversations without a per-chat override.
        </p>
        <div className="mt-2">
          {PRESET_THEMES.slice(0, 20).map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && <Divider />}
              <button
                type="button"
                onClick={() => handleGlobalChatThemeChange(t)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-xl border border-white shadow-md shrink-0"
                  style={{ background: t.colors.primary }}
                />
                <div className="text-left flex-1">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.category}</p>
                </div>
                {globalChatThemeId === t.id && <Check size={16} className="text-[#ff1493]" />}
              </button>
            </React.Fragment>
          ))}
          <div className="px-4 py-3 text-xs text-gray-400 text-center">
            More themes available in individual chat settings.
          </div>
        </div>
      </SideSheet>

      {/* Confirm Modals */}
      <ConfirmModal
        open={resetAudioModal}
        title="Reset Audio Settings?"
        message="This will restore the Sparkle Original sound theme, default volume levels, and standard sound toggles. Per-chat notification overrides are not affected."
        confirmLabel="Reset"
        onConfirm={handleResetAudio}
        onCancel={() => setResetAudioModal(false)}
      />

      <ConfirmModal
        open={clearHistoryModal}
        title="Clear Message Cache?"
        message={
          <span>
            This will clear locally cached conversations. <strong>Server messages are not deleted</strong> and active threads can be re-synced.
          </span>
        }
        confirmLabel="Clear Cache"
        confirmDanger
        onConfirm={() => {
          setClearHistoryModal(false);
          showSuccess('Message cache cleared');
        }}
        onCancel={() => setClearHistoryModal(false)}
      />

      <ConfirmModal
        open={!!unblockUserId}
        title="Unblock this user?"
        message="They will be able to message you and see your profile again according to your privacy settings."
        confirmLabel="Unblock"
        onConfirm={() => unblockUserId && handleUnblock(unblockUserId)}
        onCancel={() => setUnblockUserId(null)}
      />

      <ConfirmModal
        open={!!unarchiveChatId}
        title="Unarchive this conversation?"
        message="The conversation will return to your main messages list."
        confirmLabel="Unarchive"
        onConfirm={() => unarchiveChatId && handleUnarchive(unarchiveChatId)}
        onCancel={() => setUnarchiveChatId(null)}
      />    </div>
  );
}
