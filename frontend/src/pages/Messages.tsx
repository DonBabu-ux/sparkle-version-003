import { useState, useEffect, useRef, useCallback } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import NewChatModal from '../components/modals/NewChatModal';
import { useSocket } from '../hooks/useSocket';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface ChatConversation {
  chat_id: string;
  partner_id: string;
  partner_avatar?: string;
  partner_name: string;
  partner_online?: boolean;
  is_archived?: boolean;
  is_group?: boolean;
  is_admin?: boolean;
  unread_count: number;
  last_message?: string;
  last_message_time: string;
}

interface ChatMessage {
  message_id: string;
  sender_id: string;
  content: string;
  status: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
}

interface ActiveFriend {
  user_id: string;
  username: string;
  name?: string;
  avatar_url?: string;
}

export default function Messages() {
  const { user } = useUserStore();
  const socket = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetChatId = searchParams.get('chat');

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeFriends, setActiveFriends] = useState<ActiveFriend[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [inboxTab, setInboxTab] = useState('all');
  const [appTheme, setAppTheme] = useState('wa-standard');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordTime, setVoiceRecordTime] = useState(0);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatTab, setNewChatTab] = useState('new');
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [disappearingDuration, setDisappearingDuration] = useState(0);
  const [chatWallpaper, setChatWallpaper] = useState('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const scrollToUnread = useCallback(() => {
    if (!messages.length) return;
    
    // Find the first unread message from the partner
    const firstUnreadIndex = messages.findIndex(m => 
        m.status !== 'read' && m.sender_id !== (user?.id || user?.user_id)
    );

    if (firstUnreadIndex !== -1) {
        // If there's more than one unread, center it. If only one, just scroll bottom.
        const unreadCount = messages.length - firstUnreadIndex;
        if (unreadCount > 1) {
          const element = document.getElementById(`msg-${messages[firstUnreadIndex].message_id}`);
          element?.scrollIntoView({ behavior: 'auto', block: 'center' });
        } else {
          scrollToBottom('auto');
        }
    } else {
        scrollToBottom('auto');
    }
  }, [messages, user]);

  useEffect(() => {
    if (messages.length > 0) {
        scrollToUnread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat, scrollToUnread]);

  useEffect(() => {
    if (messages.length > 0) {
        scrollToBottom('smooth');
    }
  }, [messages.length]);

  const fetchInbox = useCallback(async () => {
    try {
      const [inboxRes, activeRes] = await Promise.all([
        api.get('/messages/inbox'),
        api.get('/users/active-friends')
      ]);
      if (inboxRes?.data?.status === 'success') {
        setConversations(inboxRes.data.data || []);
      }
      if (activeRes?.data?.success) {
        setActiveFriends(activeRes.data.friends || []);
      }
    } catch (err) {
      console.error('Failed to fetch inbox/friends:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  useEffect(() => {
    if (targetChatId && conversations.length > 0) {
      const chat = conversations.find(c => c.chat_id === targetChatId || c.partner_id === targetChatId);
      if (chat && chat.chat_id !== selectedChat?.chat_id) {
         setSelectedChat(chat);
      }
    }
  }, [targetChatId, conversations, selectedChat?.chat_id]);

  useEffect(() => {
    if (!selectedChat?.chat_id) return;
    
    const fetchMessages = async () => {
      try {
        const response = await api.get(`/messages/chat/${selectedChat.chat_id}`);
        if (response?.data?.status === 'success') {
          setMessages(response.data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };
    fetchMessages();

    // Only update if unread_count > 0 to avoid loops
    if (selectedChat.unread_count > 0) {
        setConversations(prev => prev.map(c => 
          c.chat_id === selectedChat.chat_id ? { ...c, unread_count: 0 } : c
        ));
    }
  }, [selectedChat?.chat_id, selectedChat?.unread_count]);

  useEffect(() => {
    if (!socket) return;

    socket.on('new-message', (data: ChatMessage & { conversation_id?: string, chat_id?: string }) => {
      const chatId = data.conversation_id || data.chat_id;
      if (selectedChat?.chat_id === chatId) {
        setMessages(prev => [...prev, data]);
        socket.emit('mark-read', chatId);
      }
      
      setConversations(prev => {
        const index = prev.findIndex(c => c.chat_id === chatId);
        if (index === -1) {
          fetchInbox();
          return prev;
        }
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          last_message: data.content,
          last_message_time: data.created_at,
          unread_count: selectedChat?.chat_id === chatId ? 0 : (updated[index].unread_count || 0) + 1
        };
        const chat = updated.splice(index, 1)[0];
        return [chat, ...updated];
      });
    });

    socket.on('user-typing', (data: { chatId: string, isTyping: boolean }) => {
      if (selectedChat?.chat_id === data.chatId && data.isTyping) {
        setPartnerTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 3000);
      } else if (selectedChat?.chat_id === data.chatId && !data.isTyping) {
        setPartnerTyping(false);
      }
    });

    socket.on('messages-read', (data: { chatId: string }) => {
      if (selectedChat?.chat_id === data.chatId) {
        setMessages(prev => prev.map(m => ({ ...m, status: 'read' })));
      }
    });

    socket.on('disappearing_messages_update', (data: { chatId: string, duration: number }) => {
      if (selectedChat?.chat_id === data.chatId) {
        setDisappearingDuration(data.duration);
      }
    });

    return () => {
      socket.off('new-message');
      socket.off('user-typing');
      socket.off('messages-read');
      socket.off('disappearing_messages_update');
    };
  }, [socket, selectedChat, fetchInbox]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !selectedChat || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const messageData = {
      chatId: selectedChat.chat_id,
      partnerId: selectedChat.partner_id,
      content: content,
      type: 'text'
    };

    if (socket && socket.connected) {
      socket.emit('send-message', messageData, (ack: { success: boolean }) => {
        setSending(false);
        if (!ack?.success) {
          console.error('Socket send failed, trying API...');
          sendViaApi(messageData);
        }
      });
    } else {
      await sendViaApi(messageData);
    }
  };

  const sendViaApi = async (data: Record<string, unknown>) => {
    try {
      await api.post('/messages/send', data);
    } catch (err) {
      console.error('Failed to send message via API:', err);
    } finally {
      setSending(false);
    }
  };


  const cancelVoiceNote = () => {
    setIsRecordingVoice(false);
    clearInterval(voiceTimerRef.current);
    setVoiceRecordTime(0);
  };

  const confirmVoiceNote = () => {
    setIsRecordingVoice(false);
    clearInterval(voiceTimerRef.current);
    setVoiceRecordTime(0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const safeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (socket && selectedChat) {
      socket.emit('typing', { 
        chatId: selectedChat.chat_id, 
        isTyping: e.target.value.length > 0 
      });
    }
  };

  return (
    <div className="messages-page">
      <Navbar />
      
      <div className="messaging-layout">
        {/* SIDEBAR */}
        <aside className={`conversation-sidebar ${selectedChat ? 'hidden-mobile' : ''}`}>
          <div className="sidebar-header">
            <div className="header-top">
              <h1>Conversations</h1>
              <div className="header-actions">
                <button className="icon-btn" onClick={() => { setNewChatTab('new'); setShowNewChatModal(true); }}><i className="fas fa-edit"></i></button>
              </div>
            </div>
            
            <div className="search-box">
              <i className="fas fa-search"></i>
              <input type="text" placeholder="Search chats..." />
            </div>

            <div className="inbox-tabs">
              {['all', 'unread', 'groups', 'archived', 'settings'].map(tab => (
                <button 
                  key={tab}
                  className={`inbox-tab ${inboxTab === tab ? 'active' : ''}`}
                  onClick={() => setInboxTab(tab)}
                >
                  {tab === 'settings' ? <i className="fas fa-cog"></i> : 
                   tab === 'archived' ? <i className="fas fa-archive"></i> :
                   tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="active-friends-section">
            <h4 className="section-label">Active Friends</h4>
            <div className="active-carousel">
              {activeFriends.map(friend => (
                <div key={friend.user_id} className="active-item" onClick={() => navigate(`/profile/${friend.username}`)}>
                  <div className="avatar-wrapper">
                    <img src={friend.avatar_url || '/uploads/avatars/default.png'} alt="" />
                    <div className="status-dot"></div>
                  </div>
                  <span className="name">{friend?.name ? friend.name.split(' ')[0] : (friend?.username || 'User')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="conversation-list">
            {inboxTab === 'archived' ? (
              <div className="archived-pane p-4 animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => setInboxTab('all')} className="text-[#8696a0] hover:text-white">
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  <h3 className="text-white font-bold">Archived Chats</h3>
                </div>
                {conversations.filter(c => c.is_archived).length > 0 ? (
                   conversations.filter(c => c.is_archived).map(chat => (
                    <div key={chat.chat_id} className="chat-item" onClick={() => setSelectedChat(chat)}>
                       <img src={chat.partner_avatar || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-full" alt="" />
                       <div className="flex-1 min-w-0">
                         <div className="text-white font-bold text-sm truncate">{chat.partner_name}</div>
                         <div className="text-[#8696a0] text-xs truncate slashed-zero italic">archived</div>
                       </div>
                    </div>
                   ))
                ) : (
                  <div className="text-center py-10 text-[#8696a0]">
                    <i className="fas fa-archive text-3xl mb-3 block opacity-20"></i>
                    <p className="text-sm font-medium">No archived messages</p>
                  </div>
                )}
              </div>
            ) : inboxTab === 'settings' ? (
              <div className="settings-sidebar-pane animate-fade-in flex flex-col h-full bg-[#111b21] overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b border-white/5 bg-[#202c33]/80 backdrop-blur-xl">
                   <div className="flex items-center gap-4">
                     <button onClick={() => setInboxTab('all')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-[#8696a0] hover:text-[#00a884] hover:bg-[#00a884]/10 transition-all">
                       <i className="fas fa-arrow-left"></i>
                     </button>
                     <h3 className="text-white font-black text-xl tracking-tight">Settings</h3>
                   </div>
                   <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF3D6D] to-[#FF8E53] p-[1.5px] animate-pulse">
                      <div className="w-full h-full rounded-full bg-[#202c33] flex items-center justify-center text-[10px] text-white font-black italic">PRO</div>
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 sx-settings-scroll">
                    <div className="mx-4 my-6 p-6 rounded-3xl bg-gradient-to-br from-[#202c33] to-[#111b21] border border-white/5 flex items-center gap-5 hover:border-[#00a884]/30 cursor-pointer transition-all shadow-2xl group relative overflow-hidden" onClick={() => navigate('/settings')}>
                       <div className="absolute top-0 right-0 w-32 h-32 bg-[#00a884] opacity-[0.03] blur-3xl rotate-45 translate-x-10 -translate-y-10 group-hover:opacity-[0.08] transition-opacity"></div>
                       <div className="relative">
                         <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-[#00a884] via-[#00a884]/20 to-transparent group-hover:rotate-180 transition-transform duration-1000">
                           <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-full h-full rounded-full object-cover shadow-2xl" alt="" />
                         </div>
                         <div className="absolute bottom-1 right-1 w-6 h-6 bg-[#00a884] rounded-full border-4 border-[#1c2a32] flex items-center justify-center shadow-lg">
                            <i className="fas fa-pen text-[8px] text-[#111]"></i>
                         </div>
                       </div>
                       <div className="flex-1 min-w-0">
                          <h4 className="text-white font-black text-lg truncate tracking-tight">{user?.name}</h4>
                          <p className="text-[#8696a0] text-xs truncate opacity-70 font-medium">{user?.bio || 'Hey there! I am using Sparkle.'}</p>
                          <div className="flex mt-2 gap-1.5">
                             <span className="text-[9px] bg-[#00a884]/10 text-[#00a884] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Active</span>
                             <span className="text-[9px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">v3.0</span>
                          </div>
                       </div>
                    </div>

                    <div className="mt-8 px-4">
                       <div className="px-2 pb-4 text-[10px] text-[#00a884] font-black uppercase tracking-[0.25em] opacity-80 flex items-center gap-3">
                          <span>Account Core</span>
                          <div className="h-[1px] flex-1 bg-white/5"></div>
                       </div>
                       {[
                         { id: 'privacy', icon: 'fa-fingerprint', label: 'Identity & Privacy', sub: 'Biometrics, Stealth mode', color: '#00a884' },
                         { id: 'security', icon: 'fa-shield-heart', label: 'Vault Security', sub: 'Two-factor, Recovery keys', color: '#3b82f6' },
                         { id: 'cloud', icon: 'fa-cloud-meatball', label: 'Cloud Sync', sub: 'Backup, Multi-device', color: '#a855f7' }
                       ].map(item => (
                         <div key={item.id} className="p-4 rounded-2xl flex items-center gap-5 hover:bg-white/5 cursor-pointer transition-all group mb-1 border border-transparent hover:border-white/5" onClick={() => navigate('/settings')}>
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform relative overflow-hidden">
                               <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity" style={{ backgroundColor: item.color }}></div>
                               <i className={`fas ${item.icon} text-[#8696a0] group-hover:text-white transition-colors`}></i>
                            </div>
                            <div className="flex-1">
                               <div className="text-white text-sm font-black tracking-tight group-hover:text-[#00a884] transition-colors">{item.label}</div>
                               <div className="text-[#8696a0] text-[10px] font-bold opacity-60 group-hover:opacity-100">{item.sub}</div>
                            </div>
                            <i className="fas fa-chevron-right text-[#8696a0] text-[10px] opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
                         </div>
                       ))}
                    </div>

                    <div className="mt-10 px-4">
                       <div className="px-2 pb-4 text-[10px] text-[#00a884] font-black uppercase tracking-[0.25em] opacity-80 flex items-center gap-3">
                          <span>Visual Matrix</span>
                          <div className="h-[1px] flex-1 bg-white/5"></div>
                       </div>
                       
                       <div className="space-y-6 px-2 mt-4">
                          <div className="flex items-center justify-between group">
                             <div className="flex items-center gap-5">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:rotate-12 transition-transform shadow-inner">
                                   <i className="fas fa-magic text-[#8696a0] group-hover:text-[#00a884]"></i>
                                </div>
                                <span className="text-white text-sm font-black tracking-tight">App Interface</span>
                             </div>
                             <select value={appTheme} onChange={(e) => setAppTheme(e.target.value)} className="bg-[#1c2a32] text-[10px] text-white border border-white/5 py-2 px-4 rounded-xl font-black uppercase tracking-widest focus:ring-1 ring-[#00a884] cursor-pointer hover:bg-[#2a3942] transition-colors outline-none appearance-none">
                                <option value="wa-standard">Dark Onyx</option>
                                <option value="sparkle-pink">Sparkle Pink</option>
                                <option value="forest">Emerald Forest</option>
                                <option value="dusk">Dusk Blue</option>
                             </select>
                          </div>
                          
                          <div className="flex items-center justify-between group">
                             <div className="flex items-center gap-5">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-90 transition-transform  shadow-inner">
                                   <i className="fas fa-panorama text-[#8696a0] group-hover:text-[#00a884]"></i>
                                </div>
                                <span className="text-white text-sm font-black tracking-tight">Chat Backdrop</span>
                             </div>
                             <div className="flex gap-2.5 p-1 bg-white/5 rounded-xl border border-white/5">
                                {[
                                  'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png',
                                  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR63ZfXW9P66e0vFrQzR3zH8-hX-1zF0h-h7A&s',
                                  'https://i.pinimg.com/736x/8c/9d/ae/8c9dae88b8cc8b80b7e411b0e9f16812.jpg'
                                ].map((url, i) => (
                                  <button 
                                    key={i} 
                                    onClick={() => setChatWallpaper(url)}
                                    className={`w-8 h-8 rounded-lg border-2 transition-all relative overflow-hidden ${chatWallpaper === url ? 'border-[#00a884] scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'}`}
                                    style={{ background: `url(${url})`, backgroundSize: 'cover' }}
                                  >
                                    {chatWallpaper === url && <div className="absolute inset-0 bg-[#00a884]/20 flex items-center justify-center"><i className="fas fa-check text-[10px] text-white"></i></div>}
                                  </button>
                                ))}
                             </div>
                          </div>

                          <div className="flex items-center justify-between group">
                             <div className="flex items-center gap-5">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shadow-inner">
                                   <i className="fas fa-text-height text-[#8696a0]"></i>
                                </div>
                                <span className="text-white text-sm font-black tracking-tight">Typography</span>
                             </div>
                             <div className="px-4 py-2 rounded-xl bg-[#1c2a32] border border-white/5 text-[9px] text-[#00a884] font-black uppercase tracking-[0.3em]">Adaptive</div>
                          </div>
                       </div>
                    </div>

                    <div className="mt-12 px-4 mb-10">
                       <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-[#FF3D6D]/10 to-transparent border border-[#FF3D6D]/10 text-center relative overflow-hidden group">
                          <div className="absolute -top-10 -left-10 w-32 h-32 bg-[#FF3D6D] opacity-[0.05] blur-3xl rounded-full"></div>
                          <p className="text-[10px] text-[#FF3D6D] uppercase font-black tracking-[8px] mb-4 opacity-70">distributed by</p>
                          <div className="flex items-center justify-center gap-4 text-white font-black text-lg tracking-tighter transition-transform group-hover:scale-110 duration-500">
                             <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF3D6D] to-[#FF8E53] flex items-center justify-center shadow-[0_0_20px_rgba(255,61,109,0.4)]">
                                <i className="fas fa-sparkles text-xl text-white"></i>
                             </div>
                             <div className="text-left">
                                <div className="leading-none">SPARKLE</div>
                                <div className="text-[#8696a0] text-[10px] font-bold tracking-[0.4em]">LABORATORIES</div>
                             </div>
                          </div>
                          <div className="mt-8 flex items-center justify-center gap-6">
                             <div className="text-[9px] font-black text-[#8696a0] border-r border-white/10 pr-6">BUILD 2026.04</div>
                             <div className="text-[9px] font-black text-[#00a884] px-3 py-1 bg-[#00a884]/10 rounded-full">STABLE RELEASE</div>
                          </div>
                       </div>
                    </div>
                </div>
              </div>
            ) : loading ? (
              <div className="loader-box flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (()=>{
                const filtered = conversations.filter(c => {
                   if (inboxTab === 'unread') return c.unread_count > 0;
                   if (inboxTab === 'groups') return c.is_group;
                   return !c.is_archived;
                });
                
                if (filtered.length === 0) {
                    return (
                        <div className="empty-chat-list py-20 flex flex-col items-center justify-center text-center px-10">
                            <i className={`fas ${inboxTab === 'unread' ? 'fa-envelope-open' : inboxTab === 'groups' ? 'fa-users' : 'fa-comments'} text-4xl text-white/10 mb-5`}></i>
                            <p className="text-[#8696a0] text-sm font-medium">No {inboxTab === 'all' ? '' : inboxTab} conversations found</p>
                        </div>
                    );
                }

                return filtered.map(chat => (
                  <div 
                    key={chat.chat_id}
                    className={`chat-item ${selectedChat?.chat_id === chat.chat_id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedChat(chat);
                      navigate(`/messages?chat=${chat.chat_id}`);
                    }}
                  >
                    <div className="chat-avatar relative">
                      <img src={chat.partner_avatar || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-full object-cover" alt="" />
                      {chat.partner_online && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#3c3] border-2 border-white/10 rounded-full shadow-lg"></div>}
                    </div>
                    <div className="chat-info flex-1 min-w-0">
                      <div className="chat-meta flex justify-between items-center mb-1">
                        <span className="chat-name text-white font-bold text-sm truncate">{chat.partner_name}</span>
                        <span className={`chat-time text-[10px] font-bold ${chat.unread_count > 0 ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                          {safeTime(chat.last_message_time)}
                        </span>
                      </div>
                      <div className="chat-preview flex justify-between items-center">
                        <p className={`last-msg text-xs truncate leading-relaxed ${chat.unread_count > 0 ? 'text-white font-bold' : 'text-[#8696a0]'}`}>
                           {chat.last_message || 'Start a conversation'}
                        </p>
                        {chat.unread_count > 0 && <span className="unread-badge bg-[#00a884] text-[#111] text-[10px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 ml-2">{chat.unread_count}</span>}
                      </div>
                    </div>
                  </div>
                ));
            })()}
          </div>
        </aside>

        {/* CHAT MAIN */}
        <main className={`chat-main ${!selectedChat ? 'hidden-mobile empty' : ''}`}>
          {selectedChat ? (
            <div className="chat-content">
              <header className="chat-banner">
                <div className="banner-left">
                  <button className="mobile-back" onClick={() => setSelectedChat(null)}>
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <img src={selectedChat.partner_avatar || '/uploads/avatars/default.png'} alt="" className="banner-pfp" />
                  <div className="banner-identity">
                    <h3>{selectedChat.partner_name}</h3>
                    <span className={`status ${selectedChat.partner_online ? 'online' : ''}`}>
                      {partnerTyping ? 'Typing...' : (selectedChat.partner_online ? 'Active Now' : 'Offline')}
                    </span>
                  </div>
                </div>
                <div className="banner-actions">
                  <button className="icon-btn"><i className="fas fa-phone"></i></button>
                  <button className="icon-btn"><i className="fas fa-video"></i></button>
                  
                  {/* Group Admin Actions */}
                  {selectedChat.is_group && selectedChat.is_admin && (
                    <button className="icon-btn text-[#00a884] ml-2" title="Edit Group">
                      <i className="fas fa-user-gear"></i>
                    </button>
                  )}

                  <div className="relative">
                    <button className="icon-btn" onClick={() => setShowChatSettings(!showChatSettings)}>
                      <i className="fas fa-ellipsis-v"></i>
                    </button>
                    {showChatSettings && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-[#233138] rounded-xl shadow-2xl border border-white/10 z-[100] p-1">
                        <button 
                          className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-lg text-sm text-[#e9edef]"
                          onClick={() => {
                            const newDur = disappearingDuration === 24 ? 0 : 24;
                            socket?.emit('disappearing_messages', { chatId: selectedChat.chat_id, duration: newDur });
                            setShowChatSettings(false);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <i className="bi bi-clock-history text-[#8696a0]"></i>
                            <span>Disappearing Messages</span>
                          </div>
                          <span className="text-[10px] bg-[#00a884] px-1.5 py-0.5 rounded text-[#111] font-bold">
                            {disappearingDuration > 0 ? 'ON' : 'OFF'}
                          </span>
                        </button>
                        
                        {/* New Actions inspired by EJS */}
                        <button className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg text-sm text-[#e9edef]">
                            <i className="bi bi-info-circle text-[#8696a0]"></i>
                            <span>Contact Info</span>
                        </button>
                        <button className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg text-sm text-rose-400">
                            <i className="bi bi-trash text-rose-500"></i>
                            <span>Clear Chat</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </header>

              <div className="messages-container">
                <div className="message-list flex flex-col gap-1">
                  {messages.map((msg, i) => {
                    const isMe = msg.sender_id === (user?.id || user?.user_id);
                    const isActive = activeMessageId === msg.message_id;
                    
                    // Check if this is the start of a new message burst
                    const prevMsg = i > 0 ? messages[i - 1] : null;
                    const isFirstInBurst = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                    
                    // Check if next message is from same sender (to adjust spacing)
                    const nextMsg = i < messages.length - 1 ? messages[i + 1] : null;
                    const isLastInBurst = !nextMsg || nextMsg.sender_id !== msg.sender_id;

                    return (
                      <div 
                        key={msg.message_id || i} 
                        id={`msg-${msg.message_id}`}
                        className={`message-row ${isMe ? 'own' : 'partner'} ${isLastInBurst ? 'mb-2' : 'mb-0'}`}
                      >
                       <div className={`message-content-wrapper flex flex-col max-w-[85%] sm:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                        <div 
                          className={`message-bubble ${isFirstInBurst ? 'has-tail' : 'no-tail'} ${isActive ? 'ring-2 ring-white/20' : ''}`}
                          onClick={() => setActiveMessageId(isActive ? null : msg.message_id)}
                          style={{
                                borderTopRightRadius: isMe && !isFirstInBurst ? '12px' : undefined,
                                borderTopLeftRadius: !isMe && !isFirstInBurst ? '12px' : undefined,
                          }}
                        >
                          {msg.media_url && (
                            <div className="message-media mb-2 rounded-lg overflow-hidden border border-white/5">
                              {msg.media_type === 'video' ? (
                                <video src={msg.media_url} controls className="max-w-full h-auto max-h-[300px]" />
                              ) : msg.media_type === 'audio' ? (
                                <audio src={msg.media_url} controls className="w-full max-w-[250px]" />
                              ) : (
                                <img src={msg.media_url} className="max-w-full h-auto max-h-[300px] object-cover" alt="attachment" />
                              )}
                            </div>
                          )}
                          {(() => {
                            try {
                              const data = JSON.parse(msg.content);
                              if (data.type === 'marketplace_inquiry') {
                                const payload = data.payload;
                                return (
                                  <div className="marketplace-inquiry-bubble bg-[#2a3942] rounded-xl overflow-hidden border border-white/5 shadow-lg group-hover:scale-[1.02] transition-transform">
                                    {payload.image && (
                                      <div className="relative aspect-video">
                                        <img src={payload.image} className="w-full h-full object-cover" alt="" />
                                        <div className="absolute top-2 left-2 bg-[#FF3D6D] text-white text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider shadow-lg">
                                          Marketplace Offer
                                        </div>
                                      </div>
                                    )}
                                    <div className="p-4">
                                      <h4 className="text-white font-bold text-sm mb-1">{payload.title}</h4>
                                      <p className="text-[#FF3D6D] font-black text-xs mb-3">{payload.price}</p>
                                      <a href={payload.link} className="flex items-center justify-center gap-2 w-full py-2 bg-[#00a884] hover:bg-[#00c99e] text-[#111] rounded-lg font-black text-[10px] uppercase tracking-widest transition-all">
                                        View Item Details <i className="fas fa-external-link-alt"></i>
                                      </a>
                                    </div>
                                  </div>
                                );
                              }
                            } catch { /* Not JSON, render as text */ }
                            
                            return <div className="message-text break-words whitespace-pre-wrap">{msg.content}</div>;
                          })()}
                          <div className="msg-meta">
                            <span className="msg-time">
                              {safeTime(msg.created_at)}
                            </span>
                            {isMe && (
                              <span className="msg-status-wrap">
                                {msg.status === 'read' ? (
                                  <i className="bi bi-check-all msg-status read"></i>
                                ) : (
                                  <i className="bi bi-check-all msg-status"></i>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Action Drawer */}
                        {isActive && (
                          <div className={`message-actions flex gap-3 p-2 bg-[#233138] rounded-xl shadow-2xl border border-white/10 mt-1 animate-scale-in z-20`}>
                            <button className="icon-btn text-xs font-bold flex items-center gap-1 hover:text-[#00a884]"><i className="bi bi-reply"></i> Reply</button>
                            <button className="icon-btn text-xs font-bold flex items-center gap-1 hover:text-[#00a884]"><i className="bi bi-clipboard"></i> Copy</button>
                            {isMe && <button className="icon-btn text-xs font-bold flex items-center gap-1 hover:text-rose-500"><i className="bi bi-trash"></i> Delete</button>}
                          </div>
                        )}
                       </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* FULL ATTACHMENT MENU */}
              {showAttachmentMenu && (
                 <div className="absolute bottom-[80px] left-[15px] md:left-auto md:right-[20px] bg-transparent z-[9010] w-full max-w-[280px] origin-bottom-left md:origin-bottom-right">
                    <div className="bg-[#233138] rounded-2xl p-5 shadow-2xl grid grid-cols-3 gap-y-6 gap-x-4">
                        <div className="flex flex-col items-center cursor-pointer transition-transform hover:scale-110">
                            <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-[#0A9BE2] to-[#0CB2F7] flex justify-center items-center shadow-lg"><i className="bi bi-image text-white text-xl"></i></div>
                            <span className="text-[11px] mt-2 text-[#d1d7db]">Gallery</span>
                        </div>
                        <div className="flex flex-col items-center cursor-pointer transition-transform hover:scale-110">
                            <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-[#D3396D] to-[#E53F77] flex justify-center items-center shadow-lg"><i className="bi bi-camera text-white text-xl"></i></div>
                            <span className="text-[11px] mt-2 text-[#d1d7db]">Camera</span>
                        </div>
                        <div className="flex flex-col items-center cursor-pointer transition-transform hover:scale-110">
                            <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-[#0BA360] to-[#17BE71] flex justify-center items-center shadow-lg"><i className="bi bi-geo-alt text-white text-xl"></i></div>
                            <span className="text-[11px] mt-2 text-[#d1d7db]">Location</span>
                        </div>
                        <div className="flex flex-col items-center cursor-pointer transition-transform hover:scale-110">
                            <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-[#BF59CF] to-[#9F34CC] flex justify-center items-center shadow-lg"><i className="bi bi-file-earmark-text text-white text-xl"></i></div>
                            <span className="text-[11px] mt-2 text-[#d1d7db]">Document</span>
                        </div>
                        <div className="flex flex-col items-center cursor-pointer transition-transform hover:scale-110">
                            <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-[#E65A4B] to-[#F56B5A] flex justify-center items-center shadow-lg"><i className="bi bi-headphones text-white text-xl"></i></div>
                            <span className="text-[11px] mt-2 text-[#d1d7db]">Audio</span>
                        </div>
                        <div className="flex flex-col items-center cursor-pointer transition-transform hover:scale-110">
                            <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-[#5157AE] to-[#5F66CD] flex justify-center items-center shadow-lg"><i className="bi bi-person-fill-add text-white text-xl"></i></div>
                            <span className="text-[11px] mt-2 text-[#d1d7db]">Follower</span>
                        </div>
                    </div>
                </div>
              )}

              <footer className="chat-composer">
                <div className="wa-composer-outer">
                   <div className="wa-composer-wrapper">
                      <button className="composer-action-btn">
                        <i className="bi bi-emoji-smile"></i>
                      </button>
                      <button 
                        onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                        className="composer-action-btn"
                      >
                        <i className="bi bi-plus-lg"></i>
                      </button>
                      
                      {isRecordingVoice ? (
                        <div className="voice-overlay">
                           <span className="text-red-500 animate-pulse">Recording {formatTime(voiceRecordTime)}</span>
                           <button onClick={cancelVoiceNote} className="text-red-500 ml-4">Cancel</button>
                           <button onClick={confirmVoiceNote} className="text-green-500 ml-4">Send</button>
                        </div>
                      ) : (
                        <textarea 
                          placeholder="Type a message" 
                          rows={1}
                          value={newMessage}
                          onChange={handleTyping}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          className="composer-input"
                        ></textarea>
                      )}
                   </div>

                   <button 
                      className="main-action-btn"
                      onClick={() => handleSendMessage()}
                   >
                      {newMessage.trim() ? <i className="bi bi-send-fill"></i> : <i className="bi bi-mic-fill"></i>}
                   </button>
                </div>
              </footer>
            </div>
          ) : (
            <div className="chat-empty-state">
              <h2>Select a Chat</h2>
              <p>Choose a conversation from the sidebar to start chatting.</p>
            </div>
          )}
          
        </main>
      </div>

      <NewChatModal 
        isOpen={showNewChatModal} 
        onClose={() => setShowNewChatModal(false)}
        defaultTab={newChatTab as 'new' | 'groups'}
        onChatSelected={(chatId) => {
           setShowNewChatModal(false);
           navigate(`/messages?chat=${chatId}`);
        }}
      />

      <style>{`
        :root {
          --chat-bg: ${
            appTheme === 'sparkle-pink' ? '#1a0b10' : 
            appTheme === 'forest' ? '#0b1a15' : 
            appTheme === 'dusk' ? '#0b0e14' : 
            '#0b141a'
          };
          --chat-sidebar: ${
            appTheme === 'sparkle-pink' ? '#25161c' : 
            appTheme === 'forest' ? '#12211c' : 
            appTheme === 'dusk' ? '#111b21' : 
            '#111b21'
          };
          --chat-sidebar-hover: #202c33;
          --chat-sidebar-active: #2a3942;
          --banner-bg: #202c33;
          --composer-bg: #202c33;
          --bubble-own: ${
            appTheme === 'sparkle-pink' ? '#FF3D6D' : 
            appTheme === 'forest' ? '#004a3c' : 
            appTheme === 'dusk' ? '#1e293b' : 
            '#005c4b'
          };
          --bubble-partner: #202c33;
          --bubble-text: #e9edef;
          --meta-text: #8696a0;
          --accent-green: ${
            appTheme === 'sparkle-pink' ? '#FF3D6D' : 
            '#00a884'
          };
        }

        .messages-page { 
          background: ${
            appTheme === 'sparkle-pink' ? '#1a0b10' : 
            appTheme === 'forest' ? '#0b1a15' : 
            appTheme === 'dusk' ? '#0b0e14' : 
            '#0b141a'
          }; 
          height: 100vh; 
          display: flex; 
          flex-direction: row; /* Fixed: Should be row to accommodate sidebar */
          width: 100%;
          overflow: hidden;
          transition: background 0.5s ease;
        }

        .messaging-layout { 
          display: flex; 
          flex: 1;
          height: 100vh;
          overflow: hidden; 
          position: relative;
        }

        /* --- SIDEBAR --- */
        .conversation-sidebar { 
          width: 380px; 
          background: var(--chat-sidebar); 
          border-right: 1px solid rgba(255,255,255,0.05); 
          display: flex; 
          flex-direction: column; 
          transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .sidebar-header { padding: 20px 15px; color: #fff; }
        .sidebar-header h1 { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 800; }
        
        .search-box { 
          background: var(--chat-sidebar-hover); 
          border-radius: 12px; 
          padding: 10px 15px; 
          display: flex; 
          align-items: center; 
          gap: 12px; 
          margin: 15px 0;
          border: 1px solid transparent;
          transition: 0.2s;
        }
        .search-box:focus-within { border-color: var(--accent-green); }
        .search-box input { background: transparent; border: none; color: #fff; outline: none; flex: 1; font-size: 0.9rem; }
        .search-box i { color: var(--meta-text); }

        .inbox-tabs { display: flex; gap: 8px; margin-bottom: 15px; overflow-x: auto; padding-bottom: 5px; scrollbar-width: none; }
        .inbox-tab { 
          padding: 6px 14px; 
          border-radius: 20px; 
          background: var(--chat-sidebar-hover); 
          color: var(--meta-text); 
          font-size: 12px; 
          font-weight: 700; 
          border: none; 
          cursor: pointer;
          white-space: nowrap;
          transition: 0.2s;
        }
        .inbox-tab.active { background: var(--accent-green); color: #111; }

        .active-friends-section { padding: 0 15px 15px; }
        .active-carousel { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 10px; scrollbar-width: none; }
        .active-item { cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .avatar-wrapper { position: relative; width: 48px; height: 48px; }
        .avatar-wrapper img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-green); padding: 2px; }
        .status-dot { position: absolute; bottom: 1px; right: 1px; width: 12px; height: 12px; background: #3c3; border: 2px solid var(--chat-sidebar); border-radius: 50%; }
        .active-item .name { font-size: 10px; font-weight: 700; color: #fff; max-width: 50px; text-align: center; overflow: hidden; text-overflow: ellipsis; }

        .conversation-list { flex: 1; overflow-y: auto; }
        .chat-item { 
          padding: 12px 15px; 
          display: flex; 
          gap: 15px; 
          cursor: pointer; 
          transition: background 0.2s;
          border-bottom: 1px solid rgba(255,255,255,0.02);
        }
        .chat-item:hover { background: var(--chat-sidebar-hover); }
        .chat-item.active { background: var(--chat-sidebar-active); }
        .chat-avatar { position: relative; flex-shrink: 0; }
        .chat-avatar img { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; }
        .chat-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
        .chat-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .chat-name { color: #fff; font-weight: 700; font-size: 0.95rem; }
        .chat-time { font-size: 11px; color: var(--meta-text); font-weight: 600; }
        .chat-preview { display: flex; justify-content: space-between; align-items: center; }
        .last-msg { color: var(--meta-text); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
        .unread-badge { background: var(--accent-green); color: #111; font-size: 10px; font-weight: 800; min-width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 10px; padding: 0 5px; }

        /* --- CHAT MAIN --- */
        .chat-main { 
          flex: 1; 
          background: var(--chat-bg); 
          position: relative; 
          display: flex; 
          flex-direction: column;
          background-image: url('${chatWallpaper}');
          background-blend-mode: overlay;
          background-size: 400px;
        }
        
        .chat-empty-state {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px;
          color: var(--meta-text);
          border-bottom: 6px solid var(--accent-green);
        }
        .chat-empty-state h2 { font-family: 'Outfit'; font-size: 2rem; color: #fff; margin-bottom: 10px; }

        .chat-content {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          position: relative;
        }

        .chat-banner { 
          height: 60px; 
          background: var(--banner-bg); 
          display: flex; 
          align-items: center; 
          justify-content: space-between;
          padding: 0 15px; 
          color: #e9edef; 
          z-index: 10;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          border-left: 1px solid rgba(255,255,255,0.05);
        }
        .banner-left { display: flex; align-items: center; gap: 12px; }
        .banner-pfp { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .banner-identity h3 { font-size: 1rem; font-weight: 700; margin: 0; }
        .banner-identity .status { font-size: 11px; color: var(--meta-text); }
        .banner-identity .status.online { color: var(--accent-green); font-weight: 700; }
        .banner-actions { display: flex; gap: 15px; color: var(--meta-text); }
        .icon-btn { cursor: pointer; transition: 0.2s; font-size: 1.1rem; }
        .icon-btn:hover { color: #fff; }

        .messages-container { 
          flex: 1; 
          overflow-y: auto; 
          padding: 20px 5% 40px;
          display: flex;
          flex-direction: column;
          gap: 4px; /* Tight gap for consecutive messages */
        }

        .message-row { display: flex; width: 100%; }
        .message-row.own { justify-content: flex-end; }
        .message-row.partner { justify-content: flex-start; }

        .message-bubble { 
          padding: 6px 10px 8px 12px; 
          border-radius: 12px; 
          color: var(--bubble-text); 
          font-size: 0.95rem;
          position: relative;
          max-width: fit-content;
          box-shadow: 0 1px 1px rgba(0,0,0,0.15);
          background: var(--bubble-partner); /* Individual default background */
        }
        
        .own .message-bubble { 
          background: var(--bubble-own); 
        }

        .own .message-bubble.has-tail { 
          border-top-right-radius: 0;
        }
        .partner .message-bubble.has-tail { 
          border-top-left-radius: 0;
        }

        /* Bubble Tails - Only on has-tail */
        .own .message-bubble.has-tail::after {
          content: "";
          position: absolute;
          top: 0;
          right: -8px;
          width: 0;
          height: 0;
          border: 10px solid transparent;
          border-left-color: var(--bubble-own);
          border-top-width: 0;
          border-right-width: 0;
        }
        .partner .message-bubble.has-tail::after {
          content: "";
          position: absolute;
          top: 0;
          left: -8px;
          width: 0;
          height: 0;
          border: 10px solid transparent;
          border-right-color: var(--bubble-partner);
          border-top-width: 0;
          border-left-width: 0;
        }
        
        .message-bubble.no-tail::after { display: none; }

        .message-text { line-height: 1.4; }
        .msg-meta { 
          display: flex; 
          align-items: center; 
          justify-content: flex-end; 
          gap: 5px; 
          margin-top: 2px;
          height: 15px;
        }
        .msg-time { font-size: 10px; color: var(--meta-text); font-weight: 500; font-variant-numeric: tabular-nums; }
        .msg-status { font-size: 14px; color: var(--meta-text); }
        .msg-status.read { color: #53bdeb; }

        /* --- COMPOSER --- */
        .chat-composer { 
          background: var(--banner-bg); 
          padding: 10px 15px; 
          z-index: 10;
          padding-bottom: env(safe-area-inset-bottom, 10px);
        }
        .wa-composer-outer { display: flex; gap: 8px; align-items: flex-end; }
        .wa-composer-wrapper { 
          flex: 1; 
          background: #2a3942; 
          border-radius: 24px; 
          display: flex; 
          align-items: flex-end; 
          padding: 6px 12px; 
          min-height: 44px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .composer-input { 
          flex: 1; 
          background: transparent; 
          border: none; 
          color: #fff; 
          padding: 5px 10px; 
          outline: none; 
          resize: none; 
          font-family: inherit;
          font-size: 0.95rem;
          line-height: 1.4;
          max-height: 150px;
        }
        .composer-action-btn { color: var(--meta-text); font-size: 1.4rem; cursor: pointer; transition: 0.2s; }
        .composer-action-btn:hover { color: #fff; }
        
        .main-action-btn { 
          width: 48px; 
          height: 48px; 
          border-radius: 50%; 
          background: var(--accent-green); 
          border: none; 
          color: #111; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          cursor: pointer;
          flex-shrink: 0;
          transition: 0.2s;
        }
        .main-action-btn:hover { transform: scale(1.05); }
        .main-action-btn i { font-size: 1.3rem; }

        /* Mobile Adjustments */
        @media (max-width: 768px) {
          .conversation-sidebar { width: 100%; }
          .conversation-sidebar.hidden-mobile { display: none; }
          .chat-main.hidden-mobile { display: none; }
          .chat-main { border-left: none; position: fixed; inset: 0; z-index: 2000; background: var(--chat-bg); }
          .messages-container { padding-left: 10px; padding-right: 10px; }
          .messaging-layout { overflow: visible; }
        }

        .online-indicator { 
          position: absolute; 
          bottom: 2px; 
          right: 2px; 
          width: 14px; 
          height: 14px; 
          background: #3c3; 
          border: 2px solid var(--chat-sidebar); 
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(51, 204, 51, 0.4);
          animation: onlinePulse 2s infinite;
        }
        @keyframes onlinePulse {
          0% { box-shadow: 0 0 0 0px rgba(51, 204, 51, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(51, 204, 51, 0); }
          100% { box-shadow: 0 0 0 0px rgba(51, 204, 51, 0); }
        }

        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        .global-modal-overlay { position: fixed; inset: 0; background: rgba(11, 20, 26, 0.9); backdrop-filter: blur(8px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .global-modal-content { width: 100%; max-width: 500px; max-height: 90vh; position: relative; overflow-y: auto; background: #233138; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
      `}</style>

    </div>
  );
}
