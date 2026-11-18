import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, UserCheck, X, RefreshCw } from 'lucide-react';
import api from '../../api/api';
import { logger } from '../../utils/logger';
import { showSuccess } from '../../utils/toast';
import './SparkleAIScreen.css';

type TabKey = 'for_you' | 'follow_back' | 'similar' | 'same_campus';

const TABS: { id: TabKey; label: string }[] = [
  { id: 'for_you', label: 'For you' },
  { id: 'follow_back', label: 'Follow back' },
  { id: 'similar', label: 'Similar to you' },
  { id: 'same_campus', label: 'Same campus' },
];

export default function FriendDiscoveryScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('for_you');
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (activeTab: TabKey, force = false) => {
    setLoading(true);
    try {
      const res = await api.get('/users/suggestions', {
        params: { tab: activeTab, limit: 20, ...(force ? { force: 'true' } : {}) },
      });
      const list = res.data?.suggestions || res.data?.data?.suggestions || res.data?.data || [];
      setPeople(Array.isArray(list) ? list : []);
    } catch (err) {
      logger.error('Friend discovery failed:', err);
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  const toggleFollow = async (person: any) => {
    const id = person.user_id || person.id;
    const following = person.is_following || person.isFollowing;
    setBusyId(id);
    try {
      if (following) {
        await api.delete(`/users/follow/${id}`);
      } else {
        await api.post(`/users/follow/${id}`);
        showSuccess(`Following ${person.name || person.username || 'user'}`);
      }
      setPeople((prev) =>
        prev.map((p) =>
          (p.user_id || p.id) === id ? { ...p, is_following: !following, isFollowing: !following } : p
        )
      );
    } catch (err) {
      logger.error('Follow toggle failed:', err);
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (person: any) => {
    const id = person.user_id || person.id;
    setBusyId(id);
    try {
      await api.post('/users/suggestions/dismiss', { user_id: id });
      setPeople((prev) => prev.filter((p) => (p.user_id || p.id) !== id));
    } catch (err) {
      logger.error('Dismiss suggestion failed:', err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="sparkle-ai-container">
      <header className="sparkle-ai-header">
        <button className="sparkle-ai-feature-button" onClick={() => navigate('/ai')}>
          <span className="icon-wrapper"><ArrowLeft size={20} /></span>
          <span>Back</span>
        </button>
        <h1 className="sparkle-ai-title">Friend Discovery</h1>
        <p className="sparkle-ai-subtitle">People you may know, ranked by mutuals, campus and major</p>
      </header>

      <section className="sparkle-ai-chat px-4 pb-8">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-colors ${tab === t.id ? 'bg-[#ff1493] text-white' : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700'}`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => void load(tab, true)}
            className="ml-auto p-2 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500"
            aria-label="Refresh suggestions"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {loading && <div className="py-16 text-center text-sm font-bold text-slate-400">Finding people...</div>}

        {!loading && people.length === 0 && (
          <div className="py-16 text-center">
            <div className="font-black text-slate-700 dark:text-zinc-200 mb-1">No suggestions right now</div>
            <div className="text-sm text-slate-400">Try another tab, or check back later.</div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {people.map((person) => {
            const id = person.user_id || person.id;
            const following = person.is_following || person.isFollowing;
            const reason =
              person.suggestion_reason ||
              (person.mutual_connections ? `${person.mutual_connections} mutual` : person.campus ? `Goes to ${person.campus}` : null);
            return (
              <div key={id} className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <button onClick={() => navigate(`/profile/${person.username}`)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <img
                    src={person.avatar_url || '/uploads/avatars/no-profile.png'}
                    alt=""
                    className="w-11 h-11 rounded-full object-cover bg-slate-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{person.name || person.username}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {reason || `@${person.username}`}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => void toggleFollow(person)}
                    disabled={busyId === id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-colors disabled:opacity-50 ${following ? 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300' : 'bg-[#ff1493] text-white'}`}
                  >
                    {following ? <UserCheck size={14} /> : <UserPlus size={14} />}
                    {following ? 'Following' : 'Follow'}
                  </button>
                  <button
                    onClick={() => void dismiss(person)}
                    disabled={busyId === id}
                    className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-50"
                    aria-label="Dismiss suggestion"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}