import React, { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/api";
import PostCard from "./PostCard";
import type { Post } from "../types/post";
import { useNavigate } from "react-router-dom";
import { useDeviceSeed } from "../hooks/useDeviceSeed";
import Spinner from "./ui/Spinner";
import { Orbit, UserPlus, Check } from "lucide-react";
import ModernOfflineState from "./ui/ModernOfflineState";
import { useNetworkStore } from "../store/networkStore";
import { getOptimizedMediaUrl } from "../utils/imageUtils";
import { PrefetchEngine, MediaCacheService } from "../services/FeedCacheService";

const LIMIT = 10;

interface VirtualizedFeedProps {
  initialPosts?: Post[];
  suggestions?: any[];
}

/**
 * 1. Shimmer Skeleton Card Placeholder
 * Prevents flashing content or layout jumping.
 */
const SkeletonCard = () => {
  const theme = useNetworkStore((state) => state.isOffline); // Simple dark/light adaptation
  const shimmerClass = "animate-shimmer bg-black/5 dark:bg-white/5";

  return (
    <div className="w-full bg-white dark:bg-black rounded-none sm:rounded-[12px] border-b sm:border border-black/5 dark:border-white/10 p-5 flex flex-col gap-4">
      {/* User Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full shrink-0 ${shimmerClass}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-4 rounded w-1/4 ${shimmerClass}`} />
          <div className={`h-3 rounded w-1/6 ${shimmerClass}`} />
        </div>
      </div>
      {/* Content text */}
      <div className="space-y-2">
        <div className={`h-3 rounded w-full ${shimmerClass}`} />
        <div className={`h-3 rounded w-5/6 ${shimmerClass}`} />
      </div>
      {/* Media Box */}
      <div className={`h-52 rounded-xl w-full ${shimmerClass}`} />
      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className={`h-5 rounded w-1/4 ${shimmerClass}`} />
        <div className={`h-5 rounded w-1/4 ${shimmerClass}`} />
      </div>
    </div>
  );
};

/**
 * 2. ViewportAwareCard
 * Direct virtualization engine. Unmounts cards that are far away from viewport 
 * to free up memory and prevent scrolls lag. Triggers background media cache preloading.
 */
const ViewportAwareCard = React.memo(({ 
  post, 
  onDeleted, 
  posts, 
  index 
}: { 
  post: Post; 
  onDeleted: (id: string) => void;
  posts: Post[];
  index: number;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const { quality } = useNetworkStore();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // A. Observer for Virtualization: mounts/unmounts off-screen content
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(entry.isIntersecting);

        if (entry.isIntersecting && entry.boundingClientRect.height > 0) {
          // Lock height dynamically to avoid page shifting when scrolling
          setMeasuredHeight(entry.boundingClientRect.height);
        }
      },
      { rootMargin: "1000px 0px 1000px 0px" } // Large buffer to prevent pop-in flickers
    );

    // B. Observer for Predictive Preloading: starts cache prefetch before user reaches the card
    const prefetchObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Trigger preloading of next few items predictively based on connection quality
          PrefetchEngine.preloadNextItems(posts, index, quality);
        }
      },
      { rootMargin: "1800px 0px 1800px 0px" } // Triggers extremely early
    );

    visibilityObserver.observe(el);
    prefetchObserver.observe(el);

    return () => {
      visibilityObserver.disconnect();
      prefetchObserver.disconnect();
    };
  }, [posts, index, quality]);

  return (
    <div 
      ref={containerRef} 
      style={{ minHeight: measuredHeight ? `${measuredHeight}px` : "280px" }}
      className="transition-all duration-300"
    >
      {isVisible ? (
        <PostCard post={post} onDeleted={onDeleted} />
      ) : (
        <SkeletonCard />
      )}
    </div>
  );
});

/**
 * 3. SuggestionRow
 * Premium recommendations row for expanding social networking.
 */
const SuggestionRow = React.memo(({ suggestions }: { suggestions: any[] }) => {
  const navigate = useNavigate();
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  const handleFollow = async (userId: string) => {
    try {
      await api.post(`/users/${userId}/follow`);
      setFollowing(prev => ({ ...prev, [userId]: true }));
    } catch (err) {
      console.error('Follow failed', err);
    }
  };

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="mb-3 bg-white dark:bg-black rounded-none sm:rounded-[12px] shadow-sm dark:shadow-none p-5 border-b sm:border border-black/5 dark:border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[12px] font-black text-black/35 dark:text-white/30 uppercase tracking-widest">Suggested accounts</h3>
        <button onClick={() => navigate('/connect')} className="text-[11px] font-black text-primary hover:underline uppercase tracking-widest">See all</button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        {suggestions.slice(0, 6).map((s) => (
          <div key={s.user_id} className="flex-shrink-0 w-32 flex flex-col items-center text-center gap-2.5 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/5 border border-black/5 dark:border-white/5 transition-transform hover:scale-[1.02]">
            <img 
              src={s.avatar_url || '/uploads/avatars/default.png'} 
              className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-black shadow-md cursor-pointer" 
              alt=""
              onClick={() => navigate(`/profile/${s.username}`)}
            />
            <div className="min-w-0 w-full px-1">
              <p className="text-[13px] font-black text-black dark:text-white truncate tracking-tight">{s.username}</p>
              <p className="text-[11px] text-black/40 dark:text-white/40 truncate uppercase font-bold tracking-wider">{s.campus || 'Sparkle'}</p>
            </div>
            <button 
              onClick={() => handleFollow(s.user_id)}
              disabled={following[s.user_id]}
              className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                following[s.user_id] 
                ? 'bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/30 border-black/5 dark:border-white/5' 
                : 'bg-primary text-white border-primary shadow-sm hover:scale-[1.03] active:scale-95'
              }`}
            >
              {following[s.user_id] ? <Check size={12} strokeWidth={3} /> : <UserPlus size={12} strokeWidth={3} />}
              {following[s.user_id] ? 'Joined' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * 4. Main VirtualizedFeed Component
 */
export default function VirtualizedFeed({ initialPosts = [], suggestions = [] }: VirtualizedFeedProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { seed, deviceId } = useDeviceSeed();
  const { isOffline, quality } = useNetworkStore();

  const loadingRef = useRef(false);
  const lastFetchTime = useRef(0);
  const seenPosts = useRef(new Set<string>(initialPosts.map((p) => p.post_id)));
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [error429, setError429] = useState(false);

  // Synchronize local states with global feed store changes dynamically
  useEffect(() => {
    if (initialPosts && initialPosts.length > 0) {
      setPosts(initialPosts);
      seenPosts.current = new Set(initialPosts.map(p => p.post_id));
    }
  }, [initialPosts]);

  // Fetch next cursor-based page of posts
  const fetchFeed = useCallback(
    async (isInitial = false) => {
      const now = Date.now();
      if (!isInitial && now - lastFetchTime.current < 2000) return;
      
      if (loadingRef.current || (!isInitial && !hasMore) || isOffline) return;
      loadingRef.current = true;
      setLoading(true);
      setError429(false);

      try {
        const res = await api.get("/posts/feed", {
          params: {
            limit: LIMIT,
            seed,
            device_id: deviceId,
            force: isInitial,
          },
        });

        const newPosts: Post[] = res.data.posts || res.data.feed || [];
        lastFetchTime.current = Date.now();

        // Stale-first architecture deduplication
        const filtered = newPosts.filter((p) => {
          if (seenPosts.current.has(p.post_id)) return false;
          seenPosts.current.add(p.post_id);
          return true;
        });
        
        if (isInitial) {
          setPosts(filtered);
          seenPosts.current = new Set(filtered.map(p => p.post_id));
        } else {
          setPosts((prev) => {
            const final = [...prev];
            filtered.forEach(p => {
              if (!final.some(existing => existing.post_id === p.post_id)) {
                final.push(p);
              }
            });
            return final;
          });
        }

        setHasMore(res.data.hasMore !== false && newPosts.length > 0);
      } catch (err: any) {
        console.error("Feed fetch error:", err);
        if (err.response?.status === 429) {
          setError429(true);
          setTimeout(() => fetchFeed(isInitial), 3000);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [hasMore, seed, deviceId, isOffline]
  );

  // Fetch new posts (delta focus refresh)
  const fetchNewPosts = useCallback(async () => {
    if (posts.length === 0 || loadingRef.current || isOffline) return;

    try {
      const res = await api.get("/posts/new", {
        params: { since: posts[0].post_id },
      });

      const newPosts: Post[] = res.data.posts || [];

      const filtered = newPosts.filter((p) => {
        if (seenPosts.current.has(p.post_id)) return false;
        seenPosts.current.add(p.post_id);
        return true;
      });

      if (filtered.length > 0) {
        setPosts((prev) => [...filtered, ...prev]);
      }
    } catch (err) {
      console.error("Delta fetch error:", err);
    }
  }, [posts, isOffline]);

  // Initial load if empty
  useEffect(() => {
    if (posts.length === 0 && !isOffline) {
      fetchFeed(true);
    }
  }, [isOffline]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleted = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.post_id !== id));
    seenPosts.current.delete(id);
  }, []);

  // Listeners for focus refresh, hide post, and navigation top scrolls
  useEffect(() => {
    const onFocus = () => fetchNewPosts();
    const onHidePost = (e: any) => handleDeleted(e.detail);
    const onRefreshRequest = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      fetchFeed(true);
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("hidePost", onHidePost);
    window.addEventListener("scrollDashboardToTop", onRefreshRequest);
    
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("hidePost", onHidePost);
      window.removeEventListener("scrollDashboardToTop", onRefreshRequest);
    };
  }, [fetchNewPosts, handleDeleted, fetchFeed]);

  // Sentinel infinite scroll hook
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current && !error429 && !isOffline) {
          fetchFeed(false);
        }
      },
      { rootMargin: "600px", threshold: 0 } // Load next page ahead of scrolling
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, fetchFeed, error429, isOffline]);

  // Empty state rendering
  if (posts.length === 0 && !loading) {
    return (
      <div className="py-12 px-4">
        <ModernOfflineState 
          type={isOffline ? "offline" : "empty"}
          title={isOffline ? "Connection Lost" : "Campus is Quiet"}
          message={isOffline ? "You're browsing local cached feed. Reconnect to sync latest content." : "Follow some people or join some circles to see what's happening on campus!"}
          onRetry={() => fetchFeed(true)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-0.5 sm:space-y-3">
      {/* 1. Shimmer/Shimmering inline styling */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          background: linear-gradient(90deg, rgba(0,0,0,0.03) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.03) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        .dark .animate-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>

      {/* Render Virtualized Rows */}
      {posts.map((post, index) => (
        <React.Fragment key={post.post_id}>
          <ViewportAwareCard 
            post={post} 
            onDeleted={handleDeleted} 
            posts={posts} 
            index={index} 
          />
          {/* Suggestion item injected after 3rd post */}
          {index === 2 && suggestions.length > 0 && (
            <SuggestionRow suggestions={suggestions} />
          )}
        </React.Fragment>
      ))}

      {/* Sentinel indicator */}
      <div ref={sentinelRef} className="h-14 w-full flex items-center justify-center">
        {loading && <Spinner size="medium" color="text-primary" />}
      </div>

      {!hasMore && posts.length > 0 && (
        <p className="text-center text-[10px] font-black text-black/20 dark:text-white/20 uppercase tracking-[0.2em] italic py-8">
          You're all caught up ✨
        </p>
      )}

      {error429 && (
        <div className="p-4 mx-4 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-2xl text-center">
          <p className="text-[11px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">
            Slowing down... fetching more posts in a moment
          </p>
        </div>
      )}
    </div>
  );
}
