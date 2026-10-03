import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { registerPlugin } from '@capacitor/core';

import { formatChatTimestamp, formatMessageGroupDate, isSameCalendarDay, formatLastSeenChat } from '../utils/format';
import { useUserStore } from '../store/userStore';
import { useChatStore } from '../store/chatStore';
import { ReplyPreview } from '../components/chat/ReplyPreview';
import api from '../api/api';
import AudioSessionManager from '../audio/managers/AudioSessionManager';
import Navbar from '../components/Navbar';
import { useSocket } from '../hooks/useSocket';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useModalStore } from '../store/modalStore';
import { useThemeStore, PRESET_THEMES } from '../store/themeStore';
import { MessageActionSheet, MessageMoreModal, FullEmojiPickerModal, ReactionDetailsSheet } from '../components/chat/MessageActionModals';
import { useLongPress } from '../hooks/useLongPress';

import { MessageInfoModal } from '../components/chat/MessageInfoModal';
import type { MessagePermissions } from '../types/messagePermissions';
import { KeyboardAwareChatLayout, StatusBarBackground, ChatInputDock } from '../components/SafeLayout';
import type { SparkleTheme } from '../store/themeStore';
import { OfficialAccountBanner } from '../components/chat/OfficialAccountBanner';
import { OfficialComposerFooter } from '../components/chat/OfficialComposerFooter';
import { OfficialMessageCard } from '../components/chat/OfficialMessageCard';
import { SparklePayCard } from '../components/chat/SparklePayCard';
import { OfficialWelcomeCards } from '../components/chat/OfficialWelcomeCards';
import { OfficialInteractiveOnboarding } from '../components/chat/OfficialInteractiveOnboarding';
import { DeveloperEmergencyConsoleModal } from '../components/chat/DeveloperEmergencyConsoleModal';
import { SparkleStorage } from '../services/SparkleStorageService';
import { SparkleHorizontalActionBar } from '../components/chat/SparkleHorizontalActionBar';
import { SparkleSelectionMenu } from '../components/chat/SparkleSelectionMenu';
import { sanitizePartnerName } from '../utils/nameSanitizer';
import { SparkleOrbitMenu } from '../components/chat/SparkleOrbitMenu';
import { SparkleActionSheet } from '../components/chat/SparkleActionSheet';
import { SparklePeekCard } from '../components/chat/SparklePeekCard';
import { SparkleSwipeableChatItem } from '../components/chat/SparkleSwipeableChatItem';
import { SparkleUndoToast } from '../components/chat/SparkleUndoToast';
import { LocationPickerModal, type LocationPayload } from '../components/chat/LocationPickerModal';
import { LocationMessageBubble } from '../components/chat/LocationMessageBubble';
import { SparklePeopleHubModal } from '../components/chat/SparklePeopleHubModal';
import { SparklyListingCard } from '../components/marketplace/SparklyListingCard';
import { SparklyAvatar } from '../components/sparkly/SparklyAvatar';
import { SparklyMarkdown } from '../components/sparkly/SparklyMarkdown';
import { IdentityManager } from '../utils/identityManager';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import debounce from 'lodash.debounce';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import PersistentOfflineQueue from '../services/PersistentOfflineQueue';
import { voiceRecordingService, type RecordingState } from '../services/VoiceRecordingService';
import { AudioPreviewModal } from '../components/modals/AudioPreviewModal';

// Hoist Capacitor plugin registration to module scope to avoid duplicate registration warnings
const PrivacyProtection = registerPlugin<any>('PrivacyProtection');

import {
  Search,
  Plus,
  MoreVertical,
  Phone,
  Video,
  Send,
  Paperclip,
  Smile,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  GripVertical,
  Archive,
  Bookmark,
  ImageIcon,
  FileText,
  MapPin,
  Check,
  CheckCircle2,
  RotateCw,
  AlertCircle,
  Flag,
  Trash2,
  Info,
  Orbit,
  X,
  ShoppingBag,
  User,
  Type,
  Palette,
  Pin,
  Star,
  Mail,
  Eraser,
  Ban,
  BellOff,
  Volume2,
  Users,
  Download,
  Share2,
  Clock,
  Eye,
  MoreHorizontal,
  Shield,
  Lock,
  MinusCircle,
  ShieldAlert,
  AlertTriangle,
  Image,
  Sparkles,
  Cloud,
  SquarePen,
  Gift,
  Flame,
  Heart,
  Zap,
  Coffee,
  Ghost,
  Sun,
  Moon,
  Music,
  Gamepad2,
  Wand2,
  PlusCircle,
  Camera,
  Mic,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  Forward,
  Settings
} from 'lucide-react';
import { useCall } from '../components/MockCallProvider';
import { getAvatarUrl } from '../utils/imageUtils';
import ModernOfflineState from '../components/ui/ModernOfflineState';
import CameraModal from '../components/chat/CameraModal';
import ChatSettingsModal from '../components/chat/ChatSettingsModal';
import { PullUpDisappearingGesture } from '../components/chat/PullUpDisappearingGesture';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import AppScreen from '../components/AppScreen';
import { useMessageSocket } from '../hooks/useMessageSocket';

// --- Types ---
interface ChatConversation {
  chat_id: string;
  partner_id: string;
  partner_avatar?: string;
  partner_name: string;
  partner_username?: string;
  partner_online?: boolean;
  is_archived?: boolean;
  is_group?: boolean;
  chat_type?: string;
  member_count?: number;
  group_online_count?: number;
  unread_count: number;
  last_message?: string;
  last_message_time?: string;   // from personal_chats table column
  last_message_at?: string;     // aliased in getUserConversations query
}

interface ChatMessage {
  message_id: string;
  sender_id: string;
  content: string;
  status: string;
  sent_at?: string;
  created_at?: string;
  is_read?: boolean;
  type?: 'text' | 'image' | 'video' | 'voice_note' | 'document' | 'location' | 'contact' | string;
  media_url?: string;
  mediaUrl?: string;
  metadata?: string;
}

const VoiceNotePlayer = ({ url }: { url: string }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        AudioSessionManager.unregisterVoicePlayback(audioRef.current);
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      AudioSessionManager.registerVoicePlayback(audioRef.current);
      audioRef.current.play().catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
  };

  const toggleSpeed = () => {
    if (!audioRef.current) return;
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;

    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || !audioRef.current || duration <= 0) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = fraction * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time < 0) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 min-w-[240px] max-w-[300px] select-none">
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => {
          setIsPlaying(true);
          if (audioRef.current) AudioSessionManager.registerVoicePlayback(audioRef.current);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      <button
        type="button"
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all shrink-0 shadow-md"
      >
        {isPlaying ? <Pause size={18} strokeWidth={2.5} fill="white" /> : <Play size={18} strokeWidth={2.5} fill="white" className="ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1 min-w-0 cursor-pointer" onClick={handleWaveformClick}>
        <div ref={waveformRef} className="flex items-end gap-[3px] h-[22px] px-1 overflow-hidden">
          {[...Array(24)].map((_, i) => {
            const progress = duration > 0 ? currentTime / duration : 0;
            const barIndex = i / 24;
            const isActive = progress >= barIndex;
            const height = 4 + Math.abs(Math.sin(i * 0.4)) * 14;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-all duration-150"
                style={{
                  height: `${height}px`,
                  backgroundColor: isActive ? '#ff1493' : 'rgba(255,255,255,0.2)'
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between items-center text-[10px] text-white/50 font-bold uppercase tracking-wider">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || 0)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={toggleSpeed}
        className="px-2 py-1 rounded-lg bg-white/10 text-white text-[10.5px] font-black border border-white/5 hover:bg-white/20 transition-all active:scale-95 shrink-0"
      >
        {playbackRate}x
      </button>
    </div>
  );
};

const AttachmentCard = ({ metadata }: { metadata: string }) => {
  const navigate = useNavigate();
  let parsed: any = null;
  try {
    parsed = JSON.parse(metadata);
  } catch (e) {
    console.error("Failed to parse metadata", e);
    return null;
  }
  const att = parsed?.attachment;
  if (!att) return null;

  if (att.type === 'story') {
    return (
      <div
        onClick={() => navigate(`/stories/${att.owner}`)}
        className="rounded-[20px] overflow-hidden border border-white/10 cursor-pointer max-w-[240px] bg-white/5 backdrop-blur-md relative group select-none shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] mt-1"
      >
        {att.thumbnail ? (
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/20">
            <img src={att.thumbnail} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="Story preview" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_#a855f7]" />
              <span className="text-white text-[11px] font-black uppercase tracking-wider">Story Reply</span>
            </div>
          </div>
        ) : (
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-bold text-white leading-tight">Story Reply</span>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">Click to view</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

// --- Components ---

const WordEffectBubbles = ({ emoji, active }: { emoji: string | null, active: boolean }) => {
  if (!active || !emoji) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          initial={{
            y: '110vh',
            x: `${Math.random() * 100}vw`,
            scale: 0.5,
            opacity: 0,
            rotate: 0
          }}
          animate={{
            y: '-10vh',
            x: `${Math.random() * 100}vw`,
            scale: [0.5, 1.5, 1],
            opacity: [0, 1, 1, 0],
            rotate: Math.random() * 360
          }}
          transition={{
            duration: Math.random() * 2 + 2,
            delay: Math.random() * 1.5,
            ease: "easeOut"
          }}
          className="absolute text-5xl select-none"
        >
          {emoji}
        </motion.div>
      ))}
    </div>
  );
};

const LiveAnimations = ({ type }: { type: AnimationType | undefined }) => {
  if (!type || type === 'none') return null;

  if (type === 'snow') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-60">
        {[...Array(30)].map((_, i) => (
          <div key={i} className="absolute bg-white rounded-full opacity-80 animate-snow" style={{
            left: `${Math.random() * 100}%`,
            width: `${Math.random() * 4 + 2}px`,
            height: `${Math.random() * 4 + 2}px`,
            animationDuration: `${Math.random() * 3 + 2}s`,
            animationDelay: `${Math.random() * 2}s`
          }} />
        ))}
        <style>{`@keyframes snow { 0% { transform: translateY(-10px); } 100% { transform: translateY(100vh); } } .animate-snow { animation: snow linear infinite; }`}</style>
      </div>
    );
  }

  if (type === 'rain') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        {[...Array(40)].map((_, i) => (
          <div key={i} className="absolute bg-blue-200 opacity-60 animate-rain" style={{
            left: `${Math.random() * 100}%`,
            width: '1.5px',
            height: `${Math.random() * 15 + 10}px`,
            animationDuration: `${Math.random() * 0.5 + 0.3}s`,
            animationDelay: `${Math.random() * 1}s`
          }} />
        ))}
        <style>{`@keyframes rain { 0% { transform: translateY(-20px) rotate(15deg); } 100% { transform: translateY(100vh) rotate(15deg); } } .animate-rain { animation: rain linear infinite; }`}</style>
      </div>
    );
  }

  if (type === 'particles' || type === 'stars' || type === 'fireflies') {
    const color = type === 'fireflies' ? 'bg-yellow-300' : 'bg-white';
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(25)].map((_, i) => (
          <div key={i} className={`absolute ${color} rounded-full opacity-50 animate-float`} style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${Math.random() * 3 + 1}px`,
            height: `${Math.random() * 3 + 1}px`,
            animationDuration: `${Math.random() * 4 + 3}s`,
            animationDelay: `${Math.random() * 2}s`,
            boxShadow: `0 0 ${Math.random() * 4 + 2}px ${type === 'fireflies' ? '#FDE047' : '#FFFFFF'}`
          }} />
        ))}
        <style>{`@keyframes float { 0%, 100% { transform: translate(0, 0); opacity: 0.2; } 50% { transform: translate(${Math.random() * 20 - 10}px, ${Math.random() * -20 - 10}px); opacity: 0.8; } } .animate-float { animation: float ease-in-out infinite; }`}</style>
      </div>
    );
  }

  return null;
};

const MessageBubbleWrapper: React.FC<{
  onLongPress: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  className: string;
  style: React.CSSProperties;
  children: React.ReactNode;
}> = ({ onLongPress, onContextMenu, onClick, className, style, children }) => {
  const lp = useLongPress(onLongPress, 500);
  return (
    <div
      onPointerDown={lp.onPointerDown}
      onPointerMove={lp.onPointerMove}
      onPointerUp={lp.onPointerUp}
      onPointerCancel={lp.onPointerCancel}
      onContextMenu={onContextMenu}
      onClick={(e) => {
        lp.onClick(e);
        onClick(e);
      }}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
};

const ChatBackground = ({ theme }: { theme: SparkleTheme | null }) => {
  if (!theme) return <div className="absolute inset-0 z-0 bg-[#000000]" />;

  const hasImage = !!theme.wallpaperUrl;

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-700"
      style={{ backgroundColor: theme?.colors?.backgroundDark || '#000000' }}
    >
      {!hasImage && (
        <div
          className="absolute inset-0 transition-all duration-700 opacity-100"
          style={{
            background: `linear-gradient(135deg, ${theme?.colors?.backgroundDark || '#000000'} 0%, ${theme?.colors?.backgroundLight || '#000000'} 100%)`
          }}
        />
      )}

      {hasImage && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${theme?.wallpaperUrl})`,
            backgroundSize: theme?.wallpaperStyle === 'tile' ? '350px' : (theme?.wallpaperStyle || 'cover'),
            backgroundPosition: 'center',
            backgroundRepeat: theme?.wallpaperStyle === 'tile' ? 'repeat' : 'no-repeat',
            opacity: 1,
          }}
        />
      )}

      {/* Live Animations Layer */}
      <LiveAnimations type={theme?.animationType} />
    </div>
  );
};

const EMOJIS = {
  smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕'],
  gestures: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👣', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄'],
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
  nature: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🕸', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔', '🐾', '🐉', '🐲', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐️', '🌟', '✨', '⚡️', '☄️', '💥', '🔥', '🌪', '🌈', '☀️', '🌤', '⛅️', '🌥', '☁️', '🌦', '🌧', '🌨', '🌩', '🌨', '❄️', '☃️', '⛄️', '🌬', '💨', '💧', '💦', '☔️', '☂️', '🌊', '🌫'],
  activities: ['⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳️', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🛹', '🛼', '🛷', '⛸', '🎿', '⛷', '🏂', '🏋️', '🤺', '🤼', '🤸', '⛹️', '🤺', '🏇', '🧘', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎸', '🎻', '🎲', '🧩', '🎳', '🎮', '🎰', '🎯'],
  places: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛵', '🚲', '🛴', '🚏', '🛣', '🛤', '⛽️', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓️', '⛵️', '🛶', '🚤', '🛳', '⛴', '🚢', '✈️', '🛩', '🛫', '🛬', '🚀', '🛸', '🛰', '🚠', '🚟', '🚁', '🏟', '🏗', '🏘', '🏚', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏬', '🏭', '🏰', '🏯', '💒', '🗼', '🗽', '⛪️', '🕌', '🕍', '⛩', '🕋', '⛲️', '⛺️', '🌁', '🌃', '🏙', '🌄', '🌅', '🌆', '🌇', '🌉', '♨️', '🎠', '🎡', '🎢', '💈', '🎪'],
  objects: ['⌚️', '📱', '📲', '💻', '⌨️', '🖱', '🖲', '🕹', '🗜', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛️', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🪔', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒', '🛠', '⛏', '🔩', '⚙️', '🧱', '⛓', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡', '🧹', '🧺', '🧻', '🧼', '🧽', '🧴', '🛎', '🔑', '🗝', '🚪', '🪑', '🛋', '🛏', '🛌', '🧸', '🖼', '🛍', '🛒', '🎁', '🎈', '🎏', '🎀', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷', '📁', '📂', '🗂', '📅', '📆', '🗒', '🗓', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇', '📏', '📐', '✂️', '🗃', '🗄', '🗑', '🔒', '🔓', '🔏', '🔐', '🔑', '🗝', '🔨', '⛏', '⚒', '🛠', '🗡', '⚔️', '🔫', '🏹', '🛡', '🔧', '🔩', '⚙️', '🗜', '⚖️', '🔗', '⛓', '🧰', '🧲', '⚗️', '🧪', '🧫', '🧬', '🔬', '🔭', '📡', '💉', '💊', '🩹', '🩺', '🚪', '🛏', '🛋', '🪑', '🚽', '🚿', '🛀', '🛁', '🪒', '🧴', '🧷', '🧹', '🧺', '🧻', '🧼', '🧽', '🧯', '🛒', '🚬', '⚰️', '⚱️', '🗿'],
  symbols: ['💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💯', '💢', '💥', '💫', '💦', '💨', '🕳', '💣', '💬', '👁‍🗨', '🗨', '🗯', '💭', '💤', '♨️', '💈', '🛑', '🕛', '🕧', '🕐', '🕜', '🕑', '🕝', '🕒', '🕞', '🕓', '🕟', '🕔', '🕠', '🕕', '🕡', '🕖', '🕢', '🕗', '🕣', '🕘', '🕤', '🕙', '🕥', '🕚', '🕦', '🌀', '♠️', '♥️', '♦️', '♣️', '🃏', '🀄️', '🎴', '🎭', '🖼', '🎨', '🧵', '🧶', '🎼', '🎵', '🎶', '🎙', '🎚', '🎛', '🎤', '🎧', '📻', '🎷', '🎸', '🎹', '🎺', '🎻', '🥁', '📱', '📲', '☎️', '📞', '📟', '📠', '🔋', '🔌', '💻', '🖥', '🖨', '⌨️', '🖱', '🖲', '💽', '💾', '💿', '📀', '🧮', '🎥', '🎞', '📽', '🎬', '📺', '📷', '📸', '📹', '📼', '🔍', '🔎', '🕯', '💡', '🔦', '🏮', '🪔', '📔', '📕', '📖', '📗', '📘', '📙', '📚', '📓', '📒', '📃', '📜', '📄', '📰', '🗞', '📑', '🔖', '🏷', '💰', '💴', '💵', '💶', '💷', '💸', '💳', '💹', '💱', '💲', '✉️', '📧', '📨', '📩', '📤', '📥', '📦', '📫', '📪', '📬', '📭', '📮', '🗳', '✏️', '✒️', '🖋', '🖊', '🖌', '🖍', '📝', '📁', '📂', '🗂', '📅', '📆', '🗒', '🗓', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇', '📏', '📐', '✂️', '🗃', '🗄', '🗑', '🔒', '🔓', '🔏', '🔐', '🔑', '🗝', '🔨', '⛏', '⚒', '🛠', '🗡', '⚔️', '🔫', '🏹', '🛡', '🔧', '🔩', '⚙️', '🗜', '⚖️', '🔗', '⛓', '🧰', '🧲', '⚗️', '🧪', '🧫', '🧬', '🔬', '🔭', '📡', '💉', '💊', '🩹', '🩺', '🚪', '🛏', '🛋', '🪑', '🚽', '🚿', '🛀', '🛁', '🪒', '🧴', '🧷', '🧹', '🧺', '🧻', '🧼', '🧽', '🧯', '🛒', '🚬', '⚰️', '⚱️', '🗿'],
  flags: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇸🇿', '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🇯🇪', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇮', '🇽🇰', '🇰🇼', '🇰🇬', '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇴', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇭', '🇲🇶', '🇲🇷', '🇲🇺', '🇾🇹', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇸', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇦', '🇳🇷', '🇳🇵', '🇳🇱', '🇳🇨', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇳🇺', '🇳🇫', '🇰🇵', '🇲🇰', '🇲🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇼', '🇵🇸', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇳', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇺', '🇷🇼', '🇼🇸', '🇸🇲', '🇸🇹', '🇸🇦', '🇸🇳', '🇷🇸', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇽', '🇸🇰', '🇸🇮', '🇬🇸', '🇸🇧', '🇸🇴', '🇿🇦', '🇰🇷', '🇸🇸', '🇪🇸', '🇱🇰', '🇧🇱', '🇸🇭', '🇰🇳', '🇱🇨', '🇲🇫', '🇵🇲', '🇻🇨', '🇸🇩', '🇸🇷', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱', '🇹🇬', '🇹🇰', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇨', '🇹🇻', '🇻🇮', '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇺', '🇻🇦', '🇻🇪', '🇻🇳', '🇼🇫', '🇪🇭', '🇾🇪', '🇿🇲', '🇿🇼']
};

const LiveRecordingBar = memo(({
  sessionId,
  onDiscard,
  onSend
}: {
  sessionId: string;
  onDiscard: () => void;
  onSend: () => void;
}) => {
  const [state, setState] = useState<RecordingState>({
    isRecording: true,
    isPaused: false,
    duration: 0,
    audioLevels: new Array(16).fill(0.1),
    sessionId
  });

  useEffect(() => {
    const handleStateChange = (newState: RecordingState) => {
      if (newState.sessionId === sessionId || voiceRecordingService.getCurrentSessionId() === sessionId) {
        setState(newState);
      }
    };

    voiceRecordingService.subscribe(handleStateChange);
    return () => {
      voiceRecordingService.unsubscribe();
    };
  }, [sessionId]);

  const minutes = Math.floor(state.duration / 60);
  const seconds = String(state.duration % 60).padStart(2, '0');

  return (
    <div className="flex items-center w-full max-w-[1200px] mx-auto px-1 py-2">
      <div className="flex items-center w-full bg-[#121212]/95 border border-white/20 rounded-full px-4 py-2 justify-between backdrop-blur-xl shadow-2xl">
        <button
          type="button"
          onClick={onDiscard}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-full transition-all active:scale-95 shrink-0 flex items-center justify-center"
          title="Discard voice note"
        >
          <Trash2 size={20} />
        </button>

        <div className="flex-1 flex items-center justify-center gap-3 px-4 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-black text-red-400 tracking-wider">
              {minutes}:{seconds}
            </span>
          </div>

          <div className="flex items-center gap-[3px] h-5 overflow-hidden flex-1 justify-center max-w-[220px]">
            {state.audioLevels.map((lvl, idx) => (
              <div
                key={idx}
                className="w-1 bg-[#ff1493] rounded-full transition-all duration-75"
                style={{ height: `${Math.max(4, Math.round(lvl * 20))}px` }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onSend}
          className="p-2.5 rounded-full bg-[#ff1493] text-white hover:opacity-90 active:scale-95 transition-all shadow-lg shrink-0 flex items-center justify-center"
          title="Send Voice Note"
        >
          <Send size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});

const ChatInput = memo(({
  initialMessage,
  onTyping,
  onSend,
  onCameraOpen,
  isMenuCollapsed,
  setIsMenuCollapsed,
  selectedChat,
  sending,
  getQuickReaction,
  setShowAttachmentMenu,
  showAttachmentMenu,
  onVoiceSend,
  theme,
  replyToMessage,
  onFileSelect
}: any) => {
  const drafts = useChatStore(state => state.drafts);
  const setDraft = useChatStore(state => state.setDraft);
  const localMessage = selectedChat ? (drafts[selectedChat.chat_id] || '') : '';
  const isTyping = Boolean(localMessage.length > 0);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emojis' | 'stickers' | 'gifs' | 'avatars'>('emojis');
  const [giphySearch, setGiphySearch] = useState('');
  const [giphyResults, setGiphyResults] = useState<any[]>([]);
  const [loadingGiphy, setLoadingGiphy] = useState(false);

  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const editing = useChatStore(state => state.editing);

  useEffect(() => {
    if (editing.messageId && editing.chatId === selectedChat?.chat_id) {
      inputRef.current?.focus();
    }
  }, [editing.messageId, editing.chatId, selectedChat?.chat_id]);

  const startMicRecording = useCallback(() => {
    if (recordingSessionId) return;

    const sessionId = crypto.randomUUID();
    setRecordingSessionId(sessionId);

    voiceRecordingService.start(sessionId).catch((err: any) => {
      console.error('[ChatInput] Microphone access failed:', err);
      if (voiceRecordingService.getCurrentSessionId() === sessionId) {
        setRecordingSessionId(null);
        alert('Microphone access is required to record voice notes.');
      }
    });
  }, [recordingSessionId]);

  const handleDiscardRecording = useCallback(() => {
    const currentId = recordingSessionId;
    setRecordingSessionId(null);

    if (currentId) {
      voiceRecordingService.cancel(currentId);
    }
  }, [recordingSessionId]);

  const handleFinishAndSendRecording = useCallback(async () => {
    const currentId = recordingSessionId;
    if (!currentId) return;

    setRecordingSessionId(null);

    const result = await voiceRecordingService.stop(currentId);
    if (!result || !result.file) return;

    if (result.duration < 0.8) {
      console.log('[ChatInput] Voice note too short (<0.8s), discarded');
      return;
    }

    if (onVoiceSend) {
      onVoiceSend(result.file, result.duration, 'recorded_voice_note');
    }
  }, [recordingSessionId, onVoiceSend]);

  const GIPHY_KEY = 'V4AnAfCCCGEVjlUjiNMWWXCoW1JrAn4p';

  const fetchGiphy = useCallback(async (type: 'gifs' | 'stickers', query?: string) => {
    setLoadingGiphy(true);
    try {
      const endpoint = query ? 'search' : 'trending';
      const url = `https://api.giphy.com/v1/${type}/${endpoint}?api_key=${GIPHY_KEY}&q=${query || ''}&limit=20&rating=g`;
      const res = await fetch(url);
      const json = await res.json();
      setGiphyResults(json.data || []);
    } catch (err) {
      console.error('Giphy error', err);
    } finally {
      setLoadingGiphy(false);
    }
  }, [GIPHY_KEY]);

  useEffect(() => {
    if (showEmojiPicker && (pickerTab === 'gifs' || pickerTab === 'stickers')) {
      fetchGiphy(pickerTab === 'gifs' ? 'gifs' : 'stickers', giphySearch);
    }
  }, [showEmojiPicker, pickerTab, giphySearch, fetchGiphy]);

  const themePrimary = theme?.colors?.primary || '#ff1493';
  const themeBg = theme?.colors?.backgroundDark || '#000000';

  const isBlocked = Boolean(selectedChat?.is_blocked || selectedChat?.conversation_status === 'blocked' || selectedChat?.can_send_messages === false);
  const isBlockedByMe = Boolean(selectedChat?.is_blocked_by_me);

  if (isBlocked) {
    return (
      <ChatInputDock className="z-30 shrink-0 border-t border-white/10 transition-all duration-300" backgroundColor={themeBg}>
        <div className="w-full max-w-[1200px] mx-auto py-5 px-6 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-red-500/10 text-red-500 mb-2 shadow-sm border border-red-500/20">
            <Ban size={22} strokeWidth={2.5} />
          </div>
          <h3 className="text-sm font-black text-white mb-1 tracking-tight">
            {isBlockedByMe ? 'You blocked this user' : 'Messaging is blocked'}
          </h3>
          <p className="text-xs font-medium text-slate-400 max-w-sm mx-auto mb-3 leading-relaxed">
            {isBlockedByMe
              ? 'Messaging is unavailable while this user is blocked.'
              : 'Messages cannot be sent in this conversation.'}
          </p>
          {isBlockedByMe && selectedChat?.partner_id && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.delete(`/users/block/${selectedChat.partner_id}`);
                  useChatStore.getState().setConversationBlockState(selectedChat.chat_id, {
                    is_blocked: false,
                    is_blocked_by_me: false,
                    am_i_blocked: false,
                    conversation_status: 'active',
                    can_send_messages: true
                  });
                } catch (err) {
                  console.error('Failed to unblock user:', err);
                }
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-xs transition-all active:scale-95 border border-red-500/30 shadow-md"
            >
              Unblock User
            </button>
          )}
        </div>
      </ChatInputDock>
    );
  }

  if (selectedChat?.account_type === 'system' || selectedChat?.conversation_type === 'system' || selectedChat?.is_system_account || selectedChat?.is_system || selectedChat?.partner_id === 'd75fe3b5-7a45-4581-ab13-91934d8b54de') {
    return (
      <ChatInputDock className="z-30 shrink-0 border-t border-slate-800 transition-all duration-300" backgroundColor={themeBg}>
        <OfficialComposerFooter />
      </ChatInputDock>
    );
  }

  const STICKERS = [
    'https://cdn.pixabay.com/photo/2020/03/17/17/46/sticker-4941344_1280.png',
    'https://cdn.pixabay.com/photo/2020/03/17/17/46/sticker-4941346_1280.png',
    'https://cdn.pixabay.com/photo/2020/03/17/17/46/sticker-4941347_1280.png',
    'https://cdn.pixabay.com/photo/2020/03/17/17/46/sticker-4941348_1280.png',
    'https://cdn.pixabay.com/photo/2020/03/17/17/46/sticker-4941349_1280.png',
    'https://cdn.pixabay.com/photo/2020/03/17/17/46/sticker-4941350_1280.png'
  ];

  const AVATARS = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Sasha',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=George',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Lilly',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver'
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (selectedChat) {
      setDraft(selectedChat.chat_id, val);
    }
    onTyping(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localMessage.trim() && !sending) return;
    onSend(e, localMessage);
  };

  return (
    <ChatInputDock className="z-30 shrink-0 border-t border-white/5 transition-all duration-300" backgroundColor={themeBg}>
      <div className="w-full max-w-[1200px] mx-auto">
        {editing.messageId && editing.chatId === selectedChat?.chat_id && (
          <div className="flex items-center justify-between gap-2 p-2 bg-white/5 border-b border-white/5 px-4 text-xs text-white/50">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-[#ff1493] shrink-0">Editing message…</span>
              <span className="truncate">"{editing.originalContent}"</span>
            </div>
            <button
              onClick={() => useChatStore.getState().finishEdit(selectedChat.chat_id)}
              className="p-1 hover:text-white shrink-0"
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {replyToMessage && (
          <ReplyPreview
            onClear={() => {
              if (selectedChat) {
                useChatStore.getState().setReplyTarget(selectedChat.chat_id, undefined);
              }
            }}
            messageId={replyToMessage.message_id}
          />
        )}
        {recordingSessionId ? (
          <LiveRecordingBar
            sessionId={recordingSessionId}
            onDiscard={handleDiscardRecording}
            onSend={handleFinishAndSendRecording}
          />
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center w-full max-w-[1200px] mx-auto px-1 py-2 relative gap-1.5">
            {/* Native @ / Sparkle Mention Suggestion Popup */}
            <AnimatePresence>
              {(() => {
                const isAtTrigger = /@(?:s|sp|spar|spark|sparkle|sparkly)?$/i.test(localMessage);
                const isKeywordTrigger = /(^|\s)sparkl(?:y|e)\b/i.test(localMessage) && !/@sparkl(?:y|e)\b/i.test(localMessage);
                const showPopup = isAtTrigger || isKeywordTrigger;

                if (!showPopup) return null;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute bottom-full left-4 mb-2 z-50 bg-slate-900/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl p-2.5 shadow-2xl shadow-purple-950/50 flex items-center gap-3 cursor-pointer hover:border-purple-400/70 transition-all group"
                    onClick={() => {
                      let updated = localMessage;
                      if (isAtTrigger) {
                        updated = localMessage.replace(/@(?:s|sp|spar|spark|sparkle|sparkly)?$/i, '@sparkle ');
                      } else if (isKeywordTrigger) {
                        if (/^\s*sparkl(?:y|e)\b/i.test(localMessage)) {
                          updated = localMessage.replace(/^\s*sparkl(?:y|e)\b\s*/i, '@sparkle ');
                        } else {
                          updated = '@sparkle ' + localMessage.replace(/(^|\s)sparkl(?:y|e)\b/i, '$1').trim();
                        }
                      }
                      if (selectedChat) {
                        setDraft(selectedChat.chat_id, updated);
                      }
                      onTyping(updated);
                      inputRef.current?.focus();
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform shrink-0">
                      <Sparkles size={16} />
                    </div>
                    <div className="flex flex-col pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white leading-tight">Sparkly AI</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Ask Sparkly</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium leading-tight">
                        {isKeywordTrigger ? 'Tap to authorize Sparkly AI request' : 'Tap to ask questions or search Marketplace'}
                      </span>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Left Action Icons: Plus (+), Camera (📷), Files (📎) — Visible ONLY when NOT typing */}
            <AnimatePresence initial={false}>
              {!isTyping && (
                <motion.div
                  key="composer-left-actions"
                  initial={{ opacity: 0, width: 0, scale: 0.8 }}
                  animate={{ opacity: 1, width: 'auto', scale: 1 }}
                  exit={{ opacity: 0, width: 0, scale: 0.8 }}
                  transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                  className="flex items-center gap-0.5 shrink-0 overflow-hidden"
                >
                  {/* 1. Plus (+) — Main Attachment Sheet Button */}
                  <button
                    type="button"
                    onClick={() => setShowAttachmentMenu(true)}
                    className="w-9 h-9 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 active:scale-90 rounded-full transition-all shrink-0"
                    title="Attach Options"
                  >
                    <Plus size={20} strokeWidth={2.5} />
                  </button>

                  {/* 2. Camera (📷) — Sparkle Camera Flow */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onCameraOpen) onCameraOpen();
                    }}
                    className="w-9 h-9 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 active:scale-90 rounded-full transition-all shrink-0"
                    title="Open Camera"
                  >
                    <Camera size={19} strokeWidth={2.2} />
                  </button>

                  {/* 3. Files (📎) — Device File Picker */}
                  <label
                    className="w-9 h-9 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 active:scale-90 rounded-full transition-all shrink-0 cursor-pointer"
                    title="Choose Files"
                  >
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          if (onFileSelect) {
                            onFileSelect(e.target.files);
                          }
                          e.target.value = '';
                        }
                      }}
                    />
                    <Paperclip size={19} strokeWidth={2.2} />
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Area — Naturally expands as left icons collapse */}
            <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-2 mx-1 transition-all duration-200 min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={localMessage}
                onChange={handleChange}
                onFocus={() => setShowEmojiPicker(false)}
                placeholder={editing.messageId && editing.chatId === selectedChat?.chat_id ? "Editing message…" : "Type a message..."}
                className="flex-1 bg-transparent text-[15px] font-medium text-[#f5f5f5] placeholder:text-white/20 outline-none border-none focus:ring-0 p-0 m-0 shadow-none caret-white"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={clsx(
                  "transition-all ml-2 shrink-0",
                  showEmojiPicker ? "text-[#ff1493] scale-110" : "text-white/20 hover:text-white"
                )}
              >
                <Smile size={20} strokeWidth={2.2} />
              </button>
            </div>

            <div className="flex items-center shrink-0 mr-1 gap-1">
              {!localMessage.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    const reaction = getQuickReaction(selectedChat.chat_id);
                    onSend(undefined, reaction);
                  }}
                  className="text-2xl hover:scale-110 active:scale-90 transition-all p-1"
                >
                  {getQuickReaction(selectedChat.chat_id)}
                </button>
              )}

              {localMessage.trim() ? (
                <button
                  type="submit"
                  disabled={sending}
                  className="p-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: themePrimary, color: '#ffffff' }}
                >
                  <Send size={18} strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startMicRecording}
                  style={{ backgroundColor: themePrimary }}
                  className="p-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center justify-center text-white"
                  title="Record Voice Note"
                >
                  <Mic size={18} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </form>
        )}

        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 360, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="w-full overflow-hidden flex flex-col rounded-none"
              style={{ backgroundColor: themeBg }}
            >
              {/* Reference Header */}
              <div className="flex items-center px-4 py-2 gap-3 shrink-0 border-b border-white/5">
                <button type="button" onClick={() => setShowEmojiPicker(false)} className="text-white/60 hover:text-white p-1"><ArrowLeft size={20} /></button>
                <div className="flex-1 h-9 bg-white/10 rounded-full flex items-center px-4 border border-white/5 focus-within:border-white/20 transition-all">
                  <Search size={14} className="text-white/40 mr-2" />
                  <input
                    placeholder="Search"
                    value={giphySearch}
                    onChange={e => setGiphySearch(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm w-full text-white/90 placeholder:text-white/20"
                  />
                </div>
                <div className="flex items-center gap-4 text-white/40 ml-1">
                  <button type="button" onClick={() => setPickerTab('emojis')} className={clsx("hover:text-white transition-colors", pickerTab === 'emojis' ? 'text-white' : '')}><Clock size={20} /></button>
                  <button type="button" onClick={() => setPickerTab('emojis')} className={clsx("hover:text-white transition-colors", pickerTab === 'emojis' ? 'text-white' : '')}><Smile size={20} /></button>
                  <button type="button" onClick={() => setPickerTab('gifs')} className={clsx("hover:text-white transition-colors", pickerTab === 'gifs' ? 'text-white' : '')}><Zap size={20} /></button>
                  <button type="button" onClick={() => setPickerTab('stickers')} className={clsx("hover:text-white transition-colors", pickerTab === 'stickers' ? 'text-white' : '')}><Sparkles size={20} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative">
                {pickerTab === 'emojis' ? (
                  <div className="h-full overflow-y-auto no-scrollbar px-3 py-4 space-y-6">
                    {Object.entries(EMOJIS).map(([category, list]) => (
                      <div key={category} className="space-y-3">
                        <h5 className="text-[11px] min-h-[30px] flex items-center font-black text-white/30 uppercase tracking-[2px] px-1">{category}</h5>
                        <div className="grid grid-cols-8 sm:grid-cols-9 gap-y-4">
                          {Array.from(new Set(list)).map((emoji, idx) => (
                            <button
                              key={`${category}-${emoji}-${idx}`}
                              type="button"
                              onClick={() => setLocalMessage(prev => prev + emoji)}
                              className="text-[26px] flex items-center justify-center hover:scale-120 active:scale-90 transition-all"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : pickerTab === 'gifs' ? (
                  <div className="h-full overflow-y-auto no-scrollbar grid grid-cols-2 gap-x-3 gap-y-4 p-3 content-start">
                    {loadingGiphy ? (
                      <div className="col-span-2 h-full flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-8 h-8 border-3 border-[#ff1493] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Loading GIFs...</span>
                      </div>
                    ) : giphyResults.map((item: any) => (
                      <motion.div
                        key={item.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative h-[110px] bg-white/5 border border-white/5 overflow-hidden cursor-pointer shadow-md"
                        onClick={() => {
                          onSend(null, JSON.stringify({ type: 'gif', url: item.images.fixed_height.url }));
                          setShowEmojiPicker(false);
                        }}
                      >
                        <img src={item.images.fixed_height.url} className="w-full h-full object-cover" alt="" />
                      </motion.div>
                    ))}
                  </div>
                ) : pickerTab === 'stickers' ? (
                  <div className="h-full overflow-y-auto no-scrollbar grid grid-cols-3 gap-x-3 gap-y-4 p-3 content-start">
                    {loadingGiphy ? (
                      <div className="col-span-3 h-full flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-8 h-8 border-3 border-[#ff1493] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Loading Stickers...</span>
                      </div>
                    ) : giphyResults.map((item: any) => (
                      <motion.div
                        key={item.id}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="relative h-[100px] flex items-center justify-center bg-white/5 border border-white/5 overflow-hidden cursor-pointer p-1"
                        onClick={() => {
                          onSend(null, JSON.stringify({ type: 'sticker', url: item.images.fixed_height.url }));
                          setShowEmojiPicker(false);
                        }}
                      >
                        <img src={item.images.fixed_height.url} className="w-full h-full object-contain" alt="" />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto no-scrollbar grid grid-cols-3 gap-4 p-4">
                    {AVATARS.map((src, i) => (
                      <motion.div
                        key={i}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="relative aspect-square bg-white/5 p-2 border border-white/10 cursor-pointer overflow-hidden"
                        onClick={() => {
                          onSend(null, JSON.stringify({ type: 'avatar', url: src }));
                          setShowEmojiPicker(false);
                        }}
                      >
                        <img src={src} className="w-full h-full object-contain" alt="" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reference Bottom Bar */}
              <div className="h-14 border-t border-white/5 flex items-center justify-between px-6 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                <button type="button" onClick={() => setShowEmojiPicker(false)} className="text-xs font-black text-white/40 hover:text-white transition-colors">ABC</button>
                <div className="flex items-center gap-8">
                  <button type="button" onClick={() => setPickerTab('emojis')} className={clsx("p-2 rounded-xl transition-all", pickerTab === 'emojis' ? "bg-white/20 text-white scale-110 shadow-lg" : "text-white/40 hover:text-white")}><Smile size={20} /></button>
                  <button type="button" onClick={() => setPickerTab('gifs')} className={clsx("text-[11px] font-black px-2.5 py-1 border-2 rounded-lg transition-all", pickerTab === 'gifs' ? "border-white text-white scale-110 shadow-lg" : "border-white/20 text-white/20 hover:border-white/40 hover:text-white/40")}>GIF</button>
                  <button type="button" onClick={() => setPickerTab('stickers')} className={clsx("p-2 rounded-xl transition-all", pickerTab === 'stickers' ? "bg-white/20 text-white scale-110 shadow-lg" : "text-white/40 hover:text-white")}><Sparkles size={20} /></button>
                  <button type="button" onClick={() => setLocalMessage(prev => prev + ':-)')} className="text-xs font-black text-white/40 hover:text-white transition-colors">:-)</button>
                </div>
                <button type="button" onClick={() => setLocalMessage(prev => prev.slice(0, -1))} className="text-white/30 hover:text-white transition-colors p-3 active:scale-90"><X size={20} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </ChatInputDock>
  );
});

async function uploadFileWithProgress(fileOrUrl, onProgress) {
  const formData = new FormData();

  if (fileOrUrl instanceof File) {
    formData.append('file', fileOrUrl);
  } else {
    try {
      const response = await fetch(fileOrUrl);
      const blob = await response.blob();
      formData.append('file', blob, 'device_gallery_attachment.jpg');
    } catch (err) {
      console.error('Fetch blob failed, sending mock file data', err);
      const mockBlob = new Blob(['mock content'], { type: 'image/jpeg' });
      formData.append('file', mockBlob, 'attachment.jpg');
    }
  }

  const response = await api.post('/upload/message', formData, {
    // Axios sets multipart headers automatically
    onUploadProgress: (progressEvent) => {
      const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
      onProgress(percent);
    },
  });

  return response.data?.url || response.data?.data?.url || response.data?.secure_url || '';
};

const EMPTY_MESSAGES_ARRAY: any[] = [];

export default function Messages() {
  const { user } = useUserStore();
  const { setActiveModal } = useModalStore();
  const socket = useSocket();
  const { startCall } = useCall();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { targetId: routeTargetId } = useParams();
  const targetChatId = searchParams.get('chat') || routeTargetId;

  // Add currentChatIdRef to prevent stale closures in socket events
  const currentChatIdRef = useRef<string | null>(null);

  // Track last targetChatId we already tried to fetch for (prevents infinite re-fetch loops)
  const lastFetchedTargetRef = useRef<string | null>(null);

  // Activate real-time message socket updates
  useMessageSocket();

  // --- Per-Chat Privacy Protection States & Dynamic Capacitor Bridge ---
  const [activePrivacy, setActivePrivacy] = useState<{
    screenshotProtection: boolean;
    screenRecordingProtection: boolean;
    copyProtection: boolean;
    forwardProtection: boolean;
    captureNotifications: boolean;
  } | null>(null);
  const [privacyAlert, setPrivacyAlert] = useState<{
    message: string;
    actorUserId: string;
    timestamp: string;
  } | null>(null);
  const [showScreenshotShield, setShowScreenshotShield] = useState(false);
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);

  const toggleAndroidSecure = async (enabled: boolean) => {
    try {
      if (PrivacyProtection && typeof PrivacyProtection.enablePrivacyProtection === 'function') {
        await (enabled ? PrivacyProtection.enablePrivacyProtection() : PrivacyProtection.disablePrivacyProtection());
        console.log(`[PrivacyProtection] Dynamic FLAG_SECURE ${enabled ? 'ENABLED' : 'DISABLED'}`);
      }
    } catch (err) {
      console.warn('[PrivacyProtection] Android/Capacitor dynamic bridge is offline or unavailable');
    }
  };

  // --- Sparkle Enterprise UX States ---
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [deleteConfirmCount, setDeleteConfirmCount] = useState<number | null>(null);
  const [undoToast, setUndoToast] = useState<{
    id: string;
    message: string;
    undoAction: () => void;
    commitAction: () => void;
  } | null>(null);
  const [showOrbitMenu, setShowOrbitMenu] = useState(false);
  const [showOrbitConstellation, setShowOrbitConstellation] = useState(false);
  const [peekChat, setPeekChat] = useState<any | null>(null);
  const [showOfficialOnboarding, setShowOfficialOnboarding] = useState(true);
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);

  useEffect(() => {
    api.get('/messages/official-chat').then(res => {
      if (res.data?.data) {
        setShowOfficialOnboarding(res.data.data.showOnboarding);
        if (res.data.data.status === 'NOT_STARTED') {
          api.post('/messages/official-chat/status', { targetStatus: 'VIEWED' }).catch(() => { });
        }
      }
    }).catch(console.warn);

    const handleOnboardingEvent = (e: any) => {
      if (e.detail) {
        setShowOfficialOnboarding(e.detail.showOnboarding);
      }
    };
    window.addEventListener('sparkle_onboarding_status_changed', handleOnboardingEvent);
    return () => {
      window.removeEventListener('sparkle_onboarding_status_changed', handleOnboardingEvent);
    };
  }, []);

  const toggleChatSelection = (chatId: string) => {
    setSelectedChatIds(prev =>
      prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]
    );
  };

  const toggleArchive = useChatStore(state => state.toggleArchive);
  const toggleDelete = useChatStore(state => state.toggleDelete);
  const togglePin = useChatStore(state => state.togglePin);
  const toggleMute = useChatStore(state => state.toggleMute);
  const toggleFavorite = useChatStore(state => state.toggleFavorite);
  const togglePriority = useChatStore(state => state.togglePriority);
  const toggleUnread = useChatStore(state => state.toggleUnread);

  const handleBatchArchive = () => {
    const idsToArchive = [...selectedChatIds];
    if (idsToArchive.length === 0) return;

    setSelectedChatIds([]);

    idsToArchive.forEach(id => {
      toggleArchive(id, true);
      api.post(`/messages/chat/${id}/archive`, { isArchived: true }).catch(() => {
        api.patch(`/messages/chat/${id}/archive`, { isArchived: true }).catch(console.error);
      });
    });

    setUndoToast({
      id: 'archive_' + Date.now(),
      message: `${idsToArchive.length} chat(s) archived`,
      undoAction: () => {
        idsToArchive.forEach(id => {
          toggleArchive(id, false);
          api.post(`/messages/chat/${id}/archive`, { isArchived: false }).catch(() => {
            api.patch(`/messages/chat/${id}/archive`, { isArchived: false }).catch(console.error);
          });
        });
      },
      commitAction: () => { }, // No-op, action already committed
    });
  };

  const triggerDeleteConfirmation = () => {
    if (selectedChatIds.length === 0) return;
    setDeleteConfirmCount(selectedChatIds.length);
  };

  const confirmBatchDelete = () => {
    const idsToDelete = [...selectedChatIds];
    setDeleteConfirmCount(null);
    if (idsToDelete.length === 0) return;

    setSelectedChatIds([]);

    idsToDelete.forEach(id => {
      toggleDelete(id);
      api.delete(`/messages/chat/${id}`).catch(console.error);
    });

    // Delete cannot be undone on the server side because data is dropped,
    // so we don't allow undoing deletions in the toast anymore, we just show a regular toast or nothing.
    setUndoToast({
      id: 'delete_' + Date.now(),
      message: `${idsToDelete.length} chat(s) deleted`,
      undoAction: () => { },
      commitAction: () => { },
    });
  };

  const handleBatchPin = () => {
    const idsToPin = [...selectedChatIds];
    if (idsToPin.length === 0) return;

    const allPinned = idsToPin.every(id => conversations.find(c => c.chat_id === id)?.is_pinned);
    const targetState = !allPinned;

    setSelectedChatIds([]);

    idsToPin.forEach(id => {
      togglePin(id, targetState);
      api.patch(`/messages/chat/${id}/pin`, { isPinned: targetState }).catch(() => {
        api.post(`/messages/chat/${id}/pin`, { isPinned: targetState }).catch(console.error);
      });
    });
  };

  const handleBatchMute = () => {
    const idsToMute = [...selectedChatIds];
    if (idsToMute.length === 0) return;

    const allMuted = idsToMute.every(id => conversations.find(c => c.chat_id === id)?.is_muted);
    const targetState = !allMuted;

    setSelectedChatIds([]);

    idsToMute.forEach(id => {
      toggleMute(id, targetState);
      api.post(`/messages/chat/${id}/mute`, { muted: targetState }).catch(() => {
        api.patch(`/messages/chat/${id}/mute`, { muted: targetState }).catch(console.error);
      });
    });
  };

  const handleBatchFavorite = () => {
    const idsToFav = [...selectedChatIds];
    if (idsToFav.length === 0) return;

    const allFav = idsToFav.every(id => conversations.find(c => c.chat_id === id)?.is_favorite);
    const targetState = !allFav;

    setSelectedChatIds([]);

    idsToFav.forEach(id => {
      toggleFavorite(id, targetState);
      api.patch(`/messages/chat/${id}/favorite`, { isFavorite: targetState }).catch(console.error);
    });
  };

  const handleBatchPriority = () => {
    const idsToPriority = [...selectedChatIds];
    if (idsToPriority.length === 0) return;

    const allPriority = idsToPriority.every(id => conversations.find(c => c.chat_id === id)?.is_priority);
    const targetState = !allPriority;

    setSelectedChatIds([]);

    idsToPriority.forEach(id => {
      togglePriority(id, targetState);
      api.patch(`/messages/chat/${id}/priority`, { isPriority: targetState }).catch(() => {
        api.post(`/messages/chat/${id}/priority`, { isPriority: targetState }).catch(console.error);
      });
    });
  };


  const handleBatchMarkUnread = () => {
    const idsToMark = [...selectedChatIds];
    if (idsToMark.length === 0) return;

    const allUnread = idsToMark.every(id => (conversations.find(c => c.chat_id === id)?.unread_count || 0) > 0);
    const targetUnread = !allUnread;

    setSelectedChatIds([]);

    idsToMark.forEach(id => {
      toggleUnread(id, targetUnread);
      if (targetUnread) {
        api.post(`/messages/unread/${id}`).catch(console.error);
      } else {
        api.post(`/messages/read/${id}`).catch(console.error);
      }
    });
  };

  const handleClearChat = () => {
    const idsToClear = [...selectedChatIds];
    if (idsToClear.length === 0) return;

    setSelectedChatIds([]);
    idsToClear.forEach(id => {
      useChatStore.getState().setMessages(id, []);
      api.post(`/messages/chat/${id}/clear`).catch(() => {
        api.delete(`/messages/chat/${id}/messages`).catch(console.error);
      });
    });
  };

  const handleBlockUser = () => {
    if (selectedChatIds.length === 0) return;
    const targetChat = conversations.find(c => c.chat_id === selectedChatIds[0]);
    if (targetChat && targetChat.partner_id) {
      api.post(`/privacy/block`, { target_user_id: targetChat.partner_id }).catch(console.error);
      setSelectedChatIds([]);
    }
  };

  // --- State ---
  const conversations = useChatStore(state => state.conversations);
  const setConversations = useChatStore(state => state.setConversations);
  const getTabBadgeCount = (tabId: string) => {
    const safeConvs = Array.isArray(conversations) ? conversations : [];
    if (tabId === 'all') return safeConvs.length;
    if (tabId === 'unread') {
      return safeConvs.reduce((acc, cv) => acc + (cv.unread_count || 0), 0);
    }
    if (tabId === 'groups') {
      return safeConvs.filter(cv => !!(cv.is_group || cv.chat_type === 'group')).length;
    }
    if (tabId === 'archived') {
      return safeConvs.filter(cv => !!(cv as any).is_archived).length;
    }
    const list = customLists.find(l => l.id === tabId);
    if (list) {
      return safeConvs.filter(cv => list.chatIds.includes(cv.chat_id)).length;
    }
    return 0;
  };
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);

  useEffect(() => {
    currentChatIdRef.current = selectedChat?.chat_id || null;
    const activeId = selectedChat?.chat_id || null;
    useChatStore.getState().setActiveConversationId(activeId);
    return () => {
      useChatStore.getState().setActiveConversationId(null);
    };
  }, [selectedChat?.chat_id]);

  useEffect(() => {
    const handleSynced = (e: any) => {
      const { chatId: syncedChatId } = e.detail || {};
      if (syncedChatId && selectedChat?.chat_id === syncedChatId) {
        console.log('🔄 [Messages] Reactive sync event received for active chat:', syncedChatId);
        const msgs = useChatStore.getState().messagesByConversation[syncedChatId] || [];
        updateMessages(() => [...msgs]);
      }
    };
    const handleTimeout = (e: any) => {
      const { messageId: timeoutMsgId } = e.detail || {};
      if (timeoutMsgId) {
        console.log('⏰ [Messages] Message timeout event received for messageId:', timeoutMsgId);
        updateMessages(prev => prev.map(m => (m.message_id === timeoutMsgId || m.id === timeoutMsgId ? { ...m, status: 'failed' } : m)));
      }
    };

    window.addEventListener('sparkle_messages_synced', handleSynced);
    window.addEventListener('sparkle_message_timeout', handleTimeout);
    return () => {
      window.removeEventListener('sparkle_messages_synced', handleSynced);
      window.removeEventListener('sparkle_message_timeout', handleTimeout);
    };
  }, [selectedChat?.chat_id]);

  const chatId = selectedChat?.chat_id ?? '';
  const messages = useChatStore(state => state.messagesByConversation[chatId] ?? EMPTY_MESSAGES_ARRAY);
  const setStoreMessages = useChatStore(state => state.setMessages);
  const addMessage = useChatStore(state => state.addMessage);
  const editMessage = useChatStore(state => state.editMessage);
  const deleteMessageLocal = useChatStore(state => state.deleteMessageLocal);
  const deleteMessagesBulkLocal = useChatStore(state => state.deleteMessagesBulkLocal);
  const deleteMessageForEveryone = useChatStore(state => state.deleteMessageForEveryone);
  const updateMessages = (updater: (msgs: any[]) => any[]) => {
    if (!chatId) return;
    const current = useChatStore.getState().messagesByConversation[chatId] || [];
    const updated = updater(current);
    console.log('[MESSAGE_STORE_UPDATED]', { chatId, length: updated.length });
    setStoreMessages(chatId, updated);
  };
  const updateMessagesForChat = (targetChatId: string, updater: (msgs: any[]) => any[]) => {
    if (!targetChatId) return;
    const current = useChatStore.getState().messagesByConversation[targetChatId] || [];
    const updated = updater(current);
    console.log('[MESSAGE_STORE_UPDATED]', { targetChatId, length: updated.length });
    setStoreMessages(targetChatId, updated);
  };
  const [messageSearch, setMessageSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [activeMessageMenu, setActiveMessageMenu] = useState<{ msg: any, type: 'longPress' | 'click' } | null>(null);
  const [reactionSheetMsg, setReactionSheetMsg] = useState<any | null>(null);
  const [activeMessagePermissions, setActiveMessagePermissions] = useState<MessagePermissions | undefined>(undefined);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<any | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [pendingDeletingIds, setPendingDeletingIds] = useState<Set<string>>(new Set());
  const [failedResendModalMsg, setFailedResendModalMsg] = useState<any | null>(null);

  const handleBulkDeleteForMe = () => {
    if (selectedMessageIds.size === 0 || !selectedChat) return;
    const idsArray = Array.from(selectedMessageIds);
    const targetChatId = selectedChat.chat_id;
    const operationId = crypto.randomUUID();

    // 1. Instantly update local UI (<100ms)
    deleteMessagesBulkLocal(targetChatId, idsArray);
    idsArray.forEach(id => useMessageStore.getState().deleteMessage(id));

    // 2. Transmit background socket / offline queue
    const payload = { operationId, messageIds: idsArray, chatId: targetChatId };
    if (socket?.connected) {
      socket.emit('delete-for-me-bulk', payload);
    } else {
      PersistentOfflineQueue.enqueueInteraction({
        type: 'delete-message',
        chatId: targetChatId,
        messageId: idsArray[0]
      });
    }

    // 3. Clear selection mode & restore normal composer
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
    setShowDeleteConfirm(false);
    setMessageToDelete(null);
  };

  const [audioPreviewFile, setAudioPreviewFile] = useState<File | null>(null);
  const [showAudioPreviewModal, setShowAudioPreviewModal] = useState<boolean>(false);

  const replyTargetId = useChatStore(state => state.replyTargets[chatId]);
  const replyToMessage = useMemo(() => {
    if (!chatId || !replyTargetId) return null;
    return useChatStore.getState().findMessage(chatId, replyTargetId) || null;
  }, [chatId, replyTargetId]);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<any | null>(null);
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState<string[]>([]);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [infoModalMessageId, setInfoModalMessageId] = useState<string | null>(null);

  useEffect(() => {
    const handleJumpToMessage = (e: any) => {
      const targetMsgId = e.detail?.messageId;
      if (targetMsgId) {
        setTimeout(() => {
          const el = document.getElementById(`msg-${targetMsgId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-purple-500', 'bg-purple-500/20');
            setTimeout(() => el.classList.remove('ring-2', 'ring-purple-500', 'bg-purple-500/20'), 2500);
          }
        }, 300);
      }
    };
    window.addEventListener('sparkle:jump-to-message', handleJumpToMessage);
    return () => window.removeEventListener('sparkle:jump-to-message', handleJumpToMessage);
  }, []);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [attachmentSheetHeight, setAttachmentSheetHeight] = useState<'partial' | 'full'>('partial');
  const [selectedMediaItems, setSelectedMediaItems] = useState<any[]>([]);
  const [showMediaComposer, setShowMediaComposer] = useState(false);
  const [mediaCaption, setMediaCaption] = useState('');
  const [uploadQueue, setUploadQueue] = useState<{ id: string; name: string; progress: number; status: 'uploading' | 'completed' | 'failed' }[]>([]);
  const [deviceMedia, setDeviceMedia] = useState<any[]>([]);
  const [mediaPermission, setMediaPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [peopleHubMode, setPeopleHubMode] = useState<'new_chat' | 'share_contact'>('new_chat');
  const [suggestedContacts, setSuggestedContacts] = useState<any[]>([]);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteView, setNoteView] = useState('main');
  // Helper to toggle selection of chats/contacts for forwarding
  const toggleForwardChat = (chatId: string) => {
    setSelectedForwardChatIds(prev => {
      if (prev.includes(chatId)) {
        return prev.filter(id => id !== chatId);
      }
      return [...prev, chatId];
    });
  };
  const [noteText, setNoteText] = useState(user?.note || '');
  const [showViewNoteModal, setShowViewNoteModal] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [noteReactionEmoji, setNoteReactionEmoji] = useState<string | null>(null);
  const [showNoteOptions, setShowNoteOptions] = useState(false);
  const [unreadCountInChat, setUnreadCountInChat] = useState(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [activeSettingView, setActiveSettingView] = useState('main');
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [customPhotoPreview, setCustomPhotoPreview] = useState<string | null>(null);
  const [playingEffectEmoji, setPlayingEffectEmoji] = useState<string | null>(null);
  const [showWordEmojiPicker, setShowWordEmojiPicker] = useState(false);
  const [newWordEffect, setNewWordEffect] = useState({ word: '', emoji: '😀' });
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ chatId: string, name: string }[]>([]);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  // Tracks whether the user is actively scrolling — used to subtly dim header presence text
  const [isScrollingMessages, setIsScrollingMessages] = useState(false);
  const scrollStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingExpiryTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isTypingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Note reaction states
  const [noteBubbles, setNoteBubbles] = useState<Array<{ id: number; emoji: string; x: number; delay: number }>>([]);
  const [noteReacted, setNoteReacted] = useState<string | null>(null);
  const [noteNotification, setNoteNotification] = useState<{ emoji: string; name: string; note: string } | null>(null);
  const [noteReactSent, setNoteReactSent] = useState(false);
  const [isNoteReacting, setIsNoteReacting] = useState(false);
  const [noteReplyText, setNoteReplyText] = useState('');
  const [showNoteEmojiPicker, setShowNoteEmojiPicker] = useState(false);

  // --- Chat Filter & Lists ---
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [customLists, setCustomLists] = useState<{ id: string; name: string; chatIds: string[]; isMuted?: boolean }[]>(() => {
    try {
      const saved = localStorage.getItem('sparkle_custom_lists');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [tabOrder, setTabOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sparkle_tab_order');
      return saved ? JSON.parse(saved) : ['all', 'unread', 'groups', 'archived'];
    } catch {
      return ['all', 'unread', 'groups', 'archived'];
    }
  });
  const [hiddenTabs, setHiddenTabs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sparkle_hidden_tabs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showNewListFlow, setShowNewListFlow] = useState<'none' | 'name' | 'addPeople'>('none');
  const [newListName, setNewListName] = useState('');
  const [pendingListId, setPendingListId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listSelectedChats, setListSelectedChats] = useState<string[]>([]);
  const [tabDropdown, setTabDropdown] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [tempTabOrder, setTempTabOrder] = useState<string[]>([]);
  const [tempHiddenTabs, setTempHiddenTabs] = useState<string[]>([]);
  const [showDevConsole, setShowDevConsole] = useState(false);

  // Hide bottom nav when viewing someone's note or using camera
  useEffect(() => {
    if (showViewNoteModal || showCameraModal) {
      document.body.classList.add('note-modal-open');
    } else {
      document.body.classList.remove('note-modal-open');
      if (!showViewNoteModal) {
        // Reset reaction state on close
        setNoteBubbles([]);
      }
    }
    return () => document.body.classList.remove('note-modal-open');
  }, [showViewNoteModal, showCameraModal]);

  // Hide bottom nav when list creation or reorder modals are open
  useEffect(() => {
    if (showNewListFlow !== 'none' || showReorderModal) {
      document.body.classList.add('list-modal-open');
    } else {
      document.body.classList.remove('list-modal-open');
    }
    return () => document.body.classList.remove('list-modal-open');
  }, [showNewListFlow, showReorderModal]);

  // Fetch permissions for active message when menu opens
  useEffect(() => {
    if (activeMessageMenu?.msg?.message_id) {
      api.get(`/messages/${activeMessageMenu.msg.message_id}/permissions`)
        .then(res => {
          if (res.data?.permissions) {
            setActiveMessagePermissions(res.data.permissions);
          }
        })
        .catch(err => {
          console.error("Error fetching message permissions:", err);
          setActiveMessagePermissions(undefined);
        });
    } else {
      setActiveMessagePermissions(undefined);
    }
  }, [activeMessageMenu]);

  const messagesByConversation = useChatStore(state => state.messagesByConversation);

  const effectiveMessagePermissions = useMemo(() => {
    const msgId = activeMessageMenu?.msg?.message_id;
    const storeMsg = selectedChat?.chat_id && msgId
      ? messagesByConversation[selectedChat.chat_id]?.find(m => m.message_id === msgId)
      : null;

    const msgPermissions = storeMsg?.permissions || activeMessagePermissions || activeMessageMenu?.msg?.permissions;
    if (msgPermissions) {
      return {
        ...msgPermissions,
        canCopy: msgPermissions.canCopy !== false,
        canForward: msgPermissions.canForward !== false,
      };
    }
    return {
      canCopy: true,
      canForward: true,
      canEdit: activeMessageMenu?.msg?.sender_id === (user?.id || user?.user_id),
      canDeleteForMe: true,
      canDeleteForEveryone: activeMessageMenu?.msg?.sender_id === (user?.id || user?.user_id),
      canReply: true,
      canReact: true,
      canPin: true,
    };
  }, [activeMessagePermissions, activeMessageMenu?.msg, selectedChat?.chat_id, messagesByConversation, user]);

  // Web Screenshot, Screen Recording & Clipboard Privacy Enforcement
  useEffect(() => {
    if (!selectedChat?.chat_id || selectedChat.chat_id.startsWith('temp_')) {
      setIsWindowBlurred(false);
      setShowScreenshotShield(false);
      return;
    }

    const isScreenshotProtected = !!(
      activePrivacy?.screenshotProtection ||
      (activePrivacy as any)?.blockScreenshots
    );
    const isRecordingProtected = !!(
      activePrivacy?.screenRecordingProtection ||
      (activePrivacy as any)?.blurScreenRecording
    );
    const isCopyProtected = !!(
      activePrivacy?.copyProtection ||
      (activePrivacy as any)?.allowCopy === false
    );

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isScreenshotProtected && !isRecordingProtected) return;

      const isPrtScn = e.key === 'PrintScreen' || e.code === 'PrintScreen';
      const isWinShiftS = e.key === 'S' && e.shiftKey && (e.metaKey || e.ctrlKey);
      const isMacScreenshot = (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5'));
      const isPrint = (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P');

      if (isPrtScn || isWinShiftS || isMacScreenshot || isPrint) {
        if (isPrint) e.preventDefault();
        setShowScreenshotShield(true);
        if (activePrivacy?.captureNotifications !== false && selectedChat?.chat_id) {
          api.post(`/messages/${selectedChat.chat_id}/capture-attempt`, {
            attemptType: 'SCREENSHOT_ATTEMPT',
            detectionMethod: 'WEB_KEYBOARD_LISTENER',
            deviceInfo: { userAgent: navigator.userAgent },
          }).catch(() => { });
        }
        setTimeout(() => setShowScreenshotShield(false), 2500);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isScreenshotProtected && !isRecordingProtected) return;
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        setShowScreenshotShield(true);
        setTimeout(() => setShowScreenshotShield(false), 2500);
      }
    };

    const handleWindowBlur = () => {
      if (isScreenshotProtected || isRecordingProtected) {
        setIsWindowBlurred(true);
      }
    };

    const handleWindowFocus = () => {
      setIsWindowBlurred(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden && (isScreenshotProtected || isRecordingProtected)) {
        setIsWindowBlurred(true);
      } else if (!document.hidden) {
        setIsWindowBlurred(false);
      }
    };

    const handleCopyEvent = (e: ClipboardEvent) => {
      if (isCopyProtected) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopyEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopyEvent);
    };
  }, [selectedChat?.chat_id, activePrivacy]);

  // Listen to real-time privacy settings update
  useEffect(() => {
    if (!socket || !selectedChat) return;

    const handlePrivacyUpdated = (data: any) => {
      if (data.chatId === selectedChat.chat_id) {
        // If role is receiver or omitted, update active privacy restrictions placed on us
        if (!data.role || data.role === 'receiver') {
          // Normalize: read from flat top-level OR nested privacySettings/permissions
          const ps = data.privacySettings || {};
          const enforced = {
            screenshotProtection: !!(data.screenshotProtection ?? ps.screenshotProtection ?? ps.blockScreenshots ?? data.permissions?.security?.secureWindow),
            screenRecordingProtection: !!(data.screenRecordingProtection ?? ps.screenRecordingProtection ?? ps.blurScreenRecording),
            copyProtection: !!(data.copyProtection ?? ps.copyProtection ?? (ps.allowCopy === false) ?? !(data.permissions?.canCopy ?? true)),
            forwardProtection: !!(data.forwardProtection ?? ps.forwardProtection ?? (ps.allowForward === false) ?? !(data.permissions?.canForward ?? true)),
            captureNotifications: !!(data.captureNotifications ?? ps.captureNotifications ?? ps.notifyScreenshotAttempts),
          };
          setActivePrivacy(enforced);
          toggleAndroidSecure(enforced.screenshotProtection);
        }

        // Refresh active message permissions if the menu is open
        if (activeMessageMenu?.msg?.message_id) {
          api.get(`/messages/${activeMessageMenu.msg.message_id}/permissions`)
            .then(res => {
              if (res.data?.permissions) {
                setActiveMessagePermissions(res.data.permissions);
              }
            })
            .catch(console.error);
        }
      }
    };

    // When global defaults change, re-fetch privacy for the active chat so DEFAULT-inheriting rows update
    const handleGlobalPrivacyUpdated = (_data: any) => {
      if (selectedChat?.chat_id) {
        api.get(`/messages/${selectedChat.chat_id}/privacy`)
          .then(res => {
            const data = res.data || {};
            const ps = data.mySettings || {};
            const enforced = data.enforcedSettings || {};
            const effective = enforced.effective || {};
            setActivePrivacy({
              screenshotProtection: !!effective.blockScreenshot,
              screenRecordingProtection: !!effective.blurScreenRecording,
              copyProtection: !effective.allowCopy,
              forwardProtection: !effective.allowForward,
              captureNotifications: !!effective.notifyScreenshotAttempts,
            });
          })
          .catch(console.error);
      }
    };

    const handleCaptureAttempt = (data: any) => {
      if (data.payload?.chatId === selectedChat.chat_id) {
        setPrivacyAlert({
          message: `⚠️ Alert: Screen capture attempt detected via ${data.payload.detectionMethod || 'system'}!`,
          actorUserId: data.payload.actorUserId,
          timestamp: data.payload.timestamp
        });
        setTimeout(() => {
          setPrivacyAlert(null);
        }, 6000);
      }
    };

    socket.on('privacy_updated', handlePrivacyUpdated);
    socket.on('conversation_privacy_updated', handlePrivacyUpdated);
    socket.on('global_privacy_updated', handleGlobalPrivacyUpdated);
    socket.on('capture_attempt', handleCaptureAttempt);
    return () => {
      socket.off('privacy_updated', handlePrivacyUpdated);
      socket.off('conversation_privacy_updated', handlePrivacyUpdated);
      socket.off('global_privacy_updated', handleGlobalPrivacyUpdated);
      socket.off('capture_attempt', handleCaptureAttempt);
    };
  }, [socket, selectedChat, activeMessageMenu]);

  // --- Local Storage Sync & Persistence Effects ---
  useEffect(() => {
    localStorage.setItem('sparkle_custom_lists', JSON.stringify(customLists));
  }, [customLists]);

  useEffect(() => {
    localStorage.setItem('sparkle_tab_order', JSON.stringify(tabOrder));
  }, [tabOrder]);

  useEffect(() => {
    localStorage.setItem('sparkle_hidden_tabs', JSON.stringify(hiddenTabs));
  }, [hiddenTabs]);

  // Keep tabOrder synchronized with added and deleted customLists
  useEffect(() => {
    setTabOrder(prev => {
      const missing = customLists.map(l => l.id).filter(id => !prev.includes(id));
      if (missing.length > 0) {
        return [...prev, ...missing];
      }
      const existing = prev.filter(id => {
        if (['all', 'unread', 'groups', 'archived'].includes(id)) return true;
        return customLists.some(l => l.id === id);
      });
      if (existing.length !== prev.length) {
        return existing;
      }
      return prev;
    });
  }, [customLists]);

  // Fallback to 'all' if the active filter gets hidden or deleted
  useEffect(() => {
    if (hiddenTabs.includes(activeFilter)) {
      setActiveFilter('all');
    }
  }, [hiddenTabs, activeFilter]);

  const { getThemeForChat, setThemeForChat, getQuickReaction, setQuickReaction, getWordEffects, addWordEffect, removeWordEffect } = useThemeStore();
  const currentChatTheme = selectedChat ? getThemeForChat(selectedChat.chat_id) : null;
  const activeThemeId = currentChatTheme?.id;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const notePlaceholder = "Feeling sparkle ✨";

  const getShortLastSeen = (time: string | null | undefined) => {
    if (!time) return '...';
    const diff = Date.now() - new Date(time).getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  // --- Effects ---
  useEffect(() => {
    fetchInbox();
    fetchSuggested();
  }, []);

  // --- Real Device Media Initializer & Scanner ---
  useEffect(() => {
    // Start with empty array so only real device files are shown
    setDeviceMedia([]);
  }, []);

  const handleDeviceImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: any[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const objectUrl = URL.createObjectURL(file);
      newItems.push({
        id: `local_media_${Date.now()}_${i}`,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        url: objectUrl,
        file: file,
        name: file.name,
        folder: file.type.startsWith('video/') ? 'Videos' : 'Downloads',
        isLarge: i === 0 || i === 1
      });
    }

    setDeviceMedia(prev => [...newItems, ...prev]);
    setMediaPermission('granted');
  };

  // showLastSeen is always true for offline partners — no toggling timer
  // The AnimatePresence in the header already handles smooth Online ↔ last-seen transitions
  const showLastSeen = !selectedChat?.partner_online && !(selectedChat?.is_online === 1) && !(selectedChat?.is_online === true);

  useEffect(() => {
    if (targetChatId) {
      const chat = conversations.find(c => c.chat_id === targetChatId || c.partner_id === targetChatId);
      if (chat) {
        setSelectedChat(chat);
      } else if (conversations.length > 0 && lastFetchedTargetRef.current !== targetChatId) {
        lastFetchedTargetRef.current = targetChatId;
        fetchInbox();
      } else if (conversations.length > 0) {
        setSelectedChat(null);
      }
    } else {
      setSelectedChat(null);
    }
  }, [targetChatId, conversations]);

  useEffect(() => {
    const store = useChatStore.getState();
    if (selectedChat) {
      store.setActiveConversationId(selectedChat.chat_id);
      socket?.emit('mark-read', selectedChat.chat_id);
      store.markRead(selectedChat.chat_id, user?.id || user?.user_id || '');
      store.refreshConversation(selectedChat.chat_id);
      fetchMessages(selectedChat.chat_id);
    } else {
      store.setActiveConversationId(null);
    }
  }, [selectedChat?.chat_id, socket, user]);

  useEffect(() => {
    if (selectedChat?.chat_id && !selectedChat.chat_id.startsWith('temp_')) {
      const chatId = selectedChat.chat_id;
      const cacheKey = `sparkle_privacy_cache_${chatId}`;
      // 1. Immediately hydrate from private sandbox / preferences cache to eliminate screen exposure lag
      SparkleStorage.getPrivacyCache(chatId).then(cached => {
        if (cached) {
          setActivePrivacy(cached);
          toggleAndroidSecure(!!cached?.screenshotProtection);
        } else {
          try {
            const raw = localStorage.getItem(cacheKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              setActivePrivacy(parsed);
              toggleAndroidSecure(!!parsed?.screenshotProtection);
            }
          } catch (e) { }
        }
      }).catch(() => { });

      // 2. Fetch authoritative privacy settings from server
      api.get(`/messages/${chatId}/privacy`)
        .then(res => {
          const enforced = res.data?.enforcedSettings || res.data;
          setActivePrivacy(enforced);
          toggleAndroidSecure(!!enforced?.screenshotProtection);
          SparkleStorage.setPrivacyCache(chatId, enforced).catch(() => { });
          try {
            localStorage.setItem(cacheKey, JSON.stringify(enforced));
          } catch (e) { }
        })
        .catch(err => {
          console.error('Failed to load chat privacy settings:', err);
        });
    } else {
      setActivePrivacy(null);
      toggleAndroidSecure(false);
    }

    return () => {
      toggleAndroidSecure(false);
    };
  }, [selectedChat?.chat_id]);

  // Register native Android screenshot detection listener
  useEffect(() => {
    let sub: any = null;
    let cancelled = false;

    (async () => {
      try {
        if (PrivacyProtection && typeof PrivacyProtection.addListener === 'function') {
          const handle = await PrivacyProtection.addListener('onScreenshotAttempt', (eventData: any) => {
            if (selectedChat?.chat_id && !selectedChat.chat_id.startsWith('temp_')) {
              api.post(`/messages/${selectedChat.chat_id}/capture-attempt`, {
                attemptType: 'SCREENSHOT_ATTEMPT',
                detectionMethod: eventData?.detectionMethod || 'NATIVE_BRIDGE',
                deviceInfo: { userAgent: navigator.userAgent },
              }).catch(console.error);
            }
          });
          if (!cancelled) {
            sub = handle;
          } else if (handle && typeof handle.remove === 'function') {
            handle.remove();
          }
        }
      } catch (_err) {
        // PrivacyProtection plugin is not implemented on web — silently ignore
      }
    })();

    return () => {
      cancelled = true;
      if (sub && typeof sub.remove === 'function') {
        try { sub.remove(); } catch (_e) { }
      }
    };
  }, [selectedChat?.chat_id]);


  // --- Handlers ---
  const fetchInbox = async () => {
    setLoading(true);
    try {
      const res = await api.get('/messages/inbox');
      const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setConversations(list);
    } catch (err: any) {
      console.error('Failed to fetch inbox', err.response?.data || err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggested = async () => {
    try {
      const res = await api.get('/users/active-friends');
      setSuggestedContacts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch suggested', err);
      setSuggestedContacts([]);
    }
  };

  const handleOpenDirectChat = (contact: any) => {
    const partnerId = contact.user_id || contact.id;
    const existing = conversations.find(c => c.partner_id === partnerId);

    if (existing) {
      setSelectedChat(existing);
      navigate(`/messages?chat=${existing.chat_id}`);
    } else {
      // Create a temporary chat object for the UI — no client-generated timestamps
      setSelectedChat({
        chat_id: 'temp_' + Date.now(),
        partner_id: partnerId,
        partner_name: sanitizePartnerName(contact.name || contact.username, contact.username),
        partner_avatar: contact.avatar_url,
        unread_count: 0,
        last_message_time: null,
        partner_online: contact.is_online
      });
      // Clear the chat param since we are in a temp chat
      navigate('/messages', { replace: true });
    }
  };

  const fetchMessages = async (chatId: string) => {
    // 1. Show cached messages immediately for instant UI (cache disabled, using empty array)
    const cached: any[] = [];
    if (cached && cached.length > 0) {
      setStoreMessages(chatId, cached);
      scrollToBottom();
    }

    // 2. Fetch fresh from network
    try {
      const res = await api.get(`/messages/chat/${chatId}`);
      const msgs = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      // Deduplicate: merge server list with any optimistic local msgs
      updateMessages(prev => {
        const serverIds = new Set(msgs.map((m: any) => m.message_id));
        const localOnly = prev.filter(m => !serverIds.has(m.message_id));
        return [...msgs, ...localOnly];
      });
      scrollToBottom();
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  const selectedChatRef = useRef<any>(null);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // Dedicated effect to handle initial read receipts when a new conversation is explicitly opened/tapped
  useEffect(() => {
    if (selectedChat) {
      const isTyping = typingUsers.some(t => t.chatId === selectedChat.chat_id);
      setPartnerIsTyping(isTyping);
    } else {
      setPartnerIsTyping(false);
    }

    if (!socket || !selectedChat) return;

    if (document.hasFocus() && !(selectedChat.is_group || selectedChat.chat_type === 'group') && !selectedChat.chat_id.startsWith('temp_')) {
      socket.emit('mark-read', selectedChat.chat_id);
      socket.emit('message-read-ack', { chatId: selectedChat.chat_id });
      setUnreadCountInChat(0);

      // Cleanly clear local unread count badge in sidebar list
      setConversations((prev: any[]) => prev.map(c => {
        if (c.chat_id === selectedChat.chat_id) {
          return { ...c, unread_count: 0 };
        }
        return c;
      }));
    }
  }, [socket, selectedChat?.chat_id, typingUsers]);

  // Join the socket.io room for the active chat whenever it changes
  useEffect(() => {
    if (!socket || !selectedChat) return;
    const targetId = selectedChat.chat_id;
    if (targetId && !targetId.startsWith('temp_')) {
      console.log('[JOIN_CHAT_EMIT]', targetId);
      socket.emit('join-chat', targetId);
    }
  }, [socket, selectedChat?.chat_id]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: any) => {
      console.log('[MESSAGE_RECEIVED]', msg);
      const activeChat = selectedChatRef.current;
      const isCurrentChat = activeChat && (msg.conversation_id === activeChat.chat_id || msg.chat_id === activeChat.chat_id || msg.sender_id === activeChat.partner_id);

      // 1. If it belongs to current active chat, update message array
      if (isCurrentChat) {
        const activeChatId = currentChatIdRef.current;
        if (activeChatId) {
          updateMessagesForChat(activeChatId, prev => {
            if (prev.some(m => m.message_id === msg.message_id)) return prev;
            return [...prev, msg];
          });
        }
        triggerWordEffect(msg.content);

        // Let backend know we received it ONLY IF NOT GROUP
        const isGroup = activeChat?.is_group || activeChat?.chat_type === 'group' || msg.chat_type === 'group';
        if (!isGroup) {
          if (document.hasFocus()) {
            socket.emit('mark-read', msg.conversation_id || msg.chat_id);
          } else {
            socket.emit('mark-delivered', { messageId: msg.message_id, chatId: msg.conversation_id || msg.chat_id });
          }
        }

        if (isNearBottomRef.current) {
          setTimeout(() => scrollToBottom('smooth'), 50);
          setUnreadCountInChat(0);
        } else {
          setUnreadCountInChat(prev => prev + 1);
        }
      } else {
        // We received a message for a different chat, mark it delivered if personal
        if (msg.chat_type !== 'group') {
          socket.emit('mark-delivered', { messageId: msg.message_id, chatId: msg.conversation_id || msg.chat_id });
        }
      }

      // 2. Reactively update the conversations list — use ONLY server-provided timestamps
      setConversations((prev: any[]) => {
        const chatId = msg.conversation_id || msg.chat_id;
        const chatIndex = prev.findIndex(c => c.chat_id === chatId || c.partner_id === msg.sender_id);

        const getFormattedPreview = (m: any) => {
          const t = m.type || 'text';
          const cnt = m.content || '';
          if (t === 'location') {
            if (cnt && typeof cnt === 'string' && cnt.startsWith('{')) {
              try {
                const p = JSON.parse(cnt);
                if (p.name || p.address) return `📍 ${p.name || p.address}`;
              } catch (e) { }
            }
            return '📍 Location';
          }
          if (t === 'live_location') return '📍 Live Location';
          if (t === 'attachment') return '🎬 Story reply';
          if (t === 'image') return '📷 Photo';
          if (t === 'video') return '🎥 Video';
          if (t === 'audio') return '🎤 Voice note';
          if (t === 'document') return '📄 Document';
          if (t === 'contact') return '👤 Contact Card';
          if (cnt && typeof cnt === 'string' && cnt.startsWith('{"type":')) {
            try {
              const p = JSON.parse(cnt);
              if (p.type === 'location') return p.name || p.address ? `📍 ${p.name || p.address}` : '📍 Location';
              if (p.type === 'live_location') return '📍 Live Location';
            } catch (e) { }
          }
          return cnt || (t !== 'text' ? `Shared ${t}` : '');
        };

        const displayPreview = getFormattedPreview(msg);

        if (chatIndex >= 0) {
          const newConvs = [...prev];
          const chat = { ...newConvs[chatIndex] };
          chat.last_message = displayPreview;
          chat.last_message_type = msg.type;
          chat.last_message_content = displayPreview;
          // Use server timestamp only — never fall back to client Date
          chat.last_message_time = msg.sent_at || msg.created_at || chat.last_message_time;
          // Inherit status from the server message payload; never assume 'sent'
          chat.last_message_status = msg.status || 'sent';
          if (msg.sender_id !== (user?.id || user?.user_id) && (!activeChat || activeChat.chat_id !== chat.chat_id)) {
            chat.unread_count = (chat.unread_count || 0) + 1;
          }
          newConvs.splice(chatIndex, 1);
          newConvs.unshift(chat);
          return newConvs;
        } else {
          // New conversation!
          const newChat: any = {
            chat_id: chatId,
            partner_id: msg.sender_id,
            partner_name: sanitizePartnerName(msg.sender_name || msg.sender_username || 'New Contact', msg.sender_username),
            partner_avatar: msg.sender_avatar,
            unread_count: (activeChat && activeChat.chat_id === chatId) ? 0 : 1,
            last_message: displayPreview,
            last_message_type: msg.type,
            last_message_content: displayPreview,
            last_message_time: msg.sent_at || msg.created_at,
            last_message_status: msg.status || 'sent',
            partner_online: true
          };
          return [newChat, ...prev];
        }
      });
    };

    const handleMessagesDelivered = (data: { chatId: string, messageId?: string, userId: string }) => {
      const myId = user?.id || user?.user_id;
      if (data.userId === myId) return; // Prevent falsely upgrading own messages when self receives

      const activeChatId = currentChatIdRef.current;
      if (activeChatId && data.chatId === activeChatId) {
        updateMessagesForChat(activeChatId, prev => prev.map(m => {
          if (m.sender_id === myId && m.status !== 'read' && (m.message_id === data.messageId || !data.messageId)) {
            return { ...m, status: 'delivered' };
          }
          return m;
        }));
      }
      setConversations((prev: any[]) => prev.map(c => {
        if (c.chat_id === data.chatId && c.last_message_status !== 'read') {
          return { ...c, last_message_status: 'delivered' };
        }
        return c;
      }));
    };

    const handleMessagesRead = (data: { chatId: string, readAt?: string, userId?: string }) => {
      const myId = user?.id || user?.user_id;
      if (data.userId === myId) return; // Prevent falsely upgrading own messages when self reads

      const activeChatId = currentChatIdRef.current;
      if (activeChatId && data.chatId === activeChatId) {
        updateMessagesForChat(activeChatId, prev => prev.map(m => {
          // Only upgrade MY outgoing messages to 'read'; never touch received messages, never downgrade
          if (m.sender_id === myId && m.status !== 'read' && data.readAt) {
            return { ...m, status: 'read', read_at: data.readAt };
          }
          return m;
        }));
      }
      setConversations((prev: any[]) => prev.map(c => {
        if (c.chat_id === data.chatId) {
          return { ...c, last_message_status: 'read', unread_count: 0 };
        }
        return c;
      }));
    };

    const handleUserStatus = (data: { userId: string; isOnline: boolean; lastSeen: string | null }) => {
      setConversations((prev: any[]) => prev.map(chat => {
        if (chat.partner_id === data.userId) {
          return { ...chat, is_online: data.isOnline ? 1 : 0, last_seen_at: data.lastSeen, partner_online: data.isOnline };
        }
        return chat;
      }));
      const activeChat = selectedChatRef.current;
      if (activeChat && activeChat.partner_id === data.userId) {
        setSelectedChat(prev => prev ? { ...prev, is_online: data.isOnline ? 1 : 0, last_seen_at: data.lastSeen, partner_online: data.isOnline } : null);
      }
    };

    const handleUserTyping = (data: { chatId: string, userId: string, isTyping: boolean, username?: string }) => {
      const myId = user?.id || user?.user_id;
      if (data.userId === myId) return;

      // Clear existing safety timer for this chat if any
      const existingTimer = typingExpiryTimersRef.current.get(data.chatId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        typingExpiryTimersRef.current.delete(data.chatId);
      }

      const activeChat = selectedChatRef.current;
      const isCurrentChat = activeChat && activeChat.chat_id === data.chatId;

      if (data.isTyping) {
        if (isCurrentChat) {
          setPartnerIsTyping(true);
        }
        setTypingUsers(prev => {
          const filtered = prev.filter(t => t.chatId !== data.chatId);
          return [...filtered, { chatId: data.chatId, name: data.username || 'Someone' }];
        });

        // 5-second safety timer to clear typing state if stop-event is lost
        const timer = setTimeout(() => {
          setTypingUsers(prev => prev.filter(t => t.chatId !== data.chatId));
          if (selectedChatRef.current?.chat_id === data.chatId) {
            setPartnerIsTyping(false);
          }
          typingExpiryTimersRef.current.delete(data.chatId);
        }, 5000);
        typingExpiryTimersRef.current.set(data.chatId, timer);
      } else {
        if (isCurrentChat) {
          setPartnerIsTyping(false);
        }
        setTypingUsers(prev => prev.filter(t => t.chatId !== data.chatId));
      }
    };

    const handleUserNoteUpdate = (data: { userId: string, note: string | null }) => {
      setSuggestedContacts((prev: any[]) => prev.map(contact => {
        if (contact.user_id === data.userId || contact.id === data.userId) {
          return { ...contact, note: data.note };
        }
        return contact;
      }));
    };

    const handleGroupPresenceUpdate = (data: { chatId: string, onlineCount: number }) => {
      setConversations((prev: any[]) => prev.map(chat => {
        if (chat.chat_id === data.chatId) {
          return { ...chat, group_online_count: data.onlineCount };
        }
        return chat;
      }));
      const activeChat = selectedChatRef.current;
      if (activeChat && activeChat.chat_id === data.chatId) {
        setSelectedChat(prev => prev ? { ...prev, group_online_count: data.onlineCount } : null);
      }
    };

    const handleMessagePinned = (data: { messageId: string, chatId: string, pinnedBy: string }) => {
      const activeChatId = currentChatIdRef.current;
      if (activeChatId && data.chatId === activeChatId) {
        updateMessagesForChat(activeChatId, prev => prev.map(m => m.message_id === data.messageId ? { ...m, pinned: true, pinned_at: new Date().toISOString(), pinned_by: data.pinnedBy } : m));
      }
    };

    const handleMessageUnpinned = (data: { messageId: string, chatId: string }) => {
      const activeChatId = currentChatIdRef.current;
      if (activeChatId && data.chatId === activeChatId) {
        updateMessagesForChat(activeChatId, prev => prev.map(m => m.message_id === data.messageId ? { ...m, pinned: false, pinned_at: undefined, pinned_by: undefined } : m));
      }
    };

    const handleMessageEdited = (data: { messageId: string, chatId: string, content: string, editedAt: string }) => {
      const activeChatId = currentChatIdRef.current;
      if (activeChatId && data.chatId === activeChatId) {
        updateMessagesForChat(activeChatId, prev => prev.map(m => m.message_id === data.messageId ? { ...m, content: data.content, edited: true, edited_at: data.editedAt } : m));
      }
    };

    const handleMessageDeletedEveryone = (data: { messageId: string, chatId: string }) => {
      console.log('[DELETE_RECEIVED]', data);
      const activeChatId = currentChatIdRef.current;
      if (activeChatId && data.chatId === activeChatId) {
        updateMessagesForChat(activeChatId, prev => {
          const updated = prev.map(m => m.message_id === data.messageId ? { ...m, content: 'This message was deleted', is_deleted_for_everyone: true } : m);
          const updatedMsg = updated.find(m => m.message_id === data.messageId);
          console.log('[DELETE_STORE_UPDATED]', updatedMsg);
          return updated;
        });
      }
    };

    const handleMessageDeletedMe = (data: { messageId: string, chatId: string }) => {
      const activeChatId = currentChatIdRef.current;
      if (activeChatId && data.chatId === activeChatId) {
        updateMessagesForChat(activeChatId, prev => prev.filter(m => m.message_id !== data.messageId));
      }
    };

    const handleNewReaction = (data: { messageId: string, chatId: string, userId: string, emoji: string }) => {
      const activeChatId = currentChatIdRef.current;
      if (activeChatId && data.chatId === activeChatId) {
        updateMessagesForChat(activeChatId, prev => prev.map(m => {
          if (m.message_id === data.messageId) {
            const reactions = m.reactions || [];
            if (reactions.some(r => r.user_id === data.userId)) {
              return { ...m, reactions: reactions.map(r => r.user_id === data.userId ? { ...r, emoji: data.emoji } : r) };
            }
            return { ...m, reactions: [...reactions, { emoji: data.emoji, user_id: data.userId }] };
          }
          return m;
        }));
      }
    };
    // Lightweight re-fetch wrapper used by chat-updated listener
    const fetchChatList = () => fetchInbox();
    const handleReactionRemoved = (data: { messageId: string, chatId: string, userId: string, emoji: string }) => {
      const activeChatId = currentChatIdRef.current;
      if (activeChatId && data.chatId === activeChatId) {
        updateMessagesForChat(activeChatId, prev => prev.map(m => {
          if (m.message_id === data.messageId) {
            const reactions = m.reactions || [];
            return { ...m, reactions: reactions.filter(r => !(r.user_id === data.userId && r.emoji === data.emoji)) };
          }
          return m;
        }));
      }
    };

    const handleNewMessageWrapped = (message: any) => {
      console.log('[NEW_MESSAGE]', message.chatId);
      console.log('[CURRENT_CHAT]', useChatStore.getState().currentChatId);
      console.log('[STORE_MESSAGES]', useChatStore.getState().messagesByChat?.[message.chatId]?.length);
      handleNewMessage(message);
    };

    // Commented out to avoid duplication with useMessageSocket.ts which updates the chatStore directly.
    // socket.on('new-message', handleNewMessageWrapped);
    // socket.on('receive_message', handleNewMessage);
    // socket.on('messages-delivered', handleMessagesDelivered);
    // socket.on('messages-read', handleMessagesRead);
    socket.on('user-status', handleUserStatus);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-note-update', handleUserNoteUpdate);
    socket.on('group:presence:update', handleGroupPresenceUpdate);
    socket.on('message-pinned', handleMessagePinned);
    socket.on('message-unpinned', handleMessageUnpinned);
    // socket.on('message-edited', handleMessageEdited);
    // socket.on('message-deleted-everyone', handleMessageDeletedEveryone);
    // socket.on('message-deleted-me', handleMessageDeletedMe);
    // socket.on('new-reaction', handleNewReaction);
    // socket.on('reaction-removed', handleReactionRemoved);

    // Listen for chat-updated events so the sidebar refreshes
    const handleChatUpdated = (data: { chatId: string }) => {
      console.log('[CHAT_UPDATED_RECEIVED]', data);
      // Re-fetch inbox to pick up new last_message / unread_count
      fetchInbox();
    };
    socket.on('chat-updated', handleChatUpdated);

    const handleReconnect = () => {
      const activeChatId = currentChatIdRef.current;
      console.log('🔄 Socket connected/reconnected! Rejoining active chat room:', activeChatId);
      if (activeChatId && !activeChatId.startsWith('temp_')) {
        socket.emit('join-chat', activeChatId);
      }
    };
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('new-message', handleNewMessageWrapped);
      socket.off('receive_message', handleNewMessage);
      socket.off('messages-delivered', handleMessagesDelivered);
      socket.off('messages-read', handleMessagesRead);
      socket.off('user-status', handleUserStatus);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-note-update', handleUserNoteUpdate);
      socket.off('group:presence:update', handleGroupPresenceUpdate);
      socket.off('message-pinned', handleMessagePinned);
      socket.off('message-unpinned', handleMessageUnpinned);
      socket.off('message-edited', handleMessageEdited);
      socket.off('message-deleted-everyone', handleMessageDeletedEveryone);
      socket.off('message-deleted-me', handleMessageDeletedMe);
      socket.off('new-reaction', handleNewReaction);
      socket.off('reaction-removed', handleReactionRemoved);
      socket.off('chat-updated', handleChatUpdated);
      socket.off('connect', handleReconnect);
    };
  }, [socket, user?.id, user?.user_id]);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setUnreadCountInChat(0);
  };

  // Scroll to bottom when visual viewport height changes (e.g. keyboard opens/closes)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      if (selectedChat && isNearBottomRef.current) {
        // Wait slightly for layout to settle before scrolling
        setTimeout(() => {
          scrollToBottom('auto');
        }, 80);
      }
    };

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, [selectedChat?.chat_id]);

  // Trigger UI side effects when new messages are added to the store for this active conversation
  useEffect(() => {
    if (!messages || messages.length === 0 || !selectedChat) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    const myId = user?.id || user?.user_id;
    const isMe = lastMsg.sender_id === myId;

    if (!isMe) {
      // 1. Trigger word animations
      if (lastMsg.content) {
        triggerWordEffect(lastMsg.content);
      }

      // 2. Mark read/delivered if not group
      const isGroup = selectedChat.is_group || selectedChat.chat_type === 'group';
      if (!isGroup && !selectedChat.chat_id.startsWith('temp_')) {
        if (document.hasFocus()) {
          socket?.emit('mark-read', selectedChat.chat_id);
        } else {
          socket?.emit('mark-delivered', { messageId: lastMsg.message_id, chatId: selectedChat.chat_id });
        }
      }
    }

    // 3. Scroll to bottom
    if (isNearBottomRef.current) {
      setTimeout(() => scrollToBottom('smooth'), 50);
    }
  }, [messages.length, selectedChat?.chat_id]);

  const triggerWordEffect = (content: string) => {
    if (!selectedChat) return;
    const effects = getWordEffects(selectedChat.chat_id);
    if (!effects || effects.length === 0) return;

    const lowerContent = content.toLowerCase();
    for (const effect of effects) {
      if (lowerContent.includes(effect.word)) {
        setPlayingEffectEmoji(effect.emoji);
        setTimeout(() => setPlayingEffectEmoji(null), 3000);
        return;
      }
    }
  };

  /**
   * Canonical Media Selection Handler
   * Normalizes input from Direct Camera, Direct File picker, or Attachment Sheet.
   * Ensures media goes through Media Composer & Upload Queue, NEVER text pipeline.
   */
  const handleMediaSelection = async (payload: {
    source: 'camera' | 'file' | 'picker' | 'attachment';
    files?: FileList | File[] | null;
    file?: File | Blob | null;
    uri?: string;
    dataUrl?: string;
    type?: 'image' | 'video' | 'audio' | 'document';
    fileName?: string;
  }) => {
    console.log(`[MEDIA_SHORTCUT] source=${payload.source}`);
    if (!selectedChat) return;

    const normalizedItems: any[] = [];

    // 1. Multiple raw files (from File input / picker)
    if (payload.files && payload.files.length > 0) {
      for (let i = 0; i < payload.files.length; i++) {
        const f = payload.files[i];
        const mime = f.type || '';
        let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
        if (mime.startsWith('image/')) mediaType = 'image';
        else if (mime.startsWith('video/')) mediaType = 'video';
        else if (mime.startsWith('audio/')) mediaType = 'audio';

        const url = URL.createObjectURL(f);
        console.log(`[MEDIA_NORMALIZED] type=${mediaType} mime=${mime} name=${f.name}`);
        normalizedItems.push({
          id: `media_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          type: mediaType,
          url: url,
          file: f,
          name: f.name || payload.fileName || `Attachment_${i + 1}`
        });
      }
    }
    // 2. Single raw file / Blob (from Document input / File picker)
    else if (payload.file) {
      const f = payload.file as File;
      const mime = f.type || '';
      let mediaType: 'image' | 'video' | 'audio' | 'document' = payload.type || 'document';
      if (mime.startsWith('image/')) mediaType = 'image';
      else if (mime.startsWith('video/')) mediaType = 'video';
      else if (mime.startsWith('audio/')) mediaType = 'audio';

      const url = URL.createObjectURL(f);
      console.log(`[MEDIA_NORMALIZED] type=${mediaType} mime=${mime} name=${f.name || payload.fileName}`);
      normalizedItems.push({
        id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: mediaType,
        url: url,
        file: f,
        name: f.name || payload.fileName || `Attachment_${Date.now()}`
      });
    }
    // 3. DataUrl / URI (from Camera capture or Base64 picker)
    else if (payload.dataUrl || payload.uri) {
      const rawUri = payload.dataUrl || payload.uri || '';
      if (!rawUri) return;

      const isVideo = rawUri.startsWith('data:video') || rawUri.includes('video/mp4') || rawUri.endsWith('.mp4') || rawUri.endsWith('.webm');
      const isAudio = rawUri.startsWith('data:audio') || rawUri.endsWith('.mp3') || rawUri.endsWith('.wav');
      const isDoc = rawUri.endsWith('.pdf') || rawUri.endsWith('.docx') || rawUri.endsWith('.zip');
      let mediaType: 'image' | 'video' | 'audio' | 'document' = payload.type || (isVideo ? 'video' : isAudio ? 'audio' : isDoc ? 'document' : 'image');

      let fileBlob: Blob | undefined;
      try {
        if (rawUri.startsWith('data:')) {
          const res = await fetch(rawUri);
          fileBlob = await res.blob();
        }
      } catch (err) {
        console.warn('[Camera] Failed to convert URI to blob:', err);
      }

      const name = payload.fileName || `Camera_${mediaType === 'video' ? 'Video' : mediaType === 'audio' ? 'Audio' : 'Photo'}_${Date.now()}`;
      console.log(`[MEDIA_NORMALIZED] type=${mediaType} name=${name}`);
      normalizedItems.push({
        id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: mediaType,
        url: rawUri,
        file: fileBlob,
        name: name
      });
    }

    // Reject invalid / empty payload early
    if (normalizedItems.length === 0) {
      console.warn('[MEDIA_PIPELINE_WARN] Empty or invalid media payload rejected.');
      return;
    }

    // Route documents/audio directly to Upload Queue with optimistic cards, or images/videos into Media Composer
    const firstItem = normalizedItems[0];
    if (firstItem.type === 'document' || firstItem.type === 'audio') {
      setShowAttachmentSheet(false);
      for (const item of normalizedItems) {
        const queueId = `upload_${Date.now()}_${item.id}`;
        const tempMessageId = crypto.randomUUID();
        console.log(`[MEDIA_UPLOAD_START] mediaId=${item.id}`);

        // Optimistic document / audio message bubble
        const optimisticMsg: any = {
          message_id: tempMessageId,
          id: tempMessageId,
          sender_id: user?.id || user?.user_id || '',
          content: item.name || 'Attachment',
          status: 'sending',
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          is_read: false,
          type: item.type,
          media_url: item.url,
          mediaUrl: item.url
        };
        console.log(`[MEDIA_MESSAGE_CREATE] messageId=${tempMessageId} type=${item.type}`);
        updateMessages(prev => [...prev, optimisticMsg]);
        AudioSessionManager.playSound('send');
        if (isNearBottom) setTimeout(() => scrollToBottom('smooth'), 50);

        setUploadQueue(prev => [...prev, { id: queueId, name: item.name, progress: 0, status: 'uploading' }]);

        (async () => {
          try {
            const filePayload = item.file || item.url;
            const uploadedUrl = await uploadFileWithProgress(filePayload, (p) => {
              setUploadQueue(prev => prev.map(u => u.id === queueId ? { ...u, progress: p } : u));
            });

            setUploadQueue(prev => prev.map(u => u.id === queueId ? { ...u, progress: 100, status: 'completed' } : u));
            setTimeout(() => setUploadQueue(prev => prev.filter(u => u.id !== queueId)), 3000);

            const finalMediaUrl = uploadedUrl || item.url;
            if (selectedChat) {
              const payload = {
                messageId: tempMessageId,
                chatId: selectedChat.chat_id,
                partnerId: selectedChat.partner_id,
                content: item.name || 'Attachment',
                type: item.type,
                mediaUrl: finalMediaUrl
              };

              if (socket?.connected) {
                socket.emit('send-message', payload, (response: any) => {
                  if (response?.success) {
                    updateMessages(prev => prev.map(m => (m.message_id === tempMessageId || m.id === tempMessageId)
                      ? { ...m, status: 'sent', media_url: finalMediaUrl, mediaUrl: finalMediaUrl }
                      : m
                    ));
                  } else {
                    updateMessages(prev => prev.map(m => (m.message_id === tempMessageId || m.id === tempMessageId)
                      ? { ...m, status: 'failed' }
                      : m
                    ));
                  }
                });
              } else {
                PersistentOfflineQueue.enqueue(payload);
              }
            }
          } catch (err) {
            console.error('[MediaUpload] Upload failed:', err);
            setUploadQueue(prev => prev.map(u => u.id === queueId ? { ...u, status: 'failed' } : u));
            updateMessages(prev => prev.map(m => (m.message_id === tempMessageId || m.id === tempMessageId)
              ? { ...m, status: 'failed' }
              : m
            ));
          }
        })();
      }
    } else {
      // Route images / videos into existing Media Composer for preview & captioning
      setShowAttachmentSheet(false);
      setSelectedMediaItems(normalizedItems);
      setMediaCaption('');
      setShowMediaComposer(true);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, contentOverride?: string, specialType?: string, mediaUrl?: string, metadataPayload?: string) => {
    if (e) e.preventDefault();
    const currentChatId = selectedChat?.chat_id || '';
    const storeDraft = useChatStore.getState().drafts[currentChatId] || '';
    const content = contentOverride || storeDraft;
    const isRich = !!specialType;
    if (!content.trim() && !isRich) return;
    if (!selectedChat) return;

    // Safeguard assertion: Never allow raw media payloads or JSON stringified files into text pipeline
    const messageType = specialType || 'text';
    const isMediaPayload = content.includes('"type":"camera_capture"') || content.includes('"type":"file"') || content.startsWith('data:image') || content.startsWith('data:video');
    if (messageType === 'text' && isMediaPayload) {
      console.error('[MEDIA_PIPELINE_ERROR] Media attempted to enter text pipeline! Intercepting.', { content });
      return;
    }

    const editing = useChatStore.getState().editing;
    if (editing.messageId && editing.chatId === selectedChat.chat_id) {
      const msgId = editing.messageId;
      socket?.emit('edit-message', {
        messageId: msgId,
        chatId: selectedChat.chat_id,
        content
      }, (response: { success: boolean, error?: string }) => {
        if (!response.success) {
          alert(response.error || 'Failed to edit message');
        }
      });
      useChatStore.getState().finishEdit(selectedChat.chat_id);
      return;
    }

    if (!isRich) triggerWordEffect(content);

    const sendStartTime = performance.now();
    // ── Generate a stable UUID BEFORE anything else.
    // This same ID goes into the optimistic bubble AND the socket payload,
    // so every retry is idempotent on the server.
    const messageId = crypto.randomUUID();
    const optimisticMsg: any = {
      message_id: messageId,
      id: messageId,
      sender_id: user?.id || user?.user_id || '',
      content: content || (specialType ? `Shared ${specialType}` : ''),
      status: 'sending',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_read: false,
      type: specialType || 'text',
      media_url: mediaUrl,
      mediaUrl: mediaUrl,
      metadata: metadataPayload
    };

    if (replyToMessage) {
      optimisticMsg.reply_to_message_id = replyToMessage.message_id;
      optimisticMsg.reply_content = replyToMessage.content;
      optimisticMsg.reply_type = replyToMessage.type || 'text';
      optimisticMsg.reply_sender_name = replyToMessage.sender_name || replyToMessage.sender_username || 'User';
    }

    // ── Step 1: Display IMMEDIATELY — user sees the message before any network call
    updateMessages(prev => [...prev, optimisticMsg]);
    if (!contentOverride && !isRich) setNewMessage('');
    if (selectedChat) {
      useChatStore.getState().setDraft(selectedChat.chat_id, '');
    }
    // Release the sending lock immediately — the message is already visible.
    // Network status is indicated by the bubble's status field, not the input lock.
    setSending(false);

    const localRenderMs = Math.round(performance.now() - sendStartTime);

    // ── Sparkle Audio: instant 'send' feedback ──
    AudioSessionManager.playSound('send');

    // Auto scroll if was at bottom
    if (isNearBottom) {
      setTimeout(() => scrollToBottom('smooth'), 50);
    }

    // Stop typing immediately on send
    if (isTypingRef.current) {
      socket?.emit('typing', { chatId: selectedChat.chat_id, isTyping: false });
      isTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    const payload: any = {
      messageId,               // ← client UUID travels to server for idempotency
      chatId: selectedChat.chat_id,
      partnerId: selectedChat.partner_id,
      content: content || (specialType ? `Shared ${specialType}` : ''),
      type: specialType || 'text',
      mediaUrl: mediaUrl,
      metadata: metadataPayload
    };

    if (replyToMessage) {
      payload.replyToId = replyToMessage.message_id;
    }

    const currentReplyTo = replyToMessage;
    if (selectedChat) {
      useChatStore.getState().setReplyTarget(selectedChat.chat_id, undefined);
    }

    // ── Step 2: Enqueue to Durable Local Outbox FIRST ──
    PersistentOfflineQueue.enqueue({
      messageId,
      chatId: selectedChat.chat_id,
      recipientId: selectedChat.partner_id,
      senderId: user?.id || user?.user_id || '',
      content: content || (specialType ? `Shared ${specialType}` : ''),
      type: specialType || 'text',
      mediaUrl: mediaUrl,
      replyToId: currentReplyTo?.message_id,
      context: 'chat'
    }).catch((err) => console.warn('[Sparkle] Outbox persistence warning:', err));

    // Start individual 10-second delivery timeout timer
    PersistentOfflineQueue.startMessageTimeout(messageId, () => {
      updateMessages(prev => prev.map(m => (m.message_id === messageId || m.id === messageId ? { ...m, status: 'failed' } : m)));
      if (selectedChat) {
        useChatStore.getState().updateMessage(selectedChat.chat_id, messageId, { status: 'failed' });
      }
    });

    // ── Step 3: Transmit via WebSocket if connected ──
    const emitStartTime = performance.now();
    if (socket?.connected) {
      socket.emit('send-message', payload, (response: { success: boolean, messageId?: string, sentAt?: string, error?: string }) => {
        const serverAckMs = Math.round(performance.now() - emitStartTime);
        const totalMs = Math.round(performance.now() - sendStartTime);
        console.log(`[SPARKLE_MESSAGE_PERFORMANCE] messageId=${messageId} localRenderMs=${localRenderMs}ms serverAckMs=${serverAckMs}ms totalMs=${totalMs}ms STATUS:${response?.success ? 'PASS' : 'FAIL'}`);
        if (response && response.success && response.messageId) {
          PersistentOfflineQueue.acknowledge(messageId);
          if (selectedChat) {
            useChatStore.getState().setDraft(selectedChat.chat_id, '');
          }
          updateMessages(prev => prev.map(m => m.message_id === messageId || m.id === messageId
            ? {
              ...m,
              message_id: response.messageId!,
              id: response.messageId!,
              status: 'sent',
              sent_at: response.sentAt || m.sent_at,
              reply_to_message_id: currentReplyTo?.message_id || null,
              reply_content: currentReplyTo?.content || null,
              reply_type: currentReplyTo?.type || null
            }
            : m
          ));
          setConversations((prev: any[]) => {
            const chatIndex = prev.findIndex(c => c.chat_id === selectedChat.chat_id);
            if (chatIndex >= 0) {
              const newConvs = [...prev];
              const chat = { ...newConvs[chatIndex] };
              const preview = specialType === 'location'
                ? '📍 Location'
                : specialType === 'live_location'
                  ? '📍 Live Location'
                  : (content || (specialType ? `Shared ${specialType}` : ''));
              chat.last_message = preview;
              chat.last_message_type = specialType || 'text';
              chat.last_message_content = preview;
              chat.last_message_status = 'sent';
              chat.last_message_time = response.sentAt || chat.last_message_time;
              newConvs.splice(chatIndex, 1);
              newConvs.unshift(chat);
              return newConvs;
            }
            return prev;
          });
        } else {
          console.warn('[Sparkle] Socket emit unacknowledged, message remains in outbox:', response?.error);
        }
      });
    } else {
      console.log('[Sparkle] Offline — message safely persisted in local outbox:', messageId);
    }
  };

  const handleSendMessageWrapper = (e: any, content: string) => handleSendMessage(e, content);

  /**
   * Retry a failed message using its existing UUID — fully idempotent.
   * The server will return the existing message if it already has the UUID,
   * so this is safe to call multiple times.
   */
  const handleRetryMessage = (failedMsg: any) => {
    if (!selectedChat) return;
    const msgId = failedMsg.message_id || failedMsg.id;

    // Mark back to 'sending'
    updateMessages(prev => prev.map(m =>
      (m.message_id === msgId || m.id === msgId) ? { ...m, status: 'sending' } : m
    ));
    useChatStore.getState().updateMessage(selectedChat.chat_id, msgId, { status: 'sending' });
    PersistentOfflineQueue.updateStatus(msgId, 'sending');

    // Start individual 10-second timer for manual resend attempt
    PersistentOfflineQueue.startMessageTimeout(msgId, () => {
      updateMessages(prev => prev.map(m => (m.message_id === msgId || m.id === msgId ? { ...m, status: 'failed' } : m)));
      useChatStore.getState().updateMessage(selectedChat.chat_id, msgId, { status: 'failed' });
    });

    const payload: any = {
      messageId: msgId,  // same UUID — server deduplicates
      chatId: selectedChat.chat_id,
      partnerId: selectedChat.partner_id,
      content: failedMsg.content,
      type: failedMsg.type || 'text',
      mediaUrl: failedMsg.media_url || failedMsg.mediaUrl,
    };
    if (failedMsg.reply_to_message_id) payload.replyToId = failedMsg.reply_to_message_id;

    if (socket?.connected) {
      socket.emit('send-message', payload, (response: any) => {
        if (response?.success && response.messageId) {
          PersistentOfflineQueue.acknowledge(msgId);
          updateMessages(prev => prev.map(m =>
            (m.message_id === msgId || m.id === msgId)
              ? { ...m, message_id: response.messageId, id: response.messageId, status: 'sent', sent_at: response.sentAt || m.sent_at }
              : m
          ));
        } else {
          PersistentOfflineQueue.markFailed(msgId);
          updateMessages(prev => prev.map(m =>
            (m.message_id === msgId || m.id === msgId) ? { ...m, status: 'failed' } : m
          ));
        }
      });
    } else {
      console.log('[Sparkle] Retry queued offline, will sync when connection returns:', msgId);
    }
  };

  const handleVoiceSend = async (file: File, durationSeconds?: number, source: 'recorded_voice_note' | 'device_audio_attachment' = 'recorded_voice_note') => {
    if (!selectedChat) return;

    const clientMessageId = crypto.randomUUID();
    const blobUrl = URL.createObjectURL(file);
    const queueId = `upload_${clientMessageId}`;

    const messageType = source === 'device_audio_attachment' ? 'audio' : 'voice_note';
    const metadataPayload = JSON.stringify({
      duration: durationSeconds || 0,
      source,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type
    });

    const optimisticMsg: any = {
      message_id: clientMessageId,
      id: clientMessageId,
      sender_id: user?.id || user?.user_id || '',
      content: source === 'device_audio_attachment' ? file.name : '🎤 Voice note',
      status: 'sending',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_read: false,
      type: messageType,
      media_url: blobUrl,
      mediaUrl: blobUrl,
      metadata: metadataPayload
    };

    if (replyToMessage) {
      optimisticMsg.reply_to_message_id = replyToMessage.message_id;
      optimisticMsg.reply_content = replyToMessage.content;
      optimisticMsg.reply_type = replyToMessage.type || 'text';
      optimisticMsg.reply_sender_name = replyToMessage.sender_name || replyToMessage.sender_username || 'User';
    }

    // 1. Instantly render voice/audio message bubble optimistically
    updateMessages(prev => [...prev, optimisticMsg]);
    AudioSessionManager.playSound('send');

    // Clear reply state if set
    if (selectedChat) {
      useChatStore.getState().setReplyTarget(selectedChat.chat_id, undefined);
    }

    // 2. Queue background upload
    setUploadQueue(prev => [...prev, { id: queueId, name: file.name || 'Voice Note', progress: 0, status: 'uploading' }]);

    try {
      const mediaUrl = await uploadFileWithProgress(file, (progress) => {
        setUploadQueue(prev => prev.map(item => item.id === queueId ? { ...item, progress } : item));
      });

      setUploadQueue(prev => prev.map(item => item.id === queueId ? { ...item, progress: 100, status: 'completed' } : item));
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(item => item.id !== queueId));
      }, 3000);

      if (mediaUrl) {
        // 3. Update local message bubble with uploaded URL
        updateMessages(prev => prev.map(m =>
          (m.message_id === clientMessageId || m.id === clientMessageId)
            ? { ...m, media_url: mediaUrl, mediaUrl: mediaUrl }
            : m
        ));

        // 4. Emit message payload with clientMessageId over socket / offline queue
        const payload: any = {
          messageId: clientMessageId,
          chatId: selectedChat.chat_id,
          partnerId: selectedChat.partner_id,
          content: optimisticMsg.content,
          type: messageType,
          mediaUrl,
          metadata: metadataPayload
        };
        if (replyToMessage) payload.replyToId = replyToMessage.message_id;

        if (socket && socket.connected) {
          socket.emit('send-message', payload, (response: any) => {
            if (response?.success) {
              updateMessages(prev => prev.map(m =>
                (m.message_id === clientMessageId || m.id === clientMessageId)
                  ? { ...m, status: 'sent', sent_at: response.sentAt || m.sent_at }
                  : m
              ));
            } else {
              updateMessages(prev => prev.map(m =>
                (m.message_id === clientMessageId || m.id === clientMessageId)
                  ? { ...m, status: 'failed' }
                  : m
              ));
            }
          });
        } else {
          PersistentOfflineQueue.enqueue(payload);
        }
      } else {
        updateMessages(prev => prev.map(m =>
          (m.message_id === clientMessageId || m.id === clientMessageId) ? { ...m, status: 'failed' } : m
        ));
      }
    } catch (err) {
      console.error('Failed to upload voice/audio note:', err);
      setUploadQueue(prev => prev.map(item => item.id === queueId ? { ...item, status: 'failed' } : item));
      updateMessages(prev => prev.map(m =>
        (m.message_id === clientMessageId || m.id === clientMessageId) ? { ...m, status: 'failed' } : m
      ));
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    updateMessages(prev => prev.filter(m => m.message_id !== msgId));
    if (socket && selectedChat) {
      socket.emit('delete-for-everyone', {
        messageId: msgId,
        chatId: selectedChat.chat_id,
        isGroup: selectedChat.type === 'group'
      });
    }
  };

  const handleReactToMessage = async (msgId: string, emoji: string) => {
    if (!selectedChat) return;
    const chatId = selectedChat.chat_id;
    const currentUserId = user?.id || user?.user_id;
    if (!currentUserId) return;

    // Find message in current list
    const targetMsg = messages.find(m => (m.message_id === msgId || (m as any).id === msgId));
    const currentReactions = targetMsg?.reactions || [];
    const myExistingReaction = currentReactions.find((r: any) => r.user_id === currentUserId);

    if (myExistingReaction && myExistingReaction.emoji === emoji) {
      // Toggle off / remove reaction
      useChatStore.getState().removeReaction(chatId, msgId, currentUserId, emoji);
      const item = PersistentOfflineQueue.enqueueInteraction({
        type: 'remove-reaction',
        chatId,
        messageId: msgId
      });
      if (socket && socket.connected) {
        socket.emit('remove-reaction', { ...item, operationId: item.operationId });
      }
    } else {
      // Add / Replace reaction
      useChatStore.getState().addReaction(chatId, msgId, currentUserId, emoji);
      const item = PersistentOfflineQueue.enqueueInteraction({
        type: 'add-reaction',
        chatId,
        messageId: msgId,
        emoji
      });
      if (socket && socket.connected) {
        socket.emit('add-reaction', { ...item, operationId: item.operationId });
      }
    }
  };
  const handleTyping = (val: string) => {
    if (val.length > 0 && !isMenuCollapsed) setIsMenuCollapsed(true);
    if (val.length === 0 && isMenuCollapsed) setIsMenuCollapsed(false);

    if (selectedChat) {
      // Logic for typing:start / typing:stop
      if (!isTypingRef.current && val.length > 0) {
        isTypingRef.current = true;
        socket?.emit('typing', { chatId: selectedChat.chat_id, isTyping: true });
      } else if (isTypingRef.current && val.length === 0) {
        isTypingRef.current = false;
        socket?.emit('typing', { chatId: selectedChat.chat_id, isTyping: false });
      }

      // Refresh timeout for inactivity
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (val.length > 0) {
        typingTimeoutRef.current = setTimeout(() => {
          isTypingRef.current = false;
          socket?.emit('typing', { chatId: selectedChat.chat_id, isTyping: false });
        }, 2000);
      }
    }
  };
  const handleScroll = (e: any) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsNearBottom(nearBottom);
    isNearBottomRef.current = nearBottom;
    setShowScrollToBottom(!nearBottom);
    if (nearBottom) setUnreadCountInChat(0);

    // Mark as scrolling — debounce the stop signal 300ms after last scroll event
    // This dims header presence text ONLY during active scrolling, then restores it.
    // No looping timers: purely reactive to user input.
    setIsScrollingMessages(true);
    if (scrollStopRef.current) clearTimeout(scrollStopRef.current);
    scrollStopRef.current = setTimeout(() => setIsScrollingMessages(false), 300);
  };
  // Memoized filtered messages based on search term
  const filteredMessages = useMemo(() => {
    if (!messageSearch.trim()) return messages;
    const term = messageSearch.trim().toLowerCase();
    return messages.filter(m => (m.content ?? '').toLowerCase().includes(term));
  }, [messages, messageSearch]);

  const pinnedMessages = useMemo(() => {
    return messages.filter(m => m.pinned);
  }, [messages]);

  const startNewChat = (contact: any) => {
    const existing = conversations.find(c => c.partner_id === contact.user_id);
    if (existing) {
      setSelectedChat(existing);
    } else {
      setSelectedChat({
        chat_id: 'temp_' + Date.now(),
        partner_id: contact.user_id,
        partner_name: sanitizePartnerName(contact.name || contact.username, contact.username),
        partner_avatar: contact.avatar_url,
        unread_count: 0,
        last_message_time: new Date().toISOString()
      });
    }
    setShowNewChatModal(false);
  };

  const handleAction = (label: string) => {
    if (label === 'Customize themes') setActiveSettingView('customize');
    else alert(`Action: ${label}`);
  };

  const handleApplyTheme = () => {
    if (previewThemeId && selectedChat) {
      const theme = PRESET_THEMES.find(t => t.id === previewThemeId);
      if (theme) setThemeForChat(selectedChat.chat_id, theme);
      setPreviewThemeId(null);
      setActiveSettingView('main');
    }
  };

  const safeTime = (time: string) => {
    if (!time) return '';
    const date = new Date(time);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  /**
   * WhatsApp-style absolute last-seen for private chat header.
   * Never uses relative counters — always anchors to today / yesterday / weekday / date.
   * "last seen" prefix is added by the JSX caller.
   */
  const formatLastSeen = (time: string) => formatLastSeenChat(time);

  const formatMessageText = (content?: string) => {
    if (!content) return '';
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'camera_capture') return '📷 Photo';
      if (parsed.type === 'marketplace_inquiry') return '🛒 Marketplace inquiry';
    } catch (e) { }
    return content;
  };

  const getDeletedMessageText = (msg: any, isMe: boolean) => {
    const isGroup = selectedChat?.is_group || selectedChat?.chat_type === 'group';
    if (!isGroup) {
      return isMe ? "You deleted this message" : "This message was deleted";
    } else {
      if (isMe) return "You deleted this message";
      if (msg.content && msg.content.includes("deleted by admin")) {
        return msg.content;
      }
      return `Message deleted by ${msg.sender_name || msg.sender_username || 'User'}`;
    }
  };

  const getStatusLabel = (chat: ChatConversation) => {
    // Only show outgoing receipt status when there are no unread incoming messages
    if ((chat.unread_count ?? 0) > 0) return '';
    // Map backend 'read' → display 'Seen', 'delivered' → 'Delivered', else 'Sent'
    // IMPORTANT: Never derive 'Delivered' from partner_online — that causes false positives.
    // Status must only advance via explicit socket ACK (mark-delivered / join-chat).
    const s = chat.last_message_status;
    if (s === 'read' || s === 'seen') return 'Seen';
    if (s === 'delivered') return 'Delivered';
    if (s === 'sent') return 'Sent';
    return '';
  };

  /** Compact, human-readable timestamp — delegates to shared utility so format is consistent everywhere */
  const getTimeAgo = (time?: string) => formatChatTimestamp(time);

  // --- Filtered & Sorted conversations ---
  const filteredConversations = useMemo(() => {
    const convsList = Array.isArray(conversations) ? conversations : [];
    let list = convsList;
    if (activeFilter === 'unread') {
      list = convsList.filter(c => (c.unread_count || 0) > 0 && !c.is_archived);
    } else if (activeFilter === 'groups') {
      list = convsList.filter(c => !!(c.is_group || c.chat_type === 'group') && !c.is_archived);
    } else if (activeFilter === 'archived') {
      list = convsList.filter(c => !!c.is_archived);
    } else {
      const custom = customLists.find(l => l.id === activeFilter);
      if (custom) {
        list = convsList.filter(c => custom.chatIds.includes(c.chat_id) && !c.is_archived);
      } else {
        // Main 'all' tab: hide archived chats
        list = convsList.filter(c => !c.is_archived);
      }
    }

    // Filter by message search query if typed
    if (messageSearch.trim()) {
      const q = messageSearch.toLowerCase();
      list = list.filter(c => {
        const identity = IdentityManager.resolveIdentity(c);
        const name = (identity.displayName || c.partner_name || '').toLowerCase();
        const msg = (c.last_message || '').toLowerCase();
        return name.includes(q) || msg.includes(q);
      });
    }

    // Tiered sorting: Pinned -> Priority/Favorites -> Normal (by newest timestamp)
    return [...list].sort((a, b) => {
      const aPinned = a.is_pinned ? 1 : 0;
      const bPinned = b.is_pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      const aPriority = (a.is_priority || a.is_favorite) ? 1 : 0;
      const bPriority = (b.is_priority || b.is_favorite) ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;

      const aTime = new Date(a.last_message_at || a.last_message_time || 0).getTime();
      const bTime = new Date(b.last_message_at || b.last_message_time || 0).getTime();
      return bTime - aTime;
    });
  }, [conversations, activeFilter, customLists, messageSearch]);


  const visibleTabs = useMemo(() => {
    const presetLabels: Record<string, string> = {
      all: 'All',
      unread: 'Unread',
      groups: 'Groups',
      archived: 'Archived'
    };

    return tabOrder
      .filter(id => !hiddenTabs.includes(id))
      .map(id => {
        const custom = customLists.find(l => l.id === id);
        return {
          id,
          label: custom ? custom.name : (presetLabels[id] || id),
          isCustom: !!custom,
          isMuted: custom?.isMuted
        };
      });
  }, [tabOrder, hiddenTabs, customLists]);

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    if (!editingListId) {
      const id = `list_${Date.now()}`;
      setPendingListId(id);
    }
    setShowNewListFlow('addPeople');
  };

  const handleConfirmList = () => {
    if (!newListName.trim()) return;
    if (editingListId) {
      setCustomLists(prev => prev.map(l => l.id === editingListId ? { ...l, name: newListName.trim(), chatIds: listSelectedChats } : l));
      setActiveFilter(editingListId);
    } else {
      const id = pendingListId || `list_${Date.now()}`;
      setCustomLists(prev => [...prev, { id, name: newListName.trim(), chatIds: listSelectedChats }]);
      setActiveFilter(id);
    }
    setShowNewListFlow('none');
    setNewListName('');
    setListSelectedChats([]);
    setPendingListId(null);
    setEditingListId(null);
  };

  // --- Long Press & Context Menu Event Handlers for Tabs ---
  const touchTimerRef = useRef<any>(null);

  const startTouchTimer = (e: React.TouchEvent, tabId: string) => {
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);

    touchTimerRef.current = setTimeout(() => {
      setTabDropdown({
        tabId,
        x: clientX,
        y: clientY + 12
      });
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const clearTouchTimer = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setTabDropdown({
      tabId,
      x: e.clientX,
      y: e.clientY + 8
    });
  };

  const moveTabInList = (id: string, direction: 'up' | 'down') => {
    setTempTabOrder(prev => {
      const isPreset = ['unread', 'groups', 'archived'].includes(id);
      let activeList: string[] = [];
      if (isPreset) {
        activeList = prev.filter(x => ['unread', 'groups', 'archived'].includes(x) && !tempHiddenTabs.includes(x));
      } else {
        activeList = prev.filter(x => !['all', 'unread', 'groups', 'archived'].includes(x));
      }

      const idx = activeList.indexOf(id);
      if (idx === -1) return prev;

      const newActive = [...activeList];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx >= 0 && targetIdx < newActive.length) {
        const temp = newActive[idx];
        newActive[idx] = newActive[targetIdx];
        newActive[targetIdx] = temp;
      }

      const finalPresets = isPreset
        ? newActive
        : prev.filter(x => ['unread', 'groups', 'archived'].includes(x));

      const finalCustoms = !isPreset
        ? newActive
        : prev.filter(x => !['all', 'unread', 'groups', 'archived'].includes(x));

      const finalOrder = [
        'all',
        ...finalPresets.filter(x => !tempHiddenTabs.includes(x)),
        ...finalCustoms.filter(x => !tempHiddenTabs.includes(x)),
        ...prev.filter(x => tempHiddenTabs.includes(x))
      ];
      return finalOrder;
    });
  };

  return (
    <AppScreen>
      <Navbar />
      <WordEffectBubbles emoji={playingEffectEmoji} active={!!playingEffectEmoji} />

      <KeyboardAwareChatLayout className="flex flex-col lg:flex-row flex-1 overflow-hidden relative bg-[#111118]">
        {/* SIDEBAR */}
        <aside className={clsx(
          "w-full lg:w-[420px] bg-[#13131a] border-r border-white/[0.06] flex flex-col transition-all duration-300 min-h-0 h-full",
          selectedChat ? 'hidden lg:flex' : 'flex flex-1 lg:flex-initial'
        )}>
          <StatusBarBackground backgroundColor="#13131a" />
          {selectedChatIds.length > 0 ? (
            <SparkleHorizontalActionBar
              selectedCount={selectedChatIds.length}
              isPinned={selectedChatIds.length > 0 && selectedChatIds.every(id => conversations.find(c => c.chat_id === id)?.is_pinned)}
              isMuted={selectedChatIds.length > 0 && selectedChatIds.every(id => conversations.find(c => c.chat_id === id)?.is_muted)}
              isFavorite={selectedChatIds.length > 0 && selectedChatIds.every(id => conversations.find(c => c.chat_id === id)?.is_favorite)}
              onClearSelection={() => setSelectedChatIds([])}
              onPin={handleBatchPin}
              onMute={handleBatchMute}
              onArchive={handleBatchArchive}
              onDelete={triggerDeleteConfirmation}
              onMore={() => setShowSelectionMenu(true)}
            />
          ) : (
            <header className="px-5 pt-4 pb-2 overflow-visible bg-[#13131a]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative cursor-pointer hover:scale-105 active:scale-95 transition-all" onClick={() => navigate(`/profile/${user?.username || user?.user_id}`)}>
                    <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-12 h-12 rounded-full object-cover border-2 border-white/[0.12] shadow-lg" alt="" />
                  </div>
                  <h1 className="text-[26px] font-bold text-white/90 tracking-tight">Chats</h1>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowCameraModal(true)} className="w-10 h-10 flex items-center justify-center text-[#ff1493] hover:bg-white/5 rounded-full transition-all">
                    <Camera size={22} strokeWidth={2.2} />
                  </button>
                  <button
                    onClick={() => { setPeopleHubMode('new_chat'); setShowNewChatModal(true); }}
                    className="w-10 h-10 flex items-center justify-center text-[#ff1493] hover:bg-white/5 rounded-full transition-all"
                  >
                    <SquarePen size={22} strokeWidth={2.2} />
                  </button>
                  <button
                    onClick={() => navigate('/messages/settings')}
                    className="w-10 h-10 flex items-center justify-center text-[#ff1493] hover:bg-white/5 rounded-full transition-all"
                    title="Message Settings"
                  >
                    <Settings size={22} strokeWidth={2.2} />
                  </button>
                  <button
                    onClick={() => setShowOrbitMenu(true)}
                    className="w-10 h-10 flex items-center justify-center text-[#ff1493] hover:bg-white/5 rounded-full transition-all"
                    title="Sparkle Options"
                  >
                    <Orbit size={22} strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              <div className="relative mb-4 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-[#ff1493]/80" size={16} />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={messageSearch}
                  onChange={e => setMessageSearch(e.target.value)}
                  className="w-full h-[46px] rounded-2xl pl-11 pr-4 text-[14.5px] font-medium text-white/90 placeholder:text-white/40 transition-all outline-none focus:shadow-[0_0_0_2px_rgba(255,20,147,0.18)]"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.13)',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.04)'
                  }}
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center mb-3 gap-2">
                <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
                  {visibleTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilter(tab.id)}
                      onContextMenu={(e) => handleContextMenu(e, tab.id)}
                      onTouchStart={(e) => startTouchTimer(e, tab.id)}
                      onTouchEnd={clearTouchTimer}
                      onTouchMove={clearTouchTimer}
                      className={clsx(
                        'shrink-0 px-2.5 py-1 text-[11px] font-bold transition-all duration-200 select-none touch-none',
                        activeFilter === tab.id
                          ? 'bg-[#ff1493] text-white shadow-[0_0_12px_rgba(255,20,147,0.28)] rounded-md'
                          : 'bg-white/[0.16] text-white hover:bg-white/[0.25] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.08] rounded-md'
                      )}
                    >
                      <span className="flex items-center gap-1.5 pointer-events-none">
                        {tab.label}
                        {tab.isMuted && <BellOff size={10} className="opacity-65" />}
                        {(() => {
                          const count = getTabBadgeCount(tab.id);
                          if (count <= 0) return null;
                          const displayCount = count > 99 ? '99+' : count;
                          return (
                            <span className={clsx(
                              "inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black rounded-sm leading-none min-w-[14px]",
                              activeFilter === tab.id
                                ? "bg-white text-[#ff1493]"
                                : "bg-white/20 text-white"
                            )}>
                              {displayCount}
                            </span>
                          );
                        })()}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Plus button to add a new list/filter */}
                <button
                  onClick={() => {
                    setEditingListId(null);
                    setNewListName('');
                    setListSelectedChats([]);
                    setShowNewListFlow('name');
                  }}
                  className="w-[26px] h-[26px] shrink-0 flex items-center justify-center bg-white/[0.08] border border-white/[0.06] hover:bg-white/[0.15] text-white rounded-md transition-all active:scale-95 shadow-sm"
                >
                  <Plus size={13} strokeWidth={3} />
                </button>
              </div>
            </header>
          )}

          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto pb-24 no-scrollbar scroll-smooth bg-[#13131a]"
          >
            {Array.isArray(filteredConversations) && filteredConversations.length === 0 && !loading ? (
              <div className="py-12 px-4">
                <ModernOfflineState
                  type="empty"
                  title="No chats yet"
                  message="When you start a conversation, it'll show up here."
                  onRetry={() => fetchInbox()}
                />
              </div>
            ) : (
              Array.isArray(filteredConversations) && filteredConversations.map((chat) => (
                <SparkleSwipeableChatItem
                  key={chat.chat_id}
                  chat={chat}
                  isSelected={selectedChatIds.includes(chat.chat_id)}
                  isSelectionMode={selectedChatIds.length > 0}
                  user={user}
                  onSelect={() => toggleChatSelection(chat.chat_id)}
                  onOpen={() => {
                    setSelectedChat(chat);
                    navigate(`/messages?chat=${chat.chat_id}`);
                    if (chat.unread_count > 0) {
                      setConversations((prev: any[]) => prev.map(c =>
                        c.chat_id === chat.chat_id ? { ...c, unread_count: 0 } : c
                      ));
                    }
                  }}
                  onLongPress={() => toggleChatSelection(chat.chat_id)}
                  onArchive={() => {
                    const targetId = chat.chat_id;
                    toggleArchive(targetId, true);
                    api.post(`/messages/chat/${targetId}/archive`, { isArchived: true }).catch(() => {
                      api.patch(`/messages/chat/${targetId}/archive`, { isArchived: true }).catch(console.error);
                    });

                    setUndoToast({
                      id: 'archive_' + Date.now(),
                      message: 'Chat archived',
                      undoAction: () => {
                        toggleArchive(targetId, false);
                        api.post(`/messages/chat/${targetId}/archive`, { isArchived: false }).catch(() => {
                          api.patch(`/messages/chat/${targetId}/archive`, { isArchived: false }).catch(console.error);
                        });
                      },
                      commitAction: () => { },
                    });
                  }}
                  onDelete={() => {
                    const targetId = chat.chat_id;
                    toggleDelete(targetId);
                    api.delete(`/messages/chat/${targetId}`).catch(console.error);

                    setUndoToast({
                      id: 'delete_' + Date.now(),
                      message: 'Conversation deleted',
                      undoAction: () => { },
                      commitAction: () => { },
                    });
                  }}
                  getStatusLabel={(c) => {
                    const msgType = c.last_message_type;
                    const msgTxt = c.last_message || '';
                    if (msgType === 'location') return '📍 Location';
                    if (msgType === 'live_location') return '📍 Live Location';
                    if (typeof msgTxt === 'string' && msgTxt.startsWith('{"type":')) {
                      try {
                        const p = JSON.parse(msgTxt);
                        if (p.type === 'location') return p.name || p.address ? `📍 ${p.name || p.address}` : '📍 Location';
                        if (p.type === 'live_location') return '📍 Live Location';
                      } catch (e) { }
                    }
                    return msgTxt || 'No messages yet';
                  }}
                  formatMessageText={(txt) => {
                    if (typeof txt === 'string' && txt.startsWith('{"type":')) {
                      try {
                        const p = JSON.parse(txt);
                        if (p.type === 'location') return p.name || p.address ? `📍 ${p.name || p.address}` : '📍 Location';
                        if (p.type === 'live_location') return '📍 Live Location';
                      } catch (e) { }
                    }
                    return txt;
                  }}
                  typingUsers={
                    Array.isArray(typingUsers)
                      ? typingUsers
                      : typingUsers && typeof typingUsers === 'object'
                        ? Object.entries(typingUsers).flatMap(([cId, uList]) => {
                          if (Array.isArray(uList)) {
                            return uList.map((u: any) => ({ chatId: cId, name: typeof u === 'string' ? u : (u?.username || u?.name || 'Someone') }));
                          }
                          if (uList && typeof uList === 'object') {
                            return [{ chatId: cId, name: (uList as any).username || (uList as any).name || 'Someone' }];
                          }
                          if (typeof uList === 'string') {
                            return [{ chatId: cId, name: uList }];
                          }
                          return [];
                        })
                        : []
                  }
                />
              ))
            )}
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <main className={clsx(
          "flex-1 flex flex-col transition-all duration-300 relative z-10 bg-transparent overflow-hidden",
          !selectedChat ? 'hidden lg:flex' : 'flex',
          (activePrivacy?.copyProtection || activePrivacy?.screenshotProtection || (activePrivacy as any)?.blockScreenshots) && 'select-none'
        )}>
          {selectedChat && <ChatBackground theme={currentChatTheme} />}

          {selectedChat ? (
            <PullUpDisappearingGesture
              chatId={selectedChat.chat_id}
              disappearingDuration={selectedChat.disappearing_duration || 0}
              onDurationChanged={(newDur) => {
                setSelectedChat(prev => prev ? { ...prev, disappearing_duration: newDur } : null);
                useChatStore.getState().updateConversation(selectedChat.chat_id, { disappearing_duration: newDur });
              }}
            >
              <StatusBarBackground backgroundColor={currentChatTheme?.colors?.backgroundDark || '#000000'} />
              <header
                className="h-[56px] z-40 relative px-3.5 flex items-center justify-between border-b border-white/5 shadow-xl shrink-0"
                style={{
                  backgroundColor: currentChatTheme?.colors?.backgroundDark || '#000000',
                  backdropFilter: 'blur(25px)',
                }}
              >
                {(() => {
                  const headerIdentity = IdentityManager.resolveIdentity(selectedChat);
                  const isSelfHeader = selectedChat.chat_type === 'self' || selectedChat.partner_id === (user?.id || user?.user_id);
                  const isSystemChat = headerIdentity.isSystem;
                  const headerDisplayName = isSelfHeader ? 'Saved Messages' : headerIdentity.displayName;

                  return (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 relative z-10">
                        <button
                          onClick={() => {
                            setSelectedChat(null);
                            navigate('/messages');
                          }}
                          className="text-white hover:opacity-70 transition-opacity p-1.5 -ml-1 shrink-0"
                        >
                          <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div
                          className="relative group cursor-pointer shrink-0"
                          onClick={() => {
                            if (isSystemChat) {
                              setShowChatSettings(true);
                            } else if (!isSelfHeader) {
                              navigate(`/profile/${selectedChat.partner_username || selectedChat.partner_id}`);
                            }
                          }}
                        >
                          {isSelfHeader ? (
                            <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm border border-white/10">
                              <Bookmark size={18} />
                            </div>
                          ) : (
                            <img
                              src={headerIdentity.avatar}
                              className="w-[38px] h-[38px] rounded-full object-cover border border-white/10 shadow-sm"
                              alt=""
                            />
                          )}
                        </div>
                        <div className="ml-2 flex-1 min-w-0 flex flex-col justify-center">
                          <h3 className="text-[14.5px] font-extrabold tracking-tight leading-none text-white flex items-center gap-1.5 truncate whitespace-nowrap overflow-hidden text-ellipsis">
                            {headerDisplayName}
                            {!isSelfHeader && (
                              <VerifiedBadge accountType={headerIdentity.accountType} isVerified={headerIdentity.badge.show} color={headerIdentity.badge.color} size="xs" />
                            )}
                          </h3>
                          {isSelfHeader ? (
                            <p className="text-[11px] font-medium text-white/50 truncate whitespace-nowrap overflow-hidden text-ellipsis leading-tight mt-1">
                              Personal Notes & Media
                            </p>
                          ) : headerIdentity.subtitle ? (
                            <p className="text-[11px] font-semibold text-rose-400 truncate whitespace-nowrap overflow-hidden text-ellipsis leading-tight mt-1">
                              {headerIdentity.subtitle}
                            </p>
                          ) : (
                            <div
                              className="mt-1 overflow-hidden transition-opacity duration-300 min-w-0 w-full whitespace-nowrap truncate"
                              style={{ opacity: isScrollingMessages ? 0.45 : 1 }}
                            >
                              <AnimatePresence mode="wait">
                                {(selectedChat.is_group || selectedChat.chat_type === 'group') ? (
                                  <motion.p
                                    key="group-online"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -3 }}
                                    transition={{ duration: 0.18, ease: 'easeOut' }}
                                    className="text-[11px] font-medium lowercase text-emerald-500 truncate whitespace-nowrap overflow-hidden text-ellipsis leading-tight"
                                  >
                                    {selectedChat.member_count ? `${selectedChat.member_count} members • ` : ''}{selectedChat.group_online_count || 1} online
                                  </motion.p>
                                ) : (selectedChat.partner_online || selectedChat.is_online === 1 || selectedChat.is_online === true) ? (
                                  <motion.p
                                    key="online"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -3 }}
                                    transition={{ duration: 0.18, ease: 'easeOut' }}
                                    className="text-[11px] font-semibold lowercase text-emerald-400 truncate whitespace-nowrap overflow-hidden text-ellipsis leading-tight"
                                  >
                                    online
                                  </motion.p>
                                ) : showLastSeen ? (
                                  <motion.p
                                    key="lastseen"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -3 }}
                                    transition={{ duration: 0.18, ease: 'easeOut' }}
                                    className="text-[11px] font-medium lowercase text-white/50 truncate whitespace-nowrap overflow-hidden text-ellipsis leading-tight"
                                  >
                                    last seen {formatLastSeenChat(selectedChat.last_seen_at || selectedChat.last_message_time || selectedChat.last_message_at || '')}
                                  </motion.p>
                                ) : null}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 relative z-10 shrink-0">
                        {!isSystemChat && (
                          <>
                            <button className="text-white/80 hover:text-white p-2 transition-all active:scale-90" style={{ color: currentChatTheme?.colors?.primary || '#ff1493' }} onClick={() => selectedChat && startCall(selectedChat.partner_id, 'voice', sanitizePartnerName(selectedChat.partner_name, selectedChat.partner_username), selectedChat.partner_avatar)}><Phone size={17} strokeWidth={2.2} /></button>
                            <button className="text-white/80 hover:text-white p-2 transition-all active:scale-90" style={{ color: currentChatTheme?.colors?.primary || '#ff1493' }} onClick={() => selectedChat && startCall(selectedChat.partner_id, 'video', sanitizePartnerName(selectedChat.partner_name, selectedChat.partner_username), selectedChat.partner_avatar)}><Video size={18} strokeWidth={2.2} /></button>
                          </>
                        )}
                        <button onClick={() => setShowChatSettings(true)} className="text-white/80 hover:text-white p-2 transition-all active:scale-90" style={{ color: currentChatTheme?.colors?.primary || '#ff1493' }}>
                          <Info size={19} strokeWidth={2.2} />
                        </button>
                      </div>
                    </>
                  );
                })()}
              </header>

              {/* Selection Mode Top Bar */}
              <AnimatePresence>
                {isSelectionMode && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 48, opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="relative z-[45] flex items-center justify-between px-4 border-b border-white/5 shrink-0 overflow-hidden"
                    style={{ backgroundColor: currentChatTheme?.colors?.backgroundDark || '#0a0a12' }}
                  >
                    <button
                      onClick={() => {
                        setIsSelectionMode(false);
                        setSelectedMessageIds(new Set());
                      }}
                      className="flex items-center gap-2 text-white/80 hover:text-white transition-colors p-1.5 -ml-1 active:scale-95"
                    >
                      <X size={20} strokeWidth={2.5} />
                      <span className="text-[13px] font-semibold">Cancel</span>
                    </button>
                    <span className="text-[13px] font-bold text-white/60">
                      {selectedMessageIds.size > 0 ? `${selectedMessageIds.size} selected` : 'Select messages'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {privacyAlert && (
                <div className="absolute top-[56px] left-0 right-0 z-[100] px-4 py-2.5 bg-rose-500/90 text-white backdrop-blur-md shadow-lg border-b border-rose-500/20 text-xs font-bold flex items-center justify-between transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-white shrink-0 animate-bounce" />
                    <span>{privacyAlert.message}</span>
                  </div>
                  <button type="button" onClick={() => setPrivacyAlert(null)} className="text-white/60 hover:text-white p-1 ml-2">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Pinned Messages Carousel */}
              <AnimatePresence>
                {pinnedMessages.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="relative z-20 overflow-hidden border-b border-white/5 bg-[#1b1b24]/95 backdrop-blur-xl shadow-lg"
                  >
                    <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar scroll-smooth snap-x">
                      {pinnedMessages.map(msg => (
                        <div
                          key={`pinned-${msg.message_id}`}
                          onClick={() => {
                            const el = document.getElementById(`msg-${msg.message_id}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              const originalBg = el.style.backgroundColor;
                              const originalBoxShadow = el.style.boxShadow;
                              el.style.transition = 'all 0.4s ease';
                              el.style.backgroundColor = 'rgba(255, 20, 147, 0.35)';
                              el.style.boxShadow = '0 0 20px rgba(255, 20, 147, 0.4)';
                              setTimeout(() => {
                                el.style.backgroundColor = originalBg;
                                el.style.boxShadow = originalBoxShadow;
                              }, 1200);
                            }
                          }}
                          className="snap-start flex-shrink-0 flex items-center gap-2.5 bg-white/[0.03] hover:bg-white/[0.06] active:scale-95 transition-all border border-white/10 rounded-xl px-3.5 py-2 max-w-[220px] cursor-pointer"
                        >
                          <Pin size={14} strokeWidth={2.5} className="text-[#ff1493] shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest truncate">
                              {msg.sender_id === (user?.id || user?.user_id) ? 'You' : sanitizePartnerName(selectedChat.partner_name, selectedChat.partner_username)}
                            </span>
                            <span className="text-[12px] font-medium text-white/90 truncate mt-0.5">
                              {msg.type === 'text' || !msg.type ? msg.content : `[${msg.type.toUpperCase()}]`}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (socket && selectedChat) {
                                socket.emit('unpin-message', {
                                  messageId: msg.message_id || msg.id,
                                  chatId: selectedChat.chat_id,
                                  isGroup: selectedChat.type === 'group'
                                });
                              }
                            }}
                            className="ml-1 w-6 h-6 rounded-full flex items-center justify-center bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all shrink-0"
                          >
                            <X size={12} strokeWidth={2.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-1 no-scrollbar scroll-smooth relative z-10" onScroll={handleScroll}>
                {(() => {
                  const partnerName = (sanitizePartnerName(selectedChat?.partner_name || selectedChat?.display_name || selectedChat?.name, selectedChat?.partner_username || selectedChat?.username) || '').toLowerCase();
                  const partnerUsername = (selectedChat?.partner_username || selectedChat?.username || '').toLowerCase();
                  const isSparklePay = partnerName.includes('pay') || partnerUsername.includes('pay');
                  const isOfficialChat = !!(
                    selectedChat?.account_type === 'system' ||
                    selectedChat?.conversation_type === 'system' ||
                    selectedChat?.is_system_account ||
                    selectedChat?.is_system ||
                    partnerUsername.includes('sparkle') ||
                    partnerName.includes('sparkle') ||
                    isSparklePay
                  );
                  (window as any).__sparkleIsOfficialChat = isOfficialChat;
                  (window as any).__sparkleIsSparklePay = isSparklePay;
                  return null;
                })()}

                {!!(window as any).__sparkleIsOfficialChat && (
                  <>
                    <OfficialAccountBanner
                      displayName={sanitizePartnerName(selectedChat?.partner_name || selectedChat?.display_name || selectedChat?.name, selectedChat?.partner_username || selectedChat?.username) || ((window as any).__sparkleIsSparklePay ? 'SparklePay' : 'Sparkle Official')}
                      badge={(window as any).__sparkleIsSparklePay ? 'Verified Financial Channel' : (selectedChat?.official_badge || '✔️ Verified')}
                      accountType={(window as any).__sparkleIsSparklePay ? 'sparkle_pay' : 'official'}
                    />
                    {showOfficialOnboarding && !(window as any).__sparkleIsSparklePay && (
                      <OfficialInteractiveOnboarding onComplete={() => setShowOfficialOnboarding(false)} />
                    )}
                  </>
                )}
                <div className="flex flex-col">
                  {filteredMessages.flatMap((msg, i) => {
                    const isMe = msg.sender_id === (user?.id || user?.user_id);
                    const prevMsg = i > 0 ? messages[i - 1] : null;
                    const nextMsg = i < messages.length - 1 ? messages[i + 1] : null;
                    const isFirst = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                    const isLast = !nextMsg || nextMsg.sender_id !== msg.sender_id;
                    const hasTail = !msg.reply_content;
                    const marginTopClass = isFirst ? "mt-4" : "mt-1";

                    // Show a date separator whenever the calendar day changes
                    const showDateSep = !isSameCalendarDay(
                      msg.sent_at || msg.created_at,
                      prevMsg?.sent_at || prevMsg?.created_at
                    );

                    const dateSep = showDateSep ? (
                      <div key={`date-${i}`} className="flex items-center gap-3 my-4 px-2">
                        <div className="flex-1 h-px bg-white/[0.07]" />
                        <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest px-2 shrink-0 select-none">
                          {formatMessageGroupDate(msg.sent_at || msg.created_at)}
                        </span>
                        <div className="flex-1 h-px bg-white/[0.07]" />
                      </div>
                    ) : null;

                    const msgId = msg.message_id || msg.id;
                    const isSelected = isSelectionMode && selectedMessageIds.has(msgId);

                    const bubble = (
                      <div key={msgId || i} id={`msg-${msg.message_id}`} className={clsx("flex animate-fade-in items-center gap-2", marginTopClass, isMe ? 'justify-end' : 'justify-start')}>
                        {console.log('[MESSAGE_RENDERED]', msg.message_id)}

                        {/* Selection mode: circular checkbox */}
                        {isSelectionMode && (
                          <button
                            onClick={() => {
                              setSelectedMessageIds(prev => {
                                const next = new Set(prev);
                                if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
                                return next;
                              });
                            }}
                            className="shrink-0 flex items-center justify-center transition-all duration-150 active:scale-90"
                          >
                            <div className={clsx(
                              'w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all duration-150',
                              isSelected
                                ? 'bg-[#ff1493] border-[#ff1493] scale-110'
                                : 'border-white/30 bg-transparent hover:border-white/50'
                            )}>
                              {isSelected && (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              )}
                            </div>
                          </button>
                        )}

                        <div className={clsx((window as any).__sparkleIsOfficialChat && !isMe ? "max-w-[95%]" : "max-w-[72%]", "flex flex-col", isMe ? 'items-end' : 'items-start')}>
                          <MessageBubbleWrapper
                            onLongPress={() => {
                              if (isSelectionMode) return;
                              setActiveMessageMenu({ msg, type: 'longPress' });
                              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                                try { navigator.vibrate(50); } catch (e) { }
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (isSelectionMode) {
                                setSelectedMessageIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
                                  return next;
                                });
                                return;
                              }
                              setActiveMessageMenu({ msg, type: 'longPress' });
                            }}
                            onClick={(e) => {
                              if (isSelectionMode) {
                                setSelectedMessageIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
                                  return next;
                                });
                              }
                            }}
                            className={clsx(
                              (window as any).__sparkleIsOfficialChat && !isMe
                                ? "px-4 py-3 text-[16px] leading-[1.65] transition-all duration-300 relative z-10 min-w-[120px] break-words whitespace-pre-wrap select-none cursor-pointer"
                                : "px-2.5 py-1.5 text-[15px] leading-relaxed transition-all duration-300 relative z-10 min-w-[80px] break-words whitespace-pre-wrap select-none cursor-pointer",
                              isMe ? 'rounded-[14px]' : 'rounded-[14px]',
                              isMe && hasTail ? 'rounded-tr-none' : isMe ? 'rounded-tr-[14px]' : '',
                              isMe && isLast ? 'rounded-br-[14px]' : isMe ? 'rounded-br-md' : '',
                              !isMe && hasTail ? 'rounded-tl-none' : !isMe ? 'rounded-tl-[14px]' : '',
                              !isMe && isLast ? 'rounded-bl-[14px]' : !isMe ? 'rounded-bl-md' : ''
                            )}
                            style={{
                              backgroundColor: isMe ? (currentChatTheme?.colors?.chatBubbleSent || '#5030A5') : ((window as any).__sparkleIsOfficialChat ? '#1A1035' : (currentChatTheme?.colors?.chatBubbleReceived || '#2C2C2E')),
                              border: (window as any).__sparkleIsOfficialChat && !isMe ? '1px solid rgba(244,63,94,0.25)' : 'none',
                              borderRadius: (window as any).__sparkleIsOfficialChat && !isMe ? '20px' : undefined,
                              color: '#ffffff',
                              backdropFilter: currentChatTheme ? 'blur(10px)' : 'none',
                              maxWidth: '100%',
                              width: 'fit-content',
                              minWidth: '80px',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              whiteSpace: 'pre-wrap'
                            }}
                          >
                            {isMe && hasTail ? (
                              <svg className="absolute top-0 -right-[8px] w-[8px] h-[12px]" viewBox="0 0 8 12" style={{ fill: currentChatTheme?.colors?.chatBubbleSent || '#5030A5' }}>
                                <path d="M 0 0 L 8 0 L 0 12 Z" />
                              </svg>
                            ) : !isMe && hasTail ? (
                              <svg className="absolute top-0 -left-[8px] w-[8px] h-[12px]" viewBox="0 0 8 12" style={{ fill: currentChatTheme?.colors?.chatBubbleReceived || '#2C2C2E' }}>
                                <path d="M 8 0 L 0 0 L 8 12 Z" />
                              </svg>
                            ) : null}

                            <div className="relative flex flex-col">
                              {/* Reply Block */}
                              {(() => {
                                // Try embedded reply_content first, then fall back to store lookup
                                let replyContent = msg.reply_content;
                                let replySenderName = msg.reply_sender_name;
                                let replyType = msg.reply_type || 'text';
                                let replyMediaUrl = msg.reply_media_url || msg.reply_mediaUrl;

                                if (msg.reply_to_message_id) {
                                  const refMsg = useChatStore.getState().findMessage(selectedChat?.chat_id || '', msg.reply_to_message_id);
                                  if (refMsg) {
                                    replySenderName = replySenderName || refMsg.sender_name || refMsg.sender_username || 'User';
                                    replyType = refMsg.type || 'text';
                                    replyMediaUrl = refMsg.media_url || refMsg.mediaUrl;

                                    if (refMsg.content && refMsg.content.trim() !== '') {
                                      if (replyType === 'image' || replyType === 'photo') replyContent = `📷 ${refMsg.content}`;
                                      else if (replyType === 'video') replyContent = `🎥 ${refMsg.content}`;
                                      else if (replyType === 'gif') replyContent = `👾 ${refMsg.content}`;
                                      else replyContent = refMsg.content;
                                    } else {
                                      switch (replyType) {
                                        case 'image':
                                        case 'photo':
                                          replyContent = '📷 Photo';
                                          break;
                                        case 'video':
                                          replyContent = '🎥 Video';
                                          break;
                                        case 'gif':
                                          replyContent = '👾 GIF';
                                          break;
                                        case 'audio':
                                        case 'voice':
                                        case 'voice_note':
                                          replyContent = '🎵 Voice Note';
                                          break;
                                        case 'file':
                                        case 'document':
                                          replyContent = '📄 Document';
                                          break;
                                        default:
                                          replyContent = 'Attachment';
                                          break;
                                      }
                                    }
                                  }
                                }

                                if (!replyContent) return null;

                                return (
                                  <div className="bg-black/20 rounded-[6px] p-2 mb-1 border-l-[3.5px] border-white/90 flex items-center gap-2">
                                    {(replyType === 'image' || replyType === 'photo' || replyType === 'gif') && replyMediaUrl && (
                                      <img src={replyMediaUrl} alt="preview" className="w-[30px] h-[30px] object-cover rounded shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0 flex flex-col">
                                      <span className="font-bold text-[11px] text-white/95 leading-tight">
                                        {replySenderName || 'User'}
                                      </span>
                                      <span className="text-[12px] text-white/70 line-clamp-1 leading-snug mt-0.5 truncate">
                                        {replyContent}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}

                              <div className="relative text-[14.5px]">
                                {pendingDeletingIds.has(msgId) ? (
                                  <span className="text-[12px] font-semibold text-rose-300 italic animate-pulse flex items-center gap-1.5 py-0.5 select-none">
                                    Deleting…
                                  </span>
                                ) : msg.is_deleted_for_everyone ? (
                                  <>
                                    {console.log('[DELETE_RENDER]', msg.message_id)}
                                    <span className="italic text-white/40 select-none">
                                      {getDeletedMessageText(msg, isMe)}
                                    </span>
                                    {/* Spacer to prevent timestamp overlap */}
                                    <span className="inline-block w-[75px] h-[1px]"></span>
                                  </>
                                ) : (
                                  <>
                                    {/* Unify message text resolution across all standard/system/official types */}
                                    {(() => {
                                      const textContent = (
                                        msg.content ||
                                        msg.text ||
                                        msg.message ||
                                        msg.body ||
                                        (typeof msg.payload === 'object' ? (msg.payload?.body || msg.payload?.content || msg.payload?.text || msg.payload?.message) : (typeof msg.payload === 'string' ? msg.payload : ''))
                                      ) || '';
                                      const isLocationMsg = msg.type === 'location' || msg.type === 'live_location' || (typeof textContent === 'string' && (textContent.includes('"type":"location"') || textContent.includes('"type":"live_location"')));
                                      const isSparklePay = msg.type === 'sparkle_pay' || msg.type === 'wallet' || msg.category === 'wallet' || msg.sender_username === 'sparklepay' || msg.payload?.referenceId || msg.payload?.amount;

                                      if (isSparklePay) {
                                        return (
                                          <SparklePayCard
                                            title={msg.payload?.title || msg.title || 'SparklePay Notification'}
                                            subtitle={msg.payload?.subtitle || (msg.payload?.amount ? undefined : textContent)}
                                            amount={msg.payload?.amount || 'KES 0.00'}
                                            referenceId={msg.payload?.referenceId || msg.payload?.reference_id || msg.message_id || 'SPK-REF'}
                                            balance={msg.payload?.balance || msg.payload?.availableBalance}
                                            status={msg.payload?.status || 'Successful'}
                                            sentAt={msg.sent_at || msg.created_at}
                                          />
                                        );
                                      }

                                      const isTextLike = (!msg.type || msg.type === 'text' || msg.type === 'official' || msg.type === 'system' || msg.type === 'onboarding' || msg.type === 'announcement' || msg.type === 'notification' || msg.type === 'card') && !isLocationMsg;

                                      if (isTextLike) {
                                        const isSparklyBot = msg.sender_id === 'sparkly_bot' || msg.senderId === 'sparkly_bot' || msg.is_sparkly_bot || msg.metadata?.includes('sparkly_bot');
                                        let cardsList: any[] = msg.structured_data?.cards || [];
                                        if (cardsList.length === 0 && msg.metadata) {
                                          try {
                                            const metaObj = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                                            if (Array.isArray(metaObj?.cards)) {
                                              cardsList = metaObj.cards;
                                            }
                                          } catch { }
                                        }

                                        return (
                                          <>
                                            {isSparklyBot && (
                                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-purple-500/20">
                                                <SparklyAvatar size={18} />
                                                <span className="text-[11px] font-black text-purple-300">Sparkly AI</span>
                                              </div>
                                            )}
                                            {isSparklyBot ? (
                                              <SparklyMarkdown content={textContent} className="text-white" />
                                            ) : (
                                              <span className="whitespace-pre-wrap break-words text-white leading-relaxed font-normal" style={{ color: '#ffffff' }}>
                                                {textContent}
                                              </span>
                                            )}
                                            {cardsList.length > 0 && (
                                              <div className="mt-2.5 space-y-2">
                                                {cardsList.map((card: any, idx: number) => (
                                                  <SparklyListingCard key={card.listing_id || idx} listing={card} />
                                                ))}
                                              </div>
                                            )}
                                            <span className="inline-block w-[75px] h-[1px]"></span>
                                          </>
                                        );
                                      }

                                      return null;
                                    })()}

                                    {msg.type === 'attachment' && msg.metadata && (
                                      <div className="my-1">
                                        <AttachmentCard metadata={msg.metadata} />
                                        {msg.content && msg.content.trim() !== '' && (
                                          <div className="mt-2 text-white break-words whitespace-pre-wrap">
                                            {msg.content}
                                          </div>
                                        )}
                                        {/* Spacer to prevent timestamp overlap */}
                                        <span className="inline-block w-[75px] h-[1px]"></span>
                                      </div>
                                    )}

                                    {(msg.type === 'location' || msg.type === 'live_location' || (typeof msg.content === 'string' && (msg.content.includes('"type":"location"') || msg.content.includes('"type":"live_location"')))) && (
                                      <LocationMessageBubble
                                        message={msg}
                                        isCurrentUser={msg.sender_id === (user?.user_id || user?.id)}
                                        onOpenFullMap={() => setShowLocationPickerModal(true)}
                                      />
                                    )}

                                    {msg.type === 'image' && (
                                      <div className="relative rounded-[12px] overflow-hidden max-w-[280px] border border-white/10 group cursor-pointer my-1" onClick={() => setLightboxUrl(msg.media_url || msg.mediaUrl || '')}>
                                        <img src={msg.media_url || msg.mediaUrl} className="w-full h-auto max-h-[220px] object-cover transition-transform duration-500 group-hover:scale-105" alt="Image attachment" />
                                        {msg.content && (
                                          <div className="p-2 text-[13px] bg-black/40 text-white/95 border-t border-white/5 font-semibold">
                                            {msg.content}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {msg.type === 'video' && (
                                      <div className="relative rounded-[12px] overflow-hidden max-w-[280px] border border-white/10 bg-black/40 my-1">
                                        <video src={msg.media_url || msg.mediaUrl} controls className="w-full h-auto max-h-[220px] rounded-[12px] object-cover" />
                                        {msg.content && (
                                          <div className="p-2 text-[13px] text-white/95 font-semibold">
                                            {msg.content}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {(msg.type === 'voice_note' || msg.type === 'audio') && (
                                      <div className="my-1">
                                        <VoiceNotePlayer url={msg.media_url || msg.mediaUrl || ''} />
                                      </div>
                                    )}

                                    {msg.type === 'document' && (
                                      <a
                                        href={msg.media_url || msg.mediaUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 min-w-[240px] max-w-[300px] hover:bg-white/10 transition-all cursor-pointer select-none my-1"
                                      >
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                                          <FileText size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[13px] font-bold text-white truncate leading-tight">
                                            {msg.content || 'Document attachment'}
                                          </div>
                                          <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">
                                            Attachment • FILE
                                          </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/20 transition-all shrink-0">
                                          <Download size={16} strokeWidth={2.5} />
                                        </div>
                                      </a>
                                    )}

                                    {msg.type === 'location' && (
                                      <div className="rounded-[16px] overflow-hidden max-w-[260px] border border-white/10 bg-black/40 my-1">
                                        <div className="relative h-[120px] bg-slate-900 flex items-center justify-center">
                                          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-400 via-pink-400 to-indigo-900" />
                                          <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-[#ff1493]/20 border border-[#ff1493] flex items-center justify-center animate-ping" />
                                            <MapPin size={24} className="text-[#ff1493] drop-shadow-md absolute" strokeWidth={3} />
                                          </div>
                                          <span className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest text-white/80 uppercase">LIVE MAP</span>
                                        </div>
                                        <div className="p-3">
                                          <h5 className="font-bold text-[13px] text-white truncate leading-tight">
                                            {msg.content || 'Shared Location'}
                                          </h5>
                                          <p className="text-[10.5px] text-white/40 font-bold uppercase tracking-wider mt-0.5 leading-none">
                                            Open in Maps
                                          </p>
                                          <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(msg.content || 'Location')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2.5 block w-full py-2 bg-white/10 hover:bg-white/15 active:scale-98 transition-all text-center rounded-xl text-[11px] font-black uppercase tracking-widest text-white border border-white/5"
                                          >
                                            View Route
                                          </a>
                                        </div>
                                      </div>
                                    )}

                                    {msg.type === 'contact' && (() => {
                                      let contactMeta: any = null;
                                      try {
                                        if (msg.metadata) contactMeta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                                      } catch (e) { }

                                      const contactName = contactMeta?.name || msg.content || 'Contact Card';
                                      const contactPhoneOrHandle = contactMeta?.phone || msg.media_url || msg.mediaUrl || (contactMeta?.username ? `@${contactMeta.username}` : '+1 (555) 019-2834');
                                      const contactUserId = contactMeta?.userId || contactMeta?.user_id;
                                      const contactUsername = contactMeta?.username;
                                      const contactAvatar = contactMeta?.avatar_url;

                                      return (
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 min-w-[240px] max-w-[300px] select-none flex flex-col gap-3 my-1">
                                          <div
                                            className="flex items-center gap-3 cursor-pointer group"
                                            onClick={() => {
                                              if (contactUsername) {
                                                navigate(`/profile/${contactUsername}`);
                                              } else if (contactUserId) {
                                                startNewChat({ user_id: contactUserId, name: contactName, username: contactUsername, avatar_url: contactAvatar });
                                              }
                                            }}
                                          >
                                            <div className="relative shrink-0">
                                              {contactAvatar ? (
                                                <img src={getAvatarUrl(contactAvatar, contactUsername)} className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-sm" alt="" />
                                              ) : (
                                                <div className="w-10 h-10 rounded-full bg-[#ff1493] flex items-center justify-center text-white text-[15px] font-black shrink-0 shadow-lg shadow-pink-500/20">
                                                  {contactName.charAt(0).toUpperCase()}
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-bold text-[13px] text-white truncate leading-tight group-hover:text-[#ff1493] transition-colors">
                                                {contactName}
                                              </h4>
                                              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5 truncate">
                                                {contactPhoneOrHandle}
                                              </p>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              startNewChat({
                                                user_id: contactUserId || ('contact_' + Date.now()),
                                                username: contactUsername || contactName,
                                                name: contactName,
                                                avatar_url: contactAvatar
                                              });
                                            }}
                                            className="w-full py-2 bg-white/10 hover:bg-white/15 active:scale-98 transition-all text-center rounded-xl text-[11px] font-black uppercase tracking-widest text-white border border-white/5 flex items-center justify-center gap-1.5 shadow-sm"
                                          >
                                            <User size={14} />
                                            <span>Message Contact</span>
                                          </button>
                                        </div>
                                      );
                                    })()}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Timestamp & Ticks absolute inside bubble bottom-right */}
                            <div className="absolute bottom-[2px] right-[4px] flex items-center gap-0.5 opacity-90 text-[10.5px] font-medium tracking-tight h-[15px]">
                              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{safeTime(msg.sent_at || msg.created_at || '')}</span>
                              {isMe && (
                                <div className="flex items-center -ml-0.5">
                                  {(selectedChat?.is_group || selectedChat?.chat_type === 'group') ? (
                                    <Check size={15} className="text-[#cbd5e1] drop-shadow-md" strokeWidth={3} />
                                  ) : msg.status === 'failed' ? null : msg.is_read || msg.status === 'read' || msg.status === 'seen' ? (
                                    <div className="flex -space-x-[7px] drop-shadow-md">
                                      <Check size={15} className="text-[#38bdf8]" strokeWidth={3} />
                                      <Check size={15} className="text-[#38bdf8]" strokeWidth={3} />
                                    </div>
                                  ) : msg.status === 'delivered' ? (
                                    <div className="flex -space-x-[7px] drop-shadow-md">
                                      <Check size={15} className="text-[#cbd5e1]" strokeWidth={3} />
                                      <Check size={15} className="text-[#cbd5e1]" strokeWidth={3} />
                                    </div>
                                  ) : msg.status === 'sending' ? (
                                    <Clock size={12} className="text-[#cbd5e1] ml-1 drop-shadow-md" strokeWidth={2} />
                                  ) : (
                                    <Check size={15} className="text-[#cbd5e1] drop-shadow-md" strokeWidth={3} />
                                  )}
                                </div>
                              )}
                            </div>
                          </MessageBubbleWrapper>

                          {/* Outer Delivery-Error Row for Outgoing Failed Messages */}
                          {isMe && msg.status === 'failed' && (
                            <div className="flex items-center justify-end gap-3 mt-1.5 mb-1.5 px-1 select-none animate-fade-in">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFailedResendModalMsg(msg);
                                }}
                                className="flex items-center gap-2 text-red-500 hover:text-red-400 font-extrabold text-xs tracking-tight transition-colors cursor-pointer group"
                              >
                                <span className="w-6 h-6 rounded-full bg-red-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-md shadow-red-600/30 group-hover:scale-110 transition-transform">
                                  !
                                </span>
                                <span className="font-extrabold text-red-500 hover:text-red-400">
                                  Message not delivered · {safeTime(msg.failed_at || msg.sent_at || msg.created_at || '')}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRetryMessage(msg);
                                }}
                                disabled={msg.status === 'sending'}
                                title="Resend message"
                                aria-label="Resend message"
                                className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white transition-all cursor-pointer shadow-lg shadow-red-600/40 border border-red-400/30 ml-0.5"
                              >
                                <RotateCw size={22} strokeWidth={3} className={clsx("text-white drop-shadow-sm", msg.status === 'sending' && "animate-spin")} />
                              </button>
                            </div>
                          )}

                          {/* Reaction Badges */}
                          {(() => {
                            const reacts = msg.reactions || [];
                            if (!reacts || reacts.length === 0) return null;
                            const grouped: Record<string, number> = {};
                            reacts.forEach((r: any) => {
                              if (r.emoji) grouped[r.emoji] = (grouped[r.emoji] || 0) + 1;
                            });
                            const entries = Object.entries(grouped);
                            if (entries.length === 0) return null;

                            return (
                              <div
                                className={clsx(
                                  'flex items-center gap-1 flex-wrap mt-1 mb-0.5 relative z-20',
                                  isMe ? 'justify-end' : 'justify-start'
                                )}
                              >
                                {entries.map(([emoji, count]) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setReactionSheetMsg(msg);
                                    }}
                                    className="flex items-center gap-1 bg-[#1e1e2e]/90 backdrop-blur-md border border-white/15 rounded-full px-2 py-0.5 text-[13px] shadow-lg hover:bg-[#2a2a3e] active:scale-95 transition-all cursor-pointer select-none"
                                  >
                                    <span>{emoji}</span>
                                    {count > 1 && (
                                      <span className="text-white/80 font-bold text-[11px] ml-0.5">{count}</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );

                    return dateSep ? [dateSep, bubble] : [bubble];
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* ── Scroll-to-bottom floating button ──
                    Positioned as absolute relative to <main> (which has position:relative)
                    so it floats at a fixed visual position above the input bar,
                    NOT anchored to the bottom of the scroll content. */}
              <AnimatePresence>
                {showScrollToBottom && (
                  <motion.button
                    initial={{ scale: 0, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0, opacity: 0, y: 10 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    onClick={() => {
                      scrollToBottom('smooth');
                      setUnreadCountInChat(0);
                    }}
                    className="absolute bottom-[90px] left-1/2 -translate-x-1/2 w-11 h-11 bg-[#ff1493] text-white rounded-full flex items-center justify-center shadow-[0_8px_28px_rgba(255,20,147,0.45)] z-50 hover:scale-110 transition-transform active:scale-95"
                  >
                    <ArrowDown size={20} strokeWidth={3} />
                    {unreadCountInChat > 0 && (
                      <div className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] bg-white text-[#ff1493] text-[9px] font-black px-1.5 rounded-full border-2 border-[#ff1493] shadow-lg flex items-center justify-center">
                        {unreadCountInChat > 9 ? '9+' : unreadCountInChat}
                      </div>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Floating Word Effects Layer */}
              <AnimatePresence>
                {playingEffectEmoji && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 pointer-events-none z-50 overflow-hidden"
                  >
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ y: '110vh', x: `${Math.random() * 100}vw`, opacity: 0, scale: 0.5 }}
                        animate={{
                          y: '-20vh',
                          opacity: [0, 1, 1, 0],
                          scale: [0.5, 1.2, 1.2, 1.5],
                          rotate: Math.random() * 360
                        }}
                        transition={{
                          duration: 3,
                          delay: Math.random() * 1.5,
                          ease: "easeOut"
                        }}
                        className="absolute text-6xl drop-shadow-2xl"
                      >
                        {playingEffectEmoji}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Typing indicator — sits directly above the input bar */}
              <AnimatePresence>
                {!(
                  selectedChat?.account_type === 'system' ||
                  selectedChat?.conversation_type === 'system' ||
                  selectedChat?.is_system_account ||
                  selectedChat?.is_system ||
                  selectedChat?.partner_username === 'sparkleofficial' ||
                  selectedChat?.username === 'sparkleofficial' ||
                  selectedChat?.partner_name === 'Sparkle Official'
                ) && (partnerIsTyping || typingUsers.some(t => t.chatId === selectedChat?.chat_id)) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 36, opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 px-5 overflow-hidden border-t border-white/5 shrink-0 select-none"
                      style={{ backgroundColor: currentChatTheme?.colors?.backgroundDark || '#000000' }}
                    >
                      <div className="flex items-center gap-1.5 py-1">
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-[#ff1493] rounded-full" />
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className="w-1.5 h-1.5 bg-[#ff1493] rounded-full" />
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="w-1.5 h-1.5 bg-[#ff1493] rounded-full" />
                      </div>
                      <span className="text-[12px] font-bold text-[#ff1493]">
                        {(typingUsers.find(t => t.chatId === selectedChat?.chat_id)?.name) || sanitizePartnerName(selectedChat?.partner_name, selectedChat?.partner_username)} is typing…
                      </span>
                    </motion.div>
                  )}
              </AnimatePresence>

              {isSelectionMode ? (
                /* Selection Mode Bottom Action Card */
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="shrink-0 border-t border-white/5 px-4 py-3 flex items-center justify-between gap-3 z-30"
                  style={{ backgroundColor: currentChatTheme?.colors?.backgroundDark || '#0a0a12' }}
                >
                  <button
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedMessageIds(new Set());
                    }}
                    className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (selectedMessageIds.size > 0) {
                        handleBulkDeleteForMe();
                      }
                    }}
                    disabled={selectedMessageIds.size === 0}
                    className={clsx(
                      'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-95',
                      selectedMessageIds.size > 0
                        ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30'
                        : 'bg-white/5 text-white/25 border border-white/5 cursor-not-allowed'
                    )}
                  >
                    <Trash2 size={16} strokeWidth={2.2} />
                    Delete for you{selectedMessageIds.size > 0 ? ` (${selectedMessageIds.size})` : ''}
                  </button>
                </motion.div>
              ) : (
                selectedChat?.account_type === 'system' ||
                selectedChat?.conversation_type === 'system' ||
                selectedChat?.is_system_account ||
                selectedChat?.is_system ||
                selectedChat?.partner_username === 'sparkleofficial' ||
                selectedChat?.username === 'sparkleofficial' ||
                selectedChat?.partner_name === 'Sparkle Official'
              ) ? (
                <OfficialComposerFooter onUnlockConsole={() => setShowDevConsole(true)} />
              ) : (
                <ChatInput
                  initialMessage=""
                  onTyping={handleTyping}
                  onSend={handleSendMessageWrapper}
                  onCameraOpen={() => setShowCameraModal(true)}
                  isMenuCollapsed={isMenuCollapsed}
                  setIsMenuCollapsed={setIsMenuCollapsed}
                  selectedChat={selectedChat}
                  sending={sending}
                  getQuickReaction={getQuickReaction}
                  setShowAttachmentMenu={setShowAttachmentSheet}
                  showAttachmentMenu={showAttachmentSheet}
                  onVoiceSend={handleVoiceSend}
                  theme={currentChatTheme}
                  replyToMessage={replyToMessage}
                  onFileSelect={(files: FileList | File[]) => handleMediaSelection({ source: 'file', files })}
                />
              )}
            </PullUpDisappearingGesture>
          ) : loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-transparent relative overflow-hidden group">
              <div className="w-8 h-8 border-4 border-[#ff1493] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-transparent relative overflow-hidden group">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/[0.02] pointer-events-none" aria-hidden>
                <Orbit size={400} strokeWidth={0.5} className="animate-spin-slow" />
              </div>
              <Orbit size={120} strokeWidth={1} className="text-white/5 mb-12 relative z-10" />
              <h2 className="text-5xl font-black text-[#f5f5f5] mb-4 tracking-tighter italic uppercase underline decoration-[#ff1493]/20 decoration-8 underline-offset-8 relative z-10">Messages</h2>
              <p className="text-white font-medium opacity-40 max-w-sm uppercase tracking-widest text-[11px]">Select a contact to start chatting.</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-12 flex items-center gap-3 px-10 py-5 bg-[#ff1493] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-pink-500/20 hover:scale-[1.02] transition-all italic group"
              >
                <Plus size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" /> New Message
              </button>
            </div>
          )}
          {/* Screenshot Protection Shield Overlay */}
          <AnimatePresence>
            {showScreenshotShield && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none"
              >
                <div className="w-20 h-20 rounded-full bg-[#ff1493]/20 border border-[#ff1493]/40 flex items-center justify-center mb-4 text-[#ff1493] animate-pulse">
                  <Shield size={40} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Screenshot Attempt Blocked</h3>
                <p className="text-sm text-white/60 max-w-sm">
                  Screenshots and screen capture are disabled in this chat by Sparkle Privacy Guard.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Window Blur / Screen Recording Protection Overlay */}
          <AnimatePresence>
            {isWindowBlurred && (activePrivacy?.screenshotProtection || activePrivacy?.screenRecordingProtection || (activePrivacy as any)?.blockScreenshots) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[990] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto"
              >
                <Shield size={48} className="text-[#ff1493] mb-3 animate-bounce" />
                <h4 className="text-lg font-bold text-white">Protected View Active</h4>
                <p className="text-xs text-white/50 mt-1">Focus window to restore conversation visibility</p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </KeyboardAwareChatLayout>

      {/* MODALS */}
      <AnimatePresence>
        {showDeleteConfirm && messageToDelete && (
          <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1b1b24] border border-white/10 rounded-[20px] w-full max-w-[320px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 text-center border-b border-white/5">
                <h3 className="text-[16px] font-bold text-white mb-2">Delete message?</h3>
                <p className="text-[13px] text-white/50">Are you sure you want to delete this message?</p>
              </div>
              <div className="flex flex-col p-2 gap-1">
                {messageToDelete?.sender_id === (user?.id || user?.user_id) &&
                  (Date.now() - new Date(messageToDelete.created_at || messageToDelete.sent_at || Date.now()).getTime()) <= 15 * 60 * 1000 && (
                    <button
                      onClick={() => {
                        if (!messageToDelete || !selectedChat) return;
                        const targetId = messageToDelete.message_id || messageToDelete.id;
                        const targetChatId = selectedChat.chat_id;
                        const operationId = crypto.randomUUID();

                        // 1. Mark target message as pending deletion
                        setPendingDeletingIds(prev => new Set(prev).add(targetId));

                        // 2. Transmit background socket request with server-authoritative ACK
                        const payload = { operationId, messageId: targetId, chatId: targetChatId, isGroup: selectedChat.type === 'group' };
                        if (socket?.connected) {
                          socket.emit('delete-for-everyone', payload, (res: any) => {
                            setPendingDeletingIds(prev => {
                              const next = new Set(prev);
                              next.delete(targetId);
                              return next;
                            });
                            if (res?.success) {
                              deleteMessageForEveryone(targetChatId, targetId, 'This message was deleted');
                              useMessageStore.getState().deleteMessage(targetId);
                            } else {
                              setPrivacyAlert({ message: res?.error || 'Could not delete message for everyone.' });
                            }
                          });
                        } else {
                          PersistentOfflineQueue.enqueueInteraction({ type: 'delete-message', chatId: targetChatId, messageId: targetId });
                        }

                        // 3. Close modal immediately
                        setShowDeleteConfirm(false);
                        setMessageToDelete(null);
                      }}
                      className="w-full py-3.5 px-4 rounded-xl text-[14px] font-semibold text-[#ff1493] bg-[#ff1493]/10 hover:bg-[#ff1493]/20 transition-all text-center"
                    >
                      Delete for everyone
                    </button>
                  )}
                <button
                  onClick={() => {
                    if (!messageToDelete || !selectedChat) return;
                    const targetId = messageToDelete.message_id || messageToDelete.id;

                    // Enter multi-select mode with this message pre-selected
                    setIsSelectionMode(true);
                    setSelectedMessageIds(new Set([targetId]));

                    // Close this modal immediately
                    setShowDeleteConfirm(false);
                    setMessageToDelete(null);
                  }}
                  className="w-full py-3.5 px-4 rounded-xl text-[14px] font-medium text-rose-500 hover:bg-rose-500/10 transition-all text-center"
                >
                  Delete for me
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setMessageToDelete(null);
                  }}
                  className="w-full py-3.5 px-4 rounded-xl text-[14px] font-medium text-white/70 hover:bg-white/5 transition-all text-center mt-1"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MessageActionSheet
        isOpen={activeMessageMenu?.type === 'longPress'}
        onClose={() => setActiveMessageMenu(null)}
        onCopy={() => {
          if (effectiveMessagePermissions?.canCopy === false) {
            toast.error('Copying is disabled by privacy settings for this chat');
            setActiveMessageMenu(null);
            return;
          }
          if (activeMessageMenu?.msg?.content) {
            navigator.clipboard.writeText(activeMessageMenu.msg.content);
            toast.success('Copied to clipboard');
          }
          setActiveMessageMenu(null);
        }}
        onReply={() => {
          if (activeMessageMenu?.msg && selectedChat) {
            useChatStore.getState().setReplyTarget(selectedChat.chat_id, activeMessageMenu.msg.message_id);
          }
          setActiveMessageMenu(null);
        }}
        onDelete={() => {
          setMessageToDelete(activeMessageMenu?.msg);
          setShowDeleteConfirm(true);
          setActiveMessageMenu(null);
        }}
        onMore={() => {
          setActiveMessageMenu(prev => prev ? { ...prev, type: 'click' } : null);
        }}
        onReact={(emoji) => {
          if (activeMessageMenu?.msg?.message_id) {
            handleReactToMessage(activeMessageMenu.msg.message_id, emoji);
          }
          setActiveMessageMenu(null);
        }}
        onOpenEmojiPicker={() => {
          setShowFullEmojiPicker(true);
        }}
        onForward={() => {
          if (effectiveMessagePermissions?.canForward === false) {
            toast.error('Forwarding is disabled by privacy settings for this chat');
            setActiveMessageMenu(null);
            return;
          }
          if (activeMessageMenu?.msg) {
            setForwardingMessage(activeMessageMenu.msg);
            setSelectedForwardChatIds([]);
            setShowForwardModal(true);
          }
          setActiveMessageMenu(null);
        }}
        isMe={activeMessageMenu?.msg?.sender_id === (user?.id || user?.user_id)}
        themeColor={currentChatTheme?.colors?.primary || '#ff1493'}
        permissions={effectiveMessagePermissions}
      />

      <MessageMoreModal
        isOpen={activeMessageMenu?.type === 'click'}
        onClose={() => setActiveMessageMenu(null)}
        isPinned={!!activeMessageMenu?.msg?.pinned}
        isMe={activeMessageMenu?.msg?.sender_id === (user?.id || user?.user_id)}
        onPin={() => {
          if (activeMessageMenu?.msg && socket && selectedChat) {
            if (activeMessageMenu.msg.pinned) {
              socket.emit('unpin-message', { messageId: activeMessageMenu.msg.message_id, chatId: selectedChat.chat_id });
            } else {
              socket.emit('pin-message', { messageId: activeMessageMenu.msg.message_id, chatId: selectedChat.chat_id });
            }
          }
          setActiveMessageMenu(null);
        }}
        onEdit={() => {
          if (activeMessageMenu?.msg && selectedChat) {
            useChatStore.getState().startEdit(selectedChat.chat_id, activeMessageMenu.msg.message_id, activeMessageMenu.msg.content);
          }
          setActiveMessageMenu(null);
        }}
        onForward={() => {
          if (effectiveMessagePermissions?.canForward === false) {
            toast.error('Forwarding is disabled by privacy settings for this chat');
            setActiveMessageMenu(null);
            return;
          }
          if (activeMessageMenu?.msg) {
            setForwardingMessage(activeMessageMenu.msg);
            setSelectedForwardChatIds([]);
            setShowForwardModal(true);
          }
          setActiveMessageMenu(null);
        }}
        onDetails={() => {
          if (activeMessageMenu?.msg) {
            setInfoModalMessageId(activeMessageMenu.msg.message_id);
          }
          setActiveMessageMenu(null);
        }}
        onReport={() => {
          alert('Thank you for reporting. Our moderation team will review this message shortly.');
          setActiveMessageMenu(null);
        }}
        permissions={effectiveMessagePermissions}
      />

      <MessageInfoModal
        messageId={infoModalMessageId}
        isOpen={!!infoModalMessageId}
        onClose={() => setInfoModalMessageId(null)}
      />

      <ReactionDetailsSheet
        isOpen={!!reactionSheetMsg}
        onClose={() => setReactionSheetMsg(null)}
        reactions={reactionSheetMsg?.reactions || []}
        currentUserId={user?.id || user?.user_id || ''}
        onRemoveReaction={() => {
          if (reactionSheetMsg) {
            const myId = user?.id || user?.user_id || '';
            const myReact = (reactionSheetMsg.reactions || []).find((r: any) => (r.user_id || r.userId) === myId);
            if (myReact && selectedChat) {
              handleReactToMessage(reactionSheetMsg.message_id, myReact.emoji);
            }
          }
          setReactionSheetMsg(null);
        }}
        onChangeReaction={(emoji) => {
          if (reactionSheetMsg && selectedChat) {
            handleReactToMessage(reactionSheetMsg.message_id, emoji);
          }
          setReactionSheetMsg(null);
        }}
        themeColor={currentChatTheme?.colors?.primary || '#ff1493'}
      />

      <FullEmojiPickerModal
        isOpen={showFullEmojiPicker}
        onClose={() => {
          setShowFullEmojiPicker(false);
          setActiveMessageMenu(null);
        }}
        onSelect={(emoji) => {
          if (activeMessageMenu?.msg?.message_id) {
            handleReactToMessage(activeMessageMenu.msg.message_id, emoji);
          }
          setShowFullEmojiPicker(false);
          setActiveMessageMenu(null);
        }}
      />

      <AnimatePresence>
        {showForwardModal && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-0 bg-[#0b141a] text-white z-[200] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center px-4 h-16 bg-[#0b141a] border-b border-gray-800 shrink-0 gap-3">
              <button onClick={() => setShowForwardModal(false)} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:bg-white/20">
                <ArrowLeft size={24} className="text-white" />
              </button>
              <input
                type="text"
                placeholder="Forward to..."
                value={forwardSearchQuery}
                onChange={e => setForwardSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-white text-[17px] font-medium placeholder:text-white/40 focus:ring-0 px-1"
              />
              <div className="flex items-center gap-1">
                <button onClick={() => { setShowForwardModal(false); setShowNewChatModal(true); }} className="p-2 rounded-full hover:bg-white/10 active:bg-white/20">
                  <Users size={22} className="text-white" />
                </button>
              </div>
            </div>

            {/* List Area */}
            <div className="flex-1 overflow-y-auto pb-24">

              {/* Recent Chats Header */}
              {conversations.length > 0 && (
                <div className="px-4 py-2 mt-2">
                  <span className="text-[14px] text-[#8696a0] font-medium">Recent chats</span>
                </div>
              )}

              {conversations.slice(0, 4).map(chat => (
                <div
                  key={`recent-${chat.chat_id}`}
                  onClick={() => {
                    if (socket && forwardingMessage) {
                      socket.emit('send-message', {
                        chatId: chat.chat_id,
                        content: forwardingMessage.content,
                        type: forwardingMessage.type || 'text',
                        mediaUrl: forwardingMessage.mediaUrl || forwardingMessage.media_url,
                        forwarded: true,
                        isGroup: chat.is_group || chat.chat_type === 'group'
                      });
                      if (navigator.vibrate) navigator.vibrate([50]);
                      setShowForwardModal(false);
                      setForwardingMessage(null);
                    }
                  }}
                  className="px-4 py-3 flex items-center hover:bg-[#111b21] cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden bg-gray-800 relative">
                    <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-full h-full object-cover" alt="" />
                    {(chat.partner_online || chat.group_online_count) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#121212]" />
                    )}
                  </div>
                  <div className="ml-4 flex-1 overflow-hidden flex flex-col justify-center">
                    <h3 className="text-[16px] text-[#e9edef] truncate">{sanitizePartnerName(chat.partner_name, chat.partner_username)}</h3>
                    <p className="text-[14px] text-[#8696a0] truncate">{chat.is_group || chat.chat_type === 'group' ? 'Group' : 'User'}</p>
                  </div>
                </div>
              ))}

              {/* All Followers */}
              {Array.isArray(suggestedContacts) && suggestedContacts.length > 0 && (
                <div className="px-4 py-2 mt-4">
                  <span className="text-[14px] text-[#8696a0] font-medium">All followers</span>
                </div>
              )}

              {Array.isArray(suggestedContacts) && suggestedContacts
                .filter(contact => forwardSearchQuery ? (contact.name || contact.username).toLowerCase().includes(forwardSearchQuery.toLowerCase()) : true)
                .map(contact => (
                  <div
                    key={`follower-${contact.user_id || contact.id}`}
                    onClick={async () => {
                      if (forwardingMessage) {
                        try {
                          const res = await api.post('/messages/chat', { partnerId: contact.user_id || contact.id });
                          if (res.data?.chat_id && socket) {
                            socket.emit('send-message', {
                              chatId: res.data.chat_id,
                              content: forwardingMessage.content,
                              type: forwardingMessage.type || 'text',
                              mediaUrl: forwardingMessage.mediaUrl || forwardingMessage.media_url,
                              forwarded: true,
                              isGroup: false
                            });
                            if (navigator.vibrate) navigator.vibrate([50]);
                            setShowForwardModal(false);
                            setForwardingMessage(null);
                          }
                        } catch (err) {
                          console.error('Failed to forward to follower', err);
                        }
                      }
                    }}
                    className="px-4 py-3 flex items-center hover:bg-[#111b21] cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden bg-gray-800 relative">
                      <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="ml-4 flex-1 overflow-hidden flex flex-col justify-center">
                      <h3 className="text-[16px] text-[#e9edef] truncate">{contact.name || contact.username}</h3>
                      <p className="text-[14px] text-[#8696a0] truncate">@{contact.username}</p>
                    </div>
                  </div>
                ))}
            </div>

            <AnimatePresence>
              {selectedForwardChatIds.length > 0 && (
                <motion.div
                  initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                  className="absolute bottom-0 left-0 right-0 p-4 bg-[#0b141a] flex justify-end"
                >
                  <button
                    onClick={() => {
                      selectedForwardChatIds.forEach(chatId => {
                        const targetChat = conversations.find(c => c.chat_id === chatId);
                        if (socket && targetChat && forwardingMessage) {
                          socket.emit('send-message', {
                            chatId: targetChat.chat_id,
                            content: forwardingMessage.content,
                            type: forwardingMessage.type || 'text',
                            mediaUrl: forwardingMessage.mediaUrl || forwardingMessage.media_url,
                            forwarded: true,
                            isGroup: targetChat.is_group || targetChat.chat_type === 'group'
                          });
                        }
                      });
                      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
                      setShowForwardModal(false);
                      setSelectedForwardChatIds([]);
                      setForwardingMessage(null);
                    }}
                    className="w-14 h-14 rounded-full bg-[#00a884] text-white shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                  >
                    <Forward size={24} strokeWidth={2.5} className="text-white -ml-1" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <SparklePeopleHubModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        title={peopleHubMode === 'share_contact' ? 'Share Contact' : undefined}
        actionLabel={peopleHubMode === 'share_contact' ? 'Share Contact' : undefined}
        onSelectUser={(contact) => {
          setShowNewChatModal(false);
          if (peopleHubMode === 'share_contact') {
            const contactName = contact.name || contact.username || 'Sparkle User';
            const contactPhoneOrHandle = contact.phone_number || (contact.username ? `@${contact.username}` : '+1 (555) 019-2834');
            const contactMetadata = JSON.stringify({
              userId: contact.user_id || contact.id,
              name: contactName,
              username: contact.username,
              avatar_url: contact.avatar_url,
              phone: contact.phone_number
            });
            handleSendMessage(undefined, contactName, 'contact', contactPhoneOrHandle, contactMetadata);
          } else {
            startNewChat(contact);
          }
        }}
        onNavigateProfile={(username) => {
          setShowNewChatModal(false);
          navigate(`/profile/${username}`);
        }}
      />

      {showCameraModal && (
        <CameraModal
          isOpen={showCameraModal}
          onClose={() => setShowCameraModal(false)}
          partnerName={sanitizePartnerName(selectedChat?.partner_name, selectedChat?.partner_username) || 'My Story'}
          partnerAvatar={selectedChat?.partner_avatar || user?.avatar_url}
          onSend={(mediaUrl, viewMode) => {
            setShowCameraModal(false);
            if (!mediaUrl || !selectedChat) return;
            handleMediaSelection({ source: 'camera', uri: mediaUrl });
          }}
        />
      )}

      {/* VIEW NOTE MODAL — Full Screen */}
      <AnimatePresence>
        {showViewNoteModal && viewingNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[200] flex flex-col"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4">
              <div className="flex items-center gap-3">
                {viewingNote.initials ? (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ background: viewingNote.color }}>{viewingNote.initials}</div>
                ) : (
                  <img src={getAvatarUrl(viewingNote.avatar_url, viewingNote.username)} className="w-9 h-9 rounded-full object-cover" alt="" />
                )}
                <div>
                  <span className="text-white font-semibold text-[15px] block leading-tight">{viewingNote.name || viewingNote.username}</span>
                  <span className="text-white/40 text-[11px]">10h</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-white/60 hover:text-white transition-colors p-1">
                  <MoreHorizontal size={22} />
                </button>
                <button
                  onClick={() => setShowViewNoteModal(false)}
                  className="text-white/60 hover:text-white transition-colors p-1"
                >
                  <X size={22} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Center — Avatar + Bubble */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="flex flex-col items-center">
                {/* Speech bubble */}
                <div className="relative mb-3">
                  <div
                    className="rounded-[24px] px-6 py-4 max-w-[260px] shadow-2xl text-center text-[16px] font-bold text-white"
                    style={{ backgroundColor: viewingNote.bubbleBg || '#ff1493', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  >
                    {viewingNote.note}
                  </div>
                  {/* Tail pointing down-left */}
                  <div
                    className="absolute -bottom-[10px] left-[28px]"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '12px solid transparent',
                      borderRight: '0px solid transparent',
                      borderTop: `12px solid ${viewingNote.bubbleBg || '#ff1493'}`,
                    }}
                  />
                </div>

                {/* Avatar */}
                <div className="mt-1 w-[88px] h-[88px] rounded-full overflow-hidden border-2 border-white/10 shadow-2xl">
                  {viewingNote.initials ? (
                    <div className="w-full h-full flex items-center justify-center text-white text-3xl font-black" style={{ background: viewingNote.color }}>{viewingNote.initials}</div>
                  ) : (
                    <img src={getAvatarUrl(viewingNote.avatar_url, viewingNote.username)} className="w-full h-full object-cover" alt="" />
                  )}
                </div>
              </div>
            </div>

            {/* Bottom — Send message + quick reactions */}
            <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-3">
              {/* Quick reactions */}
              <div className="flex items-center justify-center gap-6 px-1 relative">
                {['❤️', '😆', '😮', '😨', '😢'].map(emoji => (
                  <button
                    key={emoji}
                    disabled={isNoteReacting}
                    onClick={() => {
                      setIsNoteReacting(true);
                      setNoteReacted(emoji);

                      // Create bubbles
                      const newBubbles = Array.from({ length: 15 }).map((_, i) => ({
                        id: Date.now() + i,
                        emoji,
                        x: (Math.random() - 0.5) * 100,
                        delay: Math.random() * 0.3
                      }));
                      setNoteBubbles(newBubbles);

                      // Send reaction after animation
                      setTimeout(async () => {
                        try {
                          const reactionMsg = `Reacted to your note "${viewingNote.note}": ${emoji}`;
                          await api.post('/messages/send', {
                            partnerId: viewingNote.user_id || viewingNote.id,
                            content: reactionMsg
                          });

                          setNoteNotification({
                            emoji,
                            name: viewingNote.name || viewingNote.username,
                            note: viewingNote.note
                          });

                          setNoteReactSent(true);
                          setTimeout(() => {
                            setShowViewNoteModal(false);
                            setNoteNotification(null);
                          }, 2500);
                        } catch (err) {
                          console.error('Failed to send reaction', err);
                        } finally {
                          setIsNoteReacting(false);
                        }
                      }, 2500);
                    }}
                    className={clsx(
                      "w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-2xl hover:bg-white/20 active:scale-90 transition-all",
                      noteReacted === emoji ? "ring-2 ring-[#ff1493] bg-white/20 scale-110" : ""
                    )}
                  >
                    {emoji}
                  </button>
                ))}

                {/* Bubbles Container */}
                <div className="absolute inset-x-0 bottom-full h-[60vh] pointer-events-none overflow-visible">
                  <AnimatePresence>
                    {noteBubbles.map(b => (
                      <motion.div
                        key={b.id}
                        initial={{ y: 0, x: 0, opacity: 0, scale: 0.5 }}
                        animate={{
                          y: -400 - Math.random() * 200,
                          x: b.x * 2,
                          opacity: [0, 1, 1, 0],
                          scale: [0.5, 1.5, 1],
                          rotate: Math.random() * 360
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2, delay: b.delay, ease: "easeOut" }}
                        className="absolute left-1/2 -translate-x-1/2 text-4xl"
                      >
                        {b.emoji}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Notification Overlay */}
              <AnimatePresence>
                {noteNotification && (
                  <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 20, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-0 left-4 right-4 z-[300] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 flex items-center gap-4 shadow-2xl"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-[#ff1493]">
                      <img src={getAvatarUrl(viewingNote.avatar_url, viewingNote.username)} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-[13px] font-bold">{viewingNote.name || viewingNote.username} <span className="font-normal opacity-60">reacted to your note:</span></p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-3xl animate-spark-pop">{noteNotification.emoji}</span>
                        <p className="text-white font-bold text-[16px] italic truncate">"{noteNotification.note}"</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Send message bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/10 border border-white/20 rounded-full px-5 h-12 flex items-center gap-3 focus-within:border-[#ff1493]/30 transition-all relative">
                  <input
                    type="text"
                    placeholder="Send message"
                    value={noteReplyText}
                    onChange={(e) => setNoteReplyText(e.target.value)}
                    className="flex-1 bg-transparent text-white placeholder:text-white/35 text-[15px] font-medium outline-none"
                  />

                  {noteReplyText.trim() ? (
                    <button
                      onClick={async () => {
                        try {
                          await api.post('/messages/send', {
                            partnerId: viewingNote.user_id || viewingNote.id,
                            content: noteReplyText
                          });
                          setNoteReplyText('');
                          setShowViewNoteModal(false);
                        } catch (err) {
                          console.error('Failed to send reply', err);
                        }
                      }}
                      className="text-[#ff1493] hover:scale-110 active:scale-90 transition-all font-bold text-sm"
                    >
                      Send
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowNoteEmojiPicker(!showNoteEmojiPicker)}
                      className={clsx("transition-colors", showNoteEmojiPicker ? "text-[#ff1493]" : "text-white/50 hover:text-white")}
                    >
                      <Smile size={22} strokeWidth={2} />
                    </button>
                  )}

                  {/* Mobile-Friendly Emoji Picker Bottom Sheet for Notes */}
                  <AnimatePresence>
                    {showNoteEmojiPicker && (
                      <div className="fixed inset-0 z-[500] flex items-end justify-center">
                        <motion.div
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                          onClick={() => setShowNoteEmojiPicker(false)}
                        />
                        <motion.div
                          initial={{ y: "100%" }}
                          animate={{ y: 0 }}
                          exit={{ y: "100%" }}
                          transition={{ type: "spring", damping: 25, stiffness: 200 }}
                          className="relative z-10 w-full h-[30vh] overflow-hidden"
                        >
                          <Picker
                            data={data}
                            onEmojiSelect={(emoji: any) => {
                              setNoteReplyText(prev => prev + emoji.native);
                              setShowNoteEmojiPicker(false);
                            }}
                            theme="dark"
                            native={true}
                            previewPosition="none"
                            skinTonePosition="none"
                            navPosition="none"
                            searchPosition="none"
                            perLine={10}
                            width="100%"
                          />
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showChatSettings && selectedChat && (
        <ChatSettingsModal
          key={selectedChat.chat_id || selectedChat.id}
          chat={selectedChat}
          onClose={() => setShowChatSettings(false)}
          onNavigateProfile={() => {
            setShowChatSettings(false);
            navigate(`/profile/${selectedChat.partner_username || selectedChat.partner_id}`);
          }}
        />
      )}

      {/* ── 1. FLOATING ATTACHMENT BOTTOM SHEET ── */}
      <AnimatePresence>
        {showAttachmentSheet && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center select-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setShowAttachmentSheet(false);
                setSelectedMediaItems([]);
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="relative z-10 w-full max-w-[540px] bg-[#121212]/95 border-t border-white/10 rounded-t-[32px] overflow-hidden backdrop-blur-xl flex flex-col"
              style={{
                height: attachmentSheetHeight === 'full' ? '92vh' : '56vh',
                boxShadow: '0 -20px 40px -15px rgba(0,0,0,0.7)'
              }}
            >
              {/* Drag / Pull Up Handle */}
              <div
                className="w-full py-4 cursor-pointer hover:bg-white/5 transition-all shrink-0 flex flex-col items-center justify-center gap-1.5"
                onClick={() => setAttachmentSheetHeight(h => h === 'partial' ? 'full' : 'partial')}
              >
                <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
                  {attachmentSheetHeight === 'full' ? 'Swipe Down to Collapse' : 'Pull Up to Expand'}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-24 no-scrollbar flex flex-col gap-6">
                {/* Refactored Compact Quick Actions Grid */}
                <div className="flex flex-col gap-3 py-2">
                  <span className="text-[11px] font-bold text-white/50 text-center tracking-widest uppercase mb-1">Attach</span>

                  {/* Top Row: Camera | Photos | Document */}
                  <div className="grid grid-cols-3 gap-3 px-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentSheet(false);
                        setShowCameraModal(true);
                      }}
                      className="flex flex-col items-center gap-2 py-3 bg-white/5 hover:bg-white/10 active:scale-95 rounded-2xl transition-all border border-white/10"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shadow-md"><Camera size={20} strokeWidth={2.5} /></div>
                      <span className="text-[11px] font-bold tracking-wide text-white/90">Camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAttachmentSheetHeight('full')}
                      className="flex flex-col items-center gap-2 py-3 bg-white/5 hover:bg-white/10 active:scale-95 rounded-2xl transition-all border border-white/10"
                    >
                      <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center shadow-md"><ImageIcon size={20} strokeWidth={2.5} /></div>
                      <span className="text-[11px] font-bold tracking-wide text-white/90">Photos</span>
                    </button>

                    <label className="flex flex-col items-center gap-2 py-3 bg-white/5 hover:bg-white/10 active:scale-95 rounded-2xl transition-all border border-white/10 cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,.docx,.zip,.txt,.xlsx"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleMediaSelection({ source: 'attachment', file, type: 'document' });
                          }
                        }}
                      />
                      <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center shadow-md"><FileText size={20} strokeWidth={2.5} /></div>
                      <span className="text-[11px] font-bold tracking-wide text-white/90">Document</span>
                    </label>
                  </div>

                  {/* Bottom Row: Voice | Location | Contact */}
                  <div className="grid grid-cols-3 gap-3 px-2">
                    <label className="flex flex-col items-center gap-2 py-3 bg-white/5 hover:bg-white/10 active:scale-95 rounded-2xl transition-all border border-white/10 cursor-pointer">
                      <input
                        type="file"
                        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.webm"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 25 * 1024 * 1024) {
                              alert('Audio file is too large (maximum size is 25MB).');
                              return;
                            }
                            setShowAttachmentSheet(false);
                            setAudioPreviewFile(file);
                            setShowAudioPreviewModal(true);
                          }
                        }}
                      />
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shadow-md"><Mic size={20} strokeWidth={2.5} /></div>
                      <span className="text-[11px] font-bold tracking-wide text-white/90">Voice/Audio</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setShowLocationPickerModal(true);
                        setShowAttachmentSheet(false);
                      }}
                      className="flex flex-col items-center gap-2 py-3 bg-white/5 hover:bg-white/10 active:scale-95 rounded-2xl transition-all border border-white/10"
                    >
                      <div className="w-10 h-10 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center shadow-md"><MapPin size={20} strokeWidth={2.5} /></div>
                      <span className="text-[11px] font-bold tracking-wide text-white/90">Location</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentSheet(false);
                        setPeopleHubMode('share_contact');
                        setShowNewChatModal(true);
                      }}
                      className="flex flex-col items-center gap-2 py-3 bg-white/5 hover:bg-white/10 active:scale-95 rounded-2xl transition-all border border-white/10"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-md"><User size={20} strokeWidth={2.5} /></div>
                      <span className="text-[11px] font-bold tracking-wide text-white/90">Contact</span>
                    </button>
                  </div>
                </div>

                {/* Integrated Media Section */}
                <div className="border-t border-white/5 pt-4 flex flex-col gap-4">
                  <div className="flex justify-between items-center px-0.5">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-white/40">Recent Device Media</h4>
                    {mediaPermission === 'granted' && (
                      <label className="text-[10px] font-semibold text-[#ff1493] cursor-pointer hover:underline flex items-center gap-1 active:scale-95 transition-all">
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={handleDeviceImport}
                        />
                        + Add File
                      </label>
                    )}
                  </div>

                  {/* Permissions & Media View States */}
                  {mediaPermission === 'prompt' && (
                    <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center text-center gap-3.5 backdrop-blur-md relative overflow-hidden">
                      <div className="w-10 h-10 rounded-full bg-[#ff1493]/15 text-[#ff1493] flex items-center justify-center"><ImageIcon size={20} strokeWidth={2} /></div>
                      <div className="flex flex-col gap-1 z-10">
                        <span className="text-[12px] font-bold text-white">Access Recent Media</span>
                        <p className="text-[10px] text-white/50 leading-relaxed max-w-[280px]">
                          Sparkle requests access to your device storage to display photos, videos, and screenshots for rapid sharing.
                        </p>
                      </div>
                      <div className="flex gap-2 w-full mt-1.5 z-10">
                        <button
                          type="button"
                          onClick={() => setMediaPermission('granted')}
                          className="flex-1 py-2 px-3 bg-[#ff1493] hover:bg-pink-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-md shadow-pink-500/10"
                        >
                          Allow Access
                        </button>
                        <label className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 border border-white/5 flex items-center justify-center cursor-pointer">
                          <input
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={handleDeviceImport}
                          />
                          Scan Storage
                        </label>
                      </div>
                    </div>
                  )}

                  {mediaPermission === 'denied' && (
                    <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col items-center text-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center"><ShieldAlert size={20} /></div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[12px] font-bold text-white">Storage Permission Blocked</span>
                        <p className="text-[10px] text-white/50 leading-relaxed max-w-[280px]">
                          Please enable gallery permissions in your system settings to browse device files.
                        </p>
                      </div>
                      <label className="py-2 px-6 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 border border-white/5 cursor-pointer mt-1">
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={handleDeviceImport}
                        />
                        Select Manually
                      </label>
                    </div>
                  )}

                  {mediaPermission === 'granted' && deviceMedia.length === 0 ? (
                    <div className="py-8 px-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center text-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#ff1493]/10 text-[#ff1493] flex items-center justify-center animate-pulse"><ImageIcon size={18} /></div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-white/80">No scanned device media</span>
                        <p className="text-[9px] text-white/40 leading-relaxed max-w-[240px]">
                          Select real photos or videos from your storage folder to scan and populate this gallery.
                        </p>
                      </div>
                      <label className="py-2 px-5 bg-[#ff1493] hover:bg-pink-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-md shadow-pink-500/10 cursor-pointer">
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={handleDeviceImport}
                        />
                        Select Real Photos
                      </label>
                    </div>
                  ) : mediaPermission === 'granted' && (
                    <div className="grid grid-cols-4 gap-2 no-scrollbar max-h-[360px] overflow-y-auto pr-0.5">
                      {deviceMedia.map((item) => {
                        const selectedIndex = selectedMediaItems.findIndex(i => i.id === item.id);
                        const isSelected = selectedIndex >= 0;

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedMediaItems(prev => prev.filter(i => i.id !== item.id));
                              } else {
                                setSelectedMediaItems(prev => [...prev, item]);
                              }
                            }}
                            className={clsx(
                              "relative aspect-square overflow-hidden border cursor-pointer select-none group transition-all duration-300 active:scale-95 shadow-md",
                              item.isLarge ? "col-span-2 aspect-[2.1/1] rounded-none" : "col-span-1 rounded-2xl",
                              isSelected ? "border-[#ff1493] ring-2 ring-[#ff1493]/35" : "border-white/5 hover:border-white/20"
                            )}
                          >
                            <img src={item.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={item.name} loading="lazy" />

                            {/* Folder category pill */}
                            <div className="absolute bottom-1.5 left-2 py-0.5 px-1.5 bg-black/60 rounded-md text-[8px] text-white/80 font-medium tracking-wide">
                              {item.folder || 'Downloads'}
                            </div>

                            {isSelected && (
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#ff1493] border-2 border-white flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-pink-500/35">
                                {selectedIndex + 1}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Float Send Bar when selected */}
              {selectedMediaItems.length > 0 && (
                <div className="absolute bottom-6 left-6 right-6 z-20 py-3 px-5 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl flex justify-between items-center shadow-2xl animate-fade-in">
                  <span className="text-[12px] font-black uppercase tracking-wider text-white pr-2">
                    {selectedMediaItems.length} ITEM{selectedMediaItems.length > 1 ? 'S' : ''} SELECTED
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachmentSheet(false);
                      setShowMediaComposer(true);
                    }}
                    className="py-2.5 px-6 rounded-xl bg-[#ff1493] hover:bg-pink-600 text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-pink-500/25 active:scale-95 transition-all"
                  >
                    Preview & Send
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 2. MULTIPLE SELECTION MEDIA COMPOSER ── */}
      <AnimatePresence>
        {showMediaComposer && (
          <div className="fixed inset-0 z-[300] bg-[#0c0c0c] flex flex-col select-none">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex justify-between items-center backdrop-blur-md bg-black/20 shrink-0">
              <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Media Composer</span>
              <button
                type="button"
                onClick={() => {
                  setShowMediaComposer(false);
                  setSelectedMediaItems([]);
                  setMediaCaption('');
                }}
                className="text-white/60 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            {/* Slider / Image Viewer */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0 relative overflow-hidden bg-black/40">
              <div className="w-full max-w-[480px] h-[340px] rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl">
                {selectedMediaItems.length > 0 && (
                  <img src={selectedMediaItems[0].url} className="w-full h-full object-cover" alt="Previewing asset" />
                )}
              </div>
            </div>

            {/* Footer Form with Caption & Concurrent Queue Send */}
            <div className="p-6 border-t border-white/5 bg-[#121212]/90 backdrop-blur-xl shrink-0 flex flex-col gap-4">
              <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3 border border-white/5">
                <input
                  type="text"
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  placeholder="Add a caption..."
                  className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/20 outline-none border-none focus:ring-0 p-0 shadow-none"
                />
              </div>

              <div className="flex items-center justify-between">
                {/* Thumbnails grid */}
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
                  {selectedMediaItems.map((item, idx) => (
                    <div key={item.id} className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 shrink-0">
                      <img src={item.url} className="w-full h-full object-cover" alt="" />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMediaItems(prev => prev.filter(i => i.id !== item.id));
                          if (selectedMediaItems.length <= 1) {
                            setShowMediaComposer(false);
                          }
                        }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const items = [...selectedMediaItems];
                    const caption = mediaCaption;
                    setShowMediaComposer(false);
                    setSelectedMediaItems([]);
                    setMediaCaption('');

                    // Trigger concurrent background media uploads & optimistic messaging
                    for (const item of items) {
                      const queueId = `upload_${Date.now()}_${item.id}`;
                      const mediaType = item.type || 'image';

                      // 1. Display optimistic media bubble in chat IMMEDIATELY
                      const tempMessageId = crypto.randomUUID();
                      const optimisticMsg: any = {
                        message_id: tempMessageId,
                        id: tempMessageId,
                        sender_id: user?.id || user?.user_id || '',
                        content: caption || '',
                        status: 'sending',
                        sent_at: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        is_read: false,
                        type: mediaType,
                        media_url: item.url,
                        mediaUrl: item.url
                      };
                      updateMessages(prev => [...prev, optimisticMsg]);
                      AudioSessionManager.playSound('send');
                      if (isNearBottom) setTimeout(() => scrollToBottom('smooth'), 50);

                      // 2. Add item to upload progress queue widget
                      setUploadQueue(prev => [...prev, { id: queueId, name: item.name || `Attachment ${mediaType}`, progress: 0, status: 'uploading' }]);

                      // 3. Perform background file upload & socket transmission
                      (async () => {
                        try {
                          const filePayload = item.file || item.url;
                          const uploadedUrl = await uploadFileWithProgress(filePayload, (p) => {
                            setUploadQueue(prev => prev.map(u => u.id === queueId ? { ...u, progress: p } : u));
                          });

                          setUploadQueue(prev => prev.map(u => u.id === queueId ? { ...u, progress: 100, status: 'completed' } : u));
                          setTimeout(() => setUploadQueue(prev => prev.filter(u => u.id !== queueId)), 3000);

                          const finalMediaUrl = uploadedUrl || item.url;
                          if (selectedChat) {
                            const payload = {
                              messageId: tempMessageId,
                              chatId: selectedChat.chat_id,
                              partnerId: selectedChat.partner_id,
                              content: caption || '',
                              type: mediaType,
                              mediaUrl: finalMediaUrl
                            };

                            if (socket?.connected) {
                              socket.emit('send-message', payload, (response: any) => {
                                if (response?.success) {
                                  updateMessages(prev => prev.map(m => (m.message_id === tempMessageId || m.id === tempMessageId)
                                    ? { ...m, status: 'sent', media_url: finalMediaUrl, mediaUrl: finalMediaUrl }
                                    : m
                                  ));
                                } else {
                                  updateMessages(prev => prev.map(m => (m.message_id === tempMessageId || m.id === tempMessageId)
                                    ? { ...m, status: 'failed' }
                                    : m
                                  ));
                                }
                              });
                            } else {
                              PersistentOfflineQueue.enqueue(payload);
                            }
                          }
                        } catch (err) {
                          console.error('[MediaUpload] Upload failed:', err);
                          setUploadQueue(prev => prev.map(u => u.id === queueId ? { ...u, status: 'failed' } : u));
                          updateMessages(prev => prev.map(m => (m.message_id === tempMessageId || m.id === tempMessageId)
                            ? { ...m, status: 'failed' }
                            : m
                          ));
                        }
                      })();
                    }
                  }}
                  className="py-3 px-8 rounded-2xl bg-[#ff1493] hover:bg-pink-600 text-white text-[12px] font-black uppercase tracking-widest shadow-xl shadow-pink-500/25 active:scale-95 transition-all shrink-0 ml-4"
                >
                  Send Media
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 3. CONCURRENT UPLOAD QUEUE FLOATING WIDGET ── */}
      <AnimatePresence>
        {uploadQueue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-24 left-6 z-[250] p-4 bg-[#121212]/95 border border-white/10 rounded-3xl w-[280px] backdrop-blur-xl shadow-2xl flex flex-col gap-3"
          >
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#ff1493]">
                Uploading Assets ({uploadQueue.filter(u => u.status === 'uploading').length})
              </span>
              <button
                type="button"
                onClick={() => setUploadQueue([])}
                className="text-white/40 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-3.5 max-h-[160px] overflow-y-auto no-scrollbar">
              {uploadQueue.map(item => (
                <div key={item.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-white/80">
                    <span className="truncate flex-1 pr-4">{item.name}</span>
                    <span>{item.progress}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        "h-full transition-all duration-300",
                        item.status === 'failed' ? "bg-red-500" : item.status === 'completed' ? "bg-green-500" : "bg-[#ff1493]"
                      )}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NEW LIST NAME MODAL ── */}
      <AnimatePresence>
        {showNewListFlow === 'name' && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[300] bg-[#111118] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-white/[0.07]">
              <button onClick={() => { setShowNewListFlow('none'); setNewListName(''); setEditingListId(null); }} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.07] text-white/70 transition-all">
                <X size={20} />
              </button>
              <h2 className="text-[16px] font-bold text-white tracking-tight">{editingListId ? "Edit list" : "New list"}</h2>
              <div className="w-9" />
            </div>
            <div className="flex-1 px-5 pt-8">
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-2">List name</p>
              <div className="relative">
                <input
                  autoFocus
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateList()}
                  placeholder="Example: Work, Friends"
                  className="w-full h-[52px] bg-transparent border-b-2 border-[#ff1493]/60 focus:border-[#ff1493] text-[17px] font-medium text-white placeholder:text-white/25 outline-none pb-1 transition-all pr-10"
                />
                <button type="button" className="absolute right-1 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-all">
                  <Smile size={20} />
                </button>
              </div>
              <p className="text-[12px] text-white/30 mt-3">Any list you create becomes a filter at the top of your Chats tab.</p>
            </div>
            <div className="px-5 pb-10">
              <div className="bg-[#1a1a22] rounded-md p-5 mb-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-md bg-white/[0.07] flex items-center justify-center shrink-0 mt-0.5"><Users size={18} className="text-white/50" /></div>
                  <p className="text-[13px] text-white/55 leading-snug">Any list you create becomes a filter at the top of your Chats tab.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-md bg-white/[0.07] flex items-center justify-center shrink-0 mt-0.5"><Lock size={18} className="text-white/50" /></div>
                  <p className="text-[13px] text-white/55 leading-snug">Only you can see your lists.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-md bg-white/[0.07] flex items-center justify-center shrink-0 mt-0.5"><Palette size={18} className="text-white/50" /></div>
                  <p className="text-[13px] text-white/55 leading-snug">You can change or edit them anytime.</p>
                </div>
              </div>
              <button
                onClick={handleCreateList}
                disabled={!newListName.trim()}
                className="w-full h-[52px] rounded-md font-bold text-[15px] transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ background: newListName.trim() ? '#ff1493' : 'rgba(255,255,255,0.08)', color: 'white' }}
              >
                {editingListId ? "Save & Edit Contacts" : "Continue"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ADD TO LIST MODAL ── */}
      <AnimatePresence>
        {showNewListFlow === 'addPeople' && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[300] bg-[#111118] flex flex-col"
          >
            <div className="flex items-center gap-3 px-4 pt-14 pb-3 border-b border-white/[0.07]">
              <button onClick={() => setShowNewListFlow('name')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.07] text-white/70 transition-all">
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-[16px] font-bold text-white flex-1 tracking-tight">Add to list</h2>
              <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.07] text-white/50 transition-all">
                <Search size={18} />
              </button>
            </div>
            <p className="text-[12px] text-white/35 px-5 py-3 border-b border-white/[0.05]">Add as many people or groups as you want. Only you can see who's included.</p>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {suggestedContacts.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest px-5 pt-5 pb-2">Frequently contacted</p>
                  {suggestedContacts.slice(0, 5).map((c: any) => {
                    const cid = c.user_id || c.id;
                    const conv = conversations.find(cv => cv.partner_id === cid);
                    if (!conv) return null;
                    const sel = listSelectedChats.includes(conv.chat_id);
                    return (
                      <button key={cid} onClick={() => setListSelectedChats(prev => sel ? prev.filter(x => x !== conv.chat_id) : [...prev, conv.chat_id])} className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.07] transition-all">
                        <img src={getAvatarUrl(c.avatar_url, c.username)} className="w-12 h-12 rounded-full object-cover border border-white/[0.10]" alt="" />
                        <span className="flex-1 text-left text-[14.5px] font-[500] text-white/85">{c.name || c.username}</span>
                        <div className={clsx('w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all', sel ? 'bg-[#ff1493] border-[#ff1493]' : 'border-white/25')}>
                          {sel && <Check size={13} strokeWidth={3} className="text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest px-5 pt-5 pb-2">Recent chats</p>
              {conversations.map(chat => {
                const sel = listSelectedChats.includes(chat.chat_id);
                return (
                  <button key={chat.chat_id} onClick={() => setListSelectedChats(prev => sel ? prev.filter(x => x !== chat.chat_id) : [...prev, chat.chat_id])} className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.07] transition-all">
                    <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-12 h-12 rounded-full object-cover border border-white/[0.10]" alt="" />
                    <span className="flex-1 text-left text-[14.5px] font-[500] text-white/85 truncate">{sanitizePartnerName(chat.partner_name, chat.partner_username)}</span>
                    <div className={clsx('w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all', sel ? 'bg-[#ff1493] border-[#ff1493]' : 'border-white/25')}>
                      {sel && <Check size={13} strokeWidth={3} className="text-white" />}
                    </div>
                  </button>
                );
              })}
              <div className="h-28" />
            </div>
            <AnimatePresence>
              {listSelectedChats.length > 0 && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  onClick={handleConfirmList}
                  className="fixed bottom-8 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-10"
                  style={{ background: '#ff1493', boxShadow: '0 0 24px rgba(255,20,147,0.4)' }}
                >
                  <Check size={24} strokeWidth={3} className="text-white" />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TAB DROPDOWN CONTEXT MENU ── */}
      {tabDropdown && (
        <div className="fixed inset-0 z-[1000]" onClick={() => setTabDropdown(null)} onContextMenu={(e) => { e.preventDefault(); setTabDropdown(null); }}>
          <div
            className="absolute bg-[#1b1b24] border border-white/[0.08] rounded-xl py-1 w-44 shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[1010]"
            style={{ top: tabDropdown.y, left: Math.min(tabDropdown.x, window.innerWidth - 180) }}
            onClick={(e) => e.stopPropagation()}
          >
            {customLists.some(l => l.id === tabDropdown.tabId) ? (
              <>
                <button
                  onClick={() => {
                    const isMuted = customLists.find(l => l.id === tabDropdown.tabId)?.isMuted;
                    setCustomLists(prev => prev.map(l => l.id === tabDropdown.tabId ? { ...l, isMuted: !isMuted } : l));
                    setTabDropdown(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/[0.05] flex items-center gap-2"
                >
                  <BellOff size={14} className="opacity-60" />
                  {customLists.find(l => l.id === tabDropdown.tabId)?.isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={() => {
                    const list = customLists.find(l => l.id === tabDropdown.tabId);
                    if (list) {
                      setEditingListId(list.id);
                      setNewListName(list.name);
                      setListSelectedChats(list.chatIds);
                      setShowNewListFlow('name');
                    }
                    setTabDropdown(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/[0.05] flex items-center gap-2"
                >
                  <SquarePen size={14} className="opacity-60" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    setCustomLists(prev => prev.filter(l => l.id !== tabDropdown.tabId));
                    if (activeFilter === tabDropdown.tabId) {
                      setActiveFilter('all');
                    }
                    setTabDropdown(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 border-b border-white/[0.05]"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </>
            ) : (
              tabDropdown.tabId !== 'all' && (
                <button
                  onClick={() => {
                    setHiddenTabs(prev => [...prev, tabDropdown.tabId]);
                    if (activeFilter === tabDropdown.tabId) {
                      setActiveFilter('all');
                    }
                    setTabDropdown(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 border-b border-white/[0.05]"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )
            )}

            <button
              onClick={() => {
                setTempTabOrder([...tabOrder]);
                setTempHiddenTabs([...hiddenTabs]);
                setShowReorderModal(true);
                setTabDropdown(null);
              }}
              className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/[0.05] flex items-center gap-2"
            >
              <Orbit size={14} className="opacity-60" />
              Reorder lists
            </button>
          </div>
        </div>
      )}

      {/* ── REORDER LISTS MODAL ── */}
      <AnimatePresence>
        {showReorderModal && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[300] bg-[#111118] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-white/[0.07]">
              <button
                onClick={() => {
                  setShowReorderModal(false);
                  setTempTabOrder([]);
                  setTempHiddenTabs([]);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.07] text-white/70 transition-all"
              >
                <X size={20} />
              </button>
              <h2 className="text-[16px] font-bold text-white tracking-tight">Reorder lists</h2>
              <button
                onClick={() => {
                  setTabOrder(tempTabOrder);
                  setHiddenTabs(tempHiddenTabs);
                  setShowReorderModal(false);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.07] text-[#ff1493] transition-all"
              >
                <Check size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 no-scrollbar">
              <div>
                <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">Default tabs</p>
                <div className="space-y-2">
                  {tempTabOrder
                    .filter(id => ['unread', 'groups', 'archived'].includes(id) && !tempHiddenTabs.includes(id))
                    .map((id, index, arr) => {
                      const label = id.charAt(0).toUpperCase() + id.slice(1);
                      return (
                        <div key={id} className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-white/[0.05] rounded-xl hover:bg-white/[0.05] transition-all">
                          <div className="flex items-center gap-3">
                            <span className="text-white/35 flex items-center"><GripVertical size={16} /></span>
                            <span className="text-[14px] font-semibold text-white/80">{label}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={index === 0}
                              onClick={() => moveTabInList(id, 'up')}
                              className="p-1.5 rounded-lg hover:bg-white/[0.07] text-white/40 hover:text-white transition-all disabled:opacity-20"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              disabled={index === arr.length - 1}
                              onClick={() => moveTabInList(id, 'down')}
                              className="p-1.5 rounded-lg hover:bg-white/[0.07] text-white/40 hover:text-white transition-all disabled:opacity-20"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setTempHiddenTabs(prev => [...prev, id]);
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">Added listings</p>
                {tempTabOrder
                  .filter(id => !['all', 'unread', 'groups', 'archived'].includes(id) && !tempHiddenTabs.includes(id))
                  .length === 0 ? (
                  <div className="py-6 text-center border border-dashed border-white/[0.07] rounded-2xl text-[13px] text-white/30 font-medium">
                    No custom lists created yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tempTabOrder
                      .filter(id => !['all', 'unread', 'groups', 'archived'].includes(id) && !tempHiddenTabs.includes(id))
                      .map((id, index, arr) => {
                        const list = customLists.find(l => l.id === id);
                        if (!list) return null;
                        return (
                          <div key={id} className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-white/[0.05] rounded-xl hover:bg-white/[0.05] transition-all">
                            <div className="flex items-center gap-3">
                              <span className="text-white/35 flex items-center"><GripVertical size={16} /></span>
                              <span className="text-[14px] font-semibold text-white/80">{list.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                disabled={index === 0}
                                onClick={() => moveTabInList(id, 'up')}
                                className="p-1.5 rounded-lg hover:bg-white/[0.07] text-white/40 hover:text-white transition-all disabled:opacity-20"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                disabled={index === arr.length - 1}
                                onClick={() => moveTabInList(id, 'down')}
                                className="p-1.5 rounded-lg hover:bg-white/[0.07] text-white/40 hover:text-white transition-all disabled:opacity-20"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setCustomLists(prev => prev.filter(l => l.id !== id));
                                  setTempTabOrder(prev => prev.filter(x => x !== id));
                                }}
                                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {tempHiddenTabs.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">Hidden default tabs</p>
                  <div className="space-y-2">
                    {tempHiddenTabs.map(id => {
                      const label = id.charAt(0).toUpperCase() + id.slice(1);
                      return (
                        <div key={id} className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border border-white/[0.04] rounded-xl text-white/50">
                          <span className="text-[13px] font-semibold">{label}</span>
                          <button
                            onClick={() => {
                              setTempHiddenTabs(prev => prev.filter(x => x !== id));
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#ff1493]/10 text-[#ff1493] hover:bg-[#ff1493]/20 transition-all flex items-center gap-1 text-[11px] font-bold"
                          >
                            <Plus size={12} />
                            Restore
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 4. LIGHTBOX IMAGE VIEW OVERLAY ── */}
      <AnimatePresence>
        {lightboxUrl && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center select-none bg-black/95 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 cursor-pointer"
              onClick={() => setLightboxUrl(null)}
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative z-10 max-w-[90vw] max-h-[90vh] overflow-hidden"
            >
              <img src={lightboxUrl} className="w-full h-auto max-h-[85vh] object-contain rounded-2xl border border-white/10 shadow-2xl" alt="" />
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center shadow-lg active:scale-90 transition-all border border-white/10"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SPARKLE ENTERPRISE UX MODALS & OVERLAYS ── */}
      <SparkleActionSheet
        isOpen={showOrbitMenu}
        onClose={() => setShowOrbitMenu(false)}
        onViewProfile={() => {
          const target = peekChat?.partner_username || user?.username || user?.user_id;
          if (target) navigate(`/profile/${target}`);
        }}
        onMarkUnread={() => alert('Marked as Unread')}
        onFavorite={handleBatchFavorite}
        onPin={handleBatchPin}
        onMute={() => alert('Muted Notifications')}
        onClearChat={() => alert('Chat Cleared')}
        onExportChat={() => alert('Exporting Chat...')}
        onBlockUser={() => alert('User Blocked')}
        onReportUser={() => alert('User Reported')}
        onMessageSettings={() => navigate('/messages/settings')}
        isPinned={selectedChatIds.length === 1 && conversations.find(c => c.chat_id === selectedChatIds[0])?.is_pinned}
        isFavorite={selectedChatIds.length === 1 && conversations.find(c => c.chat_id === selectedChatIds[0])?.is_favorite}
        isMuted={selectedChatIds.length === 1 && conversations.find(c => c.chat_id === selectedChatIds[0])?.is_muted}
      />

      <SparkleOrbitMenu
        isOpen={showOrbitConstellation}
        onClose={() => setShowOrbitConstellation(false)}
        actions={[
          { id: 'profile', label: 'View Profile', icon: <User size={18} />, onClick: () => navigate(`/profile/${user?.username || user?.user_id}`) },
          { id: 'fav', label: 'Favorite Chat', icon: <Star size={18} className="text-amber-400 fill-amber-400" />, onClick: handleBatchFavorite },
          { id: 'pin', label: 'Pin Chat', icon: <Pin size={18} className="text-[#FF008A] fill-[#FF008A]" />, onClick: handleBatchPin },
          { id: 'clear', label: 'Clear Chat', icon: <Eraser size={18} />, onClick: () => alert('Chat Cleared') },
          { id: 'block', label: 'Block User', icon: <Ban size={18} />, onClick: () => alert('User Blocked') },
          { id: 'export', label: 'Export Chat', icon: <Download size={18} />, onClick: () => alert('Chat Exported') },
        ]}
      />

      <SparklePeekCard
        chat={peekChat}
        isOpen={!!peekChat}
        onClose={() => setPeekChat(null)}
        onViewProfile={() => {
          const target = peekChat?.partner_username || peekChat?.username || peekChat?.partner_id;
          if (target) navigate(`/profile/${target}`);
        }}
      />

      <SparkleSelectionMenu
        isOpen={showSelectionMenu}
        onClose={() => setShowSelectionMenu(false)}
        selectedCount={selectedChatIds.length}
        isAllSelected={filteredConversations.length > 0 && selectedChatIds.length === filteredConversations.length}
        isPriority={selectedChatIds.length > 0 && selectedChatIds.every(id => conversations.find(c => c.chat_id === id)?.is_priority)}
        isFavorite={selectedChatIds.length > 0 && selectedChatIds.every(id => conversations.find(c => c.chat_id === id)?.is_favorite)}
        isUnread={selectedChatIds.length > 0 && selectedChatIds.every(id => (conversations.find(c => c.chat_id === id)?.unread_count || 0) > 0)}
        onSelectAll={() => setSelectedChatIds(filteredConversations.map(c => c.chat_id))}
        onDeselectAll={() => setSelectedChatIds([])}
        onTogglePriority={handleBatchPriority}
        onSparklePeek={() => {
          if (selectedChatIds.length === 1) {
            const targetChat = conversations.find(c => c.chat_id === selectedChatIds[0]);
            if (targetChat) setPeekChat(targetChat);
          }
        }}
        onSmartRecall={() => {
          const recallChat = conversations.find(c => (c.unread_count > 0 || c.is_priority || c.is_pinned) && !c.is_archived) || conversations[0];
          if (recallChat) {
            setSelectedChat(recallChat);
            navigate(`/messages?chat=${recallChat.chat_id}`);
          }
        }}

        onViewProfile={() => {
          if (selectedChatIds.length === 1) {
            const targetChat = conversations.find(c => c.chat_id === selectedChatIds[0]);
            const target = targetChat?.partner_username || targetChat?.partner_id;
            if (target) navigate(`/profile/${target}`);
          }
        }}
        onMarkUnread={handleBatchMarkUnread}
        onFavorite={handleBatchFavorite}
        onArchive={handleBatchArchive}
        onClearChat={handleClearChat}
        onBlock={handleBlockUser}
        onSearch={() => {
          if (selectedChatIds.length === 1) {
            const targetChat = conversations.find(c => c.chat_id === selectedChatIds[0]);
            if (targetChat) setSelectedChat(targetChat);
          }
        }}
      />


      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmCount !== null && (
          <div
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none"
            onClick={() => setDeleteConfirmCount(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#181628] border border-white/15 rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-extrabold text-white mb-2">
                {deleteConfirmCount === 1 ? "Delete Conversation?" : `Delete ${deleteConfirmCount} Conversations?`}
              </h3>
              <p className="text-xs font-medium text-white/60 mb-6 leading-relaxed">
                This will delete {deleteConfirmCount === 1 ? "this conversation" : "these conversations"} from your chat list.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeleteConfirmCount(null)}
                  className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBatchDelete}
                  className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold transition-all shadow-lg shadow-rose-600/30"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {selectedChat && (
        <LocationPickerModal
          isOpen={showLocationPickerModal}
          chatId={selectedChat.chat_id}
          onClose={() => setShowLocationPickerModal(false)}
          onSendCurrentLocation={(payload: LocationPayload) => {
            const contentJson = JSON.stringify({
              type: 'location',
              latitude: payload.latitude,
              longitude: payload.longitude,
              accuracy: payload.accuracy,
              address: payload.address || payload.name,
              name: payload.name || payload.address
            });
            handleSendMessage(undefined, contentJson, 'location');
          }}
          onSendLiveLocation={(sessionData) => {
            console.log('Live location started:', sessionData);
          }}
        />
      )}

      <AudioPreviewModal
        file={audioPreviewFile}
        isOpen={showAudioPreviewModal}
        onClose={() => {
          setShowAudioPreviewModal(false);
          setAudioPreviewFile(null);
        }}
        onSend={(file: File) => {
          setShowAudioPreviewModal(false);
          setAudioPreviewFile(null);
          handleVoiceSend(file, undefined, 'device_audio_attachment');
        }}
      />

      {/* Failed Resend Action Sheet Modal */}
      <AnimatePresence>
        {failedResendModalMsg && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full sm:max-w-md bg-slate-900 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 text-white shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Undelivered Message</h3>
                    <p className="text-xs text-white/50">This message could not be sent to Sparkle servers.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFailedResendModalMsg(null)}
                  className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const msg = failedResendModalMsg;
                    setFailedResendModalMsg(null);
                    handleRetryMessage(msg);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[#ff1493] hover:bg-[#ff1493]/90 text-white font-extrabold text-sm transition-all shadow-lg active:scale-98"
                >
                  <RotateCw size={16} />
                  <span>Resend Message</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedChat) {
                      const msgId = failedResendModalMsg.message_id || failedResendModalMsg.id;
                      deleteMessageLocal(selectedChat.chat_id, msgId);
                      PersistentOfflineQueue.acknowledge(msgId);
                    }
                    setFailedResendModalMsg(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/5 hover:bg-red-500/20 text-red-400 font-bold text-sm transition-all border border-red-500/20 active:scale-98"
                >
                  <Trash2 size={16} />
                  <span>Delete Undelivered Message</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFailedResendModalMsg(null);
                    alert("Problem report submitted to Sparkle Support.");
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 font-semibold text-sm transition-all active:scale-98"
                >
                  <Flag size={16} />
                  <span>Report a Problem</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFailedResendModalMsg(null)}
                  className="w-full py-2.5 text-center text-xs font-bold text-white/40 hover:text-white/70 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeveloperEmergencyConsoleModal isOpen={showDevConsole} onClose={() => setShowDevConsole(false)} />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
        .note-modal-open nav.lg\\:hidden { display: none !important; }
        body.list-modal-open nav { display: none !important; }

        em-emoji-picker { 
          --padding: 0px !important;
          --border-radius: 0px !important;
          width: 100% !important;
          height: 100% !important;
          border: none !important;
        }
      `}</style>
    </AppScreen>
  );
}