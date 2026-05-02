import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Search, ChevronLeft, MoreHorizontal,
  Phone, Video, Info, Image as ImageIcon, Send, ShieldCheck,
  MapPin, Clock, Tag, ShoppingBag, CheckCircle2, Plus
} from 'lucide-react';
import clsx from 'clsx';
import { getAvatarUrl } from '../../utils/imageUtils';
import { useUserStore } from '../../store/userStore';
import { useSocket } from '../../hooks/useSocket';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import api from '../../api/api';

const MOCK_CHATS = [
  {
    id: 'mock-1',
    type: 'buying',
    status: 'payment_pending',
    unread: 2,
    lastMessage: 'Is the price negotiable?',
    lastMessageTime: '10:45 AM',
    partner: {
      id: 'u-1',
      name: 'Naty Leila',
      username: 'natyleila',
      avatar: null,
      isVerified: true
    },
    listing: {
      id: 'l-1',
      title: 'iPhone 15 Pro Max',
      price: 120000,
      image: 'https://images.unsplash.com/photo-1695048133142-1a20484d256e?q=80&w=2070&auto=format&fit=crop',
      status: 'available'
    }
  },
  {
    id: 'mock-2',
    type: 'selling',
    status: 'active',
    unread: 0,
    lastMessage: 'Where can we meet for pickup?',
    lastMessageTime: 'Yesterday',
    partner: {
      id: 'u-2',
      name: 'David Kamau',
      username: 'dkamau',
      avatar: null,
      isVerified: false
    },
    listing: {
      id: 'l-2',
      title: 'Gaming Laptop RTX 3060',
      price: 85000,
      image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?q=80&w=2068&auto=format&fit=crop',
      status: 'available'
    }
  },
  {
    id: 'mock-3',
    type: 'buying',
    status: 'completed',
    unread: 0,
    lastMessage: 'Thanks for the item!',
    lastMessageTime: 'Mon',
    partner: {
      id: 'u-3',
      name: 'Sarah Chen',
      username: 'schen',
      avatar: null,
      isVerified: true
    },
    listing: {
      id: 'l-3',
      title: 'Ergonomic Desk Chair',
      price: 15000,
      image: 'https://images.unsplash.com/photo-1505797149-35ebcb05a6fd?q=80&w=2070&auto=format&fit=crop',
      status: 'sold'
    }
  }
];

const MOCK_MESSAGES: Record<string, any[]> = {
  'mock-1': [
    { id: 'm1', senderId: 'u-1', text: 'Hi, I saw your iPhone 15 Pro Max listing.', time: '2024-05-02T10:30:00Z' },
    { id: 'm2', senderId: 'me', text: 'Hello! Yes, it is still available.', time: '2024-05-02T10:32:00Z' },
    { id: 'm3', senderId: 'u-1', text: 'Great! Is the price negotiable?', time: '2024-05-02T10:45:00Z' }
  ],
  'mock-2': [
    { id: 'm4', senderId: 'u-2', text: 'I want to buy the gaming laptop.', time: '2024-05-01T15:00:00Z' },
    { id: 'm5', senderId: 'me', text: 'Sure, when would you like to see it?', time: '2024-05-01T15:05:00Z' },
    { id: 'm6', senderId: 'u-2', text: 'Where can we meet for pickup?', time: '2024-05-01T15:10:00Z' }
  ]
};

// --- MOCK DATA END ---

export default function MarketplaceInbox() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [activeTab, setActiveTab] = useState<'selling' | 'buying'>('buying');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');

  // Mobile layout state: true if viewing chat list, false if viewing active chat
  const [isMobileList, setIsMobileList] = useState(true);
  const [chats, setChats] = useState<any[]>(MOCK_CHATS);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const socket = useSocket();
  const { setActiveModal, setSelectedListing } = useMarketplaceStore();

  // Fetch chats on mount
  useEffect(() => {
    const fetchChats = async () => {
      try {
        console.log('Fetching marketplace chats...');
        const res = await api.get('/marketplace/chats');
        
        if (res.data && res.data.success && Array.isArray(res.data.chats) && res.data.chats.length > 0) {
          console.log(`Successfully fetched ${res.data.chats.length} real chats.`);
          setChats(res.data.chats);
        } else {
          console.log('No real chats found, ensuring mock data is present.');
          setChats(prev => (prev && prev.length > 0) ? prev : MOCK_CHATS);
        }
      } catch (err) {
        console.error('Failed to fetch marketplace chats:', err);
        setChats(MOCK_CHATS);
      } finally {
        setLoading(false);
        // Final safety check
        setChats(prev => (!prev || prev.length === 0) ? MOCK_CHATS : prev);
      }
    };
    fetchChats();
  }, []);

  // Fetch messages when chat selected
  useEffect(() => {
    if (!selectedChatId) return;

    // Join socket room
    if (socket) {
      socket.emit('join-chat', selectedChatId);
    }

    const fetchMessages = async () => {
      try {
        const res = await api.get(`/marketplace/chats/${selectedChatId}/messages`);
        if (res.data.success && res.data.messages.length > 0) {
          setMessages(res.data.messages);
        } else if (MOCK_MESSAGES[selectedChatId]) {
          // Map 'me' to current user ID for mock messages
          const mappedMessages = MOCK_MESSAGES[selectedChatId].map(m => ({
            ...m,
            senderId: m.senderId === 'me' ? (user?.id || user?.user_id || 'me') : m.senderId
          }));
          setMessages(mappedMessages);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };
    fetchMessages();
  }, [selectedChatId]);

  // Real-time socket listener
  useEffect(() => {
    if (!socket) return;

    socket.on('marketplace:new_message', (data: any) => {
      if (data.chatId === selectedChatId) {
        setMessages(prev => [...prev, data.message]);
      }
      // Update last message in chats list
      setChats(prev => prev.map(c => 
        c.id === data.chatId 
          ? { ...c, lastMessage: data.message.text, lastMessageTime: new Date().toLocaleTimeString() } 
          : c
      ));
    });

    return () => { socket.off('marketplace:new_message'); };
  }, [socket, selectedChatId]);


  const filteredChats = chats.filter(chat => {
    // Case-insensitive type check
    if (chat.type?.toLowerCase() !== activeTab.toLowerCase()) return false;
    
    if (activeFilter !== 'All') {
      const status = chat.status?.toLowerCase();
      if (activeFilter === 'Pending' && status !== 'payment_pending') return false;
      if (activeFilter === 'Completed' && status !== 'completed') return false;
    }
    
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const partnerName = chat.partner?.name?.toLowerCase() || '';
      const listingTitle = chat.listing?.title?.toLowerCase() || '';
      
      if (!partnerName.includes(q) && !listingTitle.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const activeChat = chats.find(c => c.id === selectedChatId);

  // Select first chat automatically on desktop
  useEffect(() => {
    if (window.innerWidth >= 1024 && !selectedChatId && filteredChats.length > 0) {
      setSelectedChatId(filteredChats[0].id);
    }
  }, [activeTab, activeFilter, filteredChats, selectedChatId]);

  const handleChatSelect = (id: string) => {
    setSelectedChatId(id);
    setIsMobileList(false); // Switch to detail view on mobile
  };

  const handleBackToList = () => {
    setIsMobileList(true);
    setSelectedChatId(null);
  };

  const handleSendMessage = async (customText?: string) => {
    const text = customText || messageInput;
    if (!text.trim() || !selectedChatId) return;

    // Handle Mock Chats locally
    if (selectedChatId.startsWith('mock-')) {
      console.log('Simulating message for mock chat:', selectedChatId);
      const newMessage = {
        id: 'mock-m-' + Date.now(),
        senderId: user?.id || user?.user_id || 'me',
        text: text,
        time: new Date().toISOString()
      };
      setMessages(prev => [...prev, newMessage]);
      if (!customText) setMessageInput('');
      return;
    }

    try {
      const res = await api.post(`/marketplace/chats/${selectedChatId}/messages`, { content: text });
      if (res.data.success) {
        if (!customText) setMessageInput('');
        setMessages(prev => [...prev, {
          id: res.data.message.id,
          senderId: user?.id || user?.user_id,
          text: text,
          time: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Debug Filtering
  useEffect(() => {
    if (chats.length > 3) { // 3 is the number of mocks
      console.log('🔍 Filtering Real Chats Analysis:');
      chats.forEach((c, i) => {
        console.log(`Chat ${i}: ID=${c.id}, Type="${c.type}", ActiveTab="${activeTab}", Match=${c.type?.toLowerCase() === activeTab.toLowerCase()}`);
      });
    }
  }, [chats, activeTab]);

  const handleDeleteChat = async (chatId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    try {
      await api.delete(`/marketplace/chats/${chatId}`);
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
        setIsMobileList(true);
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-60px)] bg-white overflow-hidden w-full relative">

      {/* LEFT PANEL: Chat List */}
      <div className={clsx(
        "flex-col w-full lg:w-[380px] flex-shrink-0 border-r border-marketplace-border bg-white h-full",
        !isMobileList ? "hidden lg:flex" : "flex"
      )}>
        {/* Header Tabs */}
        <div className="flex border-b border-marketplace-border bg-white pt-2 sticky top-0 z-10">
          <button
            onClick={() => { setActiveTab('buying'); setActiveFilter('All'); }}
            className={clsx(
              "flex-1 py-3 font-bold transition-colors border-b-2",
              activeTab === 'buying' ? "text-[#1877F2] border-[#1877F2]" : "text-marketplace-muted border-transparent hover:bg-marketplace-bg"
            )}
          >
            Buying
          </button>
          <button
            onClick={() => { setActiveTab('selling'); setActiveFilter('All'); }}
            className={clsx(
              "flex-1 py-3 font-bold transition-colors border-b-2",
              activeTab === 'selling' ? "text-[#1877F2] border-[#1877F2]" : "text-marketplace-muted border-transparent hover:bg-marketplace-bg"
            )}
          >
            Selling
          </button>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-marketplace-bg rounded-full py-2 pl-4 pr-4 text-[15px] font-medium outline-none focus:bg-slate-200 transition-colors text-center placeholder:text-center"
            />
          </div>
        </div>

        {/* Horizontal Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 pb-3">
          {['All', 'Pending', 'Completed'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={clsx(
                "px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors",
                activeFilter === filter
                  ? "bg-marketplace-text text-white"
                  : "bg-marketplace-bg text-marketplace-text hover:bg-slate-200"
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {filteredChats.length > 0 ? (
            filteredChats.map(chat => (
              <div
                key={chat.id}
                onClick={() => handleChatSelect(chat.id)}
                className={clsx(
                  "flex items-center gap-3 p-3 cursor-pointer hover:bg-marketplace-bg transition-colors border-l-4",
                  selectedChatId === chat.id ? "bg-marketplace-bg/80 border-[#1877F2]" : "border-transparent"
                )}
              >
                <div className="relative w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden bg-slate-100 border border-marketplace-border">
                  <img src={chat.listing.image} alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 bg-white rounded-tl-lg flex items-center justify-center shadow-sm">
                    <img src={getAvatarUrl(chat.partner.avatar, chat.partner.username)} alt="" className="w-5 h-5 rounded-full object-cover" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className="font-bold text-[15px] text-marketplace-text truncate">{chat.partner.name}</h4>
                    <span className="text-[12px] text-marketplace-muted whitespace-nowrap ml-2">{chat.lastMessageTime}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-marketplace-text truncate mb-0.5">{chat.listing.title}</p>
                  <p className={clsx(
                    "text-[13px] truncate",
                    chat.unread > 0 ? "text-marketplace-text font-bold" : "text-marketplace-muted font-normal"
                  )}>
                    {chat.lastMessage}
                  </p>
                </div>

                {chat.unread > 0 && (
                  <div className="w-5 h-5 rounded-full bg-[#1877F2] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                    {chat.unread}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-20 px-6 opacity-60">
              <div className="w-16 h-16 bg-marketplace-bg rounded-full flex items-center justify-center mb-4">
                <MessageCircle size={28} className="text-marketplace-muted" />
              </div>
              <h3 className="text-[16px] font-bold text-marketplace-text mb-1">No Messages Found</h3>
              <p className="text-[14px] text-marketplace-muted">No chats match your current filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Active Chat */}
      <div className={clsx(
        "flex-1 flex-col bg-white h-full lg:relative",
        isMobileList ? "hidden lg:flex" : "flex fixed inset-0 z-[2000] lg:static lg:z-20"
      )}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-marketplace-border bg-white shadow-sm z-10">
              <div className="flex items-center gap-3">
                <button onClick={handleBackToList} className="lg:hidden p-2 -ml-2 text-marketplace-text hover:bg-marketplace-bg rounded-full">
                  <ChevronLeft size={24} />
                </button>
                <div className="relative">
                  <img src={getAvatarUrl(activeChat.partner.avatar, activeChat.partner.username)} alt="" className="w-10 h-10 rounded-full object-cover" />
                  {activeChat.partner.isVerified && (
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-[2px]">
                      <CheckCircle2 size={14} className="text-[#1877F2] fill-white" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-[16px] text-marketplace-text leading-tight">{activeChat.partner.name}</h3>
                  <p className="text-[12px] text-marketplace-muted flex items-center gap-1">
                    {activeChat.partner.username} • <span>Online</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 text-[#1877F2] hover:bg-blue-50 rounded-full transition-colors"><Phone size={20} /></button>
                <button className="p-2 text-[#1877F2] hover:bg-blue-50 rounded-full transition-colors"><Video size={20} /></button>
                <button className="p-2 text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors"><Info size={20} /></button>
              </div>
            </div>

            {/* Listing Context Banner */}
            <div className="bg-marketplace-bg/30 border-b border-marketplace-border p-3 flex items-center justify-between cursor-pointer hover:bg-marketplace-bg transition-colors" onClick={() => navigate(`/marketplace/listings/${activeChat.listing.id}`)}>
              <div className="flex items-center gap-3">
                <img src={activeChat.listing.image} alt="" className="w-12 h-12 rounded-lg object-cover border border-marketplace-border" />
                <div>
                  <h4 className="font-bold text-[14px] text-marketplace-text">{activeChat.listing.title}</h4>
                  <p className="text-[13px] font-semibold text-marketplace-muted">KES {activeChat.listing.price.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={clsx(
                  "px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider",
                  activeChat.listing.status === 'available' ? "bg-emerald-100 text-emerald-700" :
                    activeChat.listing.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      "bg-slate-200 text-slate-700"
                )}>
                  {activeChat.listing.status}
                </span>
                <ChevronLeft size={18} className="text-marketplace-muted rotate-180" />
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-blue-50 border-b border-blue-100 p-3 flex items-start gap-2">
              <ShieldCheck size={18} className="text-[#1877F2] flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-blue-800 leading-tight">
                To protect your payment, never transfer money or communicate outside of the Sparkle website or app. <span className="font-bold underline cursor-pointer hover:text-blue-600 transition-colors" onClick={() => navigate('/marketplace/safety')}>Learn more</span>
              </p>
            </div>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
              
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === (user?.id || user?.user_id);
                const showTime = idx === 0 || new Date(msg.time).getTime() - new Date(messages[idx-1].time).getTime() > 300000;
                
                return (
                  <div key={msg.id} className={clsx("flex flex-col max-w-[85%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                    {showTime && (
                       <div className="text-center w-full text-[11px] text-marketplace-muted font-bold my-4 uppercase tracking-tighter">
                         {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </div>
                    )}
                    <div className={clsx(
                      "px-4 py-2.5 rounded-[20px] text-[15px] leading-relaxed shadow-sm",
                      isMe 
                        ? "bg-[#1877F2] text-white rounded-br-[4px]" 
                        : "bg-slate-100 text-slate-800 rounded-bl-[4px]"
                    )}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Unified Chat Footer */}
            <div className="bg-white border-t border-slate-100 p-2 pb-safe">
              
              {/* Quick Action Chips (Floating above input) */}
              <div className="flex gap-2 px-2 pb-2 overflow-x-auto no-scrollbar">
                {activeTab === 'buying' && activeChat.listing.status === 'available' && (
                  <>
                    <button 
                      onClick={() => {
                        setSelectedListing({ listing_id: activeChat.listing.id, title: activeChat.listing.title, price: activeChat.listing.price, image_url: activeChat.listing.image } as any);
                        setActiveModal('offer');
                      }}
                      className="px-4 py-1.5 bg-[#1877F2]/10 text-[#1877F2] font-bold rounded-full text-[13px] whitespace-nowrap hover:bg-[#1877F2]/20 transition-colors shadow-sm"
                    >
                      Make Offer
                    </button>
                    <button 
                      onClick={() => navigate(`/marketplace/order?listingId=${activeChat.listing.id}`)}
                      className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-full text-[13px] whitespace-nowrap hover:bg-black transition-colors shadow-md"
                    >
                      Buy Now
                    </button>
                  </>
                )}
                {activeTab === 'selling' && activeChat.listing.status === 'available' && (
                  <>
                    <button 
                      onClick={() => api.put(`/marketplace/listings/${activeChat.listing.id}/sold`).then(() => window.location.reload())}
                      className="px-4 py-1.5 bg-emerald-50 text-emerald-600 font-bold rounded-full text-[13px] whitespace-nowrap hover:bg-emerald-100 transition-colors border border-emerald-100"
                    >
                      Mark as Sold
                    </button>
                  </>
                )}
                <button 
                  onClick={() => handleSendMessage("Is this still available?")}
                  className="px-4 py-1.5 bg-slate-50 text-slate-500 font-bold rounded-full text-[13px] whitespace-nowrap hover:bg-slate-100 transition-colors border border-slate-100"
                >
                  Is this available?
                </button>
                <button 
                  onClick={() => handleSendMessage("I'm interested. Where can we meet?")}
                  className="px-4 py-1.5 bg-slate-50 text-slate-500 font-bold rounded-full text-[13px] whitespace-nowrap hover:bg-slate-100 transition-colors border border-slate-100"
                >
                  Where to meet?
                </button>
              </div>

              {/* Input Area */}
              <div className="flex items-center gap-2 px-1">
                <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0" onClick={() => document.getElementById('marketplace-upload')?.click()}>
                  <ImageIcon size={22} />
                  <input type="file" id="marketplace-upload" hidden onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Logic for image upload would go here
                      alert('Image upload functionality: Selected ' + file.name);
                    }
                  }} />
                </button>
                
                <div className="flex-1 bg-slate-100 rounded-[22px] px-4 py-2 flex items-center border border-transparent focus-within:bg-white focus-within:border-slate-200 transition-all">
                  <textarea 
                    value={messageInput}
                    onChange={e => {
                      setMessageInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 max-h-32 bg-transparent resize-none outline-none text-[15px] text-slate-900 placeholder-slate-400 leading-tight py-1"
                    rows={1}
                  />
                </div>

                <button 
                  onClick={() => handleSendMessage()}
                  disabled={!messageInput.trim()}
                  className={clsx(
                    "w-10 h-10 flex items-center justify-center rounded-full transition-all flex-shrink-0",
                    messageInput.trim() ? "bg-[#1877F2] text-white shadow-lg shadow-blue-200 active:scale-90" : "text-slate-300"
                  )}
                >
                  <Send size={18} className={messageInput.trim() ? "translate-x-0.5" : ""} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 hidden lg:flex flex-col items-center justify-center bg-slate-50/50">
            <div className="w-24 h-24 bg-white rounded-full shadow-sm border border-marketplace-border flex items-center justify-center mb-4">
              <MessageCircle size={40} className="text-[#1877F2]" />
            </div>
            <h2 className="text-[20px] font-bold text-marketplace-text mb-2">Select a Conversation</h2>
            <p className="text-[15px] text-marketplace-muted max-w-sm text-center">
              Choose a message from the list to view the conversation details and item information.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
