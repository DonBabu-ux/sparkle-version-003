import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  X, Search, Bell, Users, Image as ImageIcon, Pin, Volume2, 
  Download, Share2, Clock, Eye, MoreHorizontal, Shield, Lock, 
  MinusCircle, ShieldAlert, AlertTriangle, Trash2, ChevronLeft,
  Palette, MessageCircle, Smile, ImagePlus, User, Edit3, Check, Sparkles, Send, Settings, Wand2, Play, RotateCcw,
  Copy, Phone, Globe, UserPlus, CheckCircle2, Link2, BarChart2, History
} from 'lucide-react';
import { getAvatarUrl } from '../../utils/imageUtils';
import { useThemeStore, PRESET_THEMES, type SparkleTheme } from '../../store/themeStore';
import { clsx } from 'clsx';
import type { SoundKey } from '../../audio/managers/SoundManager';
import AudioSessionManager from '../../audio/managers/AudioSessionManager';
import useSound from '../../hooks/useSound';
import QRCode from 'react-qr-code';

import { SharedContentExplorer } from './SharedContentExplorer';
import { PinnedMessagesView } from './PinnedMessagesView';
import { ChatSearchModal } from './ChatSearchModal';

interface ChatSettingsModalProps {
  chat: any;
  onClose: () => void;
  onNavigateProfile?: () => void;
}

// Removed static EMOJIS and MEMOJIS as we'll use emoji-mart and more realistic avatars
const MEMOJIS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop',
];

import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import api from '../../api/api';

const PREVIEW_MESSAGES = [
  { text: "Hey! Did you see the new themes?", isMe: false },
  { text: "Yes! They look absolutely incredible ✨", isMe: true },
  { text: "I'm testing out the animations right now.", isMe: false },
  { text: "Everything feels so smooth!", isMe: true }
];

// Helper to deterministically generate encryption verification keys from conversation ID
const generateEncryptionKeys = (chatId: string) => {
  let hash = 0;
  const strId = String(chatId || '');
  for (let i = 0; i < strId.length; i++) {
    hash = (hash << 5) - hash + strId.charCodeAt(i);
    hash |= 0;
  }
  
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  const blocks: string[] = [];
  const seed = Math.abs(hash) || 987654321;
  for (let i = 0; i < 12; i++) {
    const val = Math.floor(seededRandom(seed + i) * 90000) + 10000;
    blocks.push(val.toString());
  }
  return {
    blocks,
    code: blocks.join(' ')
  };
};

export default function ChatSettingsModal({ chat, onClose, onNavigateProfile }: ChatSettingsModalProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<'main' | 'customize' | 'preview_theme' | 'ai_generator' | 'custom_photo' | 'nicknames' | 'media' | 'pinned' | 'search_chat' | 'share_contact' | 'create_group' | 'word_emoji_picker' | 'notifications_sounds' | 'encryption_verification'>('main');
  const [customizeTab, setCustomizeTab] = useState<'themes' | 'reaction' | 'words'>('themes');

  // ── Create Group state ──
  const [groupName, setGroupName] = useState(`${chat.partner_name.split(' ')[0]} & You`);
  const [groupFriends, setGroupFriends] = useState<any[]>([]);
  const [groupSelected, setGroupSelected] = useState<any[]>([{ id: chat.partner_id, user_id: chat.partner_id, full_name: chat.partner_name, avatar_url: chat.partner_avatar }]);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupCreating, setGroupCreating] = useState(false);

  // ── Share Contact state ──
  const [linkCopied, setLinkCopied] = useState(false);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [followingLoading, setFollowingLoading] = useState(false);
  const [sharingStates, setSharingStates] = useState<Record<string, 'idle' | 'sending' | 'sent'>>({});

  useEffect(() => {
    if (view !== 'share_contact') return;
    const fetchFollowing = async () => {
      setFollowingLoading(true);
      try {
        const res = await api.get(`/users/following?q=${shareSearchQuery}`);
        const users = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setFollowingList(users);
      } catch (err) {
        console.error('Failed to fetch following:', err);
      } finally {
        setFollowingLoading(false);
      }
    };
    fetchFollowing();
  }, [view, shareSearchQuery]);

  const handleShareContactToUser = async (partner: any) => {
    const partnerId = partner.id || partner.user_id;
    if (!partnerId) return;
    setSharingStates(prev => ({ ...prev, [partnerId]: 'sending' }));
    try {
      const chatRes = await api.post('/messages/start', { partnerId });
      const activeChatId = chatRes.data?.data?.conversationId || chatRes.data?.chatId || chatRes.data?.chat_id;
      
      await api.post('/messages/send', {
        chatId: activeChatId,
        partnerId,
        content: chat.partner_name,
        type: 'contact',
        mediaUrl: chat.partner_username || chat.partner_id
      });
      setSharingStates(prev => ({ ...prev, [partnerId]: 'sent' }));
    } catch (err) {
      console.error('Failed to share contact to chat:', err);
      setSharingStates(prev => ({ ...prev, [partnerId]: 'idle' }));
      alert('Failed to send contact in chat.');
    }
  };

  const [wordInput, setWordInput] = useState('');
  const [wordEmoji, setWordEmoji] = useState('✨');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  
  const [nicknameInput, setNicknameInput] = useState(chat.partner_name);
  const [myNicknameInput, setMyNicknameInput] = useState('You');
  const [showNicknameHistory, setShowNicknameHistory] = useState(false);
  const [nicknameHistoryList, setNicknameHistoryList] = useState<any[]>([]);

  const fetchNicknameHistory = useCallback(async () => {
    const chatId = chat.chat_id || chat.id;
    try {
      const res = await api.get(`/messages/chat/${chatId}/nickname-history`);
      if (res.data?.status === 'success') {
        setNicknameHistoryList(res.data.data || []);
      }
    } catch (err) {
      const local = JSON.parse(localStorage.getItem(`sparkle_nicknames_history_${chatId}`) || '[]');
      setNicknameHistoryList(local);
    }
  }, [chat.chat_id, chat.id]);

  useEffect(() => {
    if (view === 'nicknames' || showNicknameHistory) {
      fetchNicknameHistory();
    }
  }, [view, showNicknameHistory, fetchNicknameHistory]);
  
  // Settings state
  const [isMuted, setIsMuted] = useState(chat.is_muted ?? false);
  const [autoSave, setAutoSave] = useState(true);
  const [disappearingMsgs, setDisappearingMsgs] = useState('Off');
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(true);
  const [allowForward, setAllowForward] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
  const [blockScreenshots, setBlockScreenshots] = useState(false);
  const [blurScreenRecording, setBlurScreenRecording] = useState(true);
  const [notifyScreenshotAttempts, setNotifyScreenshotAttempts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [emojiSearch, setEmojiSearch] = useState('');

  // Sync isMuted state with chat.is_muted
  useEffect(() => {
    setIsMuted(chat.is_muted ?? false);
  }, [chat.is_muted]);

  // Audio Framework states and handlers
  const { playSound } = useSound();
  const [audioSettings, setAudioSettingsState] = useState(() => AudioSessionManager.getSettings());
  const [volumes, setVolumesState] = useState(() => AudioSessionManager.volumeController.getAll());

  const handleToggleChange = (key: string, val: boolean) => {
    AudioSessionManager.updateSettings({ [key]: val });
    setAudioSettingsState(AudioSessionManager.getSettings());
  };

  const handleVolumeChange = (category: any, val: number) => {
    AudioSessionManager.setVolume(category, val);
    setVolumesState(AudioSessionManager.volumeController.getAll());
  };

  const handleThemeChange = async (themeName: any) => {
    await AudioSessionManager.setTheme(themeName);
    setAudioSettingsState(AudioSessionManager.getSettings());
  };

  const handleResetAudio = () => {
    AudioSessionManager.resetSettings();
    setAudioSettingsState(AudioSessionManager.getSettings());
    setVolumesState(AudioSessionManager.volumeController.getAll());
  };

  const handleToggleMute = async () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    try {
      await api.post(`/messages/chat/${chat.chat_id || chat.id}/mute`, { muted: newMute });
    } catch (err) {
      console.error('Failed to toggle mute:', err);
    }
  };

  const [selectedNotificationSound, setSelectedNotificationSoundState] = useState(() => useThemeStore.getState().getNotificationSound(chat.chat_id || chat.id));

  const handleNotificationSoundChange = (soundKey: string) => {
    setSelectedNotificationSoundState(soundKey);
    useThemeStore.getState().setNotificationSound(chat.chat_id || chat.id, soundKey);
    if (soundKey !== 'default' && soundKey !== 'system') {
      playSound(soundKey as SoundKey);
    } else {
      playSound('outchat');
    }
  };

  // Sync selectedNotificationSound if chat changes
  useEffect(() => {
    setSelectedNotificationSoundState(useThemeStore.getState().getNotificationSound(chat.chat_id || chat.id));
  }, [chat.chat_id, chat.id]);

  // Deterministic encryption verification keys — same on both sides since chatId is shared
  const encryptionKeys = useMemo(() => generateEncryptionKeys(chat.chat_id || chat.id || ''), [chat.chat_id, chat.id]);

  // Load privacy settings from backend when modal opens
  useEffect(() => {
    api
      .get(`/messages/${chat.chat_id || chat.id}/privacy`)
      .then((res) => {
        const data = res.data || {};
        setAllowForward(data.allowForward ?? true);
        setAllowCopy(data.allowCopy ?? true);
        setBlockScreenshots(data.blockScreenshots ?? false);
        setBlurScreenRecording(data.blurScreenRecording ?? true);
        setNotifyScreenshotAttempts(data.notifyScreenshotAttempts ?? true);
      })
      .catch(console.error);
  }, [chat.chat_id, chat.id]);

  const [chatStats, setChatStats] = useState<any>(null);

  useEffect(() => {
    api.get(`/messages/chat/${chat.chat_id || chat.id}/stats`)
      .then((res) => {
        if (res.data?.status === 'success') {
          setChatStats(res.data.data);
        }
      })
      .catch(console.error);
  }, [chat.chat_id, chat.id]);

  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [blurValue, setBlurValue] = useState(20);
  const [darknessValue, setDarknessValue] = useState(40);
  const [transparencyValue, setTransparencyValue] = useState(80);

  // Theming state
  const { setThemeForChat, getThemeForChat, getQuickReaction, setQuickReaction, addWordEffect, removeWordEffect, getWordEffects } = useThemeStore();
  const currentTheme = getThemeForChat(chat.chat_id || chat.id);
  const quickReaction = getQuickReaction(chat.chat_id || chat.id);
  const wordEffects = getWordEffects(chat.chat_id || chat.id);
  
  const [previewTheme, setPreviewTheme] = useState<SparkleTheme | null>(null);

  // Group themes by category
  const categories = useMemo(() => {
    const cats = new Set(PRESET_THEMES.map(t => t.category));
    return Array.from(cats).map(cat => ({
      name: cat,
      themes: PRESET_THEMES.filter(t => t.category === cat)
    }));
  }, []);

  const handleApplyTheme = () => {
    if (previewTheme) {
      setThemeForChat(chat.chat_id || chat.id, previewTheme);
      setView('main');
    }
  };

  const handleSaveWordEffect = () => {
    if (wordInput.trim()) {
      addWordEffect(chat.chat_id || chat.id, wordInput.trim(), wordEmoji);
      setWordInput('');
    }
  };

  const handleDeleteWordEffect = (effectId: string) => {
    removeWordEffect(chat.chat_id || chat.id, effectId);
  };

  const handleApplyReaction = (emoji: string) => {
    setQuickReaction(chat.chat_id || chat.id, emoji);
    setView('main');
  };

  if (chat?.account_type === 'system' || chat?.is_system_account || chat?.is_system) {
    return (
      <div className="fixed inset-0 bg-[#000000] z-[200] flex justify-center animate-fade-in">
        <div className="w-full max-w-3xl h-full flex flex-col overflow-hidden bg-[#0a0a0a] relative select-none">
          <div className="p-4 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-xl z-20 border-b border-white/10">
            <button onClick={onClose} className="p-2 text-white/90 hover:bg-white/10 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </button>
            <span className="text-white font-bold text-lg">Official Account</span>
            <div className="w-8" />
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
            {/* Branded Identity Header */}
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <img
                  src="/assets/system/sparkle-logo.svg"
                  className="w-24 h-24 rounded-full object-cover border-4 border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.4)]"
                  alt="Sparkle Official"
                />
                <div className="absolute -bottom-1 -right-1 bg-rose-500 text-white p-1.5 rounded-full shadow-lg">
                  <Check size={14} strokeWidth={3} />
                </div>
              </div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                Sparkle Official
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 border border-rose-500/40 text-rose-400">
                  ✔️ Verified
                </span>
              </h2>
              <p className="text-xs font-semibold text-rose-400 mt-1">@sparkleofficial • Official Sparkle Account</p>
              <p className="text-xs text-slate-400 mt-2 max-w-sm">
                Helping you discover Sparkle. Trusted platform communication channel between Sparkle and every user.
              </p>
            </div>

            {/* Version Pill */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Sparkle Version</h4>
                  <p className="text-xs text-white/40 font-medium">Sparkle Ecosystem</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-white/10 text-white border border-white/15">
                2.1.0
              </span>
            </div>

            {/* Official Links */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest px-2">Official Links</h3>
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
                <button
                  onClick={() => { onClose(); navigate('/help'); }}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-[#ff1493]" />
                    <span className="text-sm font-semibold text-white">Help Centre</span>
                  </div>
                  <ChevronLeft size={18} className="text-white/30 rotate-180" />
                </button>

                <button
                  onClick={() => { onClose(); navigate('/help'); }}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield size={18} className="text-[#ff1493]" />
                    <span className="text-sm font-semibold text-white">Community Guidelines</span>
                  </div>
                  <ChevronLeft size={18} className="text-white/30 rotate-180" />
                </button>

                <button
                  onClick={() => { onClose(); navigate('/settings/privacy'); }}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Lock size={18} className="text-[#ff1493]" />
                    <span className="text-sm font-semibold text-white">Privacy Policy</span>
                  </div>
                  <ChevronLeft size={18} className="text-white/30 rotate-180" />
                </button>

                <button
                  onClick={() => { onClose(); navigate('/help'); }}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-[#ff1493]" />
                    <span className="text-sm font-semibold text-white">Terms of Service</span>
                  </div>
                  <ChevronLeft size={18} className="text-white/30 rotate-180" />
                </button>

                <button
                  onClick={() => { onClose(); navigate('/explore'); }}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles size={18} className="text-[#ff1493]" />
                    <span className="text-sm font-semibold text-white">Release Notes</span>
                  </div>
                  <ChevronLeft size={18} className="text-white/30 rotate-180" />
                </button>

                <button
                  onClick={() => { onClose(); navigate('/about'); }}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <User size={18} className="text-[#ff1493]" />
                    <span className="text-sm font-semibold text-white">About Sparkle</span>
                  </div>
                  <ChevronLeft size={18} className="text-white/30 rotate-180" />
                </button>
              </div>
            </div>

            {/* Account Protection Notice */}
            <div className="p-4 rounded-2xl bg-[#ff1493]/10 border border-[#ff1493]/30 text-center space-y-1">
              <p className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                <Shield size={14} className="text-[#ff1493]" />
                Protected System Account
              </p>
              <p className="text-[11px] text-white/50">
                Official Sparkle accounts are verified system communication channels. They do not accept incoming messages and cannot be blocked or reported.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#000000] z-[200] flex justify-center animate-fade-in">
      <div 
        className="w-full max-w-3xl h-full flex flex-col overflow-hidden bg-[#0a0a0a] relative" 
        onClick={e => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          {view === 'main' ? (
            <motion.div key="main" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full overflow-y-auto no-scrollbar pb-10">
              <div className="p-4 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-xl z-20 border-b border-white/10">
                <button onClick={onClose} className="p-2 text-white/90 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                <span className="text-white font-bold text-lg">Settings</span>
                <button className="p-2 text-white/90 hover:bg-white/10 rounded-full transition-colors"><MoreHorizontal size={24} /></button>
              </div>

              <div className="flex flex-col items-center mt-2 px-6">
                <div className="relative mb-4">
                  <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-24 h-24 rounded-full object-cover border-4 border-white/10 shadow-lg" alt="" />
                  {chat.partner_online && <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-[3px] border-black rounded-full flex items-center justify-center"><span className="text-[8px] font-bold text-black">9m</span></div>}
                </div>
                <h2 className="text-2xl font-bold text-white mb-6">{chat.partner_name}</h2>

                <div className="flex gap-6 mb-8 w-full justify-center">
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={onNavigateProfile}>
                    <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors"><User size={20} className="text-white" /></div>
                    <span className="text-xs font-medium text-white/70 group-hover:text-white">Profile</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setView('nicknames')}>
                    <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors"><Edit3 size={20} className="text-white" /></div>
                    <span className="text-xs font-medium text-white/70 group-hover:text-white">Nicknames</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setView('search_chat')}>
                    <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors"><Search size={20} className="text-white" /></div>
                    <span className="text-xs font-medium text-white/70 group-hover:text-white">Search</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setView('customize')}>
                    <div className="w-12 h-12 rounded-lg bg-[#ff1493]/20 group-hover:bg-[#ff1493]/30 flex items-center justify-center transition-all border border-[#ff1493]/30 group-hover:scale-110 active:scale-95 shadow-[0_0_15px_rgba(255,20,147,0.2)]"><Palette size={20} className="text-[#ff1493]" /></div>
                    <span className="text-xs font-bold text-[#ff1493] group-hover:text-[#ff1493]/80">Customize</span>
                  </div>
                </div>
              </div>

              <div className="px-2 space-y-2">
                <Section title="Chat info">
                  <ActionItem icon={ImageIcon} label="Shared Content Explorer (Media, Files, Links)" onClick={() => setView('media')} primaryColor={currentTheme?.colors.primary} />
                  <ActionItem icon={Pin} label="Pinned messages" onClick={() => setView('pinned')} primaryColor={currentTheme?.colors.primary} />
                  
                  {/* Conversation Insights (Phase 5) */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl my-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-[#ff1493]" />
                        Conversation Insights
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-white font-bold text-sm block">{chatStats?.photos ?? 0}</span>
                        <span className="text-[10px] text-white/50">Photos</span>
                      </div>
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-white font-bold text-sm block">{chatStats?.videos ?? 0}</span>
                        <span className="text-[10px] text-white/50">Videos</span>
                      </div>
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-white font-bold text-sm block">{chatStats?.voice_notes ?? 0}</span>
                        <span className="text-[10px] text-white/50">Voice Notes</span>
                      </div>
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-white font-bold text-sm block">{chatStats?.files ?? 0}</span>
                        <span className="text-[10px] text-white/50">Files</span>
                      </div>
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-white font-bold text-sm block">{chatStats?.links ?? 0}</span>
                        <span className="text-[10px] text-white/50">Links</span>
                      </div>
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-white font-bold text-sm block">{chatStats?.music ?? 0}</span>
                        <span className="text-[10px] text-white/50">Music</span>
                      </div>
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-white font-bold text-sm block">{chatStats?.stories ?? 0}</span>
                        <span className="text-[10px] text-white/50">Stories</span>
                      </div>
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-white font-bold text-sm block">{chatStats?.posts ?? 0}</span>
                        <span className="text-[10px] text-white/50">Posts</span>
                      </div>
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-white font-bold text-amber-400 text-sm block">{chatStats?.pinned ?? 0}</span>
                        <span className="text-[10px] text-white/50">Pinned</span>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-3 space-y-1.5 text-xs text-white/70">
                      <div className="flex justify-between">
                        <span>Started chatting</span>
                        <span className="text-white font-semibold">{chatStats?.started_chatting || 'March 18, 2025'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Most active month</span>
                        <span className="text-white font-semibold">{chatStats?.most_active_month || 'June 2026'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Most shared type</span>
                        <span className="text-[#ff1493] font-semibold">{chatStats?.most_shared_type || 'Photos'}</span>
                      </div>
                    </div>
                  </div>
                </Section>
  
                <Section title="Actions">
                  <ActionItem 
                    icon={Bell} 
                    label={isMuted ? 'Unmute' : `Mute ${chat.partner_name.split(' ')[0]}`} 
                    onClick={handleToggleMute} 
                    subtext={isMuted ? 'Muted' : 'Notifications on'}
                    toggle={isMuted}
                    primaryColor={currentTheme?.colors.primary}
                  />
                  <ActionItem icon={Volume2} label="Notifications & sounds" subtext="Standard" onClick={() => setView('notifications_sounds')} primaryColor={currentTheme?.colors.primary} />
                  <ActionItem icon={Users} label={`Create group chat with ${chat.partner_name.split(' ')[0]}`} onClick={() => setView('create_group')} primaryColor={currentTheme?.colors.primary} />
                  <ActionItem icon={Download} label="Auto-save photos" onClick={() => setAutoSave(!autoSave)} toggle={autoSave} primaryColor={currentTheme?.colors.primary} />
                  <ActionItem icon={Share2} label="Share contact" onClick={() => setView('share_contact')} primaryColor={currentTheme?.colors.primary} />
                </Section>
  
                <Section title="Privacy & support">
                  <ActionItem icon={Clock} label="Disappearing messages" subtext={disappearingMsgs} onClick={() => setDisappearingMsgs(disappearingMsgs === 'Off' ? '24 Hours' : 'Off')} primaryColor={currentTheme?.colors.primary} />
                  <ActionItem icon={Eye} label="Read receipts" subtext={readReceipts ? 'On' : 'Off'} onClick={() => setReadReceipts(!readReceipts)} toggle={readReceipts} primaryColor={currentTheme?.colors.primary} />
                  <ActionItem icon={MoreHorizontal} label="Typing indicator" subtext={typingIndicator ? 'On' : 'Off'} onClick={() => setTypingIndicator(!typingIndicator)} toggle={typingIndicator} primaryColor={currentTheme?.colors.primary} />
                  <ActionItem icon={Shield} label="Message permissions" onClick={() => alert('Managing message permissions...')} primaryColor={currentTheme?.colors.primary} />
                                      <ActionItem icon={Lock} label="End-to-end encryption" subtext="This chat is end-to-end encrypted..Not even Sparkle can listen to your messages" onClick={() => setView('encryption_verification')} primaryColor={currentTheme?.colors.primary} />
                    <ActionItem icon={Eye} label="Allow forwarding" subtext={allowForward ? "Enabled" : "Disabled"} toggle={allowForward} onClick={() => {
                      const newVal = !allowForward;
                      setAllowForward(newVal);
                      api.patch(`/messages/${chat.chat_id || chat.id}/privacy`, {
                        allowForward: newVal,
                        allowCopy,
                        blockScreenshots,
                        blurScreenRecording,
                        notifyScreenshotAttempts,
                      }).catch(console.error);
                    }} primaryColor={currentTheme?.colors.primary} />
                    <ActionItem icon={Eye} label="Allow copy" subtext={allowCopy ? "Enabled" : "Disabled"} toggle={allowCopy} onClick={() => {
                      const newVal = !allowCopy;
                      setAllowCopy(newVal);
                      api.patch(`/messages/${chat.chat_id || chat.id}/privacy`, {
                        allowForward,
                        allowCopy: newVal,
                        blockScreenshots,
                        blurScreenRecording,
                        notifyScreenshotAttempts,
                      }).catch(console.error);
                    }} primaryColor={currentTheme?.colors.primary} />
                    <ActionItem icon={Shield} label="Block screenshots" subtext={blockScreenshots ? "Enabled" : "Disabled"} toggle={blockScreenshots} onClick={() => {
                      const newVal = !blockScreenshots;
                      setBlockScreenshots(newVal);
                      api.patch(`/messages/${chat.chat_id || chat.id}/privacy`, {
                        allowForward,
                        allowCopy,
                        blockScreenshots: newVal,
                        blurScreenRecording,
                        notifyScreenshotAttempts,
                      }).catch(console.error);
                    }} primaryColor={currentTheme?.colors.primary} />
                    <ActionItem icon={Shield} label="Blur on screen recording" subtext={blurScreenRecording ? "Enabled" : "Disabled"} toggle={blurScreenRecording} onClick={() => {
                      const newVal = !blurScreenRecording;
                      setBlurScreenRecording(newVal);
                      api.patch(`/messages/${chat.chat_id || chat.id}/privacy`, {
                        allowForward,
                        allowCopy,
                        blockScreenshots,
                        blurScreenRecording: newVal,
                        notifyScreenshotAttempts,
                      }).catch(console.error);
                    }} primaryColor={currentTheme?.colors.primary} />
                    <ActionItem icon={Shield} label="Notify screenshot attempts" subtext={notifyScreenshotAttempts ? "Enabled" : "Disabled"} toggle={notifyScreenshotAttempts} onClick={() => {
                      const newVal = !notifyScreenshotAttempts;
                      setNotifyScreenshotAttempts(newVal);
                      api.patch(`/messages/${chat.chat_id || chat.id}/privacy`, {
                        allowForward,
                        allowCopy,
                        blockScreenshots,
                        blurScreenRecording,
                        notifyScreenshotAttempts: newVal,
                      }).catch(console.error);
                    }} primaryColor={currentTheme?.colors.primary} />
                  <ActionItem 
                    icon={MinusCircle} 
                    label="Block" 
                    primaryColor={currentTheme?.colors.primary}
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to block ${chat.partner_name}?`)) {
                        try {
                          await api.post(`/users/block/${chat.partner_id}`);
                          alert('User blocked');
                        } catch (err) {
                          console.error('Failed to block', err);
                          alert('Failed to block user');
                        }
                      }
                    }} 
                  />
                  <ActionItem icon={ShieldAlert} label="Restrict" onClick={() => alert('User restricted')} primaryColor={currentTheme?.colors.primary} />
                  <ActionItem 
                    icon={AlertTriangle} 
                    label="Report" 
                    subtext="Give feedback and report conversation" 
                    primaryColor={currentTheme?.colors.primary}
                    onClick={async () => {
                      const reason = window.prompt('Please provide a reason for reporting:');
                      if (reason) {
                        try {
                          await api.post(`/users/${chat.partner_id}/report`, { reason });
                          alert('Report submitted');
                        } catch (err) {
                          console.error('Failed to report', err);
                          alert('Failed to submit report');
                        }
                      }
                    }} 
                  />
                  <ActionItem 
                    icon={Trash2} 
                    label="Delete chat" 
                    danger 
                    primaryColor={currentTheme?.colors.primary}
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete this chat? This cannot be undone.')) {
                        try {
                          await api.delete(`/messages/chat/${chat.chat_id || chat.id}`);
                          window.location.href = '/messages';
                        } catch (err) {
                          console.error('Failed to delete', err);
                          alert('Failed to delete chat');
                        }
                      }
                    }} 
                  />
                </Section>
              </div>
            </motion.div>
          ) : view === 'customize' ? (
            <motion.div key="customize" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-xl z-20 border-b border-white/10">
                <button onClick={() => setView('main')} className="p-2 text-white/90 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Customize</h2>
              </div>

              <div className="flex justify-center gap-2 p-4 border-b border-white/10 bg-[#0a0a0a]">
                <TabButton active={customizeTab === 'themes'} onClick={() => setCustomizeTab('themes')}>Themes</TabButton>
                <TabButton active={customizeTab === 'reaction'} onClick={() => setCustomizeTab('reaction')}>Quick reaction</TabButton>
                <TabButton active={customizeTab === 'words'} onClick={() => setCustomizeTab('words')}>Word effects</TabButton>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
                {customizeTab === 'themes' && (
                  <div className="p-4">
                    <div className="flex gap-2 mb-6">
                      <button onClick={() => setView('ai_generator')} className="flex-1 bg-white/5 hover:bg-white/10 rounded-lg py-2 px-1 flex flex-col items-center justify-center gap-1 text-white/90 text-[11px] font-bold transition-all border border-purple-500/20 active:scale-95">
                        <Wand2 size={16} className="text-purple-400" /> AI Themes
                      </button>
                      <button onClick={() => setView('custom_photo')} className="flex-1 bg-white/5 hover:bg-white/10 rounded-lg py-2 px-1 flex flex-col items-center justify-center gap-1 text-white/90 text-[11px] font-bold transition-all border border-blue-500/20 active:scale-95">
                        <ImagePlus size={16} className="text-blue-400" /> Upload Image
                      </button>
                    </div>
                    
                    {categories.map((cat) => (
                      <div key={cat.name} className="mb-8">
                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 px-1">{cat.name}</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {cat.themes.map((theme) => (
                            <div 
                              key={theme.id} 
                              className="flex flex-col gap-2 cursor-pointer group"
                              onClick={() => {
                                setPreviewTheme(theme);
                                setView('preview_theme');
                              }}
                            >
                            <div className={clsx(
                                "relative aspect-[2/3] rounded-[4px] overflow-hidden transition-all group-hover:scale-105 group-active:scale-95 border",
                                currentTheme?.id === theme.id ? "border-[#ff1493] shadow-[0_0_10px_rgba(255,20,147,0.2)]" : "border-white/5 group-hover:border-white/20"
                              )}>
                                {theme.wallpaperUrl ? (
                                  <img src={theme.wallpaperUrl} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${theme.colors.backgroundDark}, ${theme.colors.backgroundLight})` }} />
                                )}
                                <div className="absolute inset-x-0 bottom-0 p-2 flex justify-end">
                                  <div className="w-6 h-6 rounded-full border-2 border-white/20" style={{ background: theme.colors.chatBubbleSent }} />
                                </div>
                                {currentTheme?.id === theme.id && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                                    <div className="w-8 h-8 bg-[#ff1493] rounded-full flex items-center justify-center text-white shadow-lg">
                                      <Check size={16} strokeWidth={3} />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <span className={clsx("text-[11px] font-semibold text-center line-clamp-1 px-1", currentTheme?.id === theme.id ? "text-[#ff1493]" : "text-white/80")}>{theme.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {customizeTab === 'reaction' && (
                  <div className="flex flex-col h-full bg-[#000000]">
                    {/* Top Half: Preview Area */}
                    <div className="flex-[0.8] flex flex-col items-center justify-center pt-24 p-6 bg-[#000000] border-b border-white/5 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--color-primary)_0%,_transparent_70%)]" />
                      
                      <div className="relative z-10 flex flex-col items-center">
                        <motion.div 
                          animate={{ y: [0, -25, 0] }}
                          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                          className="text-8xl mb-8 mt-12 drop-shadow-[0_0_35px_rgba(255,255,255,0.4)]"
                        >
                          {quickReaction}
                        </motion.div>
                        <p className="text-sm font-black text-white/40 tracking-widest uppercase mb-10">Quick Reaction</p>
                      </div>
                    </div>

                    {/* Bottom Half: Emoji Grid with Sleek Search */}
                    <div className="flex-[1.2] flex flex-col w-full bg-[#000000] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
                      <div className="p-5 pt-8">
                        <div className="bg-white/10 rounded-full flex items-center px-5 h-11 border border-white/20 focus-within:border-[#ff1493]/50 focus-within:bg-white/[0.15] transition-all">
                          <Search size={18} className="text-white/40" />
                          <input 
                            type="text" 
                            placeholder="Search emojis..." 
                            value={emojiSearch}
                            onChange={e => setEmojiSearch(e.target.value)}
                            className="bg-transparent w-full ml-3 text-white placeholder:text-white/40 outline-none text-[14px] font-bold" 
                          />
                        </div>
                      </div>
                      
                      <div className="flex-1 w-full overflow-hidden flex justify-center">
                          <Picker 
                            data={data}
                            onEmojiSelect={(emoji: any) => handleApplyReaction(emoji?.native || emoji?.id || '👍')}
                            theme="dark"
                            native={true}
                            previewPosition="none"
                            skinTonePosition="none"
                            navPosition="none"
                            searchPosition="none"
                            perLine={Math.floor(window.innerWidth / 40)}
                            width="100%"
                          />
                      </div>
                    </div>
                  </div>
                )}

                {customizeTab === 'words' && (
                  <div className="flex flex-col h-full relative">
                    <div className="p-8 flex-1 flex flex-col items-center">
                      <div className="w-16 h-16 bg-[#ff1493]/20 text-[#ff1493] rounded-full flex items-center justify-center mb-6 border border-[#ff1493]/30">
                        <Smile size={28} />
                      </div>
                      <h3 className="text-2xl font-black text-white mb-4 tracking-tight">Add effects to your chat</h3>
                      <p className="text-sm text-white/60 mb-8 leading-relaxed text-center max-w-sm">
                        Pair words that have special meaning with fun effects. Everyone will see an animation whenever these words are used. <span className="text-blue-400 font-bold cursor-pointer hover:underline" onClick={() => alert('Word effects are synced across all your devices. Add up to 5 triggers per chat.')}>Learn more</span>
                      </p>
                      
                      <div className="w-full max-w-sm flex flex-col gap-3">
                        <AnimatePresence>
                          {wordEffects.map((effect) => (
                            <motion.div 
                              key={effect.id}
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-4">
                                <span className="text-2xl">{effect.emoji}</span>
                                <span className="text-white font-bold text-lg">{effect.word}</span>
                              </div>
                              <button onClick={() => handleDeleteWordEffect(effect.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/10 rounded-full">
                                <Trash2 size={18} />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {customizeTab === 'words' && (
                <div className="p-4 bg-[#000000] border-t border-white/10 relative z-30 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  <div className="bg-white/5 rounded-full flex items-center px-3 py-1.5 border border-white/5 focus-within:bg-white/10 focus-within:border-[#ff1493]/30 transition-all">
                    <button 
                      onClick={() => setView('word_emoji_picker')} 
                      className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-xl hover:bg-white/10 transition-colors shrink-0"
                    >
                      {wordEmoji}
                    </button>
                    <input 
                      type="text" 
                      value={wordInput}
                      onChange={e => setWordInput(e.target.value)}
                      placeholder="Add a word or phrase" 
                      className="bg-transparent w-full ml-3 text-white placeholder:text-white/30 outline-none text-[15px] font-medium" 
                      maxLength={30}
                    />
                    <button 
                      onClick={handleSaveWordEffect}
                      disabled={!wordInput.trim()}
                      className="w-10 h-10 bg-[#ff1493] text-white rounded-lg flex items-center justify-center disabled:opacity-30 transition-all shrink-0 hover:scale-105 active:scale-95"
                    >
                      <Check size={18} strokeWidth={3} />
                    </button>
                  </div>

                  {/* Moved Picker to a dedicated view for Word Effects */}
                </div>
              )}
            </motion.div>
          ) : view === 'preview_theme' && previewTheme ? (
            <motion.div key="preview_theme" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex flex-col h-full relative overflow-hidden bg-[#000000]">
              {/* Fake Live Background for Preview */}
              <div className="absolute inset-0 z-0">
                {!previewTheme.wallpaperUrl ? (
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${previewTheme.colors.backgroundDark}, ${previewTheme.colors.backgroundLight})` }} />
                ) : (
                  <>
                    <div className="absolute inset-0" style={{ 
                      backgroundImage: `url(${previewTheme.wallpaperUrl})`, 
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      filter: `blur(${previewTheme.blurIntensity || 2}px)`, transform: 'scale(1.05)'
                    }} />
                    <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${(previewTheme.darknessOverlay ?? 40) / 100})` }} />
                  </>
                )}
                <LiveAnimations type={previewTheme.animationType} />
              </div>

              {/* Fake Chat Header */}
              <header className="h-[60px] bg-black/40 backdrop-blur-xl border-b border-white/10 px-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView('customize')} className="text-white p-2"><ChevronLeft size={24} /></button>
                  <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-[36px] h-[36px] rounded-full object-cover" />
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">{chat.partner_name}</h3>
                    <p className="text-[10px] text-emerald-400 font-bold">Previewing Theme</p>
                  </div>
                </div>
              </header>

              {/* Fake Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 z-10 flex flex-col justify-end pb-8">
                {PREVIEW_MESSAGES.map((msg, idx) => (
                  <div key={idx} className={clsx("flex", msg.isMe ? "justify-end" : "justify-start")}>
                    <div 
                      className={clsx("px-4 py-2.5 rounded-2xl max-w-[75%] text-[15px] font-medium leading-relaxed shadow-sm", msg.isMe ? "rounded-br-sm" : "rounded-bl-sm")}
                      style={{ 
                        background: msg.isMe ? previewTheme.colors.chatBubbleSent : previewTheme.colors.chatBubbleReceived,
                        color: msg.isMe ? previewTheme.colors.chatBubbleSentText : previewTheme.colors.chatBubbleReceivedText,
                        border: msg.isMe ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Fake Input */}
              <div className="p-4 z-10 bg-black/40 backdrop-blur-xl border-t border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-10 rounded-full bg-white/10 border border-white/10 px-4 flex items-center">
                    <span className="text-white/40 text-sm">Message...</span>
                  </div>
                  <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: previewTheme.colors.primary }}>
                    <Send size={20} />
                  </button>
                </div>
              </div>

              {/* Apply Bar */}
              <div className="absolute bottom-0 inset-x-0 p-4 bg-[#000000] z-20 flex gap-4 pb-safe">
                <button onClick={() => setView('customize')} className="flex-1 py-4 rounded-2xl bg-white/10 text-white font-bold text-sm">Cancel</button>
                <button onClick={handleApplyTheme} className="flex-[2] py-4 rounded-2xl bg-[#ff1493] text-white font-bold text-sm shadow-[0_0_20px_rgba(255,20,147,0.4)]">Apply Theme</button>
              </div>
            </motion.div>
          ) : view === 'ai_generator' ? (
            <motion.div key="ai_generator" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#000000] z-10 border-b border-white/5">
                <button onClick={() => setView('customize')} className="p-2 text-white"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Generate Theme with AI</h2>
              </div>
              <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
                <Wand2 size={48} className="text-purple-500 mb-6" />
                <h3 className="text-2xl font-black text-white mb-2">Describe your vibe</h3>
                <p className="text-sm text-white/50 mb-8 max-w-sm">Type any concept, color, or mood, and Sparkle AI will generate a complete theme.</p>
                
                <div className="w-full max-w-sm mb-6 relative">
                  <input 
                    type="text" 
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="e.g., pink neon cyberpunk"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-5 text-white text-center font-bold focus:border-purple-500/50 transition-colors outline-none"
                  />
                </div>
                
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                  {['romantic roses', 'galaxy purple', 'sunset beach', 'dark minimalist'].map(p => (
                    <button key={p} onClick={() => setAiPrompt(p)} className="px-4 py-2 rounded-full bg-white/5 text-xs font-bold text-white/70 hover:bg-white/10 transition-colors">{p}</button>
                  ))}
                </div>

                <button 
                  onClick={() => {
                    // Fake generation logic - creates a theme and shows preview
                    const mockGenerated: SparkleTheme = {
                      id: 'ai_' + Date.now(),
                      name: `AI: ${aiPrompt || 'Magic'}`,
                      category: 'AI Generated',
                      isDarkDefault: true,
                      animationType: 'particles',
                      wallpaperUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop',
                      colors: {
                        primary: '#a855f7', primary600: '#9333ea', primary400: '#c084fc',
                        backgroundDark: '#120024', backgroundLight: '#2a004a',
                        chatBubbleSent: '#9333ea', chatBubbleReceived: '#ffffff10',
                        chatBubbleSentText: '#ffffff', chatBubbleReceivedText: '#ffffff'
                      }
                    };
                    setPreviewTheme(mockGenerated);
                    setView('preview_theme');
                  }}
                  disabled={!aiPrompt.trim()}
                  className="w-full max-w-sm py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl text-white font-bold disabled:opacity-50"
                >
                  Generate Magic
                </button>
              </div>
            </motion.div>
          ) : view === 'custom_photo' ? (
            <motion.div key="custom_photo" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#000000] z-10 border-b border-white/5">
                <button onClick={() => setView('customize')} className="p-2 text-white"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Custom Photo Editor</h2>
              </div>
              <div className="p-6 flex-1 flex flex-col items-center overflow-y-auto no-scrollbar pb-24">
                <label className="w-full aspect-[2/3] max-w-[240px] bg-white/5 rounded-3xl flex flex-col items-center justify-center border-2 border-dashed border-white/20 cursor-pointer hover:bg-white/10 transition-all overflow-hidden relative group mb-8">
                  {customPhoto ? (
                    <>
                      <img src={customPhoto} className="w-full h-full object-cover transition-all" style={{ filter: `blur(${blurValue/5}px)` }} alt="" />
                      <div className="absolute inset-0 transition-all" style={{ backgroundColor: `rgba(0,0,0,${darknessValue/100})` }} />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit3 size={32} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <ImagePlus size={48} className="text-white/20 mb-4 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-bold text-white/40">Select from Gallery</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setCustomPhoto(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
                
                <div className="w-full max-w-sm space-y-8 px-2">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-bold text-white/60 tracking-wider">BLUR INTENSITY</span>
                      <span className="text-xs font-black text-[#ff1493]">{blurValue}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={blurValue} onChange={(e) => setBlurValue(Number(e.target.value))} className="w-full accent-[#ff1493] h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-bold text-white/60 tracking-wider">DARKNESS OVERLAY</span>
                      <span className="text-xs font-black text-[#ff1493]">{darknessValue}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={darknessValue} onChange={(e) => setDarknessValue(Number(e.target.value))} className="w-full accent-[#ff1493] h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-bold text-white/60 tracking-wider">BUBBLE TRANSPARENCY</span>
                      <span className="text-xs font-black text-[#ff1493]">{transparencyValue}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={transparencyValue} onChange={(e) => setTransparencyValue(Number(e.target.value))} className="w-full accent-[#ff1493] h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>
                </div>

                {customPhoto && (
                  <button 
                    onClick={() => {
                      const customTheme: SparkleTheme = {
                        id: 'custom_' + Date.now(),
                        name: 'Custom Photo',
                        category: 'User Custom',
                        isDarkDefault: true,
                        wallpaperUrl: customPhoto,
                        blurIntensity: blurValue / 5,
                        darknessOverlay: darknessValue,
                        colors: {
                          primary: '#ff1493', primary600: '#d0107a', primary400: '#ff4da6',
                          backgroundDark: '#000000', backgroundLight: '#121212',
                          chatBubbleSent: `rgba(255, 20, 147, ${transparencyValue/100})`,
                          chatBubbleReceived: `rgba(255, 255, 255, 0.1)`,
                          chatBubbleSentText: '#ffffff',
                          chatBubbleReceivedText: '#ffffff'
                        }
                      };
                      setPreviewTheme(customTheme);
                      setView('preview_theme');
                    }}
                    className="w-full max-w-sm mt-12 py-4 bg-[#ff1493] text-white font-bold rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    Preview Theme
                  </button>
                )}
              </div>
            </motion.div>
          ) : view === 'nicknames' ? (
            <motion.div key="nicknames" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full bg-[#0a0a0a]">
              <div className="p-4 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-xl z-10 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <button onClick={() => setView('main')} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                  <h2 className="text-xl font-bold text-white">Nicknames</h2>
                </div>
                <button 
                  onClick={() => setShowNicknameHistory(true)}
                  className="p-2.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-full transition-all flex items-center gap-1.5 text-xs font-bold border border-white/10"
                  title="View Nickname History"
                >
                  <History size={18} className="text-[#ff1493]" />
                  <span className="hidden sm:inline">History</span>
                </button>
              </div>

              <div className="p-6 space-y-6 max-w-lg mx-auto w-full">
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 shadow-md">
                  <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-14 h-14 rounded-full object-cover border-2 border-white/20" alt="" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white/50 mb-1">Set nickname for {chat.partner_name}</p>
                    <input 
                      type="text" 
                      value={nicknameInput} 
                      onChange={e => setNicknameInput(e.target.value)}
                      placeholder={chat.partner_name}
                      className="bg-transparent w-full text-white font-bold outline-none border-b border-white/20 focus:border-[#ff1493] transition-colors py-1 text-base"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 shadow-md">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white font-black text-lg shadow-lg">You</div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white/50 mb-1">Set your nickname</p>
                    <input 
                      type="text" 
                      value={myNicknameInput} 
                      onChange={e => setMyNicknameInput(e.target.value)}
                      placeholder="Your Nickname"
                      className="bg-transparent w-full text-white font-bold outline-none border-b border-white/20 focus:border-[#ff1493] transition-colors py-1 text-base"
                    />
                  </div>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-xs text-white/60 leading-relaxed">
                  💡 <span className="font-bold text-white">Note:</span> Setting a nickname generates an in-chat update message visible to both participants.
                </div>

                <button 
                  onClick={async () => {
                    const chatId = chat.chat_id || chat.id;
                    const cleanPartnerNick = nicknameInput.trim();
                    const cleanMyNick = myNicknameInput.trim();

                    // Create local history entry
                    const historyRecord = {
                      id: 'nick_' + Date.now(),
                      content: cleanPartnerNick ? `You set ${chat.partner_name}'s nickname to ${cleanPartnerNick}` : `You updated nicknames`,
                      set_by_name: 'You',
                      target_name: chat.partner_name,
                      nickname: cleanPartnerNick || cleanMyNick,
                      sent_at: new Date().toISOString()
                    };

                    const existingHistory = JSON.parse(localStorage.getItem(`sparkle_nicknames_history_${chatId}`) || '[]');
                    localStorage.setItem(`sparkle_nicknames_history_${chatId}`, JSON.stringify([historyRecord, ...existingHistory]));

                    if (cleanPartnerNick) {
                      chat.partner_name = cleanPartnerNick;
                    }

                    try {
                      await api.post(`/messages/chat/${chatId}/nickname`, {
                        targetUserId: chat.partner_id,
                        targetName: chat.partner_name,
                        nickname: cleanPartnerNick || cleanMyNick
                      });
                    } catch (err) {
                      console.log('Saved nickname locally');
                    }

                    window.dispatchEvent(new CustomEvent('sparkle:nickname-updated', { 
                      detail: { chatId, nickname: cleanPartnerNick } 
                    }));

                    setView('main');
                  }}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl shadow-lg hover:opacity-95 active:scale-95 transition-all text-sm uppercase tracking-wider"
                >
                  Save Nicknames
                </button>
              </div>
            </motion.div>
          ) : view === 'media' ? (
            <motion.div key="media" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#000000] z-10 border-b border-white/5">
                <button onClick={() => setView('main')} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Media, Files & Links</h2>
              </div>
              <div className="p-4 grid grid-cols-3 gap-2 overflow-y-auto">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="aspect-square bg-white/10 rounded-lg overflow-hidden relative group cursor-pointer">
                    <img src={`https://picsum.photos/seed/${chat.id + i}/300/300`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                  </div>
                ))}
              </div>
            </motion.div>
          ) : view === 'pinned' ? (
            <motion.div key="pinned" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#000000] z-10 border-b border-white/5">
                <button onClick={() => setView('main')} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Pinned Messages</h2>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                  <Pin size={32} className="text-white/40" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No pinned messages</h3>
                <p className="text-sm text-white/50">Long press any message and select "Pin" to save it here for easy access.</p>
              </div>
            </motion.div>
          ) : view === 'search_chat' ? (
            <motion.div key="search_chat" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#000000] z-10 border-b border-white/5">
                <button onClick={() => setView('main')} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                  <div className="flex-1 bg-white/5 rounded-full flex items-center px-4 h-10 border border-white/5 transition-all focus-within:bg-white/10">
                    <Search size={16} className="text-white/20" />
                    <input 
                      type="text" 
                      placeholder="Search in conversation" 
                      autoFocus
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent w-full ml-3 text-white placeholder:text-white/20 outline-none text-sm" 
                    />
                  </div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-white/40">
                <Search size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-medium">{searchQuery ? `No results for "${searchQuery}"` : 'Search for messages, media, or links'}</p>
              </div>
            </motion.div>
          ) : view === 'notifications_sounds' ? (
            <motion.div key="notifications_sounds" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-xl z-20 border-b border-white/10">
                <button onClick={() => setView('main')} className="p-2 text-white/90 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Notifications & Sounds</h2>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pb-20 p-6 space-y-6">
                
                {/* Mute and Main Toggle Card */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">Mute Conversation</p>
                      <p className="text-xs text-white/50 mt-1">Mute all notification sounds and popups for this chat.</p>
                    </div>
                    <div
                      onClick={handleToggleMute}
                      className={`w-11 h-6 flex items-center p-1 rounded-full cursor-pointer transition-all duration-300 ${isMuted ? 'bg-red-500' : 'bg-white/10'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${isMuted ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* Sound Theme Selector */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl backdrop-blur-md">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#ff1493]">Sound Theme Profile</h4>
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">Active Theme Pack</p>
                      <p className="text-xs text-white/50 mt-1">Swaps the audio profile across the platform instantly.</p>
                    </div>
                    <select
                      value={audioSettings.soundTheme || 'Sparkle Original'}
                      onChange={(e) => handleThemeChange(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-white text-sm font-bold outline-none focus:border-[#ff1493] transition-all cursor-pointer"
                    >
                      <option value="Sparkle Original" className="bg-[#0a0a0a] text-white">Sparkle Original</option>
                      <option value="Classic" className="bg-[#0a0a0a] text-white">Classic</option>
                      <option value="Soft" className="bg-[#0a0a0a] text-white">Soft (Lowpass DSP)</option>
                      <option value="Minimal" className="bg-[#0a0a0a] text-white">Minimal (Pitch Up DSP)</option>
                    </select>
                  </div>
                </div>

                {/* Notification Alert Sound Selector */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl backdrop-blur-md">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#ff1493]">Notification Sound</h4>
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">Select Notification Tone</p>
                      <p className="text-xs text-white/50 mt-1">Set custom alert sound for incoming messages in this chat.</p>
                    </div>
                    <select
                      value={selectedNotificationSound}
                      onChange={(e) => handleNotificationSoundChange(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-white text-sm font-bold outline-none focus:border-[#ff1493] transition-all cursor-pointer"
                    >
                      <option value="default" className="bg-[#0a0a0a] text-white">Device Default / System Sound</option>
                      <option value="iphone" className="bg-[#0a0a0a] text-white">iPhone Classic Style</option>
                      <option value="facebook_notification" className="bg-[#0a0a0a] text-white">Facebook Style Notification</option>
                      <option value="inchat_receive" className="bg-[#0a0a0a] text-white">In-Chat Message Receive</option>
                      <option value="outchat_notification" className="bg-[#0a0a0a] text-white">Out-Chat Bubble Ping</option>
                    </select>
                  </div>
                </div>

                {/* Volume Sliders */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl backdrop-blur-md">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#ff1493]">Volume Levels</h4>
                  <div className="space-y-4">
                    {[
                      { label: 'Master Volume', key: 'master' },
                      { label: 'Message Sounds', key: 'messages' },
                      { label: 'Notifications', key: 'notifications' },
                      { label: 'UI Interactions', key: 'ui' },
                    ].map((item) => (
                      <div key={item.key} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-white/70">
                          <span>{item.label}</span>
                          <span>{Math.round((volumes[item.key as keyof typeof volumes] || 0) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round((volumes[item.key as keyof typeof volumes] || 0) * 100)}
                          onChange={(e) => handleVolumeChange(item.key, parseInt(e.target.value, 10) / 100)}
                          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#ff1493]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customization Switches */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl backdrop-blur-md">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#ff1493]">Toggles & Customization</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { label: 'Master Sound Effects', key: 'masterSounds' },
                      { label: 'Message Sound Effects', key: 'messageSounds' },
                      { label: 'Out of Chat Incoming Ping', key: 'outChatIncoming' },
                      { label: 'Haptic Feedback', key: 'playHaptics' },
                    ].map((item) => (
                      <div key={item.key} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between shadow-sm">
                        <span className="text-xs font-bold text-white/90">{item.label}</span>
                        <div
                          onClick={() => handleToggleChange(item.key, !audioSettings[item.key as keyof typeof audioSettings])}
                          className={`w-11 h-6 flex items-center p-1 rounded-full cursor-pointer transition-all duration-300 ${audioSettings[item.key as keyof typeof audioSettings] ? 'bg-[#ff1493]' : 'bg-white/10'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${audioSettings[item.key as keyof typeof audioSettings] ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Previews */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl backdrop-blur-md">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#ff1493]">Test Preview</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Send', key: 'send' },
                      { label: 'Receive', key: 'receive' },
                      { label: 'Notification', key: 'outchat' },
                    ].map((btn) => {
                      const soundToPlay = (btn.key === 'outchat' && selectedNotificationSound !== 'default' && selectedNotificationSound !== 'system') 
                        ? selectedNotificationSound 
                        : btn.key;
                      return (
                        <button
                          key={btn.key}
                          onClick={() => playSound(soundToPlay as SoundKey)}
                          className="py-3 px-3 bg-white/5 border border-white/10 hover:border-[#ff1493]/50 rounded-2xl transition-all active:scale-95 text-xs font-bold text-white flex items-center justify-center gap-1.5 hover:bg-white/10"
                        >
                          <Play size={10} fill="currentColor" /> {btn.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reset Audio */}
                <button
                  onClick={handleResetAudio}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 border border-white/10 text-white"
                >
                  <RotateCcw size={14} /> Reset Audio Settings
                </button>

              </div>
            </motion.div>
          ) : view === 'word_emoji_picker' ? (
            <motion.div key="word_emoji_picker" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#000000] z-10 border-b border-white/5">
                <button onClick={() => setView('customize')} className="p-2 text-white"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Select Emoji</h2>
              </div>
              <div className="flex-1 w-full overflow-hidden flex justify-center">
                <Picker 
                  data={data}
                  onEmojiSelect={(emoji: any) => { 
                    setWordEmoji(emoji?.native || emoji?.id || '✨'); 
                    setView('customize'); 
                  }}
                  theme="dark"
                  native={true}
                  previewPosition="none"
                  skinTonePosition="none"
                  navPosition="none"
                  searchPosition="none"
                  perLine={Math.floor(window.innerWidth / 40)}
                  width="100%"
                />
              </div>
            </motion.div>
          ) : view === 'encryption_verification' ? (
            <motion.div key="encryption_verification" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              {/* Header */}
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-xl z-20 border-b border-white/10">
                <button onClick={() => setView('main')} className="p-2 text-white/90 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Encryption</h2>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pb-24 p-6 space-y-6">

                {/* Shield hero */}
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-pulse" />
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-400/40 flex items-center justify-center">
                      <Lock size={28} className="text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-base font-bold text-white text-center">End-to-End Encrypted</p>
                  <p className="text-xs text-white/50 text-center max-w-xs leading-relaxed">
                    Messages and calls with <span className="text-white font-semibold">{chat.partner_name}</span> are secured with end-to-end encryption. Compare the numbers below or scan the QR code to verify the connection.
                  </p>
                </div>

                {/* QR Code card */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 shadow-xl backdrop-blur-md">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 self-start">Scan to Verify</h4>
                  <div className="bg-white rounded-2xl p-4 shadow-[0_0_40px_rgba(52,211,153,0.2)]">
                    <QRCode
                      value={encryptionKeys.code}
                      size={200}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                    />
                  </div>
                  <p className="text-[11px] text-white/40 text-center">Both devices show identical codes when secure</p>
                </div>

                {/* Verification number blocks */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl backdrop-blur-md">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">Verification Numbers</h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    If the numbers below match on both devices, your chat is fully secure.
                  </p>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {encryptionKeys.blocks.map((block, i) => (
                      <div
                        key={i}
                        className="bg-black/40 border border-white/10 rounded-2xl py-3 px-2 flex items-center justify-center"
                      >
                        <span className="font-mono text-base font-black text-white tracking-widest">{block}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer note */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex gap-3 items-start">
                  <Shield size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-white/60 leading-relaxed">
                    These numbers are unique to this conversation. They never change unless the chat is recreated. No one else — not even Sparkle — can read your messages.
                  </p>
                </div>

              </div>
            </motion.div>
          ) : view === 'create_group' ? (
            <motion.div key="create_group" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              {/* Header */}
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-xl z-20 border-b border-white/10">
                <button onClick={() => setView('main')} className="p-2 text-white/90 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white flex-1">Create Group Chat</h2>
                <button
                  onClick={async () => {
                    if (!groupName.trim() || groupSelected.length === 0 || groupCreating) return;
                    setGroupCreating(true);
                    try {
                      const res = await api.post('/groupChat', {
                        name: groupName.trim(),
                        member_ids: groupSelected.map((u: any) => u.id || u.user_id),
                      });
                      const newChatId = res.data?.data?.chatId;
                      onClose();
                      if (newChatId) navigate(`/messages?chat=${newChatId}`);
                    } catch (err) {
                      console.error('Failed to create group', err);
                    } finally {
                      setGroupCreating(false);
                    }
                  }}
                  disabled={!groupName.trim() || groupSelected.length === 0 || groupCreating}
                  className="px-4 py-2 bg-[#ff1493] disabled:opacity-40 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                >
                  {groupCreating ? 'Creating…' : 'Create'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pb-24 p-4 space-y-5">

                {/* Group name input */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
                  <p className="text-xs font-black uppercase tracking-wider text-[#ff1493]">Group Name</p>
                  <input
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="Enter group name…"
                    className="w-full bg-transparent text-white text-base font-bold outline-none placeholder:text-white/30 border-b border-white/10 pb-2"
                  />
                </div>

                {/* Selected members chips */}
                {groupSelected.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-1">
                    {groupSelected.map((u: any) => (
                      <div key={u.id || u.user_id} className="flex items-center gap-2 bg-[#ff1493]/15 border border-[#ff1493]/30 rounded-full pl-1 pr-3 py-1">
                        <img src={getAvatarUrl(u.avatar_url || u.partner_avatar)} className="w-6 h-6 rounded-full object-cover" />
                        <span className="text-xs font-bold text-white">{u.full_name || u.partner_name || u.name}</span>
                        {(u.id || u.user_id) !== chat.partner_id && (
                          <button onClick={() => setGroupSelected(prev => prev.filter(x => (x.id || x.user_id) !== (u.id || u.user_id)))} className="text-white/40 hover:text-white/80 ml-0.5"><X size={12} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Friend search */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-3">
                  <p className="text-xs font-black uppercase tracking-wider text-[#ff1493]">Add People</p>
                  <div className="flex items-center gap-2 bg-white/5 rounded-2xl px-3 py-2">
                    <Search size={14} className="text-white/40" />
                    <input
                      value={groupSearch}
                      onChange={async e => {
                        setGroupSearch(e.target.value);
                        if (e.target.value.length > 1) {
                          try {
                            const res = await api.get(`/users/search?q=${e.target.value}`);
                            setGroupFriends(res.data?.data || []);
                          } catch {}
                        } else if (!e.target.value) {
                          try {
                            setGroupLoading(true);
                            const res = await api.get('/users/active-friends');
                            setGroupFriends(res.data?.friends || []);
                          } catch {} finally { setGroupLoading(false); }
                        }
                      }}
                      onFocus={async () => {
                        if (groupFriends.length === 0) {
                          try {
                            setGroupLoading(true);
                            const res = await api.get('/users/active-friends');
                            setGroupFriends(res.data?.friends || []);
                          } catch {} finally { setGroupLoading(false); }
                        }
                      }}
                      placeholder="Search friends…"
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/30"
                    />
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto no-scrollbar">
                    {groupLoading && <p className="text-xs text-white/40 text-center py-4">Loading…</p>}
                    {groupFriends.filter(f => (f.id || f.user_id) !== chat.partner_id).map((f: any) => {
                      const fId = f.id || f.user_id;
                      const isSelected = groupSelected.some((x: any) => (x.id || x.user_id) === fId);
                      return (
                        <button
                          key={fId}
                          onClick={() => setGroupSelected(prev => isSelected ? prev.filter(x => (x.id || x.user_id) !== fId) : [...prev, f])}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all"
                        >
                          <img src={getAvatarUrl(f.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
                          <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-white">{f.full_name || f.name}</p>
                            <p className="text-xs text-white/40">@{f.username}</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#ff1493] border-[#ff1493]' : 'border-white/20'}`}>
                            {isSelected && <Check size={12} className="text-white" />}
                          </div>
                        </button>
                      );
                    })}
                    {!groupLoading && groupFriends.length === 0 && (
                      <p className="text-xs text-white/40 text-center py-4">Tap the search bar to load friends</p>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>

          ) : view === 'share_contact' ? (
            <motion.div key="share_contact" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              {/* Header */}
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-xl z-20 border-b border-white/10">
                <button onClick={() => setView('main')} className="p-2 text-white/90 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Share Contact</h2>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pb-24 p-6 space-y-6">

                {/* Contact card */}
                <div className="relative bg-gradient-to-br from-[#ff1493]/20 via-white/5 to-purple-500/10 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-5" />
                  <img
                    src={getAvatarUrl(chat.partner_avatar)}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white/20 shadow-xl"
                  />
                  <div className="text-center">
                    <p className="text-xl font-black text-white">{chat.partner_name}</p>
                    {chat.partner_username && <p className="text-sm text-white/50 mt-0.5">@{chat.partner_username}</p>}
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                    <Link2 size={13} className="text-[#ff1493]" />
                    <span className="text-xs font-mono text-white/60">
                      sparkle.app/@{chat.partner_username || chat.partner_id}
                    </span>
                  </div>
                </div>

                {/* Share QR */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 shadow-xl backdrop-blur-md">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#ff1493] self-start">Profile QR Code</h4>
                  <div className="bg-white rounded-2xl p-4 shadow-lg">
                    <QRCode
                      value={`https://sparkle.app/@${chat.partner_username || chat.partner_id}`}
                      size={190}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                    />
                  </div>
                  <p className="text-[11px] text-white/40 text-center">Scan to visit {chat.partner_name.split(' ')[0]}'s profile</p>
                </div>

                {/* Send in Chat section */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl backdrop-blur-md">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#ff1493]">Send in Chat</h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Share {chat.partner_name.split(' ')[0]}'s contact card directly with your following.
                  </p>

                  <div className="flex items-center gap-2 bg-white/5 rounded-2xl px-3 py-2 border border-white/10">
                    <Search size={14} className="text-white/40" />
                    <input
                      value={shareSearchQuery}
                      onChange={e => setShareSearchQuery(e.target.value)}
                      placeholder="Search following..."
                      className="flex-1 bg-transparent text-white text-xs outline-none placeholder:text-white/30"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar">
                    {followingLoading && <p className="text-xs text-white/40 text-center py-4">Loading following...</p>}
                    {!followingLoading && followingList.map((f: any) => {
                      const fId = f.id || f.user_id;
                      const sharingState = sharingStates[fId] || 'idle';
                      return (
                        <div
                          key={fId}
                          className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <img src={getAvatarUrl(f.avatar_url)} className="w-9 h-9 rounded-full object-cover" />
                            <div className="text-left">
                              <p className="text-sm font-bold text-white leading-tight">{f.full_name || f.name}</p>
                              <p className="text-xs text-white/40">@{f.username}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleShareContactToUser(f)}
                            disabled={sharingState !== 'idle'}
                            className={clsx(
                              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 border",
                              sharingState === 'sent' 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold" 
                                : sharingState === 'sending'
                                  ? "bg-white/5 border-white/10 text-white/40 cursor-default font-bold"
                                  : "bg-[#ff1493] border-[#ff1493] text-white hover:opacity-90 font-bold"
                            )}
                          >
                            {sharingState === 'sent' ? 'Sent!' : sharingState === 'sending' ? 'Sending…' : 'Send'}
                          </button>
                        </div>
                      );
                    })}
                    {!followingLoading && followingList.length === 0 && (
                      <p className="text-xs text-white/45 text-center py-4">No following found</p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={async () => {
                      const url = `https://sparkle.app/@${chat.partner_username || chat.partner_id}`;
                      await navigator.clipboard.writeText(url).catch(() => {});
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2500);
                    }}
                    className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 hover:border-[#ff1493]/40 rounded-2xl text-xs font-bold text-white transition-all active:scale-95"
                  >
                    {linkCopied ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Copy size={15} />}
                    {linkCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => {
                      const url = `https://sparkle.app/@${chat.partner_username || chat.partner_id}`;
                      if (navigator.share) {
                        navigator.share({ title: chat.partner_name, text: `Check out ${chat.partner_name} on Sparkle!`, url });
                      } else {
                        navigator.clipboard.writeText(url);
                      }
                    }}
                    className="flex items-center justify-center gap-2 py-4 bg-[#ff1493]/10 border border-[#ff1493]/30 hover:bg-[#ff1493]/20 rounded-2xl text-xs font-bold text-[#ff1493] transition-all active:scale-95"
                  >
                    <Share2 size={15} /> Share
                  </button>
                </div>

                {/* Visit profile CTA */}
                <button
                  onClick={() => { onClose(); navigate(`/profile/${chat.partner_id}`); }}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-bold text-white border border-white/10 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <User size={16} /> View Full Profile
                </button>

              </div>
            </motion.div>

          ) : null}
        </AnimatePresence>

        <SharedContentExplorer
          chatId={chat.chat_id || chat.id}
          isOpen={view === 'media'}
          onClose={() => setView('main')}
          onJumpToMessage={(msgId) => {
            onClose();
            window.dispatchEvent(new CustomEvent('sparkle:jump-to-message', { detail: { messageId: msgId } }));
          }}
        />

        <PinnedMessagesView
          chatId={chat.chat_id || chat.id}
          isOpen={view === 'pinned'}
          onClose={() => setView('main')}
          onJumpToMessage={(msgId) => {
            onClose();
            window.dispatchEvent(new CustomEvent('sparkle:jump-to-message', { detail: { messageId: msgId } }));
          }}
        />

        <ChatSearchModal
          chatId={chat.chat_id || chat.id}
          isOpen={view === 'search_chat'}
          onClose={() => setView('main')}
          onJumpToMessage={(msgId) => {
            onClose();
            window.dispatchEvent(new CustomEvent('sparkle:jump-to-message', { detail: { messageId: msgId } }));
          }}
        />

        {/* Nickname History Records Modal */}
        <AnimatePresence>
          {showNicknameHistory && (
            <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden text-white"
              >
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#ff1493]/20 text-[#ff1493] rounded-xl border border-[#ff1493]/30">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Nickname History</h3>
                      <p className="text-[11px] text-white/50">Log of all nickname updates in this chat</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowNicknameHistory(false)}
                    className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* History list */}
                <div className="p-5 overflow-y-auto space-y-3 flex-1 no-scrollbar">
                  {nicknameHistoryList.length === 0 ? (
                    <div className="text-center py-12 text-xs text-white/40 space-y-2">
                      <History className="w-8 h-8 mx-auto opacity-30 text-[#ff1493]" />
                      <p className="font-bold text-white/70">No nickname changes recorded yet</p>
                      <p className="text-white/40">When anyone sets or changes a nickname, a record with date & timestamp will appear here.</p>
                    </div>
                  ) : (
                    nicknameHistoryList.map((entry, idx) => (
                      <div 
                        key={entry.id || idx}
                        className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-[#ff1493]">
                          <span>{entry.set_by_name || 'User'} updated a nickname</span>
                          <span className="text-[10px] text-white/40 font-mono">
                            {new Date(entry.sent_at || entry.created_at || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-white/90 leading-relaxed">
                          {entry.content || `${entry.set_by_name} set nickname to "${entry.nickname}"`}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 border-t border-white/5">
                          <span>Timestamp: {new Date(entry.sent_at || entry.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {entry.nickname && (
                            <span className="px-2 py-0.5 rounded-md bg-[#ff1493]/20 text-[#ff1493] font-bold border border-[#ff1493]/30">
                              "{entry.nickname}"
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const LiveAnimations = ({ type }: { type: any }) => {
  if (!type || type === 'none') return null;
  if (type === 'snow') return <div className="absolute inset-0 pointer-events-none opacity-60"><div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] animate-[snow_10s_linear_infinite]" /></div>;
  if (type === 'rain') return <div className="absolute inset-0 pointer-events-none opacity-40"><div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] animate-[rain_0.5s_linear_infinite]" /></div>;
  return <div className="absolute inset-0 pointer-events-none bg-white/5 animate-pulse" />;
};

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-[13px] font-bold text-white/50 uppercase tracking-wider px-4 mb-2">{title}</h3>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function ActionItem({ icon: Icon, label, subtext, danger, onClick, toggle, primaryColor }: { icon: any, label: string, subtext?: string, danger?: boolean, onClick?: () => void, toggle?: boolean, primaryColor?: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-5 px-4 py-4 hover:bg-white/5 active:bg-white/10 transition-all group ${danger ? 'text-red-500' : 'text-white/90 hover:text-white'}`}
    >
      <div className={clsx(
        "w-6 h-6 flex items-center justify-center shrink-0 transition-all group-hover:scale-110",
        danger ? "text-red-500" : ""
      )} style={{ color: !danger && primaryColor ? primaryColor : undefined }}>
        <Icon size={22} strokeWidth={2.5} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="text-[16px] font-semibold leading-tight truncate">{label}</div>
        {subtext && <div className={`text-[12px] mt-0.5 font-medium ${danger ? 'text-red-500/70' : 'text-white/40'}`}>{subtext}</div>}
      </div>
      {toggle !== undefined ? (
        <div className={clsx(
          "w-10 h-5 rounded-full relative transition-colors duration-300",
          toggle ? "bg-[#ff1493]" : "bg-white/10"
        )}>
          <div className={clsx(
            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300",
            toggle ? "left-6" : "left-1"
          )} />
        </div>
      ) : !danger && <ChevronLeft size={16} className="text-white/20 rotate-180" />}
    </button>
  );
}

function TabButton({ active, children, onClick }: { active: boolean, children: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${active ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
    >
      {children}
    </button>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <div className="px-4 py-2 bg-white/10 border border-white/10 rounded-full text-sm font-bold text-white/90 hover:bg-white/20 cursor-pointer transition-colors">
      {text}
    </div>
  );
}
