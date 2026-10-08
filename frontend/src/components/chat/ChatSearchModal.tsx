import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, Search, Calendar, User, Filter, CornerUpRight, MessageSquare, 
  Image as ImageIcon, FileText, Link2, Mic, Music, Share2, Eye, X
} from 'lucide-react';
import api from '../../api/api';
import { useThemeStore } from '../../store/themeStore';
import { logger } from '../../utils/logger';
import { useModalA11y } from '../../hooks/useModalA11y';

interface ChatSearchModalProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
}

// Helper for date classification
const groupItemsByDate = (items: any[], dateField = 'sent_at') => {
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

export const ChatSearchModal: React.FC<ChatSearchModalProps> = ({
  chatId,
  isOpen,
  onClose,
  onJumpToMessage
}) => {
  const [keyword, setKeyword] = useState('');
  const [activeType, setActiveType] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [senderFilter, setSenderFilter] = useState('');
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Theme integration
  const { getThemeForChat } = useThemeStore();
  const currentTheme = getThemeForChat(chatId);
  const primaryColor = currentTheme?.colors?.primary || '#ff1493';
  const chatBubbleSent = currentTheme?.colors?.chatBubbleSent || primaryColor;
  const a11yRef = useModalA11y(isOpen, onClose);

  useEffect(() => {
    if (isOpen && chatId) {
      performSearch();
    }
  }, [isOpen, chatId, keyword, activeType, dateFilter, senderFilter]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('chatId', chatId);
      if (keyword.trim()) params.append('q', keyword.trim());
      if (activeType && activeType !== 'all') params.append('type', activeType);
      if (dateFilter) params.append('date', dateFilter);
      if (senderFilter) params.append('sender', senderFilter);

      const response = await api.get(`/messages/search?${params.toString()}`);
      if (response.data?.status === 'success') {
        setResults(response.data.data || []);
      }
    } catch (err) {
      logger.error('Error performing search:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupedResults = useMemo(() => {
    return groupItemsByDate(results, 'sent_at');
  }, [results]);

  const highlightKeyword = (text: string, query: string) => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="font-bold px-1 rounded text-white" style={{ backgroundColor: `${primaryColor}60` }}>
          {part}
        </span>
      ) : part
    );
  };

  if (!isOpen) return null;

  return (
    <div ref={a11yRef} role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-(--z-modal) bg-[#0a0a0a] text-slate-100 flex flex-col w-full h-full animate-in fade-in slide-in-from-right duration-200">
      
      {/* Top Search & Filter Bar with Back Button */}
      <header className="p-4 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl flex flex-col gap-3 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/90 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-6 h-6" />
            <span className="text-sm font-bold hidden sm:inline">Back</span>
          </button>

          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4" style={{ color: primaryColor }} />
            Search Conversation
          </h2>

          <div className="w-10" />
        </div>

        <div className="relative max-w-3xl mx-auto w-full">
          <Search className="w-5 h-5 absolute left-4 top-3" style={{ color: primaryColor }} />
          <input 
            type="text"
            placeholder="Search messages by keyword, title or content..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl text-sm pl-12 pr-4 py-2.5 focus:outline-none text-white placeholder:text-white/40 shadow-inner"
            autoFocus
          />
        </div>

        {/* Filter Type Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-3xl mx-auto w-full pt-1">
          {[
            { id: 'all', label: 'Messages', icon: MessageSquare },
            { id: 'image', label: 'Media', icon: ImageIcon },
            { id: 'document', label: 'Files', icon: FileText },
            { id: 'link', label: 'Links', icon: Link2 },
            { id: 'voice_note', label: 'Voice', icon: Mic },
            { id: 'audio', label: 'Music', icon: Music },
            { id: 'story_reply', label: 'Stories', icon: Eye },
            { id: 'post_share', label: 'Posts', icon: Share2 }
          ].map(type => {
            const Icon = type.icon;
            const isActive = activeType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                style={isActive ? { background: chatBubbleSent } : {}}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {type.label}
              </button>
            );
          })}
        </div>

        {/* Date Filter Row */}
        <div className="flex items-center gap-3 max-w-3xl mx-auto w-full text-xs pt-1">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-xl text-white">
            <Calendar className="w-3.5 h-3.5" style={{ color: primaryColor }} />
            <input 
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent focus:outline-none text-white text-xs"
            />
          </div>
          {dateFilter && (
            <button 
              onClick={() => setDateFilter('')}
              className="text-[10px] font-bold hover:underline"
              style={{ color: primaryColor }}
            >
              Clear date filter
            </button>
          )}
        </div>
      </header>

      {/* Main Full Page Scrollable Results */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 max-w-4xl mx-auto w-full no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-2">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${primaryColor} transparent ${primaryColor} ${primaryColor}` }} />
            <p className="text-xs">Searching conversation...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-2">
            <Search className="w-8 h-8 opacity-40" style={{ color: primaryColor }} />
            <p className="text-sm font-bold text-slate-300">No matching messages found</p>
            <p className="text-xs text-white/40">Try adjusting your search keyword or filters.</p>
          </div>
        ) : (
          groupedResults.map(([groupName, groupItems]) => (
            <div key={groupName} className="space-y-3">
              {/* Date Header Banner */}
              <div className="flex items-center gap-2 sticky top-[165px] z-10 py-1.5 px-3 bg-[#0a0a0a]/95 backdrop-blur-md rounded-xl border border-white/5 shadow-md w-fit">
                <Calendar className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                <span className="text-xs font-black uppercase tracking-wider" style={{ color: primaryColor }}>{groupName}</span>
                <span className="text-[10px] text-white/40 font-mono">({groupItems.length})</span>
              </div>

              {groupItems.map((item, idx) => (
                <div
                  key={item.message_id || idx}
                  onClick={() => { onJumpToMessage(item.message_id); onClose(); }}
                  className="group p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-between gap-4 cursor-pointer transition-all shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span className="font-bold text-white truncate">
                        {item.sender_name || 'User'}
                      </span>
                      <span className="text-white/30">•</span>
                      <span className="text-[10px] text-white/50">
                        {new Date(item.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-white/80 line-clamp-2 leading-relaxed">
                      {highlightKeyword(item.content || '[Media Attachment]', keyword)}
                    </p>
                  </div>

                  <button
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors flex-shrink-0 flex items-center gap-1 text-xs font-bold"
                    style={{ color: primaryColor }}
                    title="Jump to Message"
                  >
                    Jump
                    <CornerUpRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
