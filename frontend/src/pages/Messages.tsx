import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { useSocket } from '../hooks/useSocket';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  ShoppingBag
} from 'lucide-react';
import { getAvatarUrl } from '../utils/imageUtils';

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

export default function Messages() {
  const { user } = useUserStore();
  const socket = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetChatId = searchParams.get('chat');

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [inboxTab, setInboxTab] = useState('all');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [suggestedContacts, setSuggestedContacts] = useState<any[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitTyping = useMemo(
    () => debounce((chatId: string, isTyping: boolean) => {
        if (socket) {
            socket.emit('typing', { chatId, isTyping });
        }
    }, 500),
    [socket]
  );

  const formatMessageText = (content?: string) => {
    if (!content) return '';
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'marketplace_inquiry') {
        return `🛒 Inquiry: ${parsed.payload?.title || 'Item'}`;
      }
    } catch(e) { /* not json */ }
    return content;
  };

  const openNewChat = async () => {
    setShowNewChatModal(true);
    try {
      const res = await api.get('/users/suggestions');
      const data = res?.data?.suggestions || res?.data?.users || res?.data || [];
      if (Array.isArray(data)) {
        setSuggestedContacts(data);
      }
    } catch (err) {
      console.error('Failed to load contacts', err);
    }
  };

  const startNewChat = (contact: any) => {
    const existing = conversations.find(c => c.partner_id === contact.user_id);
    if (existing) {
      setSelectedChat(existing);
    } else {
      setSelectedChat({
        chat_id: 'new_' + contact.user_id,
        partner_id: contact.user_id,
        partner_name: contact.name || contact.username,
        partner_avatar: contact.avatar_url,
        unread_count: 0,
        last_message_time: new Date().toISOString(),
        last_message: ''
      });
    }
    setShowNewChatModal(false);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fetchInbox = useCallback(async () => {
    try {
      const inboxRes = await api.get('/messages/inbox');
      if (inboxRes?.data?.status === 'success') {
        setConversations(inboxRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch inbox:', err);
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

    if (selectedChat.unread_count > 0) {
        setConversations(prev => prev.map(c => 
          c.chat_id === selectedChat.chat_id ? { ...c, unread_count: 0 } : c
        ));
    }
  }, [selectedChat?.chat_id, selectedChat?.unread_count]);

  useEffect(() => {
    if (messages.length > 0) {
        scrollToBottom('smooth');
    }
  }, [messages.length]);

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

    return () => {
      socket.off('new-message');
      socket.off('user-typing');
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
      socket.emit('send-message', messageData, () => {
        setSending(false);
      });
    } else {
      try {
        await api.post('/messages/send', messageData);
      } catch (err) {
        console.error('Failed to send:', err);
      } finally {
        setSending(false);
      }
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (selectedChat) {
      emitTyping(selectedChat.chat_id, e.target.value.length > 0);
    }
  };

  const safeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex bg-[#fdf2f4] h-screen overflow-hidden text-black font-sans">
      <Navbar />
      
      <div className="flex-1 flex lg:ml-72 relative h-full overflow-hidden pt-18 lg:pt-0">
        {/* SIDEBAR */}
        <aside className={`w-full lg:w-[420px] bg-white/40 backdrop-blur-3xl border-r border-white flex flex-col transition-all duration-700 min-h-0 ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
          <header className="p-8 pb-6">
             <div className="flex items-center justify-between mb-10">
               <div>
                  <h1 className="text-4xl font-black text-black tracking-tight italic">Messages</h1>
                  <p className="text-[11px] font-bold text-black/20 uppercase tracking-[0.2em] mt-2">Direct Messages</p>
               </div>
               <button 
                onClick={openNewChat}
                className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
               >
                 <Plus size={20} strokeWidth={3} />
               </button>
             </div>

             <div className="relative mb-8 group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-black/20 group-focus-within:text-primary transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Search messages..." 
                  className="w-full h-14 bg-white/60 border border-white rounded-[20px] pl-16 pr-6 text-sm font-bold text-black placeholder:text-black/10 focus:bg-white focus:border-primary transition-all outline-none shadow-sm"
                />
             </div>

             <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {['all', 'direct', 'clubs', 'archived'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setInboxTab(tab)}
                    className={`px-6 py-2 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all whitespace-nowrap italic ${inboxTab === tab ? 'bg-primary text-white shadow-lg' : 'bg-white/40 text-black/30 hover:bg-white/60'}`}
                  >
                    {tab}
                  </button>
                ))}
             </div>
          </header>

          <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-3 no-scrollbar scroll-smooth">
            {conversations.length === 0 && !loading ? (
              <div className="py-20 text-center animate-fade-in px-8 flex flex-col items-center bg-white/30 border border-white rounded-[40px] shadow-inner">
                <Orbit size={80} strokeWidth={1} className="text-black/5" />
                <h3 className="text-xl font-bold text-black/10 italic mt-4 uppercase">No Messages.</h3>
                <p className="text-[10px] font-bold text-black/10 mt-2 max-w-[180px] leading-relaxed uppercase tracking-wider">Start a chat to see it here.</p>
              </div>
            ) : (
              conversations.map(chat => (
                <div 
                  key={chat.chat_id}
                  onClick={() => setSelectedChat(chat)}
                  className={`p-5 rounded-[28px] transition-all duration-500 cursor-pointer group flex items-center gap-5 border ${selectedChat?.chat_id === chat.chat_id ? 'bg-white border-primary shadow-xl scale-[1.02]' : 'bg-white/40 border-white hover:bg-white/60 hover:scale-[1.01]'}`}
                >
                  <div className="relative shrink-0">
                    <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-14 h-14 rounded-[20px] object-cover border border-white shadow-sm" alt="" />
                    {chat.partner_online && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                       <h4 className="font-black text-black text-base tracking-tight truncate leading-none italic uppercase group-hover:text-primary transition-colors">{chat.partner_name}</h4>
                       <span className="text-[9px] font-black text-black/20 uppercase tracking-widest">{safeTime(chat.last_message_time)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className={`text-[12px] font-medium truncate italic ${chat.unread_count > 0 ? 'text-black' : 'text-black/30'}`}>
                        {chat.last_message ? formatMessageText(chat.last_message) : 'No messages yet...'}
                      </p>
                      {chat.unread_count > 0 && (
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-[9px] font-black shadow-lg">
                           {chat.unread_count}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* CHAT MAIN */}
        <main className={`flex-1 flex flex-col transition-all duration-700 relative z-10 ${!selectedChat ? 'hidden lg:flex' : 'flex'} bg-white/20`}>
          {selectedChat ? (
            <>
              <header className="h-[90px] bg-white/60 backdrop-blur-3xl border-b border-white px-8 flex items-center justify-between z-20 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-5 relative z-10">
                  <button onClick={() => setSelectedChat(null)} className="lg:hidden text-black/20 hover:text-black transition-colors p-2">
                    <ArrowLeft size={20} strokeWidth={3} />
                  </button>
                  <div className="relative group cursor-pointer" onClick={() => navigate(`/profile/${selectedChat.partner_name}`)}>
                    <img src={getAvatarUrl(selectedChat.partner_avatar, selectedChat.partner_name)} className="w-12 h-12 rounded-[18px] object-cover border border-white shadow-sm group-hover:scale-110 transition-transform" alt="" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-black tracking-tight italic leading-none group-hover:text-primary transition-colors cursor-pointer uppercase" onClick={() => navigate(`/profile/${selectedChat.partner_name}`)}>{selectedChat.partner_name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 px-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${partnerTyping ? 'bg-primary' : (selectedChat.partner_online ? 'bg-emerald-500' : 'bg-black/10')} animate-pulse`}></div>
                        <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest leading-none">{partnerTyping ? 'Typing...' : (selectedChat.partner_online ? 'Online' : 'Offline')}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 relative z-10">
                  <button className="hidden sm:flex w-11 h-11 rounded-xl bg-white/60 border border-white items-center justify-center text-black/20 hover:text-primary transition-all active:scale-95 shadow-sm"><Phone size={18} strokeWidth={3} /></button>
                  <button className="hidden sm:flex w-11 h-11 rounded-xl bg-white/60 border border-white items-center justify-center text-black/20 hover:text-primary transition-all active:scale-95 shadow-sm"><Video size={18} strokeWidth={3} /></button>
                  <div className="relative">
                    <button onClick={() => setShowChatSettings(!showChatSettings)} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm border ${showChatSettings ? 'bg-primary text-white border-primary shadow-primary/20' : 'bg-white/60 border-white text-black/20 hover:text-black'}`}><MoreVertical size={18} strokeWidth={3} /></button>
                    {showChatSettings && (
                      <div className="absolute right-0 top-full mt-4 w-64 bg-white/95 backdrop-blur-3xl border border-white rounded-[32px] shadow-2xl z-50 p-4 animate-scale-in">
                        <button className="w-full flex items-center gap-4 p-4 hover:bg-primary hover:text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all group italic"><Info size={18} strokeWidth={3} /> Contact Profile</button>
                        <button className="w-full flex items-center gap-4 p-4 hover:bg-black hover:text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all group italic"><Archive size={18} strokeWidth={3} /> Archive Chat</button>
                        <div className="my-2 h-px w-full bg-black/5 mx-2"></div>
                        <button className="w-full flex items-center gap-4 p-4 hover:bg-red-500 hover:text-white rounded-2xl text-[10px] font-bold text-red-500 uppercase tracking-widest transition-all group italic"><Trash2 size={18} strokeWidth={3} /> Delete Chat</button>
                      </div>
                    )}
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 no-scrollbar scroll-smooth relative z-10">
                <div className="flex flex-col gap-6">
                  {messages.map((msg, i) => {
                    const isMe = msg.sender_id === (user?.id || user?.user_id);

                    return (
                      <div key={msg.message_id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        <div className={`max-w-[80%] md:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`px-6 py-4 rounded-[20px] md:rounded-[28px] text-md font-bold leading-relaxed shadow-sm transition-all duration-500 relative overflow-hidden group border ${isMe ? 'bg-primary text-white border-primary rounded-tr-none' : 'bg-white/80 backdrop-blur-xl text-black border-white rounded-tl-none'}`}>
                            {(() => {
                               const content = msg.content;
                               try {
                                 const parsed = JSON.parse(content);
                                 if (parsed.type === 'marketplace_inquiry') {
                                   return (
                                     <div className="flex flex-col gap-3 min-w-[200px]">
                                       <div className="flex items-center gap-2 mb-2 font-black italic text-sm opacity-90">
                                         <ShoppingBag size={16} strokeWidth={3} />
                                         <span>Marketplace Inquiry</span>
                                       </div>
                                       {parsed.payload?.image && <img src={parsed.payload.image} className="w-full h-32 object-cover rounded-[14px]" />}
                                       <h4 className="font-black leading-tight uppercase italic">{parsed.payload?.title}</h4>
                                       <p className="text-sm font-bold opacity-80">{parsed.payload?.price}</p>
                                       {parsed.payload?.link && <a href={parsed.payload.link} target="_blank" rel="noreferrer" className="mt-2 text-[10px] uppercase tracking-widest font-black underline opacity-70 hover:opacity-100">View Listing</a>}
                                     </div>
                                   );
                                 }
                               } catch(e) {}
                               return <p className="whitespace-pre-wrap">{content}</p>;
                            })()}
                            <div className={`flex items-center gap-2 mt-3 opacity-60 text-[9px] font-bold uppercase tracking-widest italic ${isMe ? 'justify-end text-white' : 'justify-start text-black/20'}`}>
                              {safeTime(msg.created_at)}
                              {isMe && (msg.status === 'read' ? <CheckCircle2 size={10} strokeWidth={4} /> : <Check size={10} strokeWidth={4} />)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <footer className="p-6 bg-white/60 backdrop-blur-3xl border-t border-white z-20 shadow-inner">
                <form onSubmit={handleSendMessage} className="flex items-center gap-4 max-w-[900px] mx-auto relative px-2">
                  <div className="relative">
                    <button 
                      type="button"
                      onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                      className={`w-14 h-14 rounded-[22px] flex items-center justify-center transition-all duration-500 shadow-sm border ${showAttachmentMenu ? 'bg-black text-white rotate-45 border-black shadow-xl' : 'bg-white border-white text-black/20 hover:text-black hover:border-black/5'}`}
                    >
                      <Paperclip size={22} strokeWidth={3} />
                    </button>
                    {showAttachmentMenu && (
                      <div className="absolute bottom-full left-0 mb-6 bg-white/95 backdrop-blur-3xl border border-white rounded-[32px] shadow-2xl p-4 flex flex-col gap-2 w-64 animate-scale-in">
                        {[
                          { icon: ImageIcon, label: 'Photos', color: 'text-primary' },
                          { icon: FileText, label: 'Files', color: 'text-black' },
                          { icon: MapPin, label: 'Location', color: 'text-black/30' },
                        ].map(item => (
                          <button key={item.label} className="flex items-center gap-4 p-3.5 hover:bg-primary/5 rounded-2xl transition-all group italic">
                            <div className={`w-10 h-10 bg-black/5 ${item.color} rounded-xl flex items-center justify-center transition-all duration-700`}><item.icon size={18} strokeWidth={3} /></div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-black/50 group-hover:text-black">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 relative group bg-white/60 border border-white rounded-[24px] focus-within:bg-white focus-within:border-primary transition-all shadow-sm">
                    <textarea 
                      value={newMessage}
                      onChange={handleTyping}
                      placeholder="Write a message..."
                      className="w-full bg-transparent py-4 pl-8 pr-16 text-base font-bold text-black placeholder:text-black/10 outline-none resize-none h-[56px] no-scrollbar leading-tight italic"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <button type="button" className="absolute right-6 top-1/2 -translate-y-1/2 text-black/5 hover:text-primary transition-colors">
                      <Smile size={22} strokeWidth={3} />
                    </button>
                  </div>

                  <button 
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className={`w-14 h-14 rounded-[22px] flex items-center justify-center transition-all duration-500 ${newMessage.trim() ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105 active:scale-95 border border-primary' : 'bg-white border-white text-black/5'}`}
                  >
                    <Send size={22} strokeWidth={3} />
                  </button>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-transparent relative overflow-hidden group">
              <Orbit size={120} strokeWidth={1} className="text-black/5 animate-spin-slow mb-12" />
              <h2 className="text-5xl font-black text-black mb-4 tracking-tighter italic uppercase underline decoration-primary/20 decoration-8 underline-offset-8">Messages</h2>
              <p className="text-black font-medium opacity-30 max-w-sm uppercase tracking-widest text-[11px]">Select a contact to start chatting.</p>
              
              <button 
                onClick={openNewChat}
                className="mt-12 flex items-center gap-3 px-10 py-5 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all italic group"
              >
                <Plus size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" /> New Message
              </button>
            </div>
          )}
        </main>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
         <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex justify-center pt-20 px-4" onClick={() => setShowNewChatModal(false)}>
            <div className="bg-white rounded-[32px] w-full max-w-md h-[70vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
               <div className="p-6 border-b border-black/[0.05] flex justify-between items-center bg-[#fdf2f4]">
                 <h2 className="text-xl font-black uppercase italic tracking-tighter">New Message</h2>
                 <button onClick={() => setShowNewChatModal(false)} className="w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-all"><X size={20} strokeWidth={3} /></button>
               </div>
               <div className="p-4 border-b border-black/[0.05]">
                 <div className="relative bg-black/5 rounded-2xl flex items-center px-4 h-12 focus-within:bg-white focus-within:border focus-within:border-primary transition-all">
                   <Search size={18} className="text-black/30" strokeWidth={3} />
                   <input type="text" placeholder="Search users..." className="bg-transparent w-full h-full outline-none ml-3 font-bold text-sm placeholder:text-black/20 italic" />
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                 {suggestedContacts.map(contact => (
                    <div key={contact.user_id} onClick={() => startNewChat(contact)} className="flex items-center gap-4 p-4 hover:bg-black/5 rounded-2xl cursor-pointer transition-all active:scale-[0.98]">
                       <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-12 h-12 rounded-xl object-cover border border-black/5 shadow-sm" />
                       <div>
                         <h4 className="font-black italic uppercase text-sm leading-none">{contact.name || contact.username}</h4>
                         <p className="text-[10px] text-black/40 font-bold uppercase tracking-widest mt-1">@{contact.username}</p>
                       </div>
                    </div>
                 ))}
                 {suggestedContacts.length === 0 && (
                    <div className="p-10 text-center opacity-40 font-bold uppercase text-[10px] tracking-widest italic animate-pulse">Loading contacts...</div>
                 )}
               </div>
            </div>
         </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
