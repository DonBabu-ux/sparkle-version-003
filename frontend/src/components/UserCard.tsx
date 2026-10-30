import { useNavigate } from 'react-router-dom';
import { MapPin, Check, Clock, Plus, GraduationCap, MoreHorizontal } from 'lucide-react';
import api from '../api/api';
import { useState } from 'react';
import type { User } from '../types/user';
import UserActionModal from './modals/UserActionModal';
import { IdentityManager } from '../utils/identityManager';
import { VerifiedBadge } from './common/VerifiedBadge';
import { logger } from '../utils/logger';

interface UserCardProps {
  u: User;
  onRemove?: (id: string) => void;
}

export default function UserCard({ u, onRemove }: UserCardProps) {
  const navigate = useNavigate();
  const identity = IdentityManager.resolveIdentity(u);
  const [isFollowed, setIsFollowed] = useState(u.is_followed);
  const [requestStatus, setRequestStatus] = useState(u.request_status);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const withExtras = u as {
    reasons?: unknown;
    follower_count?: number;
    is_developer?: boolean;
    mutual_connections?: number;
  };
  const reasons: string[] = Array.isArray(withExtras.reasons) ? (withExtras.reasons as string[]) : [];
  const chips = [
    ...reasons.slice(0, 2),
    u.major,
    u.campus,
  ].filter((c, i, arr): c is string => !!c && arr.indexOf(c) === i);

  const toggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const targetId = u.user_id || u.id;
      const res = await api.post(`/users/${targetId}/follow`);
      const { status } = res.data;

      if (status === 'requested') {
        setRequestStatus('pending');
        setIsFollowed(false);
      } else if (status === 'following') {
        setIsFollowed(true);
        setRequestStatus(null);
      } else if (status === 'unfollowed') {
        setIsFollowed(false);
        setRequestStatus(null);
      }
    } catch (err) {
      logger.error('Follow toggle failed', err);
    } finally {
      setLoading(false);
    }
  };

  // "Not interested" — remembered server-side so this suggestion never resurfaces.
  const dismiss = async () => {
    const targetId = u.user_id || u.id;
    if (!targetId || dismissing) return;
    setDismissing(true);
    try {
      await api.post('/users/suggestions/dismiss', { user_id: targetId });
    } catch (err) {
      logger.error('Dismiss suggestion failed', err);
    } finally {
      setDismissing(false);
    }
    onRemove?.(targetId as string);
  };

  const followers = Number(withExtras.follower_count) || 0;

  return (
    <div
      className="group relative flex aspect-[4/5] w-full flex-col items-center rounded-[28px] border border-[#e6d8e1] bg-[#fdf8fa] p-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-primary/50 dark:hover:shadow-2xl"
      onClick={() => navigate(`/profile/${u.username}`)}
    >
      {/* Overflow actions — dismiss lives here (Facebook's "Remove suggestion" pattern) */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
        aria-label="More actions"
        className="absolute right-3 top-3 z-20 rounded-xl p-2 text-black/20 transition-all hover:bg-black/5 hover:text-black dark:text-white/20 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <MoreHorizontal size={18} />
      </button>

      {showModal && (
        <UserActionModal
          user={u}
          onClose={() => setShowModal(false)}
          onNotInterested={dismiss}
        />
      )}

      {/* Avatar with the pink presence ring — the card's signature */}
      <div className="relative mb-3 shrink-0">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-primary/30 bg-black/5 shadow-sm transition-transform duration-500 group-hover:scale-105 dark:bg-zinc-800">
          <img
            alt={identity.displayName}
            className="h-full w-full object-cover"
            src={identity.avatar}
          />
        </div>
        {identity.presence.showPresence && identity.presence.isOnline && (
          <span className="absolute bottom-1 right-1 block h-4 w-4 rounded-full border-[3px] border-[#fdf8fa] bg-emerald-500 shadow-sm dark:border-zinc-800" />
        )}
      </div>

      {/* Name + verification + follow count */}
      <div className="mb-2 w-full shrink-0">
        <div className="mb-0.5 flex items-center justify-center gap-1.5">
          <span className="truncate max-w-[85%] text-[15px] font-black uppercase italic tracking-tight text-[#18181b] dark:text-zinc-100">
            {identity.displayName}
          </span>
          <VerifiedBadge accountType={identity.accountType} isVerified={identity.badge.show} color={identity.badge.color} size="xs" />
        </div>
        <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-zinc-300">
          @{identity.username || u.name}
        </p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-300">
            {followers} {followers === 1 ? 'follower' : 'followers'}
          </span>
          {withExtras.is_developer && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-primary">
              developer
            </span>
          )}
        </div>
      </div>

      {/* Single chip row: why-you're-seeing-this + major + campus */}
      <div className="mb-3 flex w-full flex-1 flex-wrap content-start justify-center gap-1.5 overflow-hidden">
        {chips.slice(0, 3).map((chip, i) => (
          <span
            key={`${chip}-${i}`}
            className={
              i < reasons.slice(0, 2).length
                ? 'rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-tighter text-primary'
                : 'flex items-center gap-1 rounded-full border border-black/5 bg-black/[0.04] px-2.5 py-1 text-[8px] font-black uppercase tracking-tighter text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300'
            }
          >
            {i < reasons.slice(0, 2).length ? chip : (
              <>
                {i === reasons.slice(0, 2).length && u.major === chip ? <GraduationCap size={9} /> : <MapPin size={9} />}
                {chip}
              </>
            )}
          </span>
        ))}
      </div>

      {/* Mutual followers */}
      {u.mutual_followers && u.mutual_followers.length > 0 ? (
        <div className="mb-3 flex shrink-0 items-center gap-2 rounded-xl border border-black/5 bg-black/[0.03] px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex -space-x-2">
            {u.mutual_followers.slice(0, 2).map((m: { avatar?: string; username?: string }, i: number) => (
              <img
                key={i}
                src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username || '')}&background=random`}
                className="h-5 w-5 rounded-full border-2 border-[#fdf8fa] object-cover shadow-sm dark:border-zinc-800"
                alt=""
              />
            ))}
          </div>
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300">
            {u.mutual_followers.length} mutual {u.mutual_followers.length === 1 ? 'follower' : 'followers'}
          </p>
        </div>
      ) : (
        <div className="mb-3 h-[30px] shrink-0" />
      )}

      {/* Follow */}
      <div className="mt-auto w-full shrink-0">
        {isFollowed ? (
          <button
            onClick={toggleFollow}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-black/[0.04] py-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-600 transition-all hover:bg-black/[0.08] hover:text-black dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:text-white"
          >
            <Check size={14} strokeWidth={3} /> Following
          </button>
        ) : requestStatus === 'pending' ? (
          <button
            disabled
            className="flex w-full cursor-default items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 bg-black/[0.02] py-2 text-[11px] font-black uppercase tracking-[0.15em] text-black/30 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/20"
          >
            <Clock size={14} strokeWidth={3} /> Pending
          </button>
        ) : (
          <button
            onClick={toggleFollow}
            disabled={loading}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-2 text-[11px] font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95 ${loading ? 'opacity-50' : ''}`}
          >
            <Plus size={14} strokeWidth={3} /> Follow
          </button>
        )}
      </div>
    </div>
  );
}
