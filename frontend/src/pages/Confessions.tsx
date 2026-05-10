import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';
import api from '../api/api';
import { emitHeart } from '../components/TikTokHearts';
import ConfessionModal from '../components/modals/ConfessionModal';
import ShareModal from '../components/modals/ShareModal';
import { formatCount } from '../utils/format';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import Spinner from '../components/ui/Spinner';
import { 
  ShieldCheck, Plus, Orbit, MessageSquare, ArrowLeft, Flame, TrendingUp, Sparkles, Globe, Smile, BookOpen,
  MessageCircleHeart, Star, Feather, ShieldOff, MoreHorizontal, Download, Flag, X, MessageCircle, Bookmark, Heart, Send
} from 'lucide-react';


const HeartIcon = ({ active, size = 25, className = "" }: { active?: boolean, size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const CommentIcon = ({ size = 25, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20.65 17.15a10 10 0 1 1 2.35-6.15 10 10 0 0 1-2.35 6.15L23 23l-5.85-2.35Z" />
  </svg>
);

const SendIcon = ({ size = 23, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${className} rotate-[-15deg] translate-y-[2.5px]`}>
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const BookmarkIcon = ({ active, size = 25, className = "" }: { active?: boolean, size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </svg>
);

const SpyIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 10c.5-1.5 0-3-1-4l-1-1h-6l-1 1c-1 1-1.5 2.5-1 4" />
    <path d="M3 10h18l-1.5 3H4.5L3 10z" />
    <circle cx="8.5" cy="17" r="2.5" />
    <circle cx="15.5" cy="17" r="2.5" />
    <path d="M11 17h2" />
  </svg>
);

interface Confession {
  confession_id: string;
  content: string;
  campus?: string;
  category?: string;
  author_alias?: string;
  image_url?: string;
  react_count?: number;
  relate_count?: number;
  support_count?: number;
  smile_count?: number;
  heart_count?: number;
  fire_count?: number;
  comment_count?: number;
  created_at?: string;
}

const CATEGORIES = [
  { id: 'all',        label: 'All',        icon: <Globe size={13} /> },
  { id: 'love',       label: 'Love',       icon: <MessageCircleHeart size={13} /> },
  { id: 'academics',  label: 'Academics',  icon: <BookOpen size={13} /> },
  { id: 'gossip',     label: 'Gossip',     icon: <Sparkles size={13} /> },
  { id: 'regrets',    label: 'Regrets',    icon: <Feather size={13} /> },
  { id: 'deep secret',label: 'Deep Secret',icon: <Star size={13} /> },
  { id: 'funny',      label: 'Funny',      icon: <Smile size={13} /> },
];

export default function Confessions() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const { activeModal, setActiveModal, triggerSuccess } = useModalStore();
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [loading, setLoading] = useState(true);
  const [campus] = useState(user?.campus || 'all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsData, setCommentsData] = useState<Record<string, any[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [isCommenting, setIsCommenting] = useState<Record<string, boolean>>({});
  const [trendingConfession, setTrendingConfession] = useState<Confession | null>(null);

  // In-app Image Previewer State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewOptionsOpen, setPreviewOptionsOpen] = useState(false);

  // Reaction Menu State
  const [activeReactionMenu, setActiveReactionMenu] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Modal & Interaction States
  const [activeCommentsModal, setActiveCommentsModal] = useState<string | null>(null);
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});
  const [replyTo, setReplyTo] = useState<{ id: string, author: string } | null>(null);

  const fetchConfessions = async () => {
    setLoading(true);
    try {
      let url = `/confessions?campus=${campus}`;
      if (activeCategory !== 'all') url += `&category=${activeCategory}`;
      
      const response = await api.get(url);
      const data = response.data;
      const list = data.data || data.confessions || (Array.isArray(data) ? data : []);
      setConfessions(list);

      // Pick trending (most reacts)
      if (list.length > 0) {
        const trending = [...list].sort((a: Confession, b: Confession) => (b.react_count || 0) - (a.react_count || 0))[0];
        setTrendingConfession(trending);
      } else {
        setTrendingConfession(null);
      }
    } catch (err) {
      console.error('Failed to fetch confessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfessions();
  }, [campus, activeCategory]);

  const reactedIdsRef = useRef(new Set<string>());

  const handleReact = async (confessionId: string, reactionType: string, e?: React.MouseEvent, forceAdd?: boolean) => {
    if (e) {
      e.stopPropagation();
      emitHeart(e.clientX, e.clientY);
    }
    
    // Synchronously check if we've already sent a "Like" reaction for this confession in this tap-burst
    if (forceAdd && reactedIdsRef.current.has(confessionId)) return;
    
    if (forceAdd) reactedIdsRef.current.add(confessionId);
    
    try {
      await api.post(`/confessions/${confessionId}/react`, { type: reactionType });
      fetchConfessions();
      setActiveReactionMenu(null);
    } catch (err) {
      if (forceAdd) reactedIdsRef.current.delete(confessionId);
      console.error('Error reacting to confession:', err);
    }
  };

  const toggleComments = async (id: string) => {
    setActiveCommentsModal(id);
    try {
      const response = await api.get(`/confessions/${id}/comments`);
      setCommentsData(prev => ({ ...prev, [id]: response.data.data || response.data || [] }));
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  };

  const handleShare = (id: string) => {
    setActiveModal('share', null, { 
      contentUrl: `${window.location.origin}/confessions?id=${id}`,
      isAnonymous: true
    });
  };

  const handleSave = (id: string) => {
    setSavedPosts(prev => ({ ...prev, [id]: !prev[id] }));
    triggerSuccess();
  };

  const handleAddComment = async (confessionId: string) => {
    const text = commentInputs[confessionId];
    if (!text?.trim() || isCommenting[confessionId]) return;

    setIsCommenting(prev => ({ ...prev, [confessionId]: true }));
    try {
      const content = replyTo ? `↳ ${replyTo.author}: ${text}` : text;
      await api.post(`/confessions/${confessionId}/comments`, { 
        content,
        parent_id: replyTo?.id 
      });
      setCommentInputs(prev => ({ ...prev, [confessionId]: '' }));
      setReplyTo(null);
      const response = await api.get(`/confessions/${confessionId}/comments`);
      setCommentsData(prev => ({ ...prev, [confessionId]: response.data.data || response.data || [] }));
      setConfessions(prev => prev.map(c => 
        c.confession_id === confessionId ? { ...c, comment_count: (c.comment_count || 0) + 1 } : c
      ));
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsCommenting(prev => ({ ...prev, [confessionId]: false }));
    }
  };

  return (
    <div className="flex bg-[#FBFBFD] min-h-screen text-[#1D1D1F] font-sans selection:bg-primary/10">
      {/* Background blobs */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none z-0" />

      <main className="flex-1 relative z-10 w-full max-w-[680px] mx-auto min-h-screen flex flex-col pb-28">

        {/* ── Sticky Header ── */}
        <div className="sticky top-0 z-50 bg-[#FBFBFD]/80 backdrop-blur-3xl border-b border-gray-200/20">
          {/* Top row */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-primary transition-all active:scale-95"
              >
                <ArrowLeft size={19} strokeWidth={2.5} />
              </button>
              <div>
                <h1 className="text-lg font-black tracking-tight text-gray-900 uppercase italic leading-none">Confessions</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="flex -space-x-0.5">
                    {[1,2,3].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse"
                        style={{ animationDelay: `${i * 250}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-[8px] font-black text-primary uppercase tracking-[0.18em]">Village Spectrum LIVE</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-primary transition-all shadow-sm active:scale-95">
                <TrendingUp size={17} />
              </button>
              {/* Plus button opens the local ConfessionModal */}
              <button
                onClick={() => setShowComposeModal(true)}
                className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center transition-all shadow-lg shadow-primary/30 hover:scale-105 active:scale-95"
              >
                <Plus size={20} strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* ── Category Tabs (horizontal scrollable) ── */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 pb-3 pt-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border flex-shrink-0 ${
                  activeCategory === cat.id
                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105'
                    : 'bg-white text-gray-400 border-gray-100 hover:text-primary hover:border-primary/20'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable Feed ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Pulse of the Village – Trending Card */}
          {trendingConfession && !loading && (
            <div className="mx-4 mt-5 mb-6 animate-fade-in">
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-[28px] p-5 relative overflow-hidden shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]">
                {/* flame icon */}
                <div className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                  <Flame size={20} className="text-primary animate-pulse" />
                </div>

                <div className="relative z-10 pr-12">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/20 mb-3">
                    <Sparkles size={10} className="text-primary" />
                    <span className="text-[8px] font-black text-primary uppercase tracking-widest">Pulse of the Hour</span>
                  </div>

                  <p className="text-base font-black text-white italic tracking-tight leading-snug mb-5 line-clamp-3">
                    "{trendingConfession.content}"
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-7 h-7 rounded-full border-2 border-gray-900 bg-gray-800 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                          </div>
                        ))}
                      </div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{trendingConfession.react_count || 0} resonating</span>
                    </div>
                    <button
                      onClick={() => navigate(`/confessions/${trendingConfession.confession_id}`)}
                      className="h-9 px-5 bg-white text-black rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95"
                    >
                      Join Echo
                    </button>
                  </div>
                </div>

                {/* Decorative glows */}
                <div className="absolute bottom-[-30%] left-[-10%] w-40 h-40 bg-primary/25 rounded-full blur-[70px] pointer-events-none" />
                <div className="absolute top-[-20%] right-[-10%] w-28 h-28 bg-blue-500/10 rounded-full blur-[50px] pointer-events-none" />
              </div>
            </div>
          )}

          {/* Live Ticker */}
          <div className="overflow-x-auto no-scrollbar px-4 mb-5">
            <div className="flex items-center gap-8 min-w-max pb-1">
              {[
                { label: 'Village Sync', value: 'ACTIVE',     icon: <Globe size={16} /> },
                { label: 'Global Pulses', value: '24.8K',     icon: <Orbit size={16} /> },
                { label: 'Anonymity',    value: '100% SECURE', icon: <ShieldCheck size={16} /> },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-3 group/stat">
                  <div className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-primary group-hover/stat:bg-primary group-hover/stat:text-white transition-all duration-300">
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">{stat.label}</p>
                    <p className="text-[13px] font-black text-gray-900 uppercase italic">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Feed Cards ── */}
          <div className="flex flex-col gap-4 px-4 pb-8">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center">
                <div className="mb-20">
                  <Spinner size="large" color="text-primary" />
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] animate-pulse">Scanning Nodes...</p>
              </div>
            ) : confessions.length > 0 ? (
              confessions.map((conf, idx) => (
                <div
                  key={conf.confession_id || idx}
                  className="bg-white rounded-[28px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-gray-100/60 transition-all duration-500 animate-fade-in hover:shadow-[0_12px_40px_rgba(0,0,0,0.07)] group flex flex-col relative"
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  <div className="absolute -right-5 -bottom-5 text-black/[0.03] -rotate-12 z-0 pointer-events-none" aria-hidden>
                    <SpyIcon size={160} />
                  </div>
                  
                  {/* Text & Header Section */}
                  <div className="p-5 pb-4 relative z-10">
                    {/* Card header */}
                    <div className="flex items-start gap-3 mb-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md bg-gradient-to-br
                      ${idx % 4 === 0 ? 'from-pink-500 to-rose-400 shadow-pink-100'
                      : idx % 4 === 1 ? 'from-blue-500 to-indigo-400 shadow-blue-100'
                      : idx % 4 === 2 ? 'from-emerald-500 to-teal-400 shadow-emerald-100'
                      : 'from-amber-400 to-orange-400 shadow-amber-100'}`}
                    >
                      <SpyIcon size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-gray-900 uppercase italic truncate">
                          {conf.author_alias || `Anonymous #${idx + 100}`}
                        </span>
                        <span className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider ml-2 flex-shrink-0">
                          {conf.created_at ? new Date(conf.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Live'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-2 py-0.5 bg-emerald-50 text-[7px] font-black text-emerald-600 rounded uppercase tracking-widest border border-emerald-100/60">
                          Encrypted
                        </span>
                        {conf.category && (
                          <span className="text-[8px] font-black text-primary uppercase tracking-wider italic">
                            {conf.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <p className={`text-gray-800 leading-relaxed mb-5 tracking-tight px-0.5
                    ${conf.content.length > 180 ? 'text-[15px] font-medium' : 'text-lg font-bold'}`}
                  >
                    {conf.content}
                  </p>
                  </div>

                  {/* Attached Image (Edge-to-Edge) */}
                  {conf.image_url && (
                    <div 
                      className="relative bg-black cursor-pointer border-y border-gray-100 overflow-hidden"
                      onClick={(e) => {
                        emitHeart(e.clientX, e.clientY);
                        setPreviewImage(conf.image_url!);
                      }}
                      onDoubleClick={(e) => handleReact(conf.confession_id, 'heart', e, true)}
                    >
                      <img
                        src={conf.image_url}
                        alt="Confession attachment"
                        className="w-full h-auto object-contain max-h-[600px] transition-transform duration-500 hover:scale-[1.02]"
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-xl px-2.5 py-1.5 border border-white/10 shadow-lg">
                        <ShieldOff size={12} className="text-amber-400" />
                        <span className="text-[9px] font-black text-amber-50 uppercase tracking-widest">May reduce anonymity</span>
                      </div>
                    </div>
                  )}

                  {/* Actions & Comments Section */}
                  <div 
                    className="p-4 pt-3 relative cursor-pointer active:bg-gray-50/50 transition-colors"
                    onClick={(e) => handleReact(conf.confession_id, 'heart', e, true)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        {/* Reaction Button & Popover */}
                        <div className="relative">
                          <button
                            onClick={() => {
                              setActiveReactionMenu(activeReactionMenu === conf.confession_id ? null : conf.confession_id);
                              setShowEmojiPicker(false);
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all active:scale-90 group/react ${
                              activeReactionMenu === conf.confession_id ? 'text-primary' : 'text-gray-400 hover:text-primary hover:bg-primary/5'
                            }`}
                          >
                            <HeartIcon 
                              size={20} 
                              active={activeReactionMenu === conf.confession_id}
                              className="transition-transform group-hover/react:scale-110" 
                            />
                            <span className="text-[13px] font-bold tracking-tight">
                              {formatCount((conf.smile_count || 0) + (conf.relate_count || 0) + (conf.heart_count || 0) + (conf.fire_count || 0) + (conf.support_count || 0) || conf.react_count || 0)}
                            </span>
                          </button>

                          {/* Reaction Palette Popover */}
                          {activeReactionMenu === conf.confession_id && (
                            <div className="absolute left-0 bottom-14 bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 p-4 animate-scale-in z-50 min-w-[250px]">
                              {!showEmojiPicker ? (
                                <>
                                  <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-gray-50">
                                    {(conf.smile_count || 0) > 0 && <div className="flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-lg">😂 {conf.smile_count}</div>}
                                    {(conf.relate_count || 0) > 0 && <div className="flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-lg">😭 {conf.relate_count}</div>}
                                    {(conf.heart_count || 0) > 0 && <div className="flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-lg">❤️ {conf.heart_count}</div>}
                                    {(conf.fire_count || 0) > 0 && <div className="flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-lg">🔥 {conf.fire_count}</div>}
                                    {(conf.support_count || 0) > 0 && <div className="flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-lg">🥺 {conf.support_count}</div>}
                                    {((conf.smile_count || 0) + (conf.relate_count || 0) + (conf.heart_count || 0) + (conf.fire_count || 0) + (conf.support_count || 0)) === 0 && (
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mx-auto italic">Resonate first</span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between gap-1">
                                    {[
                                      { emoji: '😂', type: 'funny' },
                                      { emoji: '😭', type: 'relate' },
                                      { emoji: '❤️', type: 'heart' },
                                      { emoji: '🔥', type: 'fire' },
                                      { emoji: '🥺', type: 'support' },
                                    ].map(({ emoji, type }) => (
                                      <button
                                        key={type}
                                        onClick={() => handleReact(conf.confession_id, type)}
                                        className="text-2xl w-10 h-10 flex items-center justify-center hover:scale-125 hover:-translate-y-2 transition-all duration-300 origin-bottom"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                    <button
                                      onClick={() => setShowEmojiPicker(true)}
                                      className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-primary hover:text-white transition-all ml-1"
                                    >
                                      <Plus size={18} strokeWidth={2.5} />
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="h-[320px] w-[300px] -m-4 overflow-hidden rounded-[24px] flex justify-center">
                                  <Picker 
                                    data={data} 
                                    onEmojiSelect={(emoji: any) => {
                                      const typeMap: Record<string, string> = {
                                        '😂': 'funny', '😭': 'relate', '❤️': 'heart', '🔥': 'fire', '🥺': 'support'
                                      };
                                      handleReact(conf.confession_id, typeMap[emoji.native] || 'heart');
                                    }} 
                                    theme="light"
                                    previewPosition="none"
                                    skinTonePosition="none"
                                    searchPosition="none"
                                    navPosition="none"
                                    perLine={8}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Comments */}
                        <button
                          onClick={() => toggleComments(conf.confession_id)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-primary hover:bg-primary/5 transition-all active:scale-90 group/comment"
                        >
                          <CommentIcon size={20} className="transition-transform group-hover/comment:scale-110" />
                          <span className="text-[13px] font-bold tracking-tight">{formatCount(conf.comment_count || 0)}</span>
                        </button>

                        {/* Send / Share */}
                        <button 
                          onClick={() => handleShare(conf.confession_id)}
                          className="flex items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:text-primary hover:bg-primary/5 transition-all active:scale-90 group"
                        >
                          <SendIcon className="transition-transform group-hover:scale-110" />
                        </button>
                      </div>

                      {/* Bookmark / Save */}
                      <button 
                        onClick={() => handleSave(conf.confession_id)}
                        className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                          savedPosts[conf.confession_id] ? 'text-yellow-500 bg-yellow-50/50' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50/50'
                        }`}
                      >
                        <BookmarkIcon active={savedPosts[conf.confession_id]} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-32 flex flex-col items-center gap-6 text-center">
                <div className="w-20 h-20 rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <Orbit size={36} strokeWidth={1.5} className="text-gray-200 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-300 uppercase italic tracking-tight">Sector Vacuum</h3>
                  <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mt-1">No confessions in this category yet.</p>
                </div>
                <button
                  onClick={() => setShowComposeModal(true)}
                  className="px-6 h-10 bg-primary/10 border border-primary/20 text-primary rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                >
                  Be the First
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Local ConfessionModal overlay — no Navbar on this page */}
      {showComposeModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 bg-black/20 backdrop-blur-xl animate-fade-in"
          onClick={() => setShowComposeModal(false)}
        >
          <div className="w-full max-w-lg animate-scale-in" onClick={e => e.stopPropagation()}>
            <ConfessionModal
              onClose={() => setShowComposeModal(false)}
              onSuccess={() => {
                setShowComposeModal(false);
                fetchConfessions();
              }}
            />
          </div>
        </div>
      )}

      {/* ── Global Modals for this isolated view ── */}
      {activeModal === 'share' && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <ShareModal onClose={() => setActiveModal(null)} />
        </div>
      )}

      {/* ── In-App Image Previewer ── */}
      {previewImage && (
        <div className="fixed inset-0 z-[10000] flex flex-col bg-black/95 animate-fade-in backdrop-blur-xl">
          {/* Top Bar */}
          <div className="flex items-center justify-between p-4 px-5 safe-pt">
            <button 
              onClick={() => { setPreviewImage(null); setPreviewOptionsOpen(false); }}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
            <div className="relative">
              <button 
                onClick={() => setPreviewOptionsOpen(!previewOptionsOpen)}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <MoreHorizontal size={20} />
              </button>
              
              {/* Dropdown Menu */}
              {previewOptionsOpen && (
                <div className="absolute right-0 top-12 w-56 bg-gray-900 rounded-2xl p-2 border border-white/10 shadow-2xl animate-fade-in origin-top-right">
                  <button 
                    onClick={() => { 
                      window.open(previewImage, '_blank'); 
                      setPreviewOptionsOpen(false); 
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left text-white hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <Download size={16} />
                    <span className="text-[13px] font-bold">Save Image</span>
                  </button>
                  <button 
                    onClick={() => { alert('Reported'); setPreviewOptionsOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left text-rose-400 hover:bg-white/10 rounded-xl transition-colors mt-1"
                  >
                    <Flag size={16} />
                    <span className="text-[13px] font-bold">Report</span>
                  </button>
                  <div className="h-px bg-white/10 my-1 mx-2" />
                  <button 
                    onClick={() => { setPreviewImage(null); setPreviewOptionsOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left text-gray-300 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <ShieldOff size={16} />
                    <span className="text-[13px] font-bold">I don't want to see this</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Image Container */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={() => setPreviewOptionsOpen(false)}>
            <img 
              src={previewImage} 
              alt="Preview" 
              className="w-full h-full object-contain drop-shadow-2xl select-none"
            />
          </div>
        </div>
      )}

      {/* ── Confession Comments Modal ── */}
      {activeCommentsModal && (
        <div className="fixed inset-0 z-[9999] flex justify-center items-end sm:items-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white sm:rounded-[32px] rounded-t-[32px] h-[85vh] sm:h-[80vh] flex flex-col shadow-2xl animate-slide-up sm:animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <MessageCircle size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">Anonymous Replies</h3>
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest">{commentsData[activeCommentsModal]?.length || 0} Total</p>
                </div>
              </div>
              <button 
                onClick={() => { setActiveCommentsModal(null); setReplyTo(null); }}
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
              {commentsData[activeCommentsModal]?.length === 0 ? (
                <div className="py-20 flex flex-col items-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
                    <SpyIcon size={24} className="text-gray-300" />
                  </div>
                  <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">No replies yet. Whisper first.</p>
                </div>
              ) : (
                (commentsData[activeCommentsModal] || [])
                  .filter((c: any) => !c.parent_id)
                  .map((comment, cIdx) => {
                    const replies = (commentsData[activeCommentsModal] || [])
                      .filter((c: any) => c.parent_id === comment.comment_id);
                    
                    return (
                      <div key={comment.comment_id || cIdx} className="animate-fade-in" style={{ animationDelay: `${cIdx * 50}ms` }}>
                        {/* Parent Comment */}
                        <div className="flex gap-3 group/comment mb-3">
                          <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <SpyIcon size={18} className="text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-[11px] font-black uppercase tracking-tight italic ${
                                  comment.author === 'Author' ? 'text-primary' : 'text-gray-700'
                                }`}>
                                  {comment.author}
                                  {comment.author === 'Author' && (
                                    <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[8px] normal-case not-italic tracking-normal">OP</span>
                                  )}
                                </span>
                                <span className="text-[9px] font-semibold text-gray-300">
                                  {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[14px] font-medium text-gray-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                            </div>
                            
                            {/* Reply action & Toggle */}
                            <div className="mt-1 ml-2 flex items-center gap-4">
                              <button 
                                onClick={() => setReplyTo({ id: comment.comment_id, author: comment.author })}
                                className="text-[10px] font-bold text-gray-400 hover:text-primary uppercase tracking-wider transition-colors"
                              >
                                Reply
                              </button>
                              
                              {replies.length > 0 && (
                                <button 
                                  onClick={() => setExpandedComments(prev => ({ ...prev, [comment.comment_id]: !prev[comment.comment_id] }))}
                                  className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                  {expandedComments[comment.comment_id] ? 'See Less' : `View ${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}`}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Visual nesting for replies (Conditional Rendering) */}
                        {replies.length > 0 && expandedComments[comment.comment_id] && (
                          <div className="ml-8 border-l-2 border-gray-50 pl-4 space-y-3 mt-1 mb-4 animate-fade-in">
                            {replies.map((reply: any, rIdx: number) => (
                              <div key={reply.comment_id || rIdx} className="flex gap-3 group/reply">
                                <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                                  <SpyIcon size={14} className="text-gray-300" />  
                                </div>
                                <div className="flex-1">
                                  <div className="bg-gray-50/50 rounded-2xl rounded-tl-sm px-3 py-2 border border-gray-100/50">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className={`text-[10px] font-black uppercase tracking-tight italic ${
                                        reply.author === 'Author' ? 'text-primary' : 'text-gray-700'
                                      }`}>
                                        {reply.author}
                                        {reply.author === 'Author' && (
                                          <span className="ml-1 px-1 py-0.5 bg-primary/10 text-primary rounded text-[7px] normal-case not-italic tracking-normal">OP</span>
                                        )}
                                      </span>
                                      <span className="text-[8px] font-semibold text-gray-300">
                                        {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-[13px] font-medium text-gray-600 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
        </div>

        {/* Input Area */}
            <div className="p-4 border-t border-gray-100 bg-white sm:rounded-b-[32px] mb-safe">
              {replyTo && (
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                    <ArrowLeft size={10} /> Replying to {replyTo.author}
                  </span>
                  <button onClick={() => setReplyTo(null)} className="text-[10px] font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              )}
              <div className="flex gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gray-900 flex items-center justify-center flex-shrink-0 shadow-md">
                  <SpyIcon size={20} className="text-white" />
                </div>
                <div className="flex-1 relative">
                  <input
                    value={commentInputs[activeCommentsModal] || ''}
                    onChange={e => setCommentInputs(prev => ({ ...prev, [activeCommentsModal]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddComment(activeCommentsModal)}
                    placeholder={replyTo ? `Whisper to ${replyTo.author}...` : "Whisper into the void..."}
                    className="w-full h-11 bg-gray-50 border border-transparent rounded-2xl pl-4 pr-12 text-[14px] font-medium focus:bg-white focus:border-primary/20 focus:shadow-sm outline-none transition-all"
                  />
                  <button
                    onClick={() => handleAddComment(activeCommentsModal)}
                    disabled={!commentInputs[activeCommentsModal]?.trim() || isCommenting[activeCommentsModal]}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-0 transition-all active:scale-95 shadow-md shadow-primary/20"
                  >
                    <Send size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 40s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}


