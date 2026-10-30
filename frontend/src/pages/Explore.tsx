import Skeleton from '../components/ui/Skeleton';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, MessageCircle, Heart, Search } from 'lucide-react';
import api from '../api/api';
import Spinner from '../components/ui/Spinner';
import ModernOfflineState from '../components/ui/ModernOfflineState';
import { logger } from '../utils/logger';

interface ExploreItem {
  id: string;
  type: 'post' | 'moment';
  content?: string;
  username: string;
  avatar_url?: string;
  media_url?: string;
  media_type?: string;
  likes: number;
  comments: number;
}

export default function Explore() {
  const navigate = useNavigate();
  const [mediaItems, setMediaItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('For You');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchError, setFetchError] = useState<{ posts: boolean; moments: boolean } | null>(null);
  const reqSeqRef = useRef(0);

  const categories = ['For You', 'Trending', 'Campus', 'Style', 'Events', 'Music', 'Sports'];

  useEffect(() => { 
    setPage(1);
    setHasMore(true);
    fetchExploreMedia(1); 
  }, [activeCategory]);

  const fetchExploreMedia = async (pageNum: number) => {
    if (pageNum !== 1 && loadingMore) return;
    const seq = ++reqSeqRef.current;

    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      // Read from local cache instantly on first load (keyed per category)
      if (pageNum === 1) {
        const cached = localStorage.getItem(`explore_cache:${activeCategory}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.length > 0) {
              setMediaItems(parsed);
              setLoading(false); // UI shows cached data immediately
            }
          } catch (e) {}
        }
      }

      // Map selected category to backend params:
      // - "For You"/"Trending" → posts mode (separate cache keys per mode)
      // - named categories → moments query (search-intent hint) + posts mode cache key
      const categorySlug = activeCategory.toLowerCase().replace(/\s+/g, '_');
      const postsMode = activeCategory === 'For You' ? 'for_you' : activeCategory === 'Trending' ? 'trending' : `explore_${categorySlug}`;
      const momentsQuery = activeCategory === 'For You' || activeCategory === 'Trending' ? '' : `&query=${encodeURIComponent(activeCategory.toLowerCase())}`;

      // Fetch from both endpoints. Distinguish "empty result" from "request failed"
      // so we never show a failed request as an empty feed.
      let postsFailed = false;
      let momentsFailed = false;

      const [postsRes, momentsRes] = await Promise.all([
        api.get(`/posts/feed?limit=15&offset=${(pageNum - 1) * 15}&mode=${postsMode}`).catch((e) => {
          postsFailed = true;
          logger.error('Explore posts fetch failed:', e.message);
          return { data: [] };
        }),
        api.get(`/moments/stream?limit=15&page=${pageNum - 1}${momentsQuery}`).catch((e) => {
          momentsFailed = true;
          logger.error('Explore moments fetch failed:', e.message);
          return { data: { moments: [] } };
        })
      ]);

      const postsData = Array.isArray(postsRes.data) ? postsRes.data : (postsRes.data.posts || []);
      const momentsData = momentsRes.data.moments || momentsRes.data || [];

      // Report total failure when both sources fail on the first page
      if (pageNum === 1 && postsFailed && momentsFailed) {
        setFetchError({ posts: true, moments: true });
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // Clear error if we got any data
      if (pageNum === 1 && (postsData.length > 0 || momentsData.length > 0)) {
        setFetchError(null);
      }

      // Normalize items
      const normalizedPosts = postsData.map((p: any) => ({
        id: p.post_id,
        type: 'post',
        username: p.username,
        avatar_url: p.avatar_url,
        media_url: p.media_url,
        media_type: p.media_type,
        likes: p.sparks || 0,
        comments: p.comments || 0,
        content: p.content
      }));

      const normalizedMoments = momentsData.map((m: any) => {
        const isVid = m.media_type === 'video' || m.is_video || !!m.video_url || (m.media_url && String(m.media_url).match(/\.(mp4|webm|mov)$/i));
        return {
          id: m.moment_id,
          type: 'moment',
          username: m.username,
          avatar_url: m.avatar_url,
          media_url: m.video_url || m.media_url || m.thumbnail_url,
          media_type: isVid ? 'video' : 'image',
          likes: m.like_count || 0,
          comments: m.comment_count || 0,
          content: m.caption
        };
      });

      let combined = [...normalizedPosts, ...normalizedMoments];
      combined = combined.filter(item => (item.media_url && item.media_url !== '/uploads/defaults/no-image.png') || item.content);
      
      // Shuffle the items
      combined = combined.sort(() => Math.random() - 0.5);

      if (seq !== reqSeqRef.current) return; // stale response — a newer fetch superseded this one

      setMediaItems(prev => {
        // If page 1, replace (we might have shown cache). Avoid duplicates if appending.
        if (pageNum === 1) {
          localStorage.setItem(`explore_cache:${activeCategory}`, JSON.stringify(combined.slice(0, 30)));
          return combined;
        } else {
          // Filter duplicates just in case
          const existingIds = new Set(prev.map(i => i.id));
          const newUnique = combined.filter(i => !existingIds.has(i.id));
          return [...prev, ...newUnique];
        }
      });
      
      if (pageNum > 1 && postsData.length + momentsData.length < 15) {
        setHasMore(false); // short page → feed exhausted
      }
    } catch (err) {
      logger.error('Explore fetch error:', err);
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchExploreMedia(nextPage);
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, loadingMore, hasMore, page]);

  const filteredItems = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return mediaItems;
    return mediaItems.filter(item =>
      (item.username || '').toLowerCase().includes(q) ||
      (item.content || '').toLowerCase().includes(q)
    );
  })();

  return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 font-sans overflow-hidden transition-colors duration-300">

      {/* Main Content Area */}
      <div className="flex-1 w-full">
        {/* Sticky Header with Search & Filters */}
        <div className="sticky top-0 z-40 bg-[#fdf8fa]/80 dark:bg-zinc-800/80 backdrop-blur-3xl border-b border-[#ede3e9] dark:border-zinc-700 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 md:px-8 transition-all">
          <div className="max-w-5xl mx-auto flex flex-col gap-4">
             <div className="flex items-center gap-3">
              <div className="relative flex-1 group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-zinc-300 group-focus-within:text-primary transition-colors duration-300" size={18} />
                 <input
                   type="text"
                   placeholder="Search Sparkle Discovery..."
                   value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="sparkle-input pl-12 h-11 md:h-12 !rounded-full !bg-[#f6eef3] dark:!bg-zinc-900 focus:!bg-[#fdf8fa] dark:focus:!bg-zinc-800 text-[#18181b] dark:text-zinc-100 border-none shadow-sm"
               />
            </div>
            </div>
            
            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-6 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 border ${
                    activeCategory === cat
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-[#fdf8fa] dark:bg-zinc-800 border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-primary/20 hover:text-primary'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="max-w-5xl mx-auto px-1 md:px-8 py-4">
          {loading && page === 1 && mediaItems.length === 0 ? (
            <div className="grid grid-cols-3 gap-1 md:gap-6">
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="aspect-square border border-[#ede3e9] dark:border-zinc-700 rounded-md md:rounded-2xl" />
              ))}
            </div>
          ) : fetchError && mediaItems.length === 0 ? (
            <div className="py-20">
              <ModernOfflineState 
                type="error"
                title="Couldn't load your feed"
                message="Both post and moment feeds failed to load. Please check your connection and try again."
                onRetry={() => { setFetchError(null); fetchExploreMedia(1); }}
              />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20">
               <ModernOfflineState 
                 type="empty"
                 title={searchQuery.trim() ? 'No matches' : 'Nothing to see yet'}
                 message={searchQuery.trim()
                   ? `Nothing found for "${searchQuery.trim()}". Try a different name or keyword.`
                   : 'There are no posts here right now. Try looking in a different category or refresh the page!'}
                 onRetry={() => fetchExploreMedia(1)}
               />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 md:gap-6 pb-24">
              {filteredItems.map((m, i) => {
                let spanClass = "col-span-1 row-span-1 aspect-square";
                if (i % 10 === 0) {
                  spanClass = "col-span-2 row-span-2";
                } else if (i % 10 === 6) {
                  spanClass = "col-span-2 row-span-2";
                }

                const isLastElement = i === filteredItems.length - 1;

                return (
                   <div 
                    ref={isLastElement ? lastElementRef : null}
                    key={`${m.id}-${i}`} 
                     className={`group relative cursor-pointer overflow-hidden rounded-xl md:rounded-3xl bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 ${spanClass}`}
                    onClick={() => {
                      if (m.type === 'moment') {
                        navigate(`/moments/${m.id}`);
                      } else {
                        navigate(`/post/${m.id}`);
                      }
                    }}
                  >
                    {m.media_type === 'video' ? (
                      <video
                        src={m.media_url}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <img
                        src={m.media_url || 'https://placehold.co/400x400?text=Image+Error'}
                        alt={m.content || m.username}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                      />
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-4">
                      <div className="flex gap-6 items-center">
                        <div className="flex items-center gap-2 text-white font-bold text-lg md:text-xl">
                          <Heart size={24} fill="white" />
                          <span>{formatCount(m.likes || 0)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white font-bold text-lg md:text-xl">
                          <MessageCircle size={24} fill="white" />
                          <span>{formatCount(m.comments || 0)}</span>
                        </div>
                      </div>
                      
                      <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 opacity-0 group-hover:opacity-100">
                        <img src={m.avatar_url || '/uploads/avatars/no-profile.png'} className="w-8 h-8 rounded-full border-2 border-white object-cover shadow-md" alt="" />
                        <span className="text-white font-semibold text-sm truncate drop-shadow-md">@{m.username}</span>
                      </div>
                    </div>

                    {/* Top Right Icon for Video/Moments */}
                    <div className="absolute top-2 right-2 md:top-4 md:right-4 flex gap-2">
                      {m.type === 'moment' && (
                        <div className="text-white drop-shadow-lg p-1.5 md:p-2 bg-primary/80 rounded-full backdrop-blur-md">
                           <Play size={14} fill="currentColor" />
                        </div>
                      )}
                      {m.type === 'post' && m.media_type === 'video' && (
                        <div className="text-white drop-shadow-lg p-1.5 md:p-2 bg-black/30 rounded-full backdrop-blur-md">
                           <Play size={14} fill="currentColor" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {loadingMore && (
                <div className="col-span-3 py-8 flex justify-center">
                  <Spinner size="medium" color="text-primary" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function formatCount(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}



