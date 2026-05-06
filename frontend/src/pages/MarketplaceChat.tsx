import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, Send, Image as ImageIcon, MoreVertical, Check, CheckCheck, Smile, Paperclip, Reply, X, Edit2, Trash2, ShieldCheck, EyeOff, ShoppingBag as ShoppingBagIcon, ShieldAlert, Tag, PackageCheck, BadgeDollarSign, ScanSearch, MapPin, Repeat2, CalendarClock } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/api';

const EMOJI_LIST = ['😊', '😂', '🥰', '😍', '😒', '😭', '😩', '😔', '😘', '☺️', '😁', '🥳', '😎', '😡', '🤔', '👍', '❤️', '🔥', '✨', '🙌', '💯', '🙏', '🤝', '💰', '🏠', '🚗', '📦', '🎁', '🛒'];

const VIRTUAL_GIFTS = [
  { id: 'available', Icon: PackageCheck, label: 'Still Available?', text: 'Is this still available?', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'offer', Icon: BadgeDollarSign, label: 'Best Price', text: 'What is your best price for this?', color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'condition', Icon: ScanSearch, label: 'Condition', text: 'Could you tell me more about the condition?', color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'pickup', Icon: MapPin, label: 'Pickup Spot', text: 'Where can I pick this up?', color: 'text-rose-600', bg: 'bg-rose-50' },
  { id: 'swap', Icon: Repeat2, label: 'Open to Swap?', text: 'Are you open to a trade or swap?', color: 'text-violet-600', bg: 'bg-violet-50' },
  { id: 'reserve', Icon: CalendarClock, label: 'Can You Hold?', text: 'Can you hold this for me until tomorrow?', color: 'text-sky-600', bg: 'bg-sky-50' },
];

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY;

interface Message {
  id: string;
  sender_id: string;
  message_text: string;
  message_type: string;
  media_url?: string;
  reply_to_id?: string;
  reply_text?: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  is_edited?: boolean;
  reactions?: any[];
}

interface ConversationInfo {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  buyer_name: string;
  buyer_avatar: string;
  seller_name: string;
  seller_username: string;
  seller_avatar: string;
  listing_title: string;
  listing_price: number;
  listing_image: string;
  listing_description: string;
  listing_status: 'active' | 'sold' | 'pending' | 'deleted';
}

const MarketplaceChat = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useUserStore();
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [isOpponentOnline, setIsOpponentOnline] = useState(false);
  const [opponentTyping, setOpponentTyping] = useState(false);
  
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [stagedMedia, setStagedMedia] = useState<{ url: string, type: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [amIBlocked, setAmIBlocked] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'sticker' | 'gif' | 'gift'>('emoji');
  const [giphyResults, setGiphyResults] = useState<any[]>([]);
  const [giphyLoading, setGiphyLoading] = useState(false);
  const [giphySearch, setGiphySearch] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showPicker && (pickerTab === 'gif' || pickerTab === 'sticker')) {
      const fetchMedia = async () => {
        setGiphyLoading(true);
        try {
          const type = pickerTab === 'gif' ? 'gifs' : 'stickers';
          const endpoint = giphySearch ? 'search' : 'trending';
          const queryParam = giphySearch ? `&q=${encodeURIComponent(giphySearch)}` : '';
          const url = `https://api.giphy.com/v1/${type}/${endpoint}?api_key=${GIPHY_API_KEY}${queryParam}&limit=20&rating=g`;
          const res = await fetch(url);
          const data = await res.json();
          setGiphyResults(data.data || []);
        } catch (err) {
          console.error("Giphy fetch failed", err);
        } finally {
          setGiphyLoading(false);
        }
      };
      
      const debounceTimer = setTimeout(fetchMedia, giphySearch ? 500 : 0);
      return () => clearTimeout(debounceTimer);
    }
  }, [showPicker, pickerTab, giphySearch]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (socket && location.state?.initialMessage) {
      const msgData = {
        conversationId,
        text: location.state.initialMessage,
        type: 'text'
      };
      
      socket.emit('send_message', msgData, (response: any) => {
        if (response.status === 'success') {
          setMessages(prev => [...prev, response.message]);
        }
      });

      window.history.replaceState({}, document.title);
    }
  }, [socket, location.state, conversationId]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/marketplace/settings');
        setUserSettings(res.data);
      } catch (err) {
        console.error("Failed to fetch settings", err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!conversationId || !user) return;

    const fetchHistory = async () => {
      try {
        const convRes = await api.get(`/marketplace/conversations`);
        const allConvs = convRes.data;
        const currentConv = allConvs.find((c: any) => c.id === conversationId);
        if (currentConv) {
          setConversation(currentConv);
          
          const statusRes = await api.get(`/marketplace/conversations/${conversationId}/status`);
          setIsBlockedByMe(statusRes.data.isBlockedByMe);
          setAmIBlocked(statusRes.data.amIBlocked);
        }

        const msgRes = await api.get(`/marketplace/messages/${conversationId}`);
        setMessages(msgRes.data);
      } catch (err) {
        console.error("Error fetching chat history:", err);
      }
    };
    fetchHistory();
  }, [conversationId, user]);

  useEffect(() => {
    if (!user || !token || !conversationId) return;

    const newSocket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/marketplace`, {
      auth: { token, userId: user.user_id },
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      newSocket.emit('join_conversation', conversationId);
    });

    newSocket.on('receive_message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
      newSocket.emit('mark_read', { messageId: msg.id, conversationId });
    });

    newSocket.on('user_status_change', ({ userId, status }) => {
      if (conversation && (userId === conversation.seller_id || userId === conversation.buyer_id) && userId !== user.user_id) {
        setIsOpponentOnline(status === 'online');
      }
    });

    newSocket.on('user_typing', ({ userId, isTyping }) => {
      if (userId !== user.user_id) {
        setOpponentTyping(isTyping);
      }
    });

    newSocket.on('message_edited', (data) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, message_text: data.newText, is_edited: true } : m));
    });

    newSocket.on('message_deleted', (data) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId));
    });

    newSocket.on('message_reaction', (data) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.messageId) {
          const reactions = m.reactions || [];
          const existing = reactions.find((r: any) => r.user_id === data.userId);
          if (existing) {
             existing.reaction = data.reaction;
             return { ...m, reactions: [...reactions] };
          }
          return { ...m, reactions: [...reactions, { user_id: data.userId, reaction: data.reaction }] };
        }
        return m;
      }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave_conversation', conversationId);
      newSocket.disconnect();
    };
  }, [user, token, conversationId, conversation]);

  const handleDelete = async (messageId: string) => {
    if (!socket) return;
    try {
      await api.delete(`/marketplace/messages/${messageId}`);
      socket.emit('delete_message', { messageId, conversationId });
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setContextMenuId(null);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleReact = async (messageId: string, reaction: string) => {
    if (!socket) return;
    try {
      await api.post(`/marketplace/messages/${messageId}/react`, { reaction });
      socket.emit('react_message', { messageId, conversationId, reaction });
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          const reactions = m.reactions || [];
          const existing = reactions.find((r: any) => r.user_id === user?.user_id);
          if (existing) {
             existing.reaction = reaction;
             return { ...m, reactions: [...reactions] };
          }
          return { ...m, reactions: [...reactions, { user_id: user?.user_id, reaction }] };
        }
        return m;
      }));
      setContextMenuId(null);
    } catch (err) {
      console.error("React failed", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !socket) return;
    
    setIsUploading(true);
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append('media', file);
        const res = await api.post('/marketplace/messages/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (res.data.success) {
          setStagedMedia(prev => [...prev, { url: res.data.url, type: res.data.type }]);
        }
      } catch(err) {
        console.error("Upload failed for file:", file.name, err);
      }
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendGiphy = (url: string, type: string) => {
    if (!socket) return;
    const msgData = {
      conversationId,
      text: '',
      type: type, // 'gif' or 'sticker'
      mediaUrl: url,
      replyToId: replyToMessage?.id
    };

    socket.emit('send_message', msgData, (response: any) => {
      if (response.status === 'success') {
        setMessages(prev => [...prev, response.message]);
      }
    });
    setShowPicker(false);
  };

  const handleSendGift = (gift: {icon: string, label: string, text: string}) => {
    if (!socket) return;
    const msgData = {
      conversationId,
      text: gift.text,
      type: 'text',
      replyToId: replyToMessage?.id
    };

    socket.emit('send_message', msgData, (response: any) => {
      if (response.status === 'success') {
        setMessages(prev => [...prev, response.message]);
      }
    });
    setShowPicker(false);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!conversation) return;
    try {
      await api.put(`/marketplace/listings/${conversation.listing_id}`, { status: newStatus });
      setConversation(prev => prev ? { ...prev, listing_status: newStatus as any } : null);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && stagedMedia.length === 0) || !socket) return;

    if (editingMessageId) {
      try {
        await api.put(`/marketplace/messages/${editingMessageId}`, { text: inputText.trim() });
        socket.emit('edit_message', { messageId: editingMessageId, conversationId, newText: inputText.trim() });
        setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, message_text: inputText.trim(), is_edited: true } : m));
        setEditingMessageId(null);
        setInputText('');
      } catch (err) {
        console.error("Edit failed", err);
      }
      return;
    }
    
    const sendMsg = (text: string, media?: {url: string, type: string}) => {
      const msgData = {
        conversationId,
        text: text,
        type: media?.type || 'text',
        mediaUrl: media?.url,
        replyToId: replyToMessage?.id
      };

      socket.emit('send_message', msgData, (response: any) => {
        if (response.status === 'success') {
          setMessages(prev => [...prev, response.message]);
        }
      });
    };

    if (stagedMedia.length > 0) {
      stagedMedia.forEach((media, index) => {
        sendMsg(index === 0 ? inputText.trim() : '', media);
      });
      setStagedMedia([]);
    } else {
      sendMsg(inputText.trim());
    }

    setInputText('');
    setReplyToMessage(null);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!socket) return;
    socket.emit('typing_start', { conversationId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { conversationId });
    }, 1500);
  };

  if (!conversation) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  const isBuyer = user?.user_id === conversation.buyer_id;
  const opponentName = amIBlocked ? 'Sparkle User' : (isBuyer ? conversation.seller_name : conversation.buyer_name);
  const opponentAvatar = amIBlocked ? '' : (isBuyer ? conversation.seller_avatar : conversation.buyer_avatar);
  const opponentUsername = amIBlocked ? 'sparkle_user' : (isBuyer ? conversation.seller_username : 'buyer');

  return (
    <div className="flex flex-col h-screen bg-gray-100 max-w-2xl mx-auto shadow-xl relative">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src={opponentAvatar || `https://ui-avatars.com/api/?name=${opponentName}&background=E2E8F0&color=94A3B8`} 
                alt={opponentName} 
                className="w-10 h-10 rounded-full object-cover border border-gray-200 bg-gray-100"
              />
              {(isOpponentOnline && (userSettings?.show_online_status !== false)) && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-gray-900 leading-tight">{opponentName}</span>
              <span className="text-xs text-gray-500">
                @{opponentUsername} • {isOpponentOnline ? <span className="text-green-600 font-medium">Online</span> : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
          >
            <MoreVertical size={20} />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <button 
                onClick={() => { setShowMenu(false); navigate(`/marketplace/seller/${isBuyer ? conversation.seller_id : conversation.buyer_id}`); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-bold transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <ShoppingBagIcon size={16} />
                </div>
                <span>View Profile</span>
              </button>
              
              <button 
                onClick={() => { setShowMenu(false); navigate(`/marketplace/report/${conversation.listing_id}`); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-red-600 font-bold transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                  <ShieldCheck size={16} />
                </div>
                <span>Report Listing</span>
              </button>

              <button 
                onClick={async () => { 
                  setShowMenu(false);
                  try {
                    await api.patch(`/marketplace/conversations/${conversationId}/toggle`, { field: 'is_pinned' });
                    window.location.reload(); 
                  } catch(err) { console.error(err); }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-bold transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Tag size={16} />
                </div>
                <span>{conversation.is_pinned ? 'Unpin' : 'Pin'} Chat</span>
              </button>

              <button 
                onClick={async () => { 
                  setShowMenu(false);
                  try {
                    await api.patch(`/marketplace/conversations/${conversationId}/toggle`, { field: 'is_archived' });
                    if (!conversation.is_archived) {
                      navigate('/marketplace/inbox');
                    } else {
                      window.location.reload();
                    }
                  } catch(err) { console.error(err); }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-bold transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                  <ShoppingBagIcon size={16} />
                </div>
                <span>{conversation.is_archived ? 'Unarchive' : 'Archive'} Chat</span>
              </button>

              <button 
                onClick={async () => { 
                  setShowMenu(false);
                  try {
                    await api.patch(`/marketplace/conversations/${conversationId}/toggle`, { field: 'is_muted' });
                    window.location.reload(); 
                  } catch(err) { console.error(err); }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-bold transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-600">
                  <EyeOff size={16} />
                </div>
                <span>{conversation.is_muted ? 'Unmute' : 'Mute'} Chat</span>
              </button>

              {(isBuyer ? conversation.seller_id : conversation.buyer_id) !== user?.user_id && (
                <button 
                  onClick={async () => {
                    if (confirm(`Block ${opponentName}? This will prevent them from messaging you again.`)) {
                      setShowMenu(false);
                      try {
                        await api.post(`/users/block/${isBuyer ? conversation.seller_id : conversation.buyer_id}`);
                        navigate('/marketplace/inbox');
                      } catch(err) { console.error(err); }
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-red-600 font-bold transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                    <ShieldAlert size={16} />
                  </div>
                  <span>Block User</span>
                </button>
              )}

              <div className="h-px bg-gray-100 my-1 mx-4" />

              <button 
                onClick={async () => {
                  if (confirm('Permanently delete this chat?')) {
                    setShowMenu(false);
                    try {
                      await api.delete(`/marketplace/conversations/${conversationId}`);
                      navigate('/marketplace/inbox');
                    } catch(err) { console.error(err); }
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-red-600 font-bold transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                  <Trash2 size={16} />
                </div>
                <span>Delete Chat</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-4 sticky top-[64px] z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-gray-50 rounded-md flex items-center justify-center text-gray-300 shadow-inner border border-gray-100 overflow-hidden">
            {conversation.listing_image ? (
              <img src={conversation.listing_image} alt={conversation.listing_title} className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={24} />
            )}
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{conversation.listing_title}</h3>
            <p className="text-blue-600 font-extrabold text-sm">
              {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(conversation.listing_price)}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                conversation.listing_status === 'active' ? 'bg-green-100 text-green-700' :
                conversation.listing_status === 'sold' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {conversation.listing_status === 'active' ? 'Available' : 
                 conversation.listing_status === 'sold' ? 'Sold Out' : 'Pending'}
              </span>
            </div>
          </div>
        </div>
        {user?.user_id === conversation.seller_id ? (
          <div className="flex flex-col gap-1">
            {conversation.listing_status === 'active' ? (
              <button onClick={() => handleUpdateStatus('sold')} className="text-[11px] font-bold bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors shadow-sm">Mark as Sold</button>
            ) : (
              <button onClick={() => handleUpdateStatus('active')} className="text-[11px] font-bold bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-300 transition-colors">Mark Available</button>
            )}
          </div>
        ) : conversation.listing_status === 'sold' && (
          <div className="bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded border border-red-100">
            Sold Out
          </div>
        )}
      </div>

      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-white bg-opacity-50" 
        onClick={() => {
          setContextMenuId(null);
          setShowPicker(false);
        }}
      >
        {messages.map((msg, index) => {
          const isMine = msg.sender_id === user?.user_id;
          return (
            <div key={`${msg.id}-${index}`} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
              <div className="flex items-end gap-2 max-w-[80%] relative">
                {!isMine && (
                  <img src={opponentAvatar || `https://ui-avatars.com/api/?name=${opponentName}`} className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-1" alt="avatar" />
                )}
                <div 
                  onContextMenu={(e) => { e.preventDefault(); setContextMenuId(msg.id); }}
                  onClick={() => setContextMenuId(contextMenuId === msg.id ? null : msg.id)}
                  className={`px-4 py-2 rounded-xl shadow-sm relative cursor-pointer group ${isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-gray-900 border border-gray-100 rounded-bl-sm font-medium'}`}
                >
                  {!isMine && <div className="text-[10px] text-purple-600 font-bold mb-1 uppercase tracking-tight">{opponentName}</div>}
                  
                  {contextMenuId === msg.id && (
                    <div className={`absolute top-0 ${isMine ? 'right-full mr-2' : 'left-full ml-2'} z-50 bg-white shadow-2xl border border-gray-100 rounded-xl py-1 w-32 overflow-hidden animate-in zoom-in-95 duration-100`}>
                      <button onClick={(e) => { e.stopPropagation(); setReplyToMessage(msg); setContextMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                        <Reply size={14} /> Reply
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.message_text); setContextMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                        <Paperclip size={14} /> Copy
                      </button>
                      {isMine && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); setContextMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 flex items-center gap-2 text-red-500 border-t">
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {msg.reply_to_id && (
                      <div className={`p-2 rounded text-xs border-l-4 ${isMine ? 'bg-blue-700 border-white/50 text-blue-100' : 'bg-gray-50 border-purple-400 text-gray-500'}`}>
                        <div className="font-bold opacity-80 mb-0.5">Replied to</div>
                        <p className="truncate italic">{messages.find(m => m.id === msg.reply_to_id)?.message_text || "Original message removed"}</p>
                      </div>
                    )}

                    {(msg.message_type === 'image' || msg.type === 'image') && (
                       <div className="relative group">
                         <img src={msg.media_url || msg.mediaUrl} alt="Upload" className="max-w-[200px] sm:max-w-[300px] rounded-md object-cover shadow-sm transition-transform hover:scale-[1.02]" />
                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-md transition-all" />
                       </div>
                    )}

                    {(msg.message_type === 'gif' || msg.type === 'gif') && (
                       <div className="relative group">
                         <img src={msg.media_url || msg.mediaUrl} alt="GIF" className="max-w-[220px] rounded-xl shadow-sm" style={{borderRadius: '12px'}} />
                         <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[9px] font-black px-1 rounded">GIF</span>
                       </div>
                    )}

                    {(msg.message_type === 'sticker' || msg.type === 'sticker') && (
                       <img src={msg.media_url || msg.mediaUrl} alt="Sticker" className="w-[120px] h-[120px] object-contain" />
                    )}

                    {(msg.message_type === 'video' || msg.type === 'video') && (
                       <video src={msg.media_url || msg.mediaUrl} controls className="max-w-[200px] sm:max-w-[300px] rounded-md shadow-sm" />
                    )}

                    {msg.message_text && (
                       <p className="text-[15px] leading-relaxed break-words">{msg.message_text}</p>
                    )}
                  </div>
                  <div className={`absolute top-0 ${isMine ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                     <button onClick={() => setReplyToMessage(msg)} className="p-1.5 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200"><ArrowLeft size={14} className="rotate-180" /></button>
                  </div>
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="absolute -bottom-3 right-2 flex gap-1 bg-white shadow-sm border border-gray-100 rounded-full px-1.5 py-0.5 text-xs z-10">
                      {[...new Set(msg.reactions.map((r: any) => r.reaction))].map((emoji: any, idx) => (<span key={idx} className="cursor-pointer">{emoji}</span>))}
                      {msg.reactions.length > 1 && <span className="text-gray-500 font-bold text-[10px] ml-0.5">{msg.reactions.length}</span>}
                    </div>
                  )}
                  {contextMenuId === msg.id && (
                    <div className="absolute top-full mt-1 right-0 bg-white shadow-lg rounded-md border border-gray-200 z-20 overflow-hidden min-w-[150px]">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                        {['👍', '❤️', '😂', '🔥', '🙏'].map(emoji => (<button key={emoji} onClick={(e) => { e.stopPropagation(); handleReact(msg.id, emoji); }} className="hover:scale-125 transition-transform">{emoji}</button>))}
                        <button onClick={(e) => { e.stopPropagation(); setReactingToMessageId(msg.id); setContextMenuId(null); }} className="hover:bg-gray-200 rounded-full p-1 text-gray-500 transition-colors">➕</button>
                      </div>
                      {isMine && (
                        <>
                          {(msg.message_type === 'text' || msg.type === 'text' || !msg.message_type) && (
                            <button onClick={(e) => { e.stopPropagation(); setEditingMessageId(msg.id); setInputText(msg.message_text); setContextMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">Edit</button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">Unsend</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 mt-1 px-1">
                {msg.is_edited && <span className="text-[10px] text-gray-400 italic">Edited</span>}
                <span className="text-[10px] text-gray-400">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {(isMine && (userSettings?.read_receipts !== false)) && (
                  <span className="text-[14px]">
                    {msg.read_at ? (<CheckCheck size={14} className="text-blue-500" />) : msg.delivered_at ? (<CheckCheck size={14} className="text-gray-400" />) : (<Check size={14} className="text-gray-400" />)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {(opponentTyping && (userSettings?.typing_indicators !== false) && !amIBlocked) && (
          <div className="flex items-start gap-2 animate-pulse">
             <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
               <Smile size={16} className="text-gray-400" />
             </div>
             <div className="bg-gray-100 rounded-2xl px-4 py-2 text-xs font-bold text-gray-500 italic shadow-sm">
               {opponentName} is typing...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {reactingToMessageId && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setReactingToMessageId(null)}
          >
            <div onClick={e => e.stopPropagation()} className="shadow-2xl rounded-2xl overflow-hidden">
              <Picker 
                data={data} 
                onEmojiSelect={(emoji: any) => { 
                  handleReact(reactingToMessageId, emoji.native); 
                  setReactingToMessageId(null); 
                }} 
                theme="light"
                previewPosition="none"
                skinTonePosition="none"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isBlockedByMe || amIBlocked ? (
        <div className="bg-white border-t p-8 text-center pb-12 animate-in slide-in-from-bottom-4 duration-500">
          <div className="max-w-xs mx-auto">
             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-sm">
               <ShieldAlert size={32} className="text-gray-300" />
             </div>
             <h4 className="text-base font-black text-slate-900 mb-2 leading-tight">
               {isBlockedByMe ? 'Conversation Blocked' : 'Message Not Sent'}
             </h4>
             <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">
               {isBlockedByMe 
                 ? 'You have blocked this user. Unblock them to continue chatting or delete this conversation.' 
                 : 'Not everyone can message this user. You cannot send messages to this person at this time.'}
             </p>
             
             {isBlockedByMe ? (
               <div className="flex flex-col gap-3">
                 <button 
                  onClick={async () => {
                    try {
                      const opponentId = isBuyer ? conversation.seller_id : conversation.buyer_id;
                      await api.delete(`/users/block/${opponentId}`);
                      setIsBlockedByMe(false);
                      window.location.reload();
                    } catch(err) { console.error(err); }
                  }}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all"
                 >
                   Unblock User
                 </button>
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={async () => {
                        if (confirm('Permanently delete this chat?')) {
                          try {
                            await api.delete(`/marketplace/conversations/${conversationId}`);
                            navigate('/marketplace/inbox');
                          } catch(err) { console.error(err); }
                        }
                      }}
                      className="py-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                    >
                      Delete Chat
                    </button>
                    <button 
                      onClick={() => navigate('/marketplace/report/' + conversation.listing_id)}
                      className="py-3 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors"
                    >
                      Report
                    </button>
                 </div>
               </div>
             ) : (
                <button 
                  onClick={() => navigate('/marketplace/inbox')}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Back to Inbox
                </button>
             )}
          </div>
        </div>
      ) : (
        <div className="bg-white border-t relative">
          {replyToMessage && (
            <div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-b border-gray-100 text-sm">
              <div className="flex flex-col overflow-hidden">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Replying to</span>
                <p className="text-gray-500 truncate italic text-xs">{replyToMessage.message_text || 'Media message'}</p>
              </div>
              <button type="button" onClick={() => setReplyToMessage(null)} className="p-1 hover:bg-gray-200 rounded-full text-gray-400"><ArrowLeft size={16} className="rotate-90" /></button>
            </div>
          )}
          
          {stagedMedia.length > 0 && (
            <div className="p-3 border-b border-gray-100 flex gap-2 overflow-x-auto no-scrollbar bg-gray-50">
              {stagedMedia.map((media, idx) => (
                <div key={idx} className="relative group">
                  {media.type === 'image' ? (
                    <img src={media.url} className="w-20 h-20 object-cover rounded-md border border-gray-200 shadow-sm" alt="Preview" />
                  ) : (
                    <div className="w-20 h-20 bg-gray-200 rounded-md flex items-center justify-center">
                      <ImageIcon size={24} className="text-gray-400" />
                    </div>
                  )}
                  <button onClick={() => setStagedMedia(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-white rounded-full shadow-md p-1 border border-gray-100 hover:bg-gray-100">
                    <X size={12} className="text-gray-500" />
                  </button>
                </div>
              ))}
              {isUploading && (
                <div className="w-20 h-20 bg-gray-100 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center animate-pulse">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          <AnimatePresence>
            {showPicker && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 320, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white border-b border-gray-100 overflow-hidden flex flex-col"
              >
                <div className="flex border-b border-gray-50 sticky top-0 bg-white z-10">
                  {(['emoji', 'sticker', 'gif', 'gift'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => { setPickerTab(tab); setGiphySearch(''); }}
                      className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                        pickerTab === tab ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {tab === 'gif' ? 'GIFs' : tab === 'emoji' ? 'Emojis' : tab === 'sticker' ? 'Stickers' : 'Quick Replies'}
                    </button>
                  ))}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar bg-gray-50/30">
                  {pickerTab === 'emoji' && (
                    <div className="flex justify-center -mx-4 -my-4">
                      <Picker 
                        data={data} 
                        onEmojiSelect={(emoji: any) => { setInputText(prev => prev + emoji.native); setShowPicker(false); }} 
                        theme="light"
                        previewPosition="none"
                        skinTonePosition="none"
                      />
                    </div>
                  )}

                  {(pickerTab === 'gif' || pickerTab === 'sticker') && (
                    <div className="space-y-4">
                      <div className="sticky top-0 bg-white/80 backdrop-blur-sm p-1 rounded-lg border border-gray-100 shadow-sm mb-4">
                        <input 
                          value={giphySearch}
                          onChange={(e) => setGiphySearch(e.target.value)}
                          placeholder={`Search ${pickerTab}s...`}
                          className="w-full bg-transparent px-3 py-2 text-xs font-bold outline-none"
                        />
                      </div>
                      {giphyLoading ? (
                        <div className="flex justify-center p-8">
                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 pb-4">
                          {giphyResults.map(item => (
                            <button
                              key={item.id}
                              onClick={() => handleSendGiphy(item.images.fixed_height.url, pickerTab)}
                              className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 hover:opacity-80 transition-opacity shadow-sm"
                            >
                              <img src={item.images.fixed_height.url} className="w-full h-full object-cover" alt="giphy" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {pickerTab === 'gift' && (
                    <div className="grid grid-cols-2 gap-3 pb-4">
                      {VIRTUAL_GIFTS.map(gift => {
                        const { Icon } = gift;
                        return (
                          <button
                            key={gift.id}
                            onClick={() => handleSendGift(gift)}
                            className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group"
                          >
                            <div className={`w-10 h-10 rounded-full ${gift.bg} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform`}>
                              <Icon size={20} className={gift.color} />
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wide text-gray-400 group-hover:${gift.color} transition-colors text-center leading-tight`}>{gift.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-3 px-4 py-3 bg-white">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
            >
              <Paperclip size={22} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              accept="image/*,video/*"
              onChange={handleFileUpload}
            />
            
            <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-4 py-1">
              <input 
                value={inputText}
                onChange={handleTyping}
                onKeyPress={(e) => e.key === 'Enter' && handleSend({ preventDefault: () => {} } as any)}
                placeholder="Type a message..." 
                className="w-full bg-transparent border-none outline-none py-2.5 text-sm font-medium placeholder:text-gray-400"
                onFocus={() => setShowPicker(false)}
              />
              <button 
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className={`transition-colors p-1 ${showPicker ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
              >
                <Smile size={20} />
              </button>
            </div>

            <button 
              onClick={() => handleSend({ preventDefault: () => {} } as any)}
              disabled={!inputText.trim() && stagedMedia.length === 0}
              className={`p-3 rounded-full transition-all shadow-lg ${
                inputText.trim() || stagedMedia.length > 0
                ? 'bg-blue-600 text-white shadow-blue-200 hover:scale-105 active:scale-95' 
                : 'bg-gray-100 text-gray-300 shadow-none'
              }`}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceChat;
