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
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
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
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-700 bg-[#000000]">
      {!hasImage && (
        <div 
          className="absolute inset-0 transition-all duration-700 opacity-100" 
          style={{ 
            background: `linear-gradient(135deg, ${theme.colors.backgroundDark} 0%, ${theme.colors.backgroundLight} 100%)` 
          }} 
        />
      )}
      
      {hasImage && (
        <div 
          className="absolute inset-0 z-0 transition-opacity duration-700" 
          style={{ 
            backgroundImage: `url(${theme.wallpaperUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: `blur(${theme.blurIntensity || 2}px)`,
            transform: 'scale(1.05)' // prevents blur from leaking edges
          }} 
        />
      )}

      {/* Darkness Overlay for readability */}
      {hasImage && (
        <div 
          className="absolute inset-0 z-0 transition-opacity duration-700" 
          style={{ backgroundColor: `rgba(0,0,0,${(theme.darknessOverlay ?? 40) / 100})` }}
        />
      )}

      {/* Live Animations Layer */}
      <LiveAnimations type={theme.animationType} />
    </div>
  );
};

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
  showAttachmentMenu
}: any) => {
  const [localMessage, setLocalMessage] = useState(initialMessage || '');
  
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
    <footer className="bg-[#000000] border-t border-white/5 z-30 pb-safe shrink-0">
      <div className="w-full px-1 py-2">
        <form onSubmit={handleSubmit} className="flex items-center w-full max-w-[1200px] mx-auto">
          {!isMenuCollapsed ? (
            <div className="flex items-center shrink-0">
              <button type="button" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="text-[#ff1493] hover:opacity-80 p-2 ml-0">
                <Plus size={22} strokeWidth={2.5} />
              </button>
              <button type="button" onClick={onCameraOpen} className="text-[#ff1493] hover:opacity-80 p-2">
                <Camera size={22} strokeWidth={2.5} />
              </button>
              <label className="text-[#ff1493] hover:opacity-80 cursor-pointer p-2">
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
              <button type="button" onClick={() => alert('Voice recording started...')} className="text-[#ff1493] hover:opacity-80 p-2">
                <Mic size={22} strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <button 
              type="button" 
              onClick={() => setIsMenuCollapsed(false)} 
              className="text-[#ff1493] hover:opacity-80 p-2 animate-scale-in shrink-0 ml-1"
            >
              <ChevronRight size={24} strokeWidth={3} />
            </button>
          )}
          
          <div className="flex-1 relative bg-[#262626] rounded-lg flex items-center h-[38px] px-3 mx-1 overflow-hidden">
            <input 
              type="text"
              value={localMessage}
              onChange={handleChange}
              placeholder="Type a message..."
              className="flex-1 bg-transparent !bg-transparent text-[14px] font-medium text-[#f5f5f5] placeholder:text-white/30 outline-none border-none !border-none focus:ring-0 focus:!ring-0 p-0 m-0 shadow-none !shadow-none caret-white"
              autoComplete="off"
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f5f5f5', caretColor: 'white' }}
            />
            <button type="button" className="text-white/30 hover:text-white transition-colors ml-2 shrink-0">
              <Smile size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex items-center shrink-0 mr-1">
            {localMessage.trim() ? (
              <button 
                type="submit"
                disabled={sending}
                className="ml-1 bg-[#ff1493] text-white p-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all shadow-lg"
              >
                <Send size={16} strokeWidth={3} />
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => {
                  const reaction = getQuickReaction(selectedChat.chat_id);
                  onSend(undefined, reaction);
                }}
                className="ml-1 text-xl hover:scale-110 active:scale-90 transition-all p-1"
              >
                {getQuickReaction(selectedChat.chat_id)}
              </button>
            )}
          </div>
        </form>
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
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(true);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteView, setNoteView] = useState('main');
  const [noteText, setNoteText] = useState('');
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

  const { getThemeForChat, setThemeForChat, getQuickReaction, setQuickReaction, getWordEffects, addWordEffect, removeWordEffect } = useThemeStore();
  const currentChatTheme = selectedChat ? getThemeForChat(selectedChat.chat_id) : null;
  const activeThemeId = currentChatTheme?.id;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Mock Data ---
  const mockNotes = [
    "Exploring the village ✨",
    "Feeling the sparkle vibe!",
    "New moments coming soon...",
    "Listening to Afrobeat 🎵",
    "Sparkle is the future 🚀"
  ];
  const notePlaceholder = "Feeling sparkle ✨";

  // --- Effects ---
  useEffect(() => {
    fetchInbox();
    fetchSuggested();
  }, []);

  useEffect(() => {
    if (targetChatId && conversations.length > 0) {
      const chat = conversations.find(c => c.chat_id === targetChatId || c.partner_id === targetChatId);
      if (chat) setSelectedChat(chat);
    }
  }, [targetChatId, conversations]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.chat_id);
    }
  }, [selectedChat]);

  // --- Handlers ---
  const fetchInbox = async () => {
    setLoading(true);
    try {
      const res = await api.get('/messages/inbox');
      // Backend wraps response: { status, data: [...] }
      const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setConversations(list);
    } catch (err) {
      console.error('Failed to fetch inbox', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggested = async () => {
    try {
      const res = await api.get('/users/followers');
      setSuggestedContacts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch suggested', err);
      setSuggestedContacts([]);
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
        scrollToBottom('smooth');
      }
      // Refresh inbox to update last message preview
      fetchInbox();
    };

    socket.on('receive_message', handleNewMessage);
    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('receive_message', handleNewMessage);
      socket.off('new_message', handleNewMessage);
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
  const handleTyping = (val: string) => setNewMessage(val);
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
    if (!time) return 'long ago';
    const diff = Date.now() - new Date(time).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return safeTime(time);
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

  // --- Render ---
  return (
    <div className={clsx("flex flex-col h-screen bg-[#000000] text-white overflow-hidden safe-bottom", selectedChat && "hidden-mobile-nav")}>
      <Navbar />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR */}
        <aside className={clsx(
          "w-full lg:w-[420px] bg-[#000000] border-r border-white/5 flex flex-col transition-all duration-300 min-h-0",
          selectedChat ? 'hidden lg:flex' : 'flex'
        )}>
          <header className="px-5 pt-4 pb-2 overflow-visible bg-[#000000]">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                   <div className="relative cursor-pointer hover:scale-105 active:scale-95 transition-all" onClick={() => navigate(`/profile/${user?.username}`)}>
                     <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-10 h-10 rounded-full object-cover border-2 border-white/10" alt="" />
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

             <div className="relative mb-3 group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                <input 
                  type="text" 
                  placeholder="Search messages..." 
                  className="w-full h-8 bg-white/5 border border-white/5 rounded-full pl-9 pr-3 text-[12px] font-medium text-[#f5f5f5] placeholder:text-white/25 transition-all outline-none focus:border-[#ff1493]/30"
                />
             </div>

             {/* Notes Row — pt-14 gives room for the absolute -top-11 speech bubbles */}
             <div className="flex gap-1 overflow-x-auto no-scrollbar overflow-visible pt-14 pb-2">
                <div className="relative w-[74px] flex flex-col items-center gap-2 shrink-0">
                  <div className="relative w-full">
                    <div 
                      className="absolute -top-[44px] left-0 right-0 h-10 bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl flex items-center justify-center px-1 text-[9px] text-white/90 font-medium text-center leading-tight shadow-xl cursor-pointer hover:scale-105 active:scale-95 transition-all z-10"
                      onClick={() => setActiveModal('note_editor')}
                    >
                      <span className="truncate block w-full">{notePlaceholder}</span>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/5 border-b border-r border-white/10 rounded-full"></div>
                    </div>
                    <div className="cursor-pointer flex justify-center" onClick={() => navigate(`/profile/${user?.username}`)}>
                      <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-12 h-12 rounded-full object-cover border-2 border-white/5" alt="" />
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

                {/* Static mock user notes — always visible */}
                {[
                  { name: 'Amara', initials: 'AM', note: 'Feeling sparkle ✨', color: '#7c3aed' },
                  { name: 'Kofi', initials: 'KO', note: 'Village vibes 🌍', color: '#0ea5e9' },
                  { name: 'Zara', initials: 'ZR', note: 'New music drop 🎵', color: '#ff1493' },
                ].map((mock) => (
                  <div key={mock.name} className="relative w-[74px] flex flex-col items-center gap-2 shrink-0 cursor-pointer"
                    onClick={() => {
                      setViewingNote({...mock});
                      setShowViewNoteModal(true);
                    }}
                  >
                    <div className="relative w-full">
                      <div className="absolute -top-[44px] left-0 right-0 h-10 bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl flex items-center justify-center px-1 text-[9px] text-white/90 font-medium text-center leading-tight shadow-xl z-10">
                        <span className="truncate block w-full">{mock.note}</span>
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/5 border-b border-r border-white/10 rounded-full"></div>
                      </div>
                      <div className="flex justify-center">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[15px] font-black border-2 border-white/5" style={{ background: mock.color }}>
                          {mock.initials}
                        </div>
                      </div>
                      <div className="absolute bottom-0 right-3 w-3.5 h-3.5 bg-emerald-500 border-[2.5px] border-black rounded-full"></div>
                    </div>
                    <span className="text-[10px] font-medium text-[#f5f5f5]/60 text-center truncate w-full">{mock.name}</span>
                  </div>
                ))}

                {Array.isArray(suggestedContacts) && suggestedContacts.slice(0, 7).map((contact, idx) => (
                  <div key={contact.user_id} className="relative w-[74px] flex flex-col items-center gap-2 shrink-0 cursor-pointer group"
                    onClick={() => {
                      setViewingNote({...contact, note: mockNotes[idx % mockNotes.length]});
                      setShowViewNoteModal(true);
                    }}
                  >
                    <div className="relative w-full">
                      <div className="absolute -top-[44px] left-0 right-0 h-10 bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl flex items-center justify-center px-1 text-[9px] text-white/90 font-medium text-center leading-tight shadow-xl animate-fade-in z-10">
                        <span className="truncate block w-full">{mockNotes[idx % mockNotes.length]}</span>
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/5 border-b border-r border-white/10 rounded-full"></div>
                      </div>
                      <div className="flex justify-center">
                        <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-12 h-12 rounded-full object-cover border-2 border-white/5 shadow-sm" alt="" />
                      </div>
                      <div className="absolute bottom-0 right-3 w-3.5 h-3.5 bg-emerald-500 border-[2.5px] border-black rounded-full"></div>
                    </div>
                    <span className="text-[10px] font-medium text-[#f5f5f5]/60 text-center truncate w-full">{contact.name?.split(' ')[0] || contact.username}</span>
                  </div>
                ))}
             </div>
          </header>

          <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-3 no-scrollbar scroll-smooth bg-[#000000]">
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
                  onClick={() => setSelectedChat(chat)}
                  className={clsx(
                    "px-4 py-1.5 rounded-2xl transition-all duration-300 cursor-pointer group flex items-center gap-3",
                    selectedChat?.chat_id === chat.chat_id ? 'bg-white/10' : 'hover:bg-white/5'
                  )}
                >
                  <div className="relative shrink-0">
                    <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-11 h-11 rounded-full object-cover border border-white/5 shadow-md" alt="" />
                    <div className="absolute -bottom-0.5 -right-0.5">
                      {chat.partner_online ? (
                        <div className="w-4 h-4 bg-emerald-500 border-[3px] border-black rounded-full"></div>
                      ) : (
                        <div className="bg-[#1a1a1a] text-white text-[9px] font-black px-1 py-0.5 rounded-full border-[2px] border-black shadow-lg">
                          {idx % 3 === 0 ? '9m' : idx % 3 === 1 ? '1h' : '2d'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex justify-between items-center mb-0.5">
                       <h4 className={clsx(
                         "text-[14px] tracking-tight truncate leading-none",
                         chat.unread_count > 0 ? 'font-bold text-[#f5f5f5]' : 'font-medium text-[#f5f5f5]/80'
                       )}>{chat.partner_name}</h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p className={clsx(
                        "text-[12px] truncate",
                        chat.unread_count > 0 ? 'font-bold text-[#f5f5f5]' : 'text-[#f5f5f5]/40'
                      )}>
                        {chat.last_message ? formatMessageText(chat.last_message) : 'Sent a photo'}
                      </p>
                      <span className="text-[12px] text-white/20 shrink-0">· {safeTime(chat.last_message_time || chat.last_message_at || '')}</span>
                    </div>
                  </div>
                  {chat.unread_count > 0 && (
                    <div className="w-2.5 h-2.5 bg-[#ff1493] rounded-full shrink-0 shadow-lg"></div>
                  )}
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
              <header className="h-[60px] bg-[#000000]/80 backdrop-blur-xl border-b border-white/5 px-4 flex items-center justify-between z-40 relative shadow-lg">
                <div className="flex items-center gap-2 relative z-10">
                  <button onClick={() => setSelectedChat(null)} className="text-white hover:opacity-70 transition-opacity p-2">
                    <ArrowLeft size={28} strokeWidth={2.5} />
                  </button>
                  <div className="relative group cursor-pointer" onClick={() => navigate(`/profile/${selectedChat.partner_name}`)}>
                    <img src={getAvatarUrl(selectedChat.partner_avatar, selectedChat.partner_name)} className="w-[38px] h-[38px] rounded-full object-cover border border-white/10 shadow-sm" alt="" />
                  </div>
                  <div className="ml-1 overflow-hidden h-[30px] flex flex-col justify-center">
                    <h3 className="text-[15px] font-bold tracking-tight leading-none text-white font-sans">{selectedChat.partner_name}</h3>
                    <div className="h-[14px] relative mt-1">
                      {selectedChat.partner_online ? (
                        <p className="text-[11px] font-bold tracking-wide lowercase text-emerald-500 whitespace-nowrap">online</p>
                      ) : (
                        <p className="text-[11px] font-bold tracking-wide lowercase text-white/40 whitespace-nowrap">last seen {formatLastSeen(selectedChat.last_message_time || selectedChat.last_message_at || '')}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 relative z-10 pr-1">
                  <button className="text-white/90 hover:text-white p-2 transition-all active:scale-95"><Phone size={18} strokeWidth={2.5} /></button>
                  <button className="text-white/90 hover:text-white p-2 transition-all active:scale-95"><Video size={18} strokeWidth={2.5} /></button>
                  <button onClick={() => setShowChatSettings(true)} className="text-white/90 hover:text-white p-2 transition-all active:scale-95">
                    <Info size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-1 no-scrollbar scroll-smooth relative z-10" onScroll={handleScroll}>
                <div className="flex flex-col">
                  {messages.map((msg, i) => {
                    const isMe = msg.sender_id === (user?.id || user?.user_id);
                    return (
                      <div key={msg.message_id || i} className={clsx("flex animate-fade-in mt-4", isMe ? 'justify-end' : 'justify-start')}>
                        <div className={clsx("max-w-[85%] md:max-w-[70%] flex flex-col", isMe ? 'items-end' : 'items-start')}>
                          <div 
                            className={clsx(
                              "px-4 py-2.5 text-[15px] leading-relaxed shadow-sm transition-all duration-300 relative z-10 rounded-[14px]",
                              isMe ? 'bg-[#ff1493] text-white' : 'bg-[#2C2C2E] text-white'
                            )}
                            style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.4)' }}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <div className={clsx("flex items-center gap-1.5 mt-1 px-1 opacity-40 text-[10px] font-medium", isMe ? 'flex-row-reverse' : 'flex-row')}>
                            <span>{safeTime(msg.sent_at || msg.created_at || '')}</span>
                            {isMe && <span className={msg.is_read ? 'text-[#ff1493]' : ''}>{msg.is_read ? '✓✓' : '✓'}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
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
                {Array.isArray(suggestedContacts) && suggestedContacts.map(contact => (
                  <div key={contact.user_id} onClick={() => startNewChat(contact)} className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl cursor-pointer transition-all active:scale-[0.98]">
                    <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-12 h-12 rounded-xl object-cover border border-white/5 shadow-sm" />
                    <div>
                      <h4 className="font-bold text-white text-sm leading-none">{contact.name || contact.username}</h4>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">@{contact.username}</p>
                    </div>
                  </div>
                ))}
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

      {/* VIEW NOTE MODAL */}
      <AnimatePresence>
        {showViewNoteModal && viewingNote && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#000000]/80 backdrop-blur-sm z-[100] flex justify-center items-center px-4" 
            onClick={() => setShowViewNoteModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#121212] rounded-[32px] w-full max-w-sm p-6 shadow-2xl overflow-hidden relative border border-white/10" 
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setShowViewNoteModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all text-white"><X size={16} strokeWidth={3} /></button>
              <div className="flex flex-col items-center mb-6">
                {viewingNote.initials ? (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-black border-4 border-white/5 shadow-md mb-4" style={{ background: viewingNote.color }}>{viewingNote.initials}</div>
                ) : (
                  <img src={getAvatarUrl(viewingNote.avatar_url, viewingNote.username)} className="w-20 h-20 rounded-full object-cover border-4 border-white/5 shadow-md mb-4" />
                )}
                <h3 className="text-xl font-black text-white tracking-tighter">{viewingNote.name || viewingNote.username}</h3>
              </div>
              <div className="relative mb-8 flex justify-center">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/10 border-t border-l border-white/20 rotate-45"></div>
                <div className="bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-center text-white font-bold shadow-xl max-w-[80%] break-words relative z-10 text-lg">
                  {viewingNote.note}
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center">
                  <input type="text" placeholder="Reply..." className="bg-transparent w-full text-white font-medium placeholder:text-white/30 outline-none text-sm" />
                </div>
                <button className="w-12 flex-shrink-0 bg-[#ff1493] text-white rounded-xl flex items-center justify-center hover:bg-[#ff1493]/80 transition-all"><Send size={18} strokeWidth={3} /></button>
              </div>
            </motion.div>
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
        @media (max-width: 1024px) {
          .hidden-mobile-nav nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
