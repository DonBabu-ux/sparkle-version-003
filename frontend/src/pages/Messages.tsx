import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';

import { formatChatTimestamp, formatMessageGroupDate, isSameCalendarDay, formatLastSeenChat } from '../utils/format';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { useSocket } from '../hooks/useSocket';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useModalStore } from '../store/modalStore';
import { useThemeStore, PRESET_THEMES } from '../store/themeStore';
import type { SparkleTheme } from '../store/themeStore';
import debounce from 'lodash.debounce';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
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
  ImageIcon,
  FileText,
  MapPin,
  Check,
  CheckCircle2,
  Trash2,
  Info,
  Orbit,
  X,
  ShoppingBag,
  User,
  Type,
  Palette,
  Pin,
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
  Star,
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
  Forward
} from 'lucide-react';
import { getAvatarUrl } from '../utils/imageUtils';
import ModernOfflineState from '../components/ui/ModernOfflineState';
import CameraModal from '../components/chat/CameraModal';
import ChatSettingsModal from '../components/chat/ChatSettingsModal';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import AppScreen from '../components/AppScreen';
import { StatusBarBackground, KeyboardAwareChatLayout } from '../components/SafeLayout';
import { MessageActionSheet, MessageMoreModal, FullEmojiPickerModal } from '../components/chat/MessageActionModals';
import {
  getCachedInbox, setCachedInbox,
  getCachedMessages, setCachedMessages,
  appendMessageToCache,
  getPendingReadReceipts, setPendingReadReceipts, clearPendingReadReceipts
} from '../lib/chatCache';

// --- Types ---
interface ChatConversation {
  chat_id: string;
  partner_id: string;
  partner_avatar?: string;
  partner_name: string;
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
}

const VoiceNotePlayer = ({ url }: { url: string }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
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

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 min-w-[240px] max-w-[300px] select-none">
      <audio 
        ref={audioRef} 
        src={url} 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata}
      />
      <button type="button" onClick={togglePlay} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all shrink-0">
        {isPlaying ? <Pause size={18} strokeWidth={2.5} fill="white" /> : <Play size={18} strokeWidth={2.5} fill="white" className="ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-end gap-[3px] h-[20px] px-1 overflow-hidden">
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
          <span>{formatTime(duration)}</span>
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

const TabItem = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    type="button"
    onClick={onClick}
    className={clsx(
      "flex flex-col items-center gap-1 py-3 px-4 transition-all relative",
      active ? "text-[#ff1493]" : "text-white/40 hover:text-white/60"
    )}
  >
    <Icon size={20} strokeWidth={active ? 3 : 2} />
    <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
    {active && (
      <motion.div layoutId="pickerTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff1493] rounded-full" />
    )}
  </button>
);

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
  theme
}: any) => {
  const [localMessage, setLocalMessage] = useState(initialMessage || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emojis' | 'stickers' | 'gifs' | 'avatars'>('emojis');
  const [giphySearch, setGiphySearch] = useState('');
  const [giphyResults, setGiphyResults] = useState<any[]>([]);
  const [loadingGiphy, setLoadingGiphy] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const initialHeightRef = useRef(window.innerHeight);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      setIsKeyboardOpen(initialHeightRef.current - vv.height > 120);
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    handleResize();

    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [slideOffset, setSlideOffset] = useState(0);
  const initialXRef = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.target.setPointerCapture(e.pointerId);
    startRecording();
    initialXRef.current = e.clientX;
    setSlideOffset(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isRecording) {
      const deltaX = e.clientX - initialXRef.current;
      if (deltaX < 0) {
        setSlideOffset(deltaX);
        if (deltaX < -120) {
          stopRecording(false);
          setSlideOffset(0);
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isRecording) {
      e.target.releasePointerCapture(e.pointerId);
      setSlideOffset(0);
      stopRecording(true);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length > 0) {
          const file = new File([audioBlob], 'voice_note.mp3', { type: 'audio/mp3' });
          if (onVoiceSend) {
            onVoiceSend(file);
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordTime(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordTime(t => t + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access failed', err);
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopRecording = (shouldSend = true) => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    
    if (!shouldSend) {
      audioChunksRef.current = [];
    }
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const GIPHY_KEY = 'V4AnAfCCCGEVjlUjiNMWWXCoW1JrAn4p';

  const themePrimary = theme?.colors?.primary || '#ff1493';
  const themeBg = theme?.colors?.backgroundDark || '#000000';

  const fetchGiphy = async (type: 'gifs' | 'stickers', query?: string) => {
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
  };

  useEffect(() => {
    if (showEmojiPicker && (pickerTab === 'gifs' || pickerTab === 'stickers')) {
      fetchGiphy(pickerTab === 'gifs' ? 'gifs' : 'stickers', giphySearch);
    }
  }, [showEmojiPicker, pickerTab, giphySearch]);

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
  
  useEffect(() => {
    setLocalMessage(initialMessage);
  }, [initialMessage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalMessage(val);
    onTyping(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localMessage.trim() && !sending) return;
    onSend(e, localMessage);
    setLocalMessage('');
  };

  return (
    <footer 
      className="z-30 shrink-0 border-t border-white/5 transition-all duration-300"
      style={{ 
        backgroundColor: themeBg,
        borderTopColor: 'rgba(255,255,255,0.05)',
        paddingBottom: isKeyboardOpen ? '8px' : 'calc(env(safe-area-inset-bottom) + 8px)'
      }}
    >
      <div className="w-full">
        <form onSubmit={handleSubmit} className="flex items-center w-full max-w-[1200px] mx-auto px-1 py-2 relative">
          {!isMenuCollapsed ? (
            <div className="flex items-center shrink-0">
              <button type="button" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="hover:opacity-80 p-2 ml-0" style={{ color: themePrimary }}>
                <Plus size={22} strokeWidth={2.5} />
              </button>
              <button type="button" onClick={onCameraOpen} className="hover:opacity-80 p-2" style={{ color: themePrimary }}>
                <Camera size={22} strokeWidth={2.5} />
              </button>
              <label className="hover:opacity-80 cursor-pointer p-2" style={{ color: themePrimary }}>
                <ImageIcon size={22} strokeWidth={2.5} />
                <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const content = JSON.stringify({ type: 'camera_capture', payload: { image: ev.target?.result as string, viewMode: 'off' } });
                      onSend(undefined, content);
                    };
                    reader.readAsDataURL(file);
                  }
                }} />
              </label>
            </div>
          ) : (
            <button 
              type="button" 
              onClick={() => setIsMenuCollapsed(false)} 
              className="hover:opacity-80 p-2 animate-scale-in shrink-0 ml-1"
              style={{ color: themePrimary }}
            >
              <ChevronRight size={24} strokeWidth={3} />
            </button>
          )}

          <div className="flex-1 relative rounded-full flex items-center h-[42px] px-5 mx-2 overflow-hidden border border-white/5 transition-all focus-within:border-white/15" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <input 
              type="text"
              value={localMessage}
              onChange={handleChange}
              onFocus={() => setShowEmojiPicker(false)}
              placeholder="Type a message..."
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
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ transform: `translateX(${slideOffset}px)`, backgroundColor: themePrimary }}
                className="p-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center justify-center text-white touch-none"
              >
                <Mic size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <AnimatePresence>
            {isRecording && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-y-2 left-2 right-16 flex items-center justify-between px-5 bg-[#121212]/95 backdrop-blur-xl rounded-full border border-white/20 pointer-events-none"
              >
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff1493] animate-ping" />
                  <span className="text-[12px] font-black text-[#ff1493] tracking-wider">
                    {Math.floor(recordTime / 60)}:{String(recordTime % 60).padStart(2, '0')}
                  </span>
                </div>
                
                
                <div className="flex items-center gap-[3px] flex-1 justify-center px-4 overflow-hidden">
                  <div className="flex items-center gap-[3px] animate-pulse">
                     {[...Array(15)].map((_, i) => (
                      <motion.div 
                        key={i} 
                        animate={{ height: [4, 16, 4] }}
                        transition={{ repeat: Infinity, duration: 0.5 + (i * 0.05), ease: 'easeInOut' }}
                        className="w-[2px] rounded-full bg-[#ff1493]"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/50 animate-pulse flex items-center gap-2">
                    <ChevronLeft size={14} strokeWidth={3} /> Slide to cancel
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

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
    </footer>
  );
});

const uploadFileWithProgress = async (
  fileOrUrl: string | File, 
  onProgress: (progress: number) => void
) => {
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
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
      onProgress(percent);
    }
  });
  
  return response.data?.url || response.data?.data?.url || response.data?.secure_url;
};

export default function Messages() {
  const { user } = useUserStore();
  const { setActiveModal } = useModalStore();
  const socket = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetChatId = searchParams.get('chat');

  // --- State ---
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const getTabBadgeCount = (tabId: string) => {
    if (tabId === 'all') return conversations.length;
    if (tabId === 'unread') {
      return conversations.reduce((acc, cv) => acc + (cv.unread_count || 0), 0);
    }
    if (tabId === 'groups') {
      return conversations.filter(cv => !!(cv.is_group || cv.chat_type === 'group')).length;
    }
    if (tabId === 'archived') {
      return conversations.filter(cv => !!(cv as any).is_archived).length;
    }
    const list = customLists.find(l => l.id === tabId);
    if (list) {
      return conversations.filter(cv => list.chatIds.includes(cv.chat_id)).length;
    }
    return 0;
  };
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageSearch, setMessageSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [activeMessageMenu, setActiveMessageMenu] = useState<{ msg: any, type: 'longPress' | 'click' } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<any | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<any | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState<string[]>([]);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
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
  const [suggestedContacts, setSuggestedContacts] = useState<any[]>([]);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteView, setNoteView] = useState('main');
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
  const [typingUsers, setTypingUsers] = useState<{chatId: string, name: string}[]>([]);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  // Tracks whether the user is actively scrolling — used to subtly dim header presence text
  const [isScrollingMessages, setIsScrollingMessages] = useState(false);
  const scrollStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Note reaction states
  const [noteBubbles, setNoteBubbles] = useState<Array<{id: number; emoji: string; x: number; delay: number}>>([]);
  const [noteReacted, setNoteReacted] = useState<string | null>(null);
  const [noteNotification, setNoteNotification] = useState<{emoji: string; name: string; note: string} | null>(null);
  const [noteReactSent, setNoteReactSent] = useState(false);
  const [isNoteReacting, setIsNoteReacting] = useState(false);
  const [noteReplyText, setNoteReplyText] = useState('');
  const [showNoteEmojiPicker, setShowNoteEmojiPicker] = useState(false);

  // --- Chat Filter & Lists ---
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [customLists, setCustomLists] = useState<{id: string; name: string; chatIds: string[]; isMuted?: boolean}[]>(() => {
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
    if (targetChatId && conversations.length > 0) {
      const chat = conversations.find(c => c.chat_id === targetChatId || c.partner_id === targetChatId);
      if (chat) setSelectedChat(chat);
      else setSelectedChat(null);
    } else if (!targetChatId) {
      setSelectedChat(null);
    }
  }, [targetChatId, conversations]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.chat_id);
    }
  }, [selectedChat?.chat_id]);

  // --- Handlers ---
  const fetchInbox = async () => {
    // 1. Render instantly from IndexedDB cache
    const cached = await getCachedInbox();
    if (cached && cached.length > 0) {
      setConversations(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. Fetch fresh data from network and update
    try {
      const res = await api.get('/messages/inbox');
      const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setConversations(list);
      setCachedInbox(list); // persist to IndexedDB in background
    } catch (err: any) {
      console.error('Failed to fetch inbox', err.response?.data || err);
      if (!cached || cached.length === 0) setConversations([]);
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
        partner_name: contact.name || contact.username,
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
    // 1. Show cached messages immediately for instant UI
    const cached = await getCachedMessages(chatId);
    if (cached && cached.length > 0) {
      setMessages(cached);
      scrollToBottom();
    }

    // 2. Fetch fresh from network
    try {
      const res = await api.get(`/messages/chat/${chatId}`);
      const msgs = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      // Deduplicate: merge server list with any optimistic local msgs
      setMessages(prev => {
        const serverIds = new Set(msgs.map((m: any) => m.message_id));
        const localOnly = prev.filter(m => !serverIds.has(m.message_id));
        return [...msgs, ...localOnly];
      });
      setCachedMessages(chatId, msgs); // persist to IndexedDB
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
    if (!socket || !selectedChat) return;

    if (document.hasFocus() && !(selectedChat.is_group || selectedChat.chat_type === 'group') && !selectedChat.chat_id.startsWith('temp_')) {
       socket.emit('mark-read', selectedChat.chat_id);
       setUnreadCountInChat(0);
       
       // Cleanly clear local unread count badge in sidebar list
       setConversations((prev: any[]) => prev.map(c => {
          if (c.chat_id === selectedChat.chat_id) {
             return { ...c, unread_count: 0 };
          }
          return c;
       }));
    }
  }, [socket, selectedChat?.chat_id]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: any) => {
      const activeChat = selectedChatRef.current;
      const isCurrentChat = activeChat && (msg.conversation_id === activeChat.chat_id || msg.chat_id === activeChat.chat_id || msg.sender_id === activeChat.partner_id);
      
      // 1. If it belongs to current active chat, update message array
      if (isCurrentChat) {
        setMessages(prev => {
          if (prev.some(m => m.message_id === msg.message_id)) return prev;
          return [...prev, msg];
        });
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
        if (chatIndex >= 0) {
          const newConvs = [...prev];
          const chat = { ...newConvs[chatIndex] };
          chat.last_message_content = msg.type === 'text' ? msg.content : `Sent a ${msg.type}`;
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
            partner_name: msg.sender_name || msg.sender_username || 'New Contact',
            partner_avatar: msg.sender_avatar,
            unread_count: (activeChat && activeChat.chat_id === chatId) ? 0 : 1,
            last_message_content: msg.type === 'text' ? msg.content : `Sent a ${msg.type}`,
            last_message_time: msg.sent_at || msg.created_at,
            last_message_status: msg.status || 'sent',
            partner_online: true
          };
          return [newChat, ...prev];
        }
      });
    };

    const handleMessagesDelivered = (data: {chatId: string, messageId?: string, userId: string}) => {
       const myId = user?.id || user?.user_id;
       if (data.userId === myId) return; // Prevent falsely upgrading own messages when self receives

       setMessages(prev => prev.map(m => {
          if (m.sender_id === myId && m.status !== 'read' && (m.message_id === data.messageId || !data.messageId)) {
             return { ...m, status: 'delivered' };
          }
          return m;
       }));
       setConversations((prev: any[]) => prev.map(c => {
          if (c.chat_id === data.chatId && c.last_message_status !== 'read') {
             return { ...c, last_message_status: 'delivered' };
          }
          return c;
       }));
    };

    const handleMessagesRead = (data: {chatId: string, readAt?: string, userId?: string}) => {
       const myId = user?.id || user?.user_id;
       if (data.userId === myId) return; // Prevent falsely upgrading own messages when self reads

       setMessages(prev => prev.map(m => {
          // Only upgrade MY outgoing messages to 'read'; never touch received messages, never downgrade
          if (m.sender_id === myId && m.status !== 'read' && data.readAt) {
             return { ...m, status: 'read', read_at: data.readAt };
          }
          return m;
       }));
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
      
      const activeChat = selectedChatRef.current;
      if (activeChat && activeChat.chat_id === data.chatId) {
        setPartnerIsTyping(data.isTyping);
      }
      setTypingUsers(prev => {
        if (data.isTyping) {
          if (prev.some(t => t.chatId === data.chatId)) return prev;
          return [...prev, { chatId: data.chatId, name: data.username || 'Someone' }];
        }
        return prev.filter(t => t.chatId !== data.chatId);
      });
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
      setMessages(prev => prev.map(m => m.message_id === data.messageId ? { ...m, pinned: true, pinned_at: new Date().toISOString(), pinned_by: data.pinnedBy } : m));
    };

    const handleMessageUnpinned = (data: { messageId: string, chatId: string }) => {
      setMessages(prev => prev.map(m => m.message_id === data.messageId ? { ...m, pinned: false, pinned_at: undefined, pinned_by: undefined } : m));
    };

    const handleMessageEdited = (data: { messageId: string, chatId: string, content: string, editedAt: string }) => {
      setMessages(prev => prev.map(m => m.message_id === data.messageId ? { ...m, content: data.content, edited: true, edited_at: data.editedAt } : m));
    };

    const handleMessageDeletedEveryone = (data: { messageId: string, chatId: string }) => {
      setMessages(prev => prev.map(m => m.message_id === data.messageId ? { ...m, content: 'This message was deleted', is_deleted_for_everyone: true } : m));
    };

    const handleMessageDeletedMe = (data: { messageId: string, chatId: string }) => {
      setMessages(prev => prev.filter(m => m.message_id !== data.messageId));
    };

    const handleNewReaction = (data: { messageId: string, chatId: string, userId: string, emoji: string }) => {
      setMessages(prev => prev.map(m => {
        if (m.message_id === data.messageId) {
          const reactions = m.reactions || [];
          if (reactions.some(r => r.user_id === data.userId)) {
            return { ...m, reactions: reactions.map(r => r.user_id === data.userId ? { ...r, emoji: data.emoji } : r) };
          }
          return { ...m, reactions: [...reactions, { emoji: data.emoji, user_id: data.userId }] };
        }
        return m;
      }));
    };

    const handleReactionRemoved = (data: { messageId: string, chatId: string, userId: string, emoji: string }) => {
      setMessages(prev => prev.map(m => {
        if (m.message_id === data.messageId) {
          const reactions = m.reactions || [];
          return { ...m, reactions: reactions.filter(r => !(r.user_id === data.userId && r.emoji === data.emoji)) };
        }
        return m;
      }));
    };

    socket.on('new-message', handleNewMessage);
    socket.on('receive_message', handleNewMessage);
    socket.on('messages-delivered', handleMessagesDelivered);
    socket.on('messages-read', handleMessagesRead);
    socket.on('user-status', handleUserStatus);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-note-update', handleUserNoteUpdate);
    socket.on('group:presence:update', handleGroupPresenceUpdate);
    socket.on('message-pinned', handleMessagePinned);
    socket.on('message-unpinned', handleMessageUnpinned);
    socket.on('message-edited', handleMessageEdited);
    socket.on('message-deleted-everyone', handleMessageDeletedEveryone);
    socket.on('message-deleted-me', handleMessageDeletedMe);
    socket.on('new-reaction', handleNewReaction);
    socket.on('reaction-removed', handleReactionRemoved);

    const handleReconnect = () => {
      const activeChat = selectedChatRef.current;
      if (activeChat?.chat_id && !activeChat.chat_id.startsWith('temp_')) {
        socket.emit('join-chat', activeChat.chat_id);
      }
    };
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('new-message', handleNewMessage);
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

  const handleSendMessage = async (e?: React.FormEvent, contentOverride?: string, specialType?: string, mediaUrl?: string) => {
    if (e) e.preventDefault();
    const content = contentOverride || newMessage;
    const isRich = !!specialType;
    if (!content.trim() && !isRich) return;
    if (!selectedChat) return;

    if (editingMessage) {
      const msgId = editingMessage.message_id;
      setMessages(prev => prev.map(m => m.message_id === msgId ? { ...m, content, edited: true, edited_at: new Date().toISOString() } : m));
      socket?.emit('edit-message', {
        messageId: msgId,
        chatId: selectedChat.chat_id,
        content
      }, (response: { success: boolean, error?: string }) => {
        if (!response.success) {
          alert(response.error || 'Failed to edit message');
        }
      });
      setNewMessage('');
      setEditingMessage(null);
      return;
    }

    if (!isRich) triggerWordEffect(content);
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: any = {
      message_id: tempId,
      sender_id: user?.id || user?.user_id || '',
      content: content || (specialType ? `Shared ${specialType}` : ''),
      status: 'sending',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_read: false,
      type: specialType || 'text',
      media_url: mediaUrl,
      mediaUrl: mediaUrl
    };

    if (replyToMessage) {
      optimisticMsg.reply_to_message_id = replyToMessage.message_id;
      optimisticMsg.reply_content = replyToMessage.content;
      optimisticMsg.reply_type = replyToMessage.type || 'text';
      optimisticMsg.reply_sender_name = replyToMessage.sender_name || replyToMessage.sender_username || 'User';
    }
    
    setMessages(prev => [...prev, optimisticMsg]);
    if (!contentOverride && !isRich) setNewMessage('');
    
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
       chatId: selectedChat.chat_id,
       partnerId: selectedChat.partner_id,
       content: content || (specialType ? `Shared ${specialType}` : ''),
       type: specialType || 'text',
       mediaUrl: mediaUrl
    };

    if (replyToMessage) {
      payload.replyToId = replyToMessage.message_id;
    }

    const currentReplyTo = replyToMessage;
    setReplyToMessage(null);

    // Transmit exclusively via WebSocket payload
    socket?.emit('send-message', payload, (response: { success: boolean, messageId?: string, sentAt?: string, error?: string }) => {
       setSending(false);
       if (response.success && response.messageId) {
          // ACK received — use server-returned sentAt (never client Date)
          setMessages(prev => prev.map(m => m.message_id === tempId
            ? { 
                ...m, 
                message_id: response.messageId!, 
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
                chat.last_message_content = content || (specialType ? `Shared ${specialType}` : '');
                chat.last_message_status = 'sent';
                chat.last_message_time = response.sentAt || chat.last_message_time;
                newConvs.splice(chatIndex, 1);
                newConvs.unshift(chat);
                return newConvs;
             }
             return prev;
          });
       } else {
          console.error('Failed to send via socket', response.error);
          setMessages(prev => prev.filter(m => m.message_id !== tempId));
       }
    });
  };

  const handleSendMessageWrapper = (e: any, content: string) => handleSendMessage(e, content);

  const handleVoiceSend = async (file: File) => {
    if (!selectedChat) return;
    const queueId = `upload_${Date.now()}`;
    setUploadQueue(prev => [...prev, { id: queueId, name: 'Voice Note Recording', progress: 0, status: 'uploading' }]);
    
    try {
      const mediaUrl = await uploadFileWithProgress(file, (progress) => {
        setUploadQueue(prev => prev.map(item => item.id === queueId ? { ...item, progress } : item));
      });
      
      setUploadQueue(prev => prev.map(item => item.id === queueId ? { ...item, progress: 100, status: 'completed' } : item));
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(item => item.id !== queueId));
      }, 3000);
      
      if (mediaUrl) {
        await handleSendMessage(undefined, undefined, 'voice_note', mediaUrl);
      }
    } catch (err) {
      console.error('Failed to upload voice note', err);
      setUploadQueue(prev => prev.map(item => item.id === queueId ? { ...item, status: 'failed' } : item));
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.message_id !== msgId));
    if (socket && selectedChat) {
      socket.emit('delete-for-everyone', {
        messageId: msgId,
        chatId: selectedChat.chat_id,
        isGroup: selectedChat.type === 'group'
      });
    }
  };

  const handleReactToMessage = async (msgId: string, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if (m.message_id === msgId) {
        return { ...m, reactions: [...(m.reactions || []), { emoji, user_id: user?.id || user?.user_id }] };
      }
      return m;
    }));
    
    if (socket && selectedChat) {
      socket.emit('add-reaction', {
        messageId: msgId,
        emoji: emoji,
        chatId: selectedChat.chat_id
      });
    }
  };
  const handleTyping = (val: string) => {
    setNewMessage(val);
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
        partner_name: contact.name || contact.username,
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
    } catch (e) {}
    return content;
  };

  const getStatusLabel = (chat: ChatConversation) => {
    // Only show outgoing receipt status when there are no unread incoming messages
    if ((chat.unread_count ?? 0) > 0) return '';
    // Map backend 'read' → display 'Seen', 'delivered' → 'Delivered', else 'Sent'
    // IMPORTANT: Never derive 'Delivered' from partner_online — that causes false positives.
    // Status must only advance via explicit socket ACK (mark-delivered / join-chat).
    const s = chat.last_message_status;
    if (s === 'read' || s === 'seen')  return 'Seen';
    if (s === 'delivered')             return 'Delivered';
    if (s === 'sent')                  return 'Sent';
    return '';
  };

  /** Compact, human-readable timestamp — delegates to shared utility so format is consistent everywhere */
  const getTimeAgo = (time?: string) => formatChatTimestamp(time);

  // --- Filtered conversations ---
  const filteredConversations = useMemo(() => {
    if (activeFilter === 'unread') return conversations.filter(c => (c.unread_count || 0) > 0);
    if (activeFilter === 'groups') return conversations.filter(c => !!(c.is_group || c.chat_type === 'group'));
    if (activeFilter === 'archived') return conversations.filter(c => !!(c as any).is_archived);
    const list = customLists.find(l => l.id === activeFilter);
    if (list) {
      // Filter out muted if desired, or just filter by list members
      return conversations.filter(c => list.chatIds.includes(c.chat_id));
    }
    return conversations;
  }, [conversations, activeFilter, customLists]);

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
      return Array.from(new Set(finalOrder));
    });
  };

  // --- Render ---
  return (
    <AppScreen immersive={true} scrollable={false} statusBarStyle="transparent-dark" className="flex flex-col h-screen bg-[#111118] text-white overflow-hidden md:pl-[72px]">
      <Navbar />
      <WordEffectBubbles emoji={playingEffectEmoji} active={!!playingEffectEmoji} />
      
      <KeyboardAwareChatLayout className="flex flex-col lg:flex-row flex-1 overflow-hidden relative bg-[#111118]">
        {/* SIDEBAR */}
        <aside className={clsx(
          "w-full lg:w-[420px] bg-[#13131a] border-r border-white/[0.06] flex flex-col transition-all duration-300 min-h-0 h-full",
          selectedChat ? 'hidden lg:flex' : 'flex flex-1 lg:flex-initial'
        )}>
          <StatusBarBackground backgroundColor="#13131a" />
          <header className="px-5 pt-4 pb-2 overflow-visible bg-[#13131a]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                   <div className="relative cursor-pointer hover:scale-105 active:scale-95 transition-all" onClick={() => navigate(`/profile/${user?.username}`)}>
                     <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-12 h-12 rounded-full object-cover border-2 border-white/[0.12] shadow-lg" alt="" />
                   </div>
                   <h1 className="text-[26px] font-bold text-white/90 tracking-tight">Chats</h1>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowCameraModal(true)} className="w-10 h-10 flex items-center justify-center text-[#ff1493] hover:bg-white/5 rounded-full transition-all">
                    <Camera size={22} strokeWidth={2.2} />
                  </button>
                  <button 
                   onClick={() => setShowNewChatModal(true)}
                   className="w-10 h-10 flex items-center justify-center text-[#ff1493] hover:bg-white/5 rounded-full transition-all"
                  >
                    <SquarePen size={22} strokeWidth={2.2} />
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

          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-6 pb-24 space-y-3 no-scrollbar scroll-smooth bg-[#13131a]"
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
              Array.isArray(filteredConversations) && filteredConversations.map((chat, idx) => (
                <div 
                  key={chat.chat_id}
                  onClick={() => {
                    setSelectedChat(chat);
                    navigate(`/messages?chat=${chat.chat_id}`);
                    // Optimistically clear the unread count in the chat list
                    if (chat.unread_count > 0) {
                      setConversations((prev: any[]) => prev.map(c => 
                        c.chat_id === chat.chat_id ? { ...c, unread_count: 0 } : c
                      ));
                    }
                  }}
                  className={clsx(
                    "px-4 py-1.5 rounded-2xl transition-all duration-300 cursor-pointer group flex items-center gap-3",
                    selectedChat?.chat_id === chat.chat_id ? 'bg-white/10' : 'hover:bg-white/5'
                  )}
                >
                  <div className="relative shrink-0">
                    <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-[54px] h-[54px] rounded-full object-cover border border-white/5 shadow-md" alt="" />
                    <div className="absolute -bottom-0.5 -right-0.5">
                      {!(chat.is_group || chat.chat_type === 'group') && (chat.partner_online || chat.is_online === 1 || chat.is_online === true) ? (
                        <div className="w-4 h-4 bg-emerald-500 border-[3px] border-[#121212] rounded-full"></div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex justify-between items-center mb-0.5">
                       <h4 className={clsx(
                         "text-[15px] tracking-tight truncate leading-tight",
                         chat.unread_count > 0 ? 'font-black text-[#f5f5f5]' : 'font-semibold text-[#f5f5f5]/90'
                       )}>{chat.partner_name}</h4>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {chat.unread_count > 1 ? (
                          <div className="flex items-center gap-1.5 truncate">
                            <p className="text-[13px] font-black text-[#ff1493] lowercase">
                              {chat.unread_count > 4 ? '4+ new messages' : `${chat.unread_count} new messages`}
                            </p>
                            <span className="text-[10px] font-bold text-white/20 lowercase shrink-0">· {getTimeAgo(chat.last_message_time || chat.last_message_at)}</span>
                          </div>
                        ) : chat.unread_count === 1 ? (
                          <div className="flex items-center gap-1.5 truncate">
                            <p className="text-[13px] font-bold text-[#f5f5f5] truncate flex-1">
                              {chat.last_message ? formatMessageText(chat.last_message) : 'Sent a photo'}
                            </p>
                            <span className="text-[10px] font-bold text-white/20 lowercase shrink-0">· {getTimeAgo(chat.last_message_time || chat.last_message_at)}</span>
                          </div>
                        ) : (() => {
                          const isTypingHere = typingUsers.some(t => t.chatId === chat.chat_id);
                          const statusLabel = getStatusLabel(chat);
                          const tsLabel = getTimeAgo(chat.last_message_time || chat.last_message_at);
                          return (
                            <div className="flex items-center gap-1.5 truncate">
                              {isTypingHere ? (
                                <p className="text-[12px] font-bold text-[#ff1493] italic animate-pulse">Typing…</p>
                              ) : (
                                <p className="text-[12px] font-medium text-[#f5f5f5]/40 truncate lowercase">
                                  {statusLabel}{statusLabel && tsLabel ? ' · ' : ''}{tsLabel}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {chat.unread_count > 0 && (
                        <div className="relative flex items-center justify-center shrink-0 ml-4">
                          <div className="w-2 h-2 bg-[#a855f7] rounded-full shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-pulse"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <main className={clsx(
          "flex-1 flex flex-col transition-all duration-300 relative z-10 bg-transparent overflow-hidden",
          !selectedChat ? 'hidden lg:flex' : 'flex'
        )}>
          {selectedChat && <ChatBackground theme={currentChatTheme} />}
          
          {selectedChat ? (
            <>
              <StatusBarBackground backgroundColor={currentChatTheme?.colors?.backgroundDark || '#000000'} />
              <header 
                className="h-[56px] z-40 relative px-3.5 flex items-center justify-between border-b border-white/5 shadow-xl shrink-0"
                style={{ 
                  backgroundColor: currentChatTheme?.colors?.backgroundDark || '#000000',
                  backdropFilter: 'blur(25px)',
                }}
              >
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
                  <div className="relative group cursor-pointer shrink-0" onClick={() => navigate(`/profile/${selectedChat.partner_name}`)}>
                    <img src={getAvatarUrl(selectedChat.partner_avatar, selectedChat.partner_name)} className="w-[38px] h-[38px] rounded-full object-cover border border-white/10 shadow-sm" alt="" />
                  </div>
                  <div className="ml-2 flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="text-[14.5px] font-semibold tracking-tight leading-none text-white truncate whitespace-nowrap overflow-hidden text-ellipsis">{selectedChat.partner_name}</h3>
                    {/* Presence line: dims slightly during active scrolling, restores on stop. */}
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
                            last seen {formatLastSeen(selectedChat.last_seen_at || selectedChat.last_message_time || selectedChat.last_message_at || '')}
                          </motion.p>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 relative z-10 shrink-0">
                  <button className="text-white/80 hover:text-white p-2 transition-all active:scale-90" style={{ color: currentChatTheme?.colors?.primary || '#ff1493' }}><Phone size={17} strokeWidth={2.2} /></button>
                  <button className="text-white/80 hover:text-white p-2 transition-all active:scale-90" style={{ color: currentChatTheme?.colors?.primary || '#ff1493' }}><Video size={18} strokeWidth={2.2} /></button>
                  <button onClick={() => setShowChatSettings(true)} className="text-white/80 hover:text-white p-2 transition-all active:scale-90" style={{ color: currentChatTheme?.colors?.primary || '#ff1493' }}>
                    <Info size={19} strokeWidth={2.2} />
                  </button>
                </div>
              </header>

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
                        <div key={`pinned-${msg.message_id}`} className="snap-start flex-shrink-0 flex items-center gap-2.5 bg-white/[0.03] hover:bg-white/[0.06] transition-colors border border-white/10 rounded-xl px-3.5 py-2 max-w-[220px] cursor-pointer">
                          <Pin size={14} strokeWidth={2.5} className="text-[#ff1493] shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest truncate">
                              {msg.sender_id === (user?.id || user?.user_id) ? 'You' : selectedChat.partner_name}
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
                                  messageId: msg.message_id,
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
                <div className="flex flex-col">
                  {filteredMessages.flatMap((msg, i) => {
                    const isMe = msg.sender_id === (user?.id || user?.user_id);
                    const prevMsg = i > 0 ? messages[i-1] : null;
                    const nextMsg = i < messages.length - 1 ? messages[i+1] : null;
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

                    const bubble = (
                      <div key={msg.message_id || i} className={clsx("flex animate-fade-in", marginTopClass, isMe ? 'justify-end' : 'justify-start')}>
                        <div className={clsx("max-w-[75%] md:max-w-[60%] flex flex-col", isMe ? 'items-end' : 'items-start')}>
                          <div 
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setActiveMessageMenu({ msg, type: 'longPress' });
                            }}
                            onClick={() => {
                              if (isMe) {
                                setActiveMessageMenu({ msg, type: 'click' });
                              }
                            }}
                            className={clsx(
                              "px-2.5 py-1.5 text-[15px] leading-relaxed transition-all duration-300 relative z-10 min-w-[80px] break-words whitespace-pre-wrap",
                              isMe ? 'rounded-[14px]' : 'rounded-[14px]',
                              isMe && hasTail ? 'rounded-tr-none' : isMe ? 'rounded-tr-[14px]' : '',
                              isMe && isLast ? 'rounded-br-[14px]' : isMe ? 'rounded-br-md' : '',
                              !isMe && hasTail ? 'rounded-tl-none' : !isMe ? 'rounded-tl-[14px]' : '',
                              !isMe && isLast ? 'rounded-bl-[14px]' : !isMe ? 'rounded-bl-md' : ''
                            )}
                            style={{ 
                              backgroundColor: isMe ? (currentChatTheme?.colors?.chatBubbleSent || '#5030A5') : (currentChatTheme?.colors?.chatBubbleReceived || '#2C2C2E'),
                              color: '#ffffff',
                              backdropFilter: currentChatTheme ? 'blur(10px)' : 'none'
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
                              {msg.reply_content && (
                                <div className="bg-black/20 rounded-[6px] p-2 mb-1 border-l-[3.5px] border-white/90 flex flex-col">
                                  <span className="font-bold text-[13px] text-white/90 leading-tight">
                                    {msg.reply_sender_name || 'User'}
                                  </span>
                                  <span className="text-[12px] text-white/70 line-clamp-2 leading-snug mt-0.5">
                                    {msg.reply_content}
                                  </span>
                                </div>
                              )}
                              
                              <div className="relative text-[14.5px]">
                                {(!msg.type || msg.type === 'text') && (
                                  <>
                                    <span className="whitespace-pre-wrap break-words text-white" style={{ color: '#ffffff !important' }}>{msg.content}</span>
                                    {/* Spacer to prevent timestamp overlap */}
                                    <span className="inline-block w-[75px] h-[1px]"></span>
                                  </>
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

                                {msg.type === 'contact' && (
                                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3 min-w-[240px] max-w-[300px] select-none flex flex-col gap-3 my-1">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-[#ff1493] flex items-center justify-center text-white text-[15px] font-black shrink-0 shadow-lg shadow-pink-500/20">
                                        {msg.content ? msg.content.charAt(0).toUpperCase() : 'C'}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-[13px] text-white truncate leading-tight">
                                          {msg.content || 'Contact Card'}
                                        </h4>
                                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">
                                          {msg.media_url || msg.mediaUrl || '+1 (555) 019-2834'}
                                        </p>
                                      </div>
                                    </div>
                                    <button 
                                      type="button" 
                                      onClick={() => startNewChat({ user_id: 'mock_partner', username: msg.content, name: msg.content, avatar_url: '' })}
                                      className="w-full py-2 bg-white/10 hover:bg-white/15 active:scale-98 transition-all text-center rounded-xl text-[11px] font-black uppercase tracking-widest text-white border border-white/5"
                                    >
                                      Message Contact
                                    </button>
                                  </div>
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
                                  ) : msg.is_read || msg.status === 'read' || msg.status === 'seen' ? (
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
                          </div>
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
                {partnerIsTyping && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 36, opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2 px-5 overflow-hidden border-t border-white/5 shrink-0"
                    style={{ backgroundColor: currentChatTheme?.colors?.backgroundDark || '#000000' }}
                  >
                    <div className="flex gap-1">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0 }} className="w-1.5 h-1.5 bg-[#ff1493] rounded-full" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.2 }} className="w-1.5 h-1.5 bg-[#ff1493] rounded-full" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.4 }} className="w-1.5 h-1.5 bg-[#ff1493] rounded-full" />
                    </div>
                    <span className="text-[11px] font-semibold text-white/50">{selectedChat.partner_name} is typing…</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <ChatInput 
                initialMessage={newMessage}
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
              />
            </>
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
                      if (socket && selectedChat) {
                        socket.emit('delete-for-everyone', {
                          messageId: messageToDelete.message_id,
                          chatId: selectedChat.chat_id,
                          isGroup: selectedChat.type === 'group'
                        });
                      }
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
                    setMessages(prev => prev.filter(m => m.message_id !== messageToDelete.message_id));
                    if (socket && selectedChat) {
                      socket.emit('delete-for-me', {
                        messageId: messageToDelete.message_id,
                        chatId: selectedChat.chat_id,
                        isGroup: selectedChat.type === 'group'
                      });
                    }
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
        isMe={activeMessageMenu?.msg?.sender_id === (user?.id || user?.user_id)}
        themeColor={currentChatTheme?.colors?.primary || '#ff1493'}
        onClose={() => setActiveMessageMenu(null)}
        onReply={() => {
          if (activeMessageMenu?.msg) {
            setReplyToMessage(activeMessageMenu.msg);
          }
          setActiveMessageMenu(null);
        }}
        onCopy={() => {
          if (activeMessageMenu?.msg?.content) navigator.clipboard.writeText(activeMessageMenu.msg.content);
          setActiveMessageMenu(null);
        }}
        onDelete={() => {
          if (activeMessageMenu?.msg) {
            setMessageToDelete(activeMessageMenu.msg);
            setShowDeleteConfirm(true);
          }
          setActiveMessageMenu(null);
        }}
        onMore={() => setActiveMessageMenu({ msg: activeMessageMenu?.msg, type: 'click' })}
        onReact={(emoji) => {
          if (activeMessageMenu?.msg?.message_id) {
            handleReactToMessage(activeMessageMenu.msg.message_id, emoji);
          }
          setActiveMessageMenu(null);
        }}
        onOpenEmojiPicker={() => {
          setShowFullEmojiPicker(true);
        }}
      />

      <MessageMoreModal
        isOpen={activeMessageMenu?.type === 'click'}
        onClose={() => setActiveMessageMenu(null)}
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
          if (activeMessageMenu?.msg) {
            setEditingMessage(activeMessageMenu.msg);
            setNewMessage(activeMessageMenu.msg.content);
          }
          setActiveMessageMenu(null);
        }}
        onForward={() => {
          if (activeMessageMenu?.msg) {
            setSelectedForwardChatIds([]);
            setShowForwardModal(true);
          }
          setActiveMessageMenu(null);
        }}
        onDetails={() => {
          if (activeMessageMenu?.msg) {
            alert(`Sent at: ${new Date(activeMessageMenu.msg.sent_at).toLocaleString()}\nStatus: ${activeMessageMenu.msg.status || 'sent'}\nForwarded: ${activeMessageMenu.msg.forwarded ? 'Yes' : 'No'}`);
          }
          setActiveMessageMenu(null);
        }}
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

      {/* ── FORWARD MODAL ── */}
      <AnimatePresence>
        {showForwardModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[130] backdrop-blur-sm" 
              onClick={() => setShowForwardModal(false)} 
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 h-[85vh] bg-[#121212] rounded-t-[32px] z-[131] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-4 shrink-0" />
              <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 shrink-0">
                <h2 className="text-[18px] font-black text-white italic tracking-tight uppercase">Forward To</h2>
                <button 
                  onClick={() => setShowForwardModal(false)} 
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all text-white/50 hover:text-white"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>
              
              <div className="p-4 shrink-0">
                <div className="bg-white/5 rounded-2xl flex items-center px-4 h-[44px] focus-within:bg-white/10 transition-colors border border-white/5">
                  <Search size={18} className="text-white/40 mr-2" strokeWidth={2.5} />
                  <input 
                    type="text" 
                    placeholder="Search chats..."
                    value={forwardSearchQuery}
                    onChange={(e) => setForwardSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-[15px] font-medium text-white placeholder:text-white/30 outline-none border-none focus:ring-0 w-full"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                {conversations
                  .filter(c => c.partner_name?.toLowerCase().includes(forwardSearchQuery.toLowerCase()))
                  .map(chat => {
                    const isSelected = selectedForwardChatIds.includes(chat.chat_id);
                    return (
                      <button 
                        key={chat.chat_id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedForwardChatIds(prev => prev.filter(id => id !== chat.chat_id));
                          } else {
                            setSelectedForwardChatIds(prev => [...prev, chat.chat_id]);
                          }
                          if (navigator.vibrate) navigator.vibrate(30);
                        }}
                        className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.04] transition-all"
                      >
                        <div className="relative shrink-0">
                          <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-12 h-12 rounded-full object-cover border border-white/10 shadow-sm" alt="" />
                          {(chat.partner_online || chat.group_online_count) && (
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#121212]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left flex flex-col justify-center">
                          <span className="text-[15px] font-semibold text-white/90 truncate block">{chat.partner_name}</span>
                          <span className="text-[12px] text-white/40 truncate block">{chat.is_group || chat.chat_type === 'group' ? 'Group' : 'User'}</span>
                        </div>
                        <div className={clsx("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all", isSelected ? 'bg-[#ff1493] border-[#ff1493]' : 'border-white/20')}>
                          {isSelected && <Check size={14} strokeWidth={3} className="text-white" />}
                        </div>
                      </button>
                    );
                })}
              </div>
              
              <AnimatePresence>
                {selectedForwardChatIds.length > 0 && (
                  <motion.div 
                    initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                    className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#121212] via-[#121212] to-transparent pointer-events-none"
                  >
                    <button
                      onClick={() => {
                        selectedForwardChatIds.forEach(chatId => {
                          const targetChat = conversations.find(c => c.chat_id === chatId);
                          if (socket && targetChat && activeMessageMenu?.msg) {
                            socket.emit('send-message', {
                              chatId: targetChat.chat_id,
                              content: activeMessageMenu.msg.content,
                              type: activeMessageMenu.msg.type || 'text',
                              mediaUrl: activeMessageMenu.msg.mediaUrl || activeMessageMenu.msg.media_url,
                              forwarded: true,
                              isGroup: targetChat.is_group || targetChat.chat_type === 'group'
                            });
                          }
                        });
                        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
                        setShowForwardModal(false);
                        setSelectedForwardChatIds([]);
                        setActiveMessageMenu(null);
                      }}
                      className="w-full h-[52px] rounded-2xl bg-[#ff1493] text-white font-black text-[15px] uppercase tracking-widest shadow-[0_8px_24px_rgba(255,20,147,0.4)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 pointer-events-auto"
                    >
                      <Forward size={20} strokeWidth={2.5} /> Send ({selectedForwardChatIds.length})
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewChatModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#000000]/80 backdrop-blur-sm z-[100] flex justify-center pt-20 px-4" 
            onClick={() => setShowNewChatModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#121212] rounded-[32px] w-full max-w-md h-[70vh] flex flex-col shadow-2xl overflow-hidden" 
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#000000]/40">
                <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">New Message</h2>
                <button onClick={() => setShowNewChatModal(false)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all text-white"><X size={20} strokeWidth={3} /></button>
              </div>
              <div className="p-4 border-b border-white/5">
                <div className="relative bg-white/5 rounded-2xl flex items-center px-4 h-12 focus-within:bg-white/10 transition-all">
                  <Search size={18} className="text-white/30" strokeWidth={3} />
                  <input type="text" placeholder="Search users..." className="bg-transparent w-full h-full outline-none ml-3 font-bold text-sm text-[#f5f5f5] placeholder:text-white/20 italic" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                {Array.isArray(suggestedContacts) && suggestedContacts.map((contact, idx) => {
                  const contactId = contact.user_id || contact.id || idx;
                  return (
                    <div key={`modal-${contactId}`} onClick={() => startNewChat(contact)} className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl cursor-pointer transition-all active:scale-[0.98]">
                      <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-12 h-12 rounded-xl object-cover border border-white/5 shadow-sm" />
                      <div>
                        <h4 className="font-bold text-white text-sm leading-none">{contact.name || contact.username}</h4>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">@{contact.username}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showCameraModal && (
        <CameraModal 
          isOpen={showCameraModal}
          onClose={() => setShowCameraModal(false)}
          partnerName={selectedChat?.partner_name || 'My Story'}
          partnerAvatar={selectedChat?.partner_avatar || user?.avatar_url}
          onSend={(mediaUrl, viewMode) => {
            setShowCameraModal(false);
            if (!mediaUrl) return;
            if (selectedChat) {
              const content = JSON.stringify({ type: 'camera_capture', payload: { image: mediaUrl, viewMode } });
              handleSendMessage(undefined, content);
            } else {
              // Mock uploading to story/note
              setNotePlaceholder('Photo added!');
            }
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
                      const newBubbles = Array.from({length: 15}).map((_, i) => ({
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
          chat={selectedChat}
          onClose={() => setShowChatSettings(false)}
          onNavigateProfile={() => {
            setShowChatSettings(false);
            navigate(`/profile/${selectedChat.partner_name}`);
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
                <div className="grid grid-cols-5 gap-2 px-1">
                  <button 
                    type="button" 
                    onClick={() => setAttachmentSheetHeight('full')}
                    className="flex flex-col items-center gap-1.5 py-2.5 bg-transparent hover:bg-white/5 active:scale-95 rounded-2xl transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center"><ImageIcon size={18} strokeWidth={2} /></div>
                    <span className="text-[10px] font-medium tracking-wide text-white/75 truncate w-full text-center px-1">Gallery</span>
                  </button>

                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAttachmentSheet(false);
                      setShowCameraModal(true);
                    }}
                    className="flex flex-col items-center gap-1.5 py-2.5 bg-transparent hover:bg-white/5 active:scale-95 rounded-2xl transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center"><Camera size={18} strokeWidth={2} /></div>
                    <span className="text-[10px] font-medium tracking-wide text-white/75 truncate w-full text-center px-1">Camera</span>
                  </button>

                  <label className="flex flex-col items-center gap-1.5 py-2.5 bg-transparent hover:bg-white/5 active:scale-95 rounded-2xl transition-all cursor-pointer">
                    <input 
                      type="file" 
                      accept=".pdf,.docx,.zip,.txt,.xlsx" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setShowAttachmentSheet(false);
                        const queueId = `upload_${Date.now()}`;
                        setUploadQueue(prev => [...prev, { id: queueId, name: file.name, progress: 0, status: 'uploading' }]);
                        try {
                          const url = await uploadFileWithProgress(file, (p) => {
                            setUploadQueue(prev => prev.map(item => item.id === queueId ? { ...item, progress: p } : item));
                          });
                          setUploadQueue(prev => prev.map(item => item.id === queueId ? { ...item, progress: 100, status: 'completed' } : item));
                          setTimeout(() => setUploadQueue(prev => prev.filter(item => item.id !== queueId)), 3000);
                          if (url) {
                            handleSendMessage(undefined, file.name, 'document', url);
                          }
                        } catch (err) {
                          console.error(err);
                          setUploadQueue(prev => prev.map(item => item.id === queueId ? { ...item, status: 'failed' } : item));
                        }
                      }}
                    />
                    <div className="w-9 h-9 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center"><FileText size={18} strokeWidth={2} /></div>
                    <span className="text-[10px] font-medium tracking-wide text-white/75 truncate w-full text-center px-1">Document</span>
                  </label>

                  <button 
                    type="button" 
                    onClick={() => {
                      const LOCATIONS = ['Eiffel Tower, Paris', 'Space Needle, Seattle', 'Central Park, NY', 'Shibuya Crossing, Tokyo'];
                      const randomLoc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
                      handleSendMessage(undefined, randomLoc, 'location');
                      setShowAttachmentSheet(false);
                    }}
                    className="flex flex-col items-center gap-1.5 py-2.5 bg-transparent hover:bg-white/5 active:scale-95 rounded-2xl transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center"><MapPin size={18} strokeWidth={2} /></div>
                    <span className="text-[10px] font-medium tracking-wide text-white/75 truncate w-full text-center px-1">Location</span>
                  </button>

                  <button 
                    type="button" 
                    onClick={() => {
                      const CONTACTS = [
                        { name: 'Sarah Jenkins', phone: '+1 (555) 302-8821' },
                        { name: 'Dr. Alan Grant', phone: '+1 (555) 909-1234' },
                        { name: 'Marcus Aurelius', phone: '+1 (555) 100-2000' }
                      ];
                      const randomContact = CONTACTS[Math.floor(Math.random() * CONTACTS.length)];
                      handleSendMessage(undefined, randomContact.name, 'contact', randomContact.phone);
                      setShowAttachmentSheet(false);
                    }}
                    className="flex flex-col items-center gap-1.5 py-2.5 bg-transparent hover:bg-white/5 active:scale-95 rounded-2xl transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center"><User size={18} strokeWidth={2} /></div>
                    <span className="text-[10px] font-medium tracking-wide text-white/75 truncate w-full text-center px-1">Contact</span>
                  </button>
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

                    // Trigger concurrent background uploads
                    for (const item of items) {
                      const queueId = `upload_${Date.now()}_${item.id}`;
                      setUploadQueue(prev => [...prev, { id: queueId, name: item.name || 'Attachment Image', progress: 0, status: 'uploading' }]);
                      
                      // Async upload wrapper
                      (async () => {
                        try {
                          const filePayload = item.file || item.url;
                          const url = await uploadFileWithProgress(filePayload, (p) => {
                            setUploadQueue(prev => prev.map(u => u.id === queueId ? { ...u, progress: p } : u));
                          });
                          
                          setUploadQueue(prev => prev.map(u => u.id === queueId ? { ...u, progress: 100, status: 'completed' } : u));
                          setTimeout(() => setUploadQueue(prev => prev.filter(u => u.id !== queueId)), 3000);
                          
                          if (url) {
                            handleSendMessage(undefined, caption, 'image', url);
                          }
                        } catch (err) {
                          console.error(err);
                          setUploadQueue(prev => prev.map(u => u.id === queueId ? { ...u, status: 'failed' } : u));
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
                    <span className="flex-1 text-left text-[14.5px] font-[500] text-white/85 truncate">{chat.partner_name}</span>
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
