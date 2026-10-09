import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Image as ImageIcon, FileText, Link2, Mic, Music, Play, ExternalLink, Download, Share2, CornerUpRight, Search, AlertCircle, ChevronRight, Eye, Calendar, X } from 'lucide-react';
import api from '../../api/api';
import { useThemeStore } from '../../store/themeStore';
import { logger } from '../../utils/logger';
import { safeHref } from '../../utils/safeHref';

interface SharedContentExplorerProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
}

type TabType = 'media' | 'files' | 'links' | 'voice' | 'music' | 'stories' | 'posts';

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
    const rawDate = item[dateField] || item.created_at || item.sent_at || item.pinned_at;
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

export const SharedContentExplorer: React.FC<SharedContentExplorerProps> = ({
  chatId,
  isOpen,
  onClose,
  onJumpToMessage
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('media');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  // Theme integration
  const { getThemeForChat } = useThemeStore();
  const currentTheme = getThemeForChat(chatId);
  const primaryColor = currentTheme?.colors?.primary || '#ff1493';
  const chatBubbleSent = currentTheme?.colors?.chatBubbleSent || primaryColor;

  // Filters & Options
  const [fileCategory, setFileCategory] = useState('All');
  const [fileSearch, setFileSearch] = useState('');
  const [fileSort, setFileSort] = useState('newest');

  // Media Lightbox
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen && chatId) {
      fetchTabData(activeTab);
    }
  }, [isOpen, chatId, activeTab, fileCategory, fileSearch, fileSort]);

  const fetchTabData = async (tab: TabType) => {
    setLoading(true);
    try {
      let endpoint = `/messages/chat/${chatId}/${tab}`;
      const params = new URLSearchParams();

      if (tab === 'files') {
        if (fileCategory !== 'All') params.append('category', fileCategory);
        if (fileSearch) params.append('q', fileSearch);
        if (fileSort) params.append('sort', fileSort);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`${endpoint}${queryString}`);
      if (response.data?.status === 'success') {
        setData(response.data.data || []);
      }
    } catch (err) {
      logger.error(`Error fetching ${tab}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const groupedData = useMemo(() => {
    return groupItemsByDate(data, 'sent_at');
  }, [data]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-(--z-modal) bg-[#0a0a0a] text-slate-100 flex flex-col w-full h-full animate-in fade-in slide-in-from-right duration-200">
      
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
            <h2 className="text-lg font-bold leading-tight" style={{ color: primaryColor }}>
              Shared Content Explorer
            </h2>
            <p className="text-[11px] text-white/50">
              All photos, documents, links, audio & attachments in this chat
            </p>
          </div>
        </div>
      </header>

      {/* Horizontal Navigation Tabs */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 overflow-x-auto no-scrollbar bg-black/40 sticky top-[57px] z-20">
        {[
          { id: 'media', label: 'Media', icon: ImageIcon },
          { id: 'files', label: 'Files', icon: FileText },
          { id: 'links', label: 'Links', icon: Link2 },
          { id: 'voice', label: 'Voice', icon: Mic },
          { id: 'music', label: 'Music', icon: Music },
          { id: 'stories', label: 'Stories', icon: Eye },
          { id: 'posts', label: 'Posts', icon: Share2 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={isActive ? { background: chatBubbleSent } : {}}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'text-white shadow-lg scale-105'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Full Page Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${primaryColor} transparent ${primaryColor} ${primaryColor}` }} />
            <p className="text-xs">Loading shared content...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-2">
            <div className="p-4 bg-white/5 rounded-full text-white/40">
              <FileText className="w-8 h-8 opacity-60" />
            </div>
            <p className="text-sm font-medium text-slate-300">No {activeTab} shared yet</p>
            <p className="text-xs text-white/40">Items exchanged in this chat will show up here.</p>
          </div>
        ) : (
          groupedData.map(([groupName, groupItems]) => (
            <div key={groupName} className="space-y-4">
              {/* Date Header */}
              <div className="flex items-center gap-2 sticky top-[105px] z-10 py-1.5 px-3 bg-[#0a0a0a]/95 backdrop-blur-md rounded-xl border border-white/5 shadow-md w-fit">
                <Calendar className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                <span className="text-xs font-black uppercase tracking-wider" style={{ color: primaryColor }}>{groupName}</span>
                <span className="text-[10px] text-white/40 font-mono">({groupItems.length})</span>
              </div>

              {/* TAB 1: MEDIA */}
              {activeTab === 'media' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {groupItems.map((item, idx) => (
                    <div 
                      key={item.message_id || idx}
                      onClick={() => setSelectedMedia(item)}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-white/5 cursor-pointer border border-white/10 transition-all transform hover:-translate-y-1 hover:shadow-xl"
                    >
                      {item.media_type === 'video' ? (
                        <video 
                          src={item.media_url} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          muted
                        />
                      ) : (
                        <img 
                          src={item.media_url} 
                          alt="Shared media" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      )}
                      
                      {item.media_type === 'video' && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="p-3 bg-black/60 backdrop-blur-md rounded-full text-white group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 fill-white" />
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between text-[10px] text-slate-300">
                        <span className="truncate max-w-[80%]">{item.sender_name || 'User'}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onJumpToMessage(item.message_id); onClose(); }}
                          className="p-1 hover:opacity-80"
                          style={{ color: primaryColor }}
                          title="Go to Message"
                        >
                          <CornerUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 2: FILES */}
              {activeTab === 'files' && (
                <div className="space-y-4">
                  {/* Category filters & Search */}
                  {groupName === groupedData[0][0] && (
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 mb-4">
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {['All', 'PDF', 'Word', 'Excel', 'PowerPoint', 'ZIP', 'APK', 'Other'].map(cat => (
                          <button
                            key={cat}
                            onClick={() => setFileCategory(cat)}
                            style={fileCategory === cat ? { background: primaryColor } : {}}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                              fileCategory === cat
                                ? 'text-white'
                                : 'text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-white/40" />
                          <input 
                            type="text"
                            placeholder="Search files..."
                            value={fileSearch}
                            onChange={(e) => setFileSearch(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl text-xs pl-8 pr-3 py-1.5 focus:outline-none text-white w-36 sm:w-48"
                          />
                        </div>
                        <select
                          value={fileSort}
                          onChange={(e) => setFileSort(e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-xl text-xs px-2 py-1.5 text-white focus:outline-none"
                        >
                          <option value="newest">Newest</option>
                          <option value="oldest">Oldest</option>
                          <option value="largest">Largest</option>
                          <option value="smallest">Smallest</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {groupItems.map((file, idx) => (
                      <div 
                        key={file.message_id || idx}
                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-between gap-3 group transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-3 rounded-xl border" style={{ backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}40`, color: primaryColor }}>
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate transition-colors">
                              {file.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-white/50 mt-1">
                              <span>{file.size || '2.4 MB'}</span>
                              <span>•</span>
                              <span>{file.category}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <a 
                            href={safeHref(file.file_url)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-2 hover:bg-white/10 rounded-xl text-white/70 hover:text-white"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => { onJumpToMessage(file.message_id); onClose(); }}
                            className="p-2 hover:bg-white/10 rounded-xl text-white/70"
                            style={{ color: primaryColor }}
                            title="Jump to Message"
                          >
                            <CornerUpRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: LINKS */}
              {activeTab === 'links' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groupItems.map((link, idx) => (
                    <div 
                      key={link.message_id || idx}
                      className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col justify-between gap-3 group transition-all"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {link.image_url ? (
                          <img 
                            src={link.image_url} 
                            alt="Link thumbnail" 
                            className="w-16 h-16 rounded-xl object-cover border border-white/10 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border" style={{ backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}40`, color: primaryColor }}>
                            <Link2 className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate transition-colors">
                            {link.title || link.domain}
                          </h4>
                          <p className="text-[11px] text-white/60 line-clamp-2 mt-0.5">
                            {link.description || link.url}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] font-bold mt-1" style={{ color: primaryColor }}>
                            <span>{link.domain}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
                        <span className="text-[10px] text-white/40">{new Date(link.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <div className="flex items-center gap-2">
                          <a 
                            href={safeHref(link.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ background: chatBubbleSent }}
                            className="px-3 py-1.5 text-white hover:opacity-90 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open
                          </a>
                          <button
                            onClick={() => { onJumpToMessage(link.message_id); onClose(); }}
                            className="p-1.5 hover:bg-white/10 rounded-xl text-white/50"
                            style={{ color: primaryColor }}
                            title="Jump to Message"
                          >
                            <CornerUpRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: VOICE */}
              {activeTab === 'voice' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {groupItems.map((voice, idx) => (
                    <div 
                      key={voice.message_id || idx}
                      className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-between gap-3 group transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button onClick={() => { onJumpToMessage(voice.message_id); onClose(); }} className="p-3 text-white rounded-full shadow-lg hover:scale-105 transition-transform" style={{ background: chatBubbleSent }}>
                          <Play className="w-4 h-4 fill-white" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs text-white mb-1">
                            <span className="font-bold">{voice.sender_name || 'Voice Note'}</span>
                            <span className="text-[10px] text-white/50">{voice.duration}s</span>
                          </div>
                          {/* Waveform */}
                          <div className="flex items-center gap-1 h-5">
                            {(voice.waveform || [15, 30, 45, 60, 40, 25, 55, 75, 40, 20]).map((h: number, i: number) => (
                              <span 
                                key={i}
                                className="w-1 rounded-full"
                                style={{ height: `${Math.max(20, h)}%`, backgroundColor: primaryColor }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => { onJumpToMessage(voice.message_id); onClose(); }}
                        className="p-2 hover:bg-white/10 rounded-xl text-white/50"
                        style={{ color: primaryColor }}
                        title="Jump to Message"
                      >
                        <CornerUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: MUSIC */}
              {activeTab === 'music' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {groupItems.map((track, idx) => (
                    <div 
                      key={track.message_id || idx}
                      className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-between gap-3 group transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img 
                          src={track.album_art} 
                          alt="Album Art" 
                          className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">
                            {track.track_title}
                          </h4>
                          <p className="text-[11px] text-white/50 truncate">{track.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button onClick={() => { onJumpToMessage(track.message_id); onClose(); }} className="p-2 text-white rounded-full hover:scale-105 transition-transform" style={{ background: chatBubbleSent }}>
                          <Play className="w-3.5 h-3.5 fill-white" />
                        </button>
                        <button
                          onClick={() => { onJumpToMessage(track.message_id); onClose(); }}
                          className="p-2 hover:bg-white/10 rounded-xl text-white/50"
                          style={{ color: primaryColor }}
                          title="Jump to Message"
                        >
                          <CornerUpRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 6: STORIES */}
              {activeTab === 'stories' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {groupItems.map((story, idx) => (
                    <div 
                      key={story.message_id || idx}
                      className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col gap-2 group transition-all"
                    >
                      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black/60">
                        <img 
                          src={story.thumbnail_url} 
                          alt="Story thumbnail" 
                          className="w-full h-full object-cover"
                        />
                        {story.is_expired && (
                          <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-1 p-2 text-center">
                            <AlertCircle className="w-5 h-5 text-amber-400" />
                            <span className="text-[10px] font-bold text-amber-300">Story expired</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-white/80 truncate font-bold">{story.sender_name}</span>
                        <button
                          onClick={() => { onJumpToMessage(story.message_id); onClose(); }}
                          className="font-bold hover:underline text-[10px]"
                          style={{ color: primaryColor }}
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 7: POSTS */}
              {activeTab === 'posts' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groupItems.map((post, idx) => (
                    <div 
                      key={post.message_id || idx}
                      className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col gap-3 group transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs" style={{ background: chatBubbleSent }}>
                          {post.sender_name?.[0] || 'S'}
                        </div>
                        <span className="text-xs font-bold text-white">{post.sender_name}</span>
                      </div>
                      <p className="text-xs text-white/80 line-clamp-2">{post.preview_text}</p>
                      <div className="flex items-center justify-between text-[11px] text-white/50 border-t border-white/10 pt-2">
                        <span>❤️ {post.likes_count} likes</span>
                        <span>💬 {post.comments_count} comments</span>
                        <button 
                          onClick={() => { onJumpToMessage(post.message_id); onClose(); }}
                          className="font-bold hover:underline flex items-center gap-1"
                          style={{ color: primaryColor }}
                        >
                          Open Post <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Lightbox for Fullscreen Media View */}
      {selectedMedia && (
        <div 
          className="fixed inset-0 z-(--z-modal) bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <div className="w-full flex items-center justify-between text-white z-10">
            <span className="text-sm font-bold">{selectedMedia.sender_name || 'Shared Media'}</span>
            <button onClick={() => setSelectedMedia(null)} className="p-2 hover:bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center max-w-4xl max-h-[80vh] my-auto">
            {selectedMedia.media_type === 'video' ? (
              <video src={selectedMedia.media_url} controls autoPlay className="max-w-full max-h-full rounded-2xl shadow-2xl" />
            ) : (
              <img src={selectedMedia.media_url} alt="Lightbox view" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
            )}
          </div>

          <div className="w-full flex items-center justify-center gap-4 border-t border-white/10 pt-3 z-10" onClick={e => e.stopPropagation()}>
            <a 
              href={safeHref(selectedMedia.media_url)} 
              download 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold text-white transition-colors"
            >
              <Download className="w-4 h-4" /> Download
            </a>
            <button 
              onClick={() => { onJumpToMessage(selectedMedia.message_id); setSelectedMedia(null); onClose(); }}
              style={{ background: chatBubbleSent }}
              className="flex items-center gap-2 px-4 py-2 hover:opacity-90 rounded-full text-xs font-bold text-white transition-colors shadow-lg"
            >
              <CornerUpRight className="w-4 h-4" /> Jump to Message
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
