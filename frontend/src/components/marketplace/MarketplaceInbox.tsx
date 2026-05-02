import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Search, ChevronLeft, MoreHorizontal,
  Phone, Video, Info, Image as ImageIcon, Send, ShieldCheck,
  MapPin, Clock, Tag, ShoppingBag as ShoppingBagIcon, CheckCircle2, Plus, SlidersHorizontal, EyeOff, ShieldAlert
} from 'lucide-react';
import clsx from 'clsx';
import { getAvatarUrl } from '../../utils/imageUtils';
import { useUserStore } from '../../store/userStore';
import { useSocket } from '../../hooks/useSocket';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import api from '../../api/api';

// Real chats will be fetched from API

export default function MarketplaceInbox() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [activeTab, setActiveTab] = useState<'selling' | 'buying'>('buying');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const socket = useSocket();

  // Fetch chats on mount
  useEffect(() => {
    const fetchChats = async () => {
      try {
        setLoading(true);
        const res = await api.get('/marketplace/conversations');
        
        if (res.data && Array.isArray(res.data)) {
          const mappedChats = res.data.map((c: any) => ({
            id: c.id,
            type: c.buyer_id === user?.user_id ? 'buying' : 'selling',
            status: c.listing_status,
            unread: 0,
            lastMessage: c.last_message || 'No messages yet',
            lastMessageTime: new Date(c.last_activity_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            partner: {
              id: c.buyer_id === user?.user_id ? c.seller_id : c.buyer_id,
              name: c.buyer_id === user?.user_id ? c.seller_name : c.buyer_name,
              username: c.buyer_id === user?.user_id ? c.seller_username : c.buyer_username,
              avatar: c.buyer_id === user?.user_id ? c.seller_avatar : c.buyer_avatar,
              isVerified: true
            },
            listing: {
              id: c.listing_id,
              title: c.listing_title,
              price: c.listing_price,
              image: c.listing_image || 'https://ui-avatars.com/api/?name=Item',
              status: c.listing_status
            },
            is_pinned: !!c.is_pinned,
            is_muted: !!c.is_muted,
            is_archived: !!c.is_archived
          }));
          
          setChats(mappedChats);
        }
      } catch (err) {
        console.error('Failed to fetch marketplace chats:', err);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchChats();
  }, [user]);

  const filteredChats = chats.filter(chat => {
    if (chat.type?.toLowerCase() !== activeTab.toLowerCase()) return false;
    
    if (activeFilter === 'Archived') return !!chat.is_archived;
    if (chat.is_archived && activeFilter !== 'Archived') return false;

    if (activeFilter === 'Pinned') return !!chat.is_pinned;
    
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
  }).sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return 0;
  });

  const handleChatSelect = (id: string) => {
    navigate(`/marketplace/messages/${id}`);
  };

  const handleToggleFlag = async (chatId: string, field: string) => {
    try {
      const res = await api.patch(`/marketplace/conversations/${chatId}/toggle`, { field });
      if (res.data.success) {
        setChats(prev => prev.map(c => 
          c.id === chatId ? { ...c, [field]: res.data.value } : c
        ));
      }
    } catch (err) {
      console.error(`Failed to toggle ${field}:`, err);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    try {
      await api.delete(`/marketplace/conversations/${chatId}`);
      setChats(prev => prev.filter(c => c.id !== chatId));
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-white overflow-hidden w-full relative">
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-marketplace-border flex items-center justify-between bg-white sticky top-0 z-20">
        <h2 className="text-xl font-bold text-marketplace-text">Messages</h2>
        <button 
          onClick={() => navigate('/marketplace/settings')}
          className="p-2 hover:bg-marketplace-bg rounded-full transition-colors text-marketplace-text"
          title="Marketplace Settings"
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>

      {/* Header Tabs */}
      <div className="flex border-b border-marketplace-border bg-white pt-2 sticky top-[52px] z-10">
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
        {['All', 'Pinned', 'Archived', 'Pending', 'Completed'].map((filter) => (
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
        {loading ? (
          <div className="flex items-center justify-center h-40">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1877F2]"></div>
          </div>
        ) : filteredChats.length > 0 ? (
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
                  <div className="flex items-center gap-1 min-w-0">
                    <h4 className="font-bold text-[15px] text-marketplace-text truncate">{chat.partner.name}</h4>
                    {chat.is_pinned && <Tag size={12} className="text-[#1877F2] rotate-90" fill="currentColor" />}
                    {chat.is_muted && <EyeOff size={12} className="text-gray-400" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-marketplace-muted whitespace-nowrap">{chat.lastMessageTime}</span>
                    <div className="relative">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setOpenMenuId(openMenuId === chat.id ? null : chat.id); 
                        }}
                        className="p-1 hover:bg-gray-200 rounded-full text-gray-400"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      
                      {openMenuId === chat.id && (
                        <div 
                          className="absolute right-0 top-full mt-1 bg-white shadow-xl rounded-md border border-gray-100 py-1 z-30 w-32"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button onClick={(e) => { e.stopPropagation(); handleToggleFlag(chat.id, 'is_pinned'); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-gray-50 flex items-center gap-2">
                            <Tag size={12} /> {chat.is_pinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleToggleFlag(chat.id, 'is_archived'); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-gray-50 flex items-center gap-2">
                             <ShoppingBagIcon size={12} /> {chat.is_archived ? 'Unarchive' : 'Archive'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleToggleFlag(chat.id, 'is_muted'); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-gray-50 flex items-center gap-2">
                             <EyeOff size={12} /> {chat.is_muted ? 'Unmute' : 'Mute'}
                          </button>
                          {chat.partner.id !== user?.user_id && (
                            <button 
                              onClick={async (e) => { 
                                e.stopPropagation(); 
                                if (confirm(`Block ${chat.partner.name}?`)) {
                                  try {
                                    await api.post(`/users/block/${chat.partner.id}`);
                                    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, is_archived: true } : c));
                                    setOpenMenuId(null);
                                  } catch(err) { console.error(err); }
                                }
                              }} 
                              className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-gray-50 text-red-500 flex items-center gap-2"
                            >
                               <ShieldAlert size={12} /> Block User
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-gray-50 text-red-500 flex items-center gap-2 border-t">
                             Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
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
  );
}
