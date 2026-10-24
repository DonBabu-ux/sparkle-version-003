import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Film, Trash2, RotateCcw, Eye, Heart, MessageSquare, Share2, Loader2, Clapperboard, Radio } from 'lucide-react';
import api from '../api/api';
import { getMediaUrl } from '../utils/imageUtils';
import ModernOfflineState from '../components/ui/ModernOfflineState';
import { logger } from '../utils/logger';

interface DeletedMoment {
  moment_id: string;
  caption?: string;
  thumbnail_url?: string;
  media_type?: string;
  deleted_at: string;
}

interface Moment {
  moment_id: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  media_type?: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function compact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n || 0);
}

export default function MomentStudio() {
  const navigate = useNavigate();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({ views: 0, sparks: 0, comments: 0, shares: 0 });
  const [deleted, setDeleted] = useState<DeletedMoment[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/moments/my/moments', { params: { limit: 50 } });
      setMoments(data.moments || []);
      setTotal(data.total || 0);
      // Server-side aggregates. Summing the returned rows here silently
      // under-reports once a creator passes the page limit.
      setTotals({
        views: data.totals?.views || 0,
        sparks: data.totals?.sparks || 0,
        comments: data.totals?.comments || 0,
        shares: data.totals?.shares || 0
      });
      setDeleted(data.deleted || []);
    } catch (err: any) {
      logger.error('Failed to load creator moments:', err);
      setError(err?.response?.status === 401 ? 'Your session expired. Please sign in again.' : 'Could not load your moments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const takeDown = async (id: string) => {
    setBusyId(id);
    const previous = moments;
    // Optimistic: the row leaves the dashboard immediately. A soft delete is
    // reversible, so a failed takedown puts the row straight back.
    setMoments(prev => prev.filter(m => m.moment_id !== id));
    setTotal(t => Math.max(0, t - 1));
    try {
      await api.delete(`/moments/${id}`);
    } catch (err: any) {
      logger.error('Takedown failed:', err);
      setMoments(previous);
      setTotal(previous.length);
      setError(err?.response?.data?.error || 'Could not take that moment down. It is still live.');
    } finally {
      setBusyId(null);
    }
  };

  const restore = async (id: string) => {
    setBusyId(id);
    const previous = deleted;
    setDeleted(prev => prev.filter(m => m.moment_id !== id));
    try {
      await api.post(`/moments/${id}/restore`);
      // Reload both lists — a restored moment reappears among live ones.
      await load();
    } catch (err: any) {
      logger.error('Restore failed:', err);
      setDeleted(previous);
      setError(err?.response?.data?.error || 'Could not restore that moment.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-dvh bg-white dark:bg-black text-black dark:text-white pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-[1100] bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-black/5 dark:border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-11 h-11 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors"
        >
          <ArrowLeft size={24} strokeWidth={2.5} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-black tracking-tight leading-none">Moment Studio</h1>
          <p className="text-[11px] text-marketplace-muted font-medium mt-0.5">
            {total} {total === 1 ? 'moment' : 'moments'} published
          </p>
        </div>
        <button
          onClick={() => navigate('/streams')}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#FF1F6D] text-white text-[11px] font-black uppercase tracking-widest active:scale-95 transition-transform shrink-0"
        >
          <Radio size={14} strokeWidth={2.5} />
          Go Live
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Lifetime totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Views', value: totals.views, icon: Eye, tile: 'text-blue-500' },
            { label: 'Sparks', value: totals.sparks, icon: Heart, tile: 'text-[#FF1F6D]' },
            { label: 'Comments', value: totals.comments, icon: MessageSquare, tile: 'text-emerald-500' },
            { label: 'Shares', value: totals.shares, icon: Share2, tile: 'text-amber-500' },
          ].map(({ label, value, icon: Icon, tile }) => (
            <div key={label} className="p-4 rounded-2xl bg-marketplace-bg border border-marketplace-border">
              <div className={`w-8 h-8 rounded-xl bg-white dark:bg-white/[0.06] border border-marketplace-border flex items-center justify-center mb-3 ${tile}`}>
                <Icon size={15} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-marketplace-muted block mb-1">{label}</span>
              <span className="text-2xl font-black tracking-tight leading-none">{compact(value)}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50">
            <p className="text-[13px] font-semibold text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-marketplace-muted" />
          </div>
        ) : moments.length === 0 ? (
          <ModernOfflineState
            type="empty"
            title="No moments yet"
            message="Publish your first moment and its performance will show up here."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {moments.map((m) => {
              const thumb = m.thumbnail_url || m.media_url;
              const busy = busyId === m.moment_id;
              return (
                <li
                  key={m.moment_id}
                  className="flex items-center gap-4 p-3 rounded-2xl bg-marketplace-bg border border-marketplace-border"
                >
                  {/* Thumbnail */}
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 shrink-0">
                    {thumb ? (
                      m.media_type === 'video' ? (
                        <video src={getMediaUrl(thumb)} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                      ) : (
                        <img src={getMediaUrl(thumb)} alt="" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-marketplace-muted">
                        <Film size={20} />
                      </div>
                    )}
                    {m.media_type === 'video' && (
                      <div className="absolute bottom-1 right-1 text-white drop-shadow-md">
                        <Clapperboard size={13} fill="currentColor" />
                      </div>
                    )}
                  </div>

                  {/* Meta + stats */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-black dark:text-white truncate">
                      {m.caption?.trim() || 'Untitled moment'}
                    </p>
                    <p className="text-[11px] text-marketplace-muted font-medium mt-0.5">{timeAgo(m.created_at)}</p>
                    <div className="flex items-center gap-3.5 mt-2 text-[11px] font-bold text-marketplace-muted">
                      <span className="flex items-center gap-1"><Eye size={13} strokeWidth={2.5} />{compact(m.view_count)}</span>
                      <span className="flex items-center gap-1"><Heart size={13} strokeWidth={2.5} />{compact(m.like_count)}</span>
                      <span className="flex items-center gap-1"><MessageSquare size={13} strokeWidth={2.5} />{compact(m.comment_count)}</span>
                      <span className="flex items-center gap-1"><Share2 size={13} strokeWidth={2.5} />{compact(m.share_count)}</span>
                    </div>
                  </div>

                  {/* Takedown */}
                  <button
                    onClick={() => takeDown(m.moment_id)}
                    disabled={busy}
                    aria-label={`Take down ${m.caption?.trim() || 'this moment'}`}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-40 shrink-0"
                  >
                    {busy ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} strokeWidth={2.5} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Recently taken down — restore path for a soft delete */}
        {!loading && deleted.length > 0 && (
          <section className="mt-12">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-marketplace-muted mb-3 px-1">
              Recently taken down
            </p>
            <ul className="flex flex-col gap-2">
              {deleted.map((m) => {
                const busy = busyId === m.moment_id;
                return (
                  <li
                    key={m.moment_id}
                    className="flex items-center gap-4 p-3 rounded-2xl border border-dashed border-marketplace-border"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-marketplace-bg shrink-0 opacity-50">
                      {m.thumbnail_url ? (
                        <img src={getMediaUrl(m.thumbnail_url)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-marketplace-muted">
                          <Film size={16} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-marketplace-text truncate line-through opacity-60">
                        {m.caption?.trim() || 'Untitled moment'}
                      </p>
                      <p className="text-[11px] text-marketplace-muted font-medium mt-0.5">
                        Taken down {timeAgo(m.deleted_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => restore(m.moment_id)}
                      disabled={busy}
                      aria-label={`Restore ${m.caption?.trim() || 'this moment'}`}
                      className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 shrink-0"
                    >
                      {busy ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} strokeWidth={2.5} />}
                      <span className="text-[11px] font-black uppercase tracking-widest">Restore</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="mt-8 text-[11px] text-marketplace-muted leading-relaxed">
          Taking a moment down removes it from your studio and other people's feeds right away.
          It stays recoverable — nothing is permanently deleted.
        </p>
      </main>
    </div>
  );
}
