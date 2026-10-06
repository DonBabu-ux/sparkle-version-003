import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, Pin, Search, ArrowUpDown, CornerUpRight, Trash2, Copy, Share2, 
  Star, User, Clock, Check, Calendar, X
} from 'lucide-react';
import api from '../../api/api';
import { useThemeStore } from '../../store/themeStore';
import { logger } from '../../utils/logger';

interface PinnedMessagesViewProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
  onUnpinMessage?: (messageId: string) => void;
  onForwardMessage?: (messageId: string) => void;
  canCopy?: boolean;
  canForward?: boolean;
}

// Helper for date classification
const groupItemsByDate = (items: any[], dateField = 'pinned_at') => {
  const groups: { [key: string]: any[] } = {
    'Recent': [],
    'Last Week': [],
    'Last Month': [],
    'Older': []
  };

  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  items.forEach(item => {
    const rawDate = item[dateField] || item.created_at || item.sent_at;
    if (!rawDate) {
      groups['Older'].push(item);
      return;
    }
    const d = new Date(rawDate);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / oneDay);

    if (diffDays <= 2) {
      groups['Recent'].push(item);
    } else if (diffDays <= 7) {
      groups['Last Week'].push(item);
    } else if (diffDays <= 30) {
      groups['Last Month'].push(item);
    } else {
      groups['Older'].push(item);
    }
  });

  return Object.entries(groups).filter(([_, list]) => list.length > 0);
};

export const PinnedMessagesView: React.FC<PinnedMessagesViewProps> = ({
  chatId,
  isOpen,
  onClose,
  onJumpToMessage,
  onUnpinMessage,
  onForwardMessage,
  canCopy = true,
  canForward = true,
}) => {
  const [pinnedList, setPinnedList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'me' | 'them'>('newest');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Theme integration
  const { getThemeForChat } = useThemeStore();
  const currentTheme = getThemeForChat(chatId);
  const primaryColor = currentTheme?.colors?.primary || '#ff1493';

  useEffect(() => {
    if (isOpen && chatId) {
      fetchPinnedMessages();
    }
  }, [isOpen, chatId, searchQuery, sortOption]);

  const fetchPinnedMessages = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/messages/chat/${chatId}/pinned?q=${encodeURIComponent(searchQuery)}&sort=${sortOption}`);
      if (response.data?.status === 'success') {
        setPinnedList(response.data.data || []);
      }
    } catch (err) {
      logger.error('Error fetching pinned messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/messages/${messageId}/pin`, { data: { chatId } });
      setPinnedList(prev => prev.filter(m => m.message_id !== messageId));
      if (onUnpinMessage) onUnpinMessage(messageId);
    } catch (err) {
      logger.error('Error unpinning message:', err);
    }
  };

  const handleCopy = (content: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const groupedPins = useMemo(() => {
    return groupItemsByDate(pinnedList, 'pinned_at');
  }, [pinnedList]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-[#0a0a0a] text-slate-100 flex flex-col w-full h-full animate-in fade-in slide-in-from-right duration-200">
      
      {/* Top Header Bar with Back Button */}
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-[#0a0a0a]/90 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/90 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-6 h-6" />
            <span className="text-sm font-bold hidden sm:inline">Back</span>
          </button>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 leading-tight">
              Pinned Messages
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold border" style={{ backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}40`, color: primaryColor }}>
                {pinnedList.length}
              </span>
            </h2>
            <p className="text-[11px] text-white/50">Quickly access important pinned updates</p>
          </div>
        </div>
      </header>

      {/* Filter Controls Row */}
      <div className="p-4 bg-black/40 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 sticky top-[57px] z-20">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-white/40" />
          <input 
            type="text"
            placeholder="Search pinned messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl text-xs pl-10 pr-3 py-2 focus:outline-none text-white placeholder:text-white/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-white/50" />
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-xl text-xs px-3 py-2 text-white focus:outline-none"
          >
            <option value="newest">Newest Pinned</option>
            <option value="oldest">Oldest Pinned</option>
            <option value="me">Pinned by Me</option>
            <option value="them">Pinned by Them</option>
          </select>
        </div>
      </div>

      {/* Pinned Messages Main Scroll View */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-2">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${primaryColor} transparent ${primaryColor} ${primaryColor}` }} />
            <p className="text-xs">Loading pins...</p>
          </div>
        ) : pinnedList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-2">
            <Pin className="w-8 h-8 opacity-40" style={{ color: primaryColor }} />
            <p className="text-sm font-bold text-slate-300">No pinned messages found</p>
            <p className="text-xs text-white/40">Long press any message in the chat to pin it here.</p>
          </div>
        ) : (
          groupedPins.map(([groupName, groupItems]) => (
            <div key={groupName} className="space-y-3">
              {/* Date Header Banner */}
              <div className="flex items-center gap-2 sticky top-[125px] z-10 py-1.5 px-3 bg-[#0a0a0a]/95 backdrop-blur-md rounded-xl border border-white/5 shadow-md w-fit">
                <Calendar className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                <span className="text-xs font-black uppercase tracking-wider" style={{ color: primaryColor }}>{groupName}</span>
                <span className="text-[10px] text-white/40 font-mono">({groupItems.length})</span>
              </div>

              {groupItems.map((item) => (
                <div
                  key={item.message_id}
                  onClick={() => { onJumpToMessage(item.message_id); onClose(); }}
                  className="group p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-start justify-between gap-4 cursor-pointer transition-all shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="p-2.5 rounded-xl mt-0.5 flex-shrink-0 border" style={{ backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}40`, color: primaryColor }}>
                      <Pin className="w-4 h-4 fill-current" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs mb-1">
                        <span className="font-bold truncate" style={{ color: primaryColor }}>
                          Pinned by {item.pinned_by_name || 'You'}
                        </span>
                        <span className="text-white/30">•</span>
                        <span className="text-[10px] text-white/50">
                          {new Date(item.pinned_at || item.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-white/90 line-clamp-2 leading-relaxed font-medium">
                        {item.content || '[Media attachment]'}
                      </p>

                      <div className="flex items-center gap-2 mt-2 text-[10px] text-white/40">
                        <span>Sender: {item.sender_name || 'User'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions Menu */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {canCopy !== false && (
                      <button
                        onClick={(e) => handleCopy(item.content, item.message_id, e)}
                        className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white"
                        title="Copy Text"
                      >
                        {copiedId === item.message_id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                    {canForward !== false && onForwardMessage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onForwardMessage(item.message_id); }}
                        className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white"
                        title="Forward"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleUnpin(item.message_id, e)}
                      className="p-2 hover:bg-red-500/20 rounded-xl text-white/60 hover:text-red-400"
                      title="Unpin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 hover:bg-white/10 rounded-xl font-bold text-xs flex items-center gap-1"
                      style={{ color: primaryColor }}
                      title="Jump to Message"
                    >
                      <CornerUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
