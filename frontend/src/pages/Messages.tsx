import { useState, useEffect, useRef } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { useSocket } from '../hooks/useSocket';

export default function Messages() {
  const { user } = useUserStore();
  const socket = useSocket();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time Listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('receive_message', (data: any) => {
      // If message is for currently open chat
      if (selectedChat?.chat_id === data.chat_id) {
        setMessages(prev => [...prev, data]);
      }
      
      // Update sidebar
      setConversations(prev => prev.map(c => 
        c.chat_id === data.chat_id 
        ? { 
            ...c, 
            last_message: data.content, 
            last_message_time: data.created_at,
            unread_count: selectedChat?.chat_id === data.chat_id ? 0 : (c.unread_count || 0) + 1
          } 
        : c
      ));
    });

    socket.on('partner_typing', (data: any) => {
      if (selectedChat?.chat_id === data.chatId) {
        setPartnerTyping(true);
        setTimeout(() => setPartnerTyping(false), 3000);
      }
    });

    return () => {
      socket.off('receive_message');
      socket.off('partner_typing');
    };
  }, [socket, selectedChat]);

  // Typing event
  useEffect(() => {
    if (!socket || !selectedChat || !newMessage.trim()) return;
    socket.emit('typing', { chatId: selectedChat.chat_id, partnerId: selectedChat.partner_id });
  }, [newMessage, socket, selectedChat]);


  // Fetch Conversations
  useEffect(() => {
    const fetchInbox = async () => {
      try {
        const response = await api.get('/messages/inbox');
        if (response.data.status === 'success') {
          setConversations(response.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch inbox:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInbox();
  }, []);

  // Fetch Messages for Selected Chat
  useEffect(() => {
    if (!selectedChat) return;
    
    const fetchMessages = async () => {
      try {
        const response = await api.get(`/messages/chat/${selectedChat.chat_id}`);
        if (response.data.status === 'success') {
          setMessages(response.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };
    fetchMessages();

    // Reset unread count locally when selecting a chat
    setConversations(prev => prev.map(c => 
      c.chat_id === selectedChat.chat_id ? { ...c, unread_count: 0 } : c
    ));
  }, [selectedChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || sending) return;

    setSending(true);
    try {
      const response = await api.post('/messages/send', {
        chatId: selectedChat.chat_id,
        content: newMessage.trim(),
        type: 'text'
      });

      if (response.data.status === 'success') {
        const sentMsg = {
          message_id: response.data.data.messageId,
          content: newMessage.trim(),
          sender_id: user?.id || user?.user_id,
          created_at: new Date().toISOString(),
          status: 'sent'
        };
        setMessages(prev => [...prev, sentMsg]);
        setNewMessage('');
        
        // Update last message in sidebar
        setConversations(prev => prev.map(c => 
          c.chat_id === selectedChat.chat_id 
          ? { ...c, last_message: newMessage.trim(), last_message_time: new Date().toISOString() } 
          : c
        ));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 pb-8 overflow-hidden">
        <div className="h-full glass-panel border-white/60 shadow-2xl rounded-[40px] flex overflow-hidden">
          
          {/* Conversation Sidebar */}
          <aside className="w-full md:w-80 lg:w-96 border-r border-slate-100 flex flex-col bg-white/50">
            <div className="p-6 border-b border-slate-100">
               <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                 Transmissions
                 <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full">{conversations.filter(c => c.unread_count > 0).length}</span>
               </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-3xl">
                    <div className="w-12 h-12 bg-slate-200 rounded-2xl"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      <div className="h-2 bg-slate-200 rounded w-full"></div>
                    </div>
                  </div>
                ))
              ) : conversations.length > 0 ? (
                conversations.map(chat => (
                  <button 
                    key={chat.chat_id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all ${
                      selectedChat?.chat_id === chat.chat_id 
                      ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                      : 'hover:bg-white/80 text-slate-600'
                    }`}
                  >
                    <div className="relative">
                      <img 
                        src={chat.partner_avatar || '/uploads/avatars/default.png'} 
                        className="w-12 h-12 rounded-2xl object-cover shadow-sm bg-white" 
                        alt="" 
                      />
                      {chat.partner_online && (
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`font-bold truncate ${selectedChat?.chat_id === chat.chat_id ? 'text-white' : 'text-slate-800'}`}>
                          {chat.partner_name || 'Partner'}
                        </span>
                        <span className="text-[9px] uppercase font-black opacity-40">
                          {new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${selectedChat?.chat_id === chat.chat_id ? 'text-white/60' : 'text-slate-400'}`}>
                        {chat.last_message || 'Start transmission...'}
                      </p>
                    </div>
                    {chat.unread_count > 0 && selectedChat?.chat_id !== chat.chat_id && (
                      <div className="w-2 h-2 bg-indigo-600 rounded-full shadow-lg shadow-indigo-200"></div>
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-20">
                   <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No cosmic connections yet.</p>
                </div>
              )}
            </div>
          </aside>

          {/* Chat Window */}
          <section className="flex-1 flex flex-col bg-white">
            {selectedChat ? (
              <>
                {/* Header */}
                <header className="p-6 border-b border-slate-50 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <img src={selectedChat.partner_avatar || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-xl object-cover" alt="" />
                      <div>
                        <h3 className="font-black text-slate-800 tracking-tight">{selectedChat.partner_name}</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                          {partnerTyping ? 'Writing transmission...' : selectedChat.partner_online ? 'Pulse: Active' : 'Pulse: Adrift'}
                        </p>

                      </div>
                   </div>
                   <div className="flex gap-2">
                     <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all">📞</button>
                     <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all">⚙️</button>
                   </div>
                </header>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-8 space-y-4 bg-slate-50/30">
                  {messages.map((msg, idx) => {
                    const isMe = msg.sender_id === (user?.id || user?.user_id);
                    return (
                      <div key={msg.message_id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-5 py-3.5 rounded-3xl text-sm font-medium shadow-sm transition-all hover:shadow-md ${
                          isMe 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                        }`}>
                          {msg.content}
                          <div className={`text-[9px] mt-1.5 opacity-40 font-black uppercase text-right ${isMe ? 'text-white' : 'text-slate-400'}`}>
                             {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <footer className="p-6 bg-white">
                  <form onSubmit={handleSendMessage} className="relative group">
                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Sequence transmit..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-6 pr-16 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all placeholder:text-slate-300"
                    />
                    <button 
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      className="absolute right-2 top-2 bottom-2 px-5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-30"
                    >
                      {sending ? '...' : 'Launch'}
                    </button>
                  </form>
                </footer>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                 <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center text-4xl shadow-2xl shadow-indigo-50 border border-white">📬</div>
                 <div className="text-center space-y-2">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Select a Frequency</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Connect with Sparklers across the horizon.</p>
                 </div>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
