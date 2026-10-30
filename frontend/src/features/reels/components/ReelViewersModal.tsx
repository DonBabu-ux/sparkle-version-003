import { useEffect, useState } from 'react';
import { X, Eye } from 'lucide-react';
import api from '../../../api/api';
import { getAvatarUrl } from '../../../utils/imageUtils';
import { InlineSpinner } from './shell';
import { logger } from '../../../utils/logger';

interface Viewer {
  viewer_id: string;
  username: string;
  name?: string | null;
  avatar_url?: string | null;
  viewed_at: string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

/**
 * Owner-only "Who viewed this reel" modal. The 30-day retention window is
 * enforced by the backend (`GET /moments/:id/viewers`) — this UI just
 * renders whatever the server returns.
 */
export default function ReelViewersModal({
  momentId,
  onClose,
}: {
  momentId: string;
  onClose: () => void;
}) {
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get(`/moments/${momentId}/viewers`)
      .then(({ data }) => {
        if (alive) setViewers(Array.isArray(data?.viewers) ? data.viewers : []);
      })
      .catch((err) => {
        logger.warn('[ReelViewers] load failed:', err);
        if (alive) setError('Could not load viewers right now.');
      });
    return () => { alive = false; };
  }, [momentId]);

  return (
    <div className="fixed inset-0 z-[var(--z-modal,60)] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Reel viewers">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#0B070C] rounded-t-3xl sm:rounded-3xl max-h-[75dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Eye size={17} className="text-[#FF1F6D]" />
            <h2 className="text-[15px] font-extrabold text-[#18181b] dark:text-white">Viewers</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close viewers" className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
            <X size={17} className="text-black/50 dark:text-white/50" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {viewers === null && !error && (
            <div className="flex items-center justify-center gap-2 py-10 text-black/50 dark:text-white/50 text-sm">
              <InlineSpinner size={15} /> Loading…
            </div>
          )}
          {error && <p className="py-8 text-center text-[13px] text-red-500 font-semibold">{error}</p>}
          {viewers !== null && viewers.length === 0 && !error && (
            <p className="py-8 text-center text-[13px] text-black/45 dark:text-white/45">
              No views yet in the last 30 days.
            </p>
          )}
          {viewers !== null && viewers.length > 0 && (
            <ul className="flex flex-col gap-1">
              {viewers.map((v) => (
                <li key={v.viewer_id} className="flex items-center gap-3 py-2">
                  <img
                    src={getAvatarUrl(v.avatar_url, v.username)}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-[#18181b] dark:text-white truncate">@{v.username}</span>
                    {v.name ? <span className="block text-[11px] text-black/45 dark:text-white/45 truncate">{v.name}</span> : null}
                  </div>
                  <span className="text-[11px] text-black/40 dark:text-white/40 shrink-0">{timeAgo(v.viewed_at)}</span>
                </li>
              ))}
            </ul>
          )}
          {viewers !== null && viewers.length > 0 && (
            <p className="py-3 text-center text-[10px] text-black/35 dark:text-white/35 uppercase tracking-widest font-bold">
              Last 30 days
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
