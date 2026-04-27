import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { VariableSizeList } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import api from "../api/api";
import PostCard from "./PostCard";
import type { Post } from "../types/post";
import { RefreshCw, Ghost } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LIMIT = 10;

interface VirtualizedFeedProps {
  initialPosts?: Post[];
}

export default function VirtualizedFeed({ initialPosts = [] }: VirtualizedFeedProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();

  const loadingRef = useRef(false);
  const seenPosts = useRef(new Set<string>(initialPosts.map(p => p.post_id)));
  const listRef = useRef<VariableSizeList>(null);
  const sizeMap = useRef<Record<number, number>>({});

  // 🔹 Fetch feed (cursor-based)
  const fetchFeed = useCallback(async (isInitial = false) => {
    if (loadingRef.current || (!isInitial && !hasMore)) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const currentCursor = isInitial ? null : cursor;
      const res = await api.get("/posts/feed", {
        params: { cursor: currentCursor, limit: LIMIT },
      });

      const newPosts: Post[] = res.data.posts || [];

      // ✅ Deduplicate posts
      const filtered = newPosts.filter(p => {
        if (seenPosts.current.has(p.post_id)) return false;
        seenPosts.current.add(p.post_id);
        return true;
      });

      if (isInitial) {
        setPosts(filtered);
        seenPosts.current = new Set(filtered.map(p => p.post_id));
      } else {
        setPosts(prev => [...prev, ...filtered]);
      }

      setHasMore(newPosts.length === LIMIT);
      
      if (newPosts.length > 0) {
        setCursor(newPosts[newPosts.length - 1].post_id);
      }
    } catch (err) {
      console.error("Feed error:", err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, hasMore]);

  // 🔹 Fetch new posts (delta update)
  const fetchNewPosts = useCallback(async () => {
    if (posts.length === 0 || loadingRef.current) return;

    try {
      const res = await api.get("/posts/new", {
        params: { since: posts[0].post_id },
      });

      const newPosts: Post[] = res.data.posts || [];

      const filtered = newPosts.filter(p => {
        if (seenPosts.current.has(p.post_id)) return false;
        seenPosts.current.add(p.post_id);
        return true;
      });

      if (filtered.length > 0) {
        setPosts(prev => [...filtered, ...prev]);
        // Reset list size map for new items at the top
        sizeMap.current = {};
        listRef.current?.resetAfterIndex(0);
      }
    } catch (err) {
      console.error("New posts error:", err);
    }
  }, [posts]);

  // 🔹 Initial load
  useEffect(() => {
    if (posts.length === 0) {
      fetchFeed(true);
    }
  }, []);

  // 🔹 Auto refresh on focus
  useEffect(() => {
    const onFocus = () => {
      fetchNewPosts();
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchNewPosts]);

  // 🔹 Row height measurement
  const setSize = useCallback((index: number, size: number) => {
    if (sizeMap.current[index] !== size) {
        sizeMap.current[index] = size;
        listRef.current?.resetAfterIndex(index);
    }
  }, []);

  const getSize = (index: number) => {
    return sizeMap.current[index] || 500; // Default estimate
  };

  // 🔹 Row renderer
  const Row = ({ index, style }: any) => {
    const post = posts[index];
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (rowRef.current) {
        setSize(index, rowRef.current.getBoundingClientRect().height + 16); // +16 for margin/gap
      }
    }, [index]);

    if (!post) return null;

    return (
      <div style={{ ...style, paddingBottom: '16px' }}>
        <div ref={rowRef}>
          <PostCard 
            post={post} 
            onDeleted={(id) => {
                setPosts(prev => prev.filter(p => p.post_id !== id));
                sizeMap.current = {};
                listRef.current?.resetAfterIndex(0);
            }}
          />
        </div>
      </div>
    );
  };

  const handleItemsRendered = ({ visibleStopIndex }: any) => {
    if (visibleStopIndex >= posts.length - 2) {
      fetchFeed();
    }
  };

  if (posts.length === 0 && !loading) {
    return (
        <div className="py-48 bg-white/20 border-4 border-dashed border-white rounded-[64px] flex flex-col items-center justify-center gap-10 text-center shadow-inner mx-4">
            <Ghost size={120} strokeWidth={1} className="text-black/5 animate-bounce-slow" />
            <div className="space-y-6">
                <h3 className="text-4xl font-black text-black/10 uppercase tracking-tighter italic leading-none">No Posts Yet.</h3>
                <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.3em] max-w-xs mx-auto leading-loose italic">Follow some people to see their posts here.</p>
                <button onClick={() => navigate('/connect')} className="mt-8 px-12 py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 italic">Find Friends</button>
            </div>
        </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 200px)", width: "100%" }}>
      <AutoSizer>
        {({ height, width }) => (
          <VariableSizeList
            ref={listRef}
            height={height}
            itemCount={posts.length}
            itemSize={getSize}
            width={width}
            onItemsRendered={handleItemsRendered}
            className="no-scrollbar"
          >
            {Row}
          </VariableSizeList>
        )}
      </AutoSizer>
      {loading && (
        <div className="flex justify-center py-4">
          <RefreshCw size={24} className="animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
