import React, { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/api";
import PostCard from "./PostCard";
import type { Post } from "../types/post";
import { RefreshCw, Ghost } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDeviceSeed } from "../hooks/useDeviceSeed";

const LIMIT = 10;

interface VirtualizedFeedProps {
  initialPosts?: Post[];
  suggestions?: any[];
}

// Memoized row to prevent re-renders of already-rendered posts
const FeedRow = React.memo(({ post, onDeleted }: { post: Post; onDeleted: (id: string) => void }) => (
  <div className="mb-[3px] sm:mb-3">
    <PostCard post={post} onDeleted={onDeleted} />
  </div>
));

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
    <div className="mb-[3px] sm:mb-3 bg-white sm:rounded-xl shadow-sm p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-gray-500 uppercase tracking-wider">People you might know</h3>
        <button onClick={() => navigate('/connect')} className="text-[12px] font-bold text-blue-600 hover:underline">See all</button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        {suggestions.slice(0, 5).map((s) => (
          <div key={s.user_id} className="flex-shrink-0 w-32 flex flex-col items-center text-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100">
            <img 
              src={s.avatar_url || '/uploads/avatars/default.png'} 
              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm cursor-pointer" 
              alt=""
              onClick={() => navigate(`/profile/${s.username}`)}
            />
            <div className="min-w-0 w-full px-1">
              <p className="text-[13px] font-bold text-gray-900 truncate">{s.username}</p>
              <p className="text-[11px] text-gray-500 truncate">{s.campus || 'Sparkle'}</p>
            </div>
            <button 
              onClick={() => handleFollow(s.user_id)}
              disabled={following[s.user_id]}
              className={`w-full py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                following[s.user_id] 
                ? 'bg-gray-200 text-gray-500' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {following[s.user_id] ? 'Following' : 'Follow'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

export default function VirtualizedFeed({ initialPosts = [], suggestions = [] }: VirtualizedFeedProps) {

  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();
  const { seed, deviceId } = useDeviceSeed();

  // Refs to prevent request spam
  const loadingRef = useRef(false);
  const lastFetchTime = useRef(0);
  const seenPosts = useRef(new Set<string>(initialPosts.map((p) => p.post_id)));
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [error429, setError429] = useState(false);

  // ── Fetch next page (cursor-based) ─────────────────────────────────────────
  const fetchFeed = useCallback(
    async (isInitial = false) => {
      // Throttle: avoid fetching more than once every 2 seconds unless it's initial
      const now = Date.now();
      if (!isInitial && now - lastFetchTime.current < 2000) return;
      
      if (loadingRef.current || (!isInitial && !hasMore)) return;
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

        // Deduplicate against both state and seenPosts ref
        const filtered = newPosts.filter((p) => {
          if (seenPosts.current.has(p.post_id)) return false;
          seenPosts.current.add(p.post_id);
          return true;
        });
        
        if (isInitial) {
          setPosts(filtered);
          // Reset seenPosts to exactly what we just set
          seenPosts.current = new Set(filtered.map(p => p.post_id));
        } else {
          setPosts((prev) => {
            // Final safety check against race conditions in state
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
          // Auto-retry once after 3 seconds if it was a 429
          setTimeout(() => fetchFeed(isInitial), 3000);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [hasMore, seed, deviceId]
  );

  // ── Fetch new posts (delta update on focus) ─────────────────────────────────
  const fetchNewPosts = useCallback(async () => {
    if (posts.length === 0 || loadingRef.current) return;

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
  }, [posts]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (posts.length === 0) {
      fetchFeed(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleted = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.post_id !== id));
    seenPosts.current.delete(id);
  }, []);

  // ── Focus-based refresh (like Instagram) ────────────────────────────────────
  useEffect(() => {
    const onFocus = () => fetchNewPosts();
    const onHidePost = (e: any) => handleDeleted(e.detail);
    
    // ── Home Button Refresh & Scroll ──
    const onRefreshRequest = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      fetchFeed(true); // Force refresh
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

  // ── IntersectionObserver for infinite scroll ────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Only fetch if sentinel is visible, we have more, not currently loading, AND not in error state
        if (entries[0].isIntersecting && hasMore && !loadingRef.current && !error429) {
          fetchFeed(false);
        }
      },
      { rootMargin: "400px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, fetchFeed, error429]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (posts.length === 0 && !loading) {
    return (
      <div className="py-48 bg-white/20 border-4 border-dashed border-white rounded-[64px] flex flex-col items-center justify-center gap-10 text-center shadow-inner mx-4">
        <Ghost size={120} strokeWidth={1} className="text-black/5 animate-bounce-slow" />
        <div className="space-y-6">
          <h3 className="text-4xl font-black text-black/10 uppercase tracking-tighter italic leading-none">
            No Posts Yet.
          </h3>
          <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.3em] max-w-xs mx-auto leading-loose italic">
            Follow some people to see their posts here.
          </p>
          <button
            onClick={() => navigate("/connect")}
            className="mt-8 px-12 py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 italic"
          >
            Find Friends
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-[3px] sm:space-y-3">
      {/* Render posts – FeedRow is memoized so only new items re-render */}
      {posts.map((post, index) => (
        <React.Fragment key={post.post_id}>
          <FeedRow post={post} onDeleted={handleDeleted} />
          {/* Inject suggestions after the 3rd post (index 2) */}
          {index === 2 && suggestions.length > 0 && (
            <SuggestionRow suggestions={suggestions} />
          )}
        </React.Fragment>
      ))}

      {/* Sentinel – triggers next page load when visible */}
      <div ref={sentinelRef} className="h-10 w-full flex items-center justify-center">
        {loading && <RefreshCw size={24} className="animate-spin text-primary" />}
      </div>

      {!hasMore && posts.length > 0 && (
        <p className="text-center text-[11px] font-bold text-black/20 uppercase tracking-widest italic py-6">
          You're all caught up ✨
        </p>
      )}

      {error429 && (
        <div className="p-4 mx-4 bg-orange-50 border border-orange-100 rounded-2xl text-center">
          <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
            Slowing down... fetching more posts in a moment
          </p>
        </div>
      )}
    </div>
  );
}
