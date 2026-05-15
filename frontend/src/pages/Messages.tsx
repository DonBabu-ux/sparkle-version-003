import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { getAvatarUrl } from '../utils/imageUtils';
import ModernOfflineState from '../components/ui/ModernOfflineState';
import CameraModal from '../components/chat/CameraModal';
import ChatSettingsModal from '../components/chat/ChatSettingsModal';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
interface ChatConversation {
  chat_id: string;
  partner_id: string;
  partner_avatar?: string;
  partner_name: string;
  partner_online?: boolean;
  is_archived?: boolean;
  is_group?: boolean;
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
  sent_at?: string;       // DB field name
  created_at?: string;    // fallback / optimistic field
  is_read?: boolean;
}

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
  theme
}: any) => {
  const [localMessage, setLocalMessage] = useState(initialMessage || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emojis' | 'stickers' | 'gifs' | 'avatars'>('emojis');
  const [giphySearch, setGiphySearch] = useState('');
  const [giphyResults, setGiphyResults] = useState<any[]>([]);
  const [loadingGiphy, setLoadingGiphy] = useState(false);

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
      className="z-30 pb-safe shrink-0 border-t border-white/5 transition-all duration-300"
      style={{ 
        backgroundColor: themeBg,
        borderTopColor: 'rgba(255,255,255,0.05)'
      }}
    >
      <div className="w-full">
        <form onSubmit={handleSubmit} className="flex items-center w-full max-w-[1200px] mx-auto px-1 py-2">
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
              <button type="button" onClick={() => alert('Voice recording started...')} className="hover:opacity-80 p-2" style={{ color: themePrimary }}>
                <Mic size={22} strokeWidth={2.5} />
              </button>
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

          <div className="flex items-center shrink-0 mr-1">
            {localMessage.trim() ? (
              <button 
                type="submit"
                disabled={sending}
                className="ml-1 p-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center justify-center"
                style={{ backgroundColor: themePrimary, color: '#ffffff' }}
              >
                <Send size={18} strokeWidth={2.5} />
              </button>
            ) : (
              <button 
                type="button" 
                onClick={() => {
                  const reaction = getQuickReaction(selectedChat.chat_id);
                  onSend(undefined, reaction);
                }}
                className="ml-1 text-2xl hover:scale-110 active:scale-90 transition-all p-1"
              >
                {getQuickReaction(selectedChat.chat_id)}
              </button>
            )}
          </div>
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

ChatInput.displayName = 'ChatInput';

export default function Messages() {
  const { user } = useUserStore();
  const { setActiveModal } = useModalStore();
  const socket = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetChatId = searchParams.get('chat');

  // --- State ---
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
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
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [customPhotoPreview, setCustomPhotoPreview] = useState<string | null>(null);
  const [playingEffectEmoji, setPlayingEffectEmoji] = useState<string | null>(null);
  const [showWordEmojiPicker, setShowWordEmojiPicker] = useState(false);
  const [newWordEffect, setNewWordEffect] = useState({ word: '', emoji: '😀' });
  // Note reaction states
  const [noteBubbles, setNoteBubbles] = useState<Array<{id: number; emoji: string; x: number; delay: number}>>([]);
  const [noteReacted, setNoteReacted] = useState<string | null>(null);
  const [noteNotification, setNoteNotification] = useState<{emoji: string; name: string; note: string} | null>(null);
  const [noteReactSent, setNoteReactSent] = useState(false);
  const [isNoteReacting, setIsNoteReacting] = useState(false);
  const [noteReplyText, setNoteReplyText] = useState('');
  const [showNoteEmojiPicker, setShowNoteEmojiPicker] = useState(false);

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

  useEffect(() => {
    if (selectedChat?.partner_online) {
      setShowLastSeen(true);
      return;
    }
    const timeoutId = setTimeout(() => {
      setShowLastSeen(prev => !prev);
    }, showLastSeen ? 4000 : 2000);
    return () => clearTimeout(timeoutId);
  }, [selectedChat?.partner_online, showLastSeen]);

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
  }, [selectedChat]);

  // Hide bottom nav when viewing someone's note or using camera
  useEffect(() => {
    if (showViewNoteModal || showCameraModal) {
      document.body.classList.add('note-modal-open');
    } else {
      document.body.classList.remove('note-modal-open');
      if (!showViewNoteModal) {
        // Reset reaction state on close
        setNoteBubbles([]);
        setNoteReacted(null);
        setNoteReactSent(false);
      }
    }
    return () => document.body.classList.remove('note-modal-open');
  }, [showViewNoteModal, showCameraModal]);

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
      // Create a temporary chat object for the UI
      setSelectedChat({
        chat_id: 'temp_' + Date.now(),
        partner_id: partnerId,
        partner_name: contact.name || contact.username,
        partner_avatar: contact.avatar_url,
        unread_count: 0,
        last_message_time: new Date().toISOString(),
        partner_online: contact.is_online
      });
      // Clear the chat param since we are in a temp chat
      navigate('/messages', { replace: true });
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await api.get(`/messages/chat/${chatId}`);
      // Backend returns: { status, data: [...messages], chatId }
      const msgs = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setMessages(msgs);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  useEffect(() => {
    if (!socket || !selectedChat) return;

    const handleNewMessage = (msg: any) => {
      // Check if message belongs to current open chat
      if (msg.sender_id === selectedChat.partner_id || msg.receiver_id === selectedChat.partner_id) {
        setMessages(prev => [...prev, msg]);
        triggerWordEffect(msg.content);
        
        // If scrolled up, increment unread count in view
        if (showScrollToBottom) {
          setUnreadCountInChat(prev => prev + 1);
        } else {
          scrollToBottom('smooth');
        }
      }
      // Refresh inbox to update last message preview
      fetchInbox();
    };

    const handleUserStatus = (data: { userId: string; isOnline: boolean; lastSeen: string | null }) => {
      setConversations(prev => prev.map(chat => {
        if (chat.partner_id === data.userId) {
          return { ...chat, is_online: data.isOnline ? 1 : 0, last_seen_at: data.lastSeen, partner_online: data.isOnline };
        }
        return chat;
      }));
      if (selectedChat?.partner_id === data.userId) {
        setSelectedChat(prev => prev ? { ...prev, is_online: data.isOnline ? 1 : 0, last_seen_at: data.lastSeen, partner_online: data.isOnline } : null);
      }
    };

    socket.on('receive_message', handleNewMessage);
    socket.on('new_message', handleNewMessage);
    socket.on('user-status', handleUserStatus);

    return () => {
      socket.off('receive_message', handleNewMessage);
      socket.off('new_message', handleNewMessage);
      socket.off('user-status', handleUserStatus);
    };
  }, [socket, selectedChat]);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

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

  const handleSendMessage = async (e?: React.FormEvent, contentOverride?: string) => {
    if (e) e.preventDefault();
    const content = contentOverride || newMessage;
    if (!content.trim() || !selectedChat) return;

    triggerWordEffect(content);

    setSending(true);
    // Optimistic update — build a local message object immediately
    const optimisticMsg: ChatMessage = {
      message_id: `temp_${Date.now()}`,
      sender_id: user?.id || user?.user_id || '',
      content,
      status: 'sent',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    if (!contentOverride) setNewMessage('');
    scrollToBottom('smooth');

    try {
      await api.post('/messages/send', {
        partnerId: selectedChat.partner_id,  // backend expects 'partnerId'
        content
      });
      // Refresh the full chat so the real message_id replaces the temp one
      fetchMessages(selectedChat.chat_id);
    } catch (err) {
      console.error('Failed to send message', err);
      // Roll back optimistic message on failure
      setMessages(prev => prev.filter(m => m.message_id !== optimisticMsg.message_id));
    } finally {
      setSending(false);
    }
  };

  const handleSendMessageWrapper = (e: any, content: string) => handleSendMessage(e, content);
  const handleTyping = (val: string) => {
    setNewMessage(val);
    if (val.length > 0 && !isMenuCollapsed) setIsMenuCollapsed(true);
    if (val.length === 0 && isMenuCollapsed) setIsMenuCollapsed(false);
  };
  const handleScroll = (e: any) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setShowScrollToBottom(scrollHeight - scrollTop - clientHeight > 300);
  };

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

  const formatLastSeen = (time: string) => {
    if (!time) return 'a while ago';
    const date = new Date(time);
    if (isNaN(date.getTime())) return 'a while ago';
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today.getTime() - targetDate.getTime()) / 86400000);
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (diffDays === 0) return `today at ${timeStr}`;
    if (diffDays === 1) return `yesterday at ${timeStr}`;
    if (diffDays < 7) {
      return `${date.toLocaleDateString([], { weekday: 'long' })} at ${timeStr}`;
    }
    
    return `${date.toLocaleDateString()} at ${timeStr}`;
  };

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
    // If there are unread messages, we don't show the outgoing status
    if (chat.unread_count > 0) return '';
    
    // In production, we'd check if the last message was sent by 'me'
    // For this UI, we assume the status refers to the last dispatched message
    
    // Priority 1: Seen (if backend provides seen_at or explicit status)
    if (chat.last_message_status === 'seen' || chat.seen_at) return 'seen';
    
    // Priority 2: Delivered (if partner is online or explicit status)
    if (chat.last_message_status === 'delivered' || chat.partner_online) return 'delivered';
    
    // Priority 3: Sent (default)
    return 'sent';
  };

  const getTimeAgo = (time?: string) => {
    if (!time) return '';
    const diff = Date.now() - new Date(time).getTime();
    if (diff < 60000) return 'just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(time).toLocaleDateString();
  };

  // --- Render ---
  return (
    <div className="flex flex-col h-screen bg-[#121212] text-white overflow-hidden safe-bottom">
      <Navbar />
      <WordEffectBubbles emoji={playingEffectEmoji} active={!!playingEffectEmoji} />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR */}
        <aside className={clsx(
          "w-full lg:w-[420px] bg-[#121212] border-r border-white/5 flex flex-col transition-all duration-300 min-h-0",
          selectedChat ? 'hidden lg:flex' : 'flex'
        )}>
          <header className="px-5 pt-4 pb-2 overflow-visible bg-[#121212]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                   <div className="relative cursor-pointer hover:scale-105 active:scale-95 transition-all" onClick={() => navigate(`/profile/${user?.username}`)}>
                     <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-12 h-12 rounded-full object-cover border-2 border-white/10" alt="" />
                   </div>
                   <h1 className="text-[26px] font-bold text-[#f5f5f5] tracking-tight">Chats</h1>
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
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={16} />
                <input 
                  type="text" 
                  placeholder="Search messages..." 
                  className="w-full h-12 bg-[#333333] border-2 border-[#666666] rounded-2xl pl-11 pr-4 text-[15px] font-semibold text-white placeholder:text-white/50 transition-all outline-none focus:border-[#ff1493] focus:bg-[#3a3a3a] shadow-xl"
                />
             </div>

             {/* Notes Row — reduced size and pushed up */}
             <div className="flex gap-2 overflow-x-auto no-scrollbar overflow-visible pt-10 pb-1">
                <div className="relative w-[74px] flex flex-col items-center gap-2 shrink-0">
                  <div className="relative w-full">
                    <div 
                      className="absolute -top-[34px] left-0 right-0 h-8 bg-white border border-white/20 backdrop-blur-2xl rounded-lg flex items-center justify-center px-1.5 text-[9px] text-black font-black text-center leading-tight shadow-xl cursor-pointer hover:scale-105 active:scale-95 transition-all z-10"
                      onClick={() => setActiveModal('note_editor', (newNote: any) => setNoteText(newNote || ''))}
                    >
                      <span className="truncate block w-full">{noteText || "Share a thought..."}</span>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white border-b border-r border-white/20 rounded-full"></div>
                    </div>
                    <div className="cursor-pointer flex justify-center" onClick={() => navigate(`/profile/${user?.username}`)}>
                      <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-12 h-12 rounded-full object-cover border-2 border-white/10" alt="" />
                    </div>
                    <div 
                      className="absolute bottom-0 right-3 w-5 h-5 bg-[#ff1493] rounded-full flex items-center justify-center border-[3px] border-black text-white cursor-pointer hover:scale-110 active:scale-90 transition-all"
                      onClick={() => setShowCameraModal(true)}
                    >
                      <Plus size={12} strokeWidth={4} />
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-white/30 text-center truncate w-full">Your story</span>
                </div>

                {/* Real users with notes with distinct colors */}
                {/* Real users with notes with distinct colors */}
                {Array.isArray(suggestedContacts) && suggestedContacts
                  .filter(contact => contact.is_online)
                  .slice(0, 12)
                  .map((contact, idx) => {
                    const contactId = contact.user_id || contact.id || `contact-${idx}`;
                    const chat = Array.isArray(conversations) ? conversations.find(c => c.partner_id === contact.user_id) : null;
                    const chatTheme = chat ? getThemeForChat(chat.chat_id) : null;
                    const colors = ['#7c3aed', '#0ea5e9', '#ff1493', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899'];
                    const bubbleBg = chatTheme?.colors?.primary || colors[idx % colors.length];
                    const noteContent = contact.note;

                    return (
                      <div key={`palette-${contactId}`} className="relative w-[64px] flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
                        onClick={() => handleOpenDirectChat(contact)}
                      >
                        <div className="relative w-full">
                          {noteContent && (
                            <div 
                              className="absolute -top-[34px] left-0 right-0 h-8 border border-white/30 backdrop-blur-3xl rounded-lg flex items-center justify-center px-1.5 text-[9px] text-white font-black text-center leading-tight shadow-xl animate-fade-in z-10"
                              style={{ 
                                backgroundColor: `${bubbleBg}`, 
                                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                                boxShadow: `0 4px 15px ${bubbleBg}44`
                              }}
                              onClick={(e) => {
                                e.stopPropagation(); // Don't trigger chat shortcut if clicking the bubble specifically
                                setViewingNote({...contact, note: noteContent, bubbleBg});
                                setShowViewNoteModal(true);
                              }}
                            >
                              <span className="truncate block w-full">{noteContent}</span>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 border-b border-r border-white/30 rounded-full" style={{ backgroundColor: `${bubbleBg}` }}></div>
                            </div>
                          )}
                          <div className="flex justify-center">
                            <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-14 h-14 rounded-full object-cover border-2 border-white/10 shadow-sm" alt="" />
                          </div>
                          {contact.is_online && (
                            <div className="absolute bottom-0 right-1 w-4 h-4 bg-emerald-500 border-[3px] border-[#121212] rounded-full"></div>
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-white/50 text-center truncate w-full group-hover:text-white transition-colors">{contact.name?.split(' ')[0] || contact.username}</span>
                      </div>
                    );
                  })}
             </div>
          </header>

          <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-3 no-scrollbar scroll-smooth bg-[#121212]">
            {Array.isArray(conversations) && conversations.length === 0 && !loading ? (
              <div className="py-12 px-4">
                 <ModernOfflineState 
                   type="empty"
                   title="No chats yet"
                   message="When you start a conversation, it'll show up here."
                   onRetry={() => fetchInbox()}
                 />
              </div>
            ) : (
              Array.isArray(conversations) && conversations.map((chat, idx) => (
                <div 
                  key={chat.chat_id}
                  onClick={() => {
                    setSelectedChat(chat);
                    navigate(`/messages?chat=${chat.chat_id}`);
                  }}
                  className={clsx(
                    "px-4 py-1.5 rounded-2xl transition-all duration-300 cursor-pointer group flex items-center gap-3",
                    selectedChat?.chat_id === chat.chat_id ? 'bg-white/10' : 'hover:bg-white/5'
                  )}
                >
                  <div className="relative shrink-0">
                    <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-[54px] h-[54px] rounded-full object-cover border border-white/5 shadow-md" alt="" />
                    <div className="absolute -bottom-0.5 -right-0.5">
                      {(chat.partner_online || chat.is_online === 1 || chat.is_online === true) ? (
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
                        ) : (
                          <div className="flex items-center gap-1.5 truncate">
                            <p className="text-[12px] font-medium text-[#f5f5f5]/40 truncate lowercase">
                              {getStatusLabel(chat)} {getTimeAgo(chat.last_message_time || chat.last_message_at)}
                            </p>
                          </div>
                        )}
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
              <header 
                className="h-[65px] z-40 relative px-4 flex items-center justify-between border-b border-white/5 shadow-xl"
                style={{ 
                  backgroundColor: currentChatTheme?.colors?.backgroundDark || '#000000',
                  backdropFilter: 'blur(25px)',
                }}
              >
                <div className="flex items-center gap-2 relative z-10">
                  <button 
                    onClick={() => {
                      setSelectedChat(null);
                      navigate('/messages');
                    }} 
                    className="text-white hover:opacity-70 transition-opacity p-2"
                  >
                    <ArrowLeft size={24} strokeWidth={2.5} />
                  </button>
                  <div className="relative group cursor-pointer" onClick={() => navigate(`/profile/${selectedChat.partner_name}`)}>
                    <img src={getAvatarUrl(selectedChat.partner_avatar, selectedChat.partner_name)} className="w-[48px] h-[48px] rounded-full object-cover border border-white/10 shadow-sm" alt="" />
                  </div>
                  <div className="ml-3 flex flex-col justify-center">
                    <h3 className="text-[17px] font-bold tracking-tight leading-tight text-white">{selectedChat.partner_name}</h3>
                    <div className="h-[14px] mt-0.5 overflow-hidden">
                      <AnimatePresence mode="wait">
                        {(selectedChat.partner_online || selectedChat.is_online === 1 || selectedChat.is_online === true) ? (
                          <motion.p key="online" initial={{y: 10, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-10, opacity:0}} className="text-[12px] font-bold lowercase text-emerald-500">online</motion.p>
                        ) : showLastSeen ? (
                          <motion.p key="lastseen" initial={{y: 10, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-10, opacity:0}} className="text-[11.5px] font-semibold lowercase text-white/50">last seen {formatLastSeen(selectedChat.last_seen_at || selectedChat.last_message_time || selectedChat.last_message_at || '')}</motion.p>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 relative z-10">
                  <button className="text-white/80 hover:text-white p-2.5 transition-all active:scale-90" style={{ color: currentChatTheme?.colors?.primary || '#ff1493' }}><Phone size={19} strokeWidth={2.2} /></button>
                  <button className="text-white/80 hover:text-white p-2.5 transition-all active:scale-90" style={{ color: currentChatTheme?.colors?.primary || '#ff1493' }}><Video size={20} strokeWidth={2.2} /></button>
                  <button onClick={() => setShowChatSettings(true)} className="text-white/80 hover:text-white p-2.5 transition-all active:scale-90" style={{ color: currentChatTheme?.colors?.primary || '#ff1493' }}>
                    <Info size={21} strokeWidth={2.2} />
                  </button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-1 no-scrollbar scroll-smooth relative z-10" onScroll={handleScroll}>
                <div className="flex flex-col">
                  {messages.map((msg, i) => {
                    const isMe = msg.sender_id === (user?.id || user?.user_id);
                    const prevMsg = i > 0 ? messages[i-1] : null;
                    const nextMsg = i < messages.length - 1 ? messages[i+1] : null;
                    const isFirst = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                    const isLast = !nextMsg || nextMsg.sender_id !== msg.sender_id;
                    
                    const hasTail = !msg.reply_content;
                    
                    // Add margin between different sender groups
                    const marginTopClass = isFirst ? "mt-4" : "mt-1";

                    return (
                      <div key={msg.message_id || i} className={clsx("flex animate-fade-in", marginTopClass, isMe ? 'justify-end' : 'justify-start')}>
                        <div className={clsx("max-w-[85%] md:max-w-[75%] flex flex-col", isMe ? 'items-end' : 'items-start')}>
                          <div 
                            className={clsx(
                              "px-2.5 py-1.5 text-[15px] leading-relaxed transition-all duration-300 relative z-10 min-w-[80px]",
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
                                <span className="whitespace-pre-wrap break-words text-white" style={{ color: '#ffffff !important' }}>{msg.content}</span>
                                {/* Spacer to prevent timestamp overlap */}
                                <span className="inline-block w-[60px] h-[1px]"></span>
                              </div>
                            </div>
                            
                            {/* Timestamp & Ticks absolute inside bubble bottom-right */}
                            <div className="absolute bottom-[4px] right-[6px] flex items-center gap-1 opacity-90 text-[10.5px] font-medium tracking-tight h-[15px]">
                              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{safeTime(msg.sent_at || msg.created_at || '')}</span>
                              {isMe && (
                                <div className="flex items-center -ml-0.5">
                                  {msg.is_read || msg.status === 'seen' ? (
                                    <div className="flex -space-x-[7px] drop-shadow-md">
                                      <Check size={15} className="text-[#38bdf8]" strokeWidth={3} />
                                      <Check size={15} className="text-[#38bdf8]" strokeWidth={3} />
                                    </div>
                                  ) : selectedChat?.partner_online ? (
                                    <div className="flex -space-x-[7px] drop-shadow-md">
                                      <Check size={15} className="text-[#cbd5e1]" strokeWidth={3} />
                                      <Check size={15} className="text-[#cbd5e1]" strokeWidth={3} />
                                    </div>
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
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Scroll to Bottom Button */}
                <AnimatePresence>
                  {showScrollToBottom && (
                    <motion.button 
                      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                      onClick={() => {
                        scrollToBottom('smooth');
                        setUnreadCountInChat(0);
                      }}
                      className="absolute bottom-24 right-6 w-11 h-11 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white shadow-2xl z-50 hover:bg-white/20 transition-all active:scale-95"
                    >
                      <ArrowDown size={20} strokeWidth={3} />
                      {unreadCountInChat > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#ff1493] rounded-full flex items-center justify-center text-[10px] font-black border-2 border-black">
                          {unreadCountInChat}
                        </div>
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

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
                setShowAttachmentMenu={setShowAttachmentMenu}
                showAttachmentMenu={showAttachmentMenu}
                theme={currentChatTheme}
              />
            </>
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
      </div>

      {/* MODALS */}
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

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
        .note-modal-open nav.lg\\:hidden { display: none !important; }
        em-emoji-picker { 
          --padding: 0px !important;
          --border-radius: 0px !important;
          width: 100% !important;
          height: 100% !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
