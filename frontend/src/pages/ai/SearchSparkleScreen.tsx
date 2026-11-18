import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon } from 'lucide-react';
import api from '../../api/api';
import { logger } from '../../utils/logger';
import { showError } from '../../utils/toast';
import { useUserStore } from '../../store/userStore';
import './SparkleAIScreen.css';

type ResultGroup = { [key: string]: any[] };
type TabKey = 'all' | 'users' | 'posts' | 'groups' | 'clubs' | 'marketplace';

const TABS: { id: TabKey; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'users', label: 'People' },
  { id: 'posts', label: 'Posts' },
  { id: 'groups', label: 'Groups' },
  { id: 'clubs', label: 'Clubs' },
  { id: 'marketplace', label: 'Market' },
];

const GROUP_LABELS: Record<string, string> = {
  users: 'People',
  posts: 'Posts',
  groups: 'Groups',
  clubs: 'Clubs',
  marketplace: 'Marketplace',
};

export default function SearchSparkleScreen() {
  const navigate = useNavigate();
  const { user: currentUser } = useUserStore();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<TabKey>('all');
  const [results, setResults] = useState<ResultGroup>({});
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);
  const seqRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/search/trending');
        if (res.data.status === 'success') {
          setTrending(res.data.data?.trending || res.data.data || []);
        }
      } catch (err) {
        logger.debug('Trending unavailable:', err);
      }
    })();
  }, []);

  useEffect(() => {
    const seq = ++seqRef.current;
    if (!query.trim()) {
      setResults({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/search', {
          params: { q: query, type: tab, campus: currentUser?.campus },
        });
        if (seq !== seqRef.current) return;
        if (res.data.status === 'success') {
          const r = res.data.data?.results || {};
          setResults(tab === 'all' ? r : { [tab]: r[tab] || [] });
        }
      } catch (err) {
        if (seq !== seqRef.current) return;
        logger.error('Sparkle search failed:', err);
        showError('Search failed. Please try again.');
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query, tab, currentUser?.campus]);

  const openResult = (type: string, item: any) => {
    if (type === 'users') navigate(`/profile/${item.username}`);
    else if (type === 'groups') navigate(`/groups/${item.id}`);
    else if (type === 'clubs') navigate(`/clubs/${item.id}`);
    else if (type === 'marketplace') navigate(`/marketplace/listings/${item.id}`);
    else if (type === 'posts') navigate(`/post/${item.post_id || item.id}`);
  };

  const groups = useMemo(
    () => Object.entries(results).filter(([, rows]) => Array.isArray(rows) && rows.length > 0),
    [results]
  );
  const total = groups.reduce((n, [, rows]) => n + rows.length, 0);

  const renderRow = (type: string, item: any) => {
    const onClick = () => openResult(type, item);
    if (type === 'users') {
      return (
        <button key={item.user_id || item.username} onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
          <img src={item.avatar_url || '/uploads/avatars/no-profile.png'} alt="" className="w-10 h-10 rounded-full object-cover bg-slate-200" />
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{item.name || item.username}</div>
            <div className="text-xs text-slate-500 truncate">
              {item.suggestion_reason || (item.mutual_connections ? `${item.mutual_connections} mutual` : `@${item.username}`)}
            </div>
          </div>
        </button>
      );
    }
    if (type === 'marketplace') {
      return (
        <button key={item.id} onClick={onClick} className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{item.title}</div>
            <div className="text-xs text-slate-500 truncate">{item.description || item.location || 'Marketplace'}</div>
          </div>
          {item.price != null && <div className="font-black text-sm text-[#ff1493] shrink-0">KES {item.price}</div>}
        </button>
      );
    }
    return (
      <button key={item.post_id || item.id} onClick={onClick} className="w-full p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
        <div className="font-bold text-sm truncate">{item.title || item.name || (type === 'posts' ? 'Post' : type)}</div>
        {(item.content || item.description) && (
          <div className="text-xs text-slate-500 line-clamp-2">{item.content || item.description}</div>
        )}
      </button>
    );
  };

  return (
    <div className="sparkle-ai-container">
      <header className="sparkle-ai-header">
        <button className="sparkle-ai-feature-button" onClick={() => navigate('/ai')}>
          <span className="icon-wrapper"><ArrowLeft size={20} /></span>
          <span>Back</span>
        </button>
        <h1 className="sparkle-ai-title">Search Sparkle</h1>
        <p className="sparkle-ai-subtitle">People, posts, groups, clubs and marketplace items</p>
      </header>

      <section className="sparkle-ai-chat px-4 pb-8">
        <div className="relative">
          <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anything on Sparkle..."
            aria-label="Search query"
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-bold outline-none focus:border-[#ff1493] text-slate-800 dark:text-zinc-100"
          />
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-colors ${tab === t.id ? 'bg-[#ff1493] text-white' : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="py-10 text-center text-sm font-bold text-slate-400">Searching...</div>
        )}

        {!loading && query.trim() && total === 0 && (
          <div className="py-10 text-center">
            <div className="font-black text-slate-700 dark:text-zinc-200 mb-1">No results for "{query}"</div>
            <div className="text-sm text-slate-400">Try a different word or check the other tabs.</div>
          </div>
        )}

        {!loading && !query.trim() && trending.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Trending now</div>
            <div className="flex flex-wrap gap-2">
              {trending.slice(0, 12).map((t: any, i: number) => {
                const tag = String(t.name || t.term || t.tag || t).replace(/^#+/, '');
                return (
                  <button
                    key={tag || i}
                    onClick={() => setQuery(tag)}
                    className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300"
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !query.trim() && trending.length === 0 && (
          <div className="py-16 text-center text-sm font-bold text-slate-400">
            Search for people, posts, groups, clubs and marketplace items.
          </div>
        )}

        <div className="mt-4 space-y-6">
          {groups.map(([type, rows]) => (
            <div key={type}>
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                {GROUP_LABELS[type] || type} ({rows.length})
              </div>
              <div className="space-y-1">{rows.map((item) => renderRow(type, item))}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}