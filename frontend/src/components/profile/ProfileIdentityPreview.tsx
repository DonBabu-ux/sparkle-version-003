import React from 'react';
import { VerifiedBadge } from '../common/VerifiedBadge';
import { IdentityManager } from '../../utils/identityManager';
import MentionText from '../MentionText';
import { GraduationCap, Compass } from 'lucide-react';

export interface DraftIdentity {
  name: string;
  username: string;
  avatar_url?: string;
  headline?: string;
  bio?: string;
  campus?: string;
  major?: string;
  is_verified?: boolean | number;
  account_type?: string;
}

interface ProfileIdentityPreviewProps {
  draft: DraftIdentity;
  onAvatarClick?: () => void;
}

export const ProfileIdentityPreview: React.FC<ProfileIdentityPreviewProps> = ({
  draft,
  onAvatarClick,
}) => {
  const identity = IdentityManager.resolveIdentity({
    ...draft,
    displayName: draft.name,
  });

  const sparkleDomain = typeof window !== 'undefined' ? window.location.host : 'sparkle.app';
  const cleanUsername = (draft.username || '').replace(/^@/, '').trim();
  const profileLink = `${sparkleDomain}/@${cleanUsername || 'username'}`;

  return (
    <div className="relative w-full rounded-2xl p-5 md:p-6 bg-neutral-50/90 dark:bg-neutral-900/70 border border-neutral-200/90 dark:border-neutral-800 shadow-xs transition-all">
      {/* Live Preview Bar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200/80 dark:border-neutral-800">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5 text-pink-500"
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Live Identity Preview
        </span>
        <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
          Draft State
        </span>
      </div>

      <div className="flex flex-col items-center text-center">
        {/* Profile Photo */}
        <div className="relative mb-3.5 group">
          <div
            onClick={onAvatarClick}
            className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden p-1 bg-gradient-to-tr from-pink-500/30 via-purple-500/20 to-neutral-200 dark:to-neutral-700 shadow-sm cursor-pointer transition-transform active:scale-95 hover:scale-[1.02]"
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
              <img
                src={draft.avatar_url || identity.avatar}
                alt={draft.name || 'Profile'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(draft.name || 'User')}`;
                }}
              />
            </div>
          </div>
        </div>

        {/* Display Name & Verified Badge */}
        <div className="flex items-center justify-center gap-1.5 mb-1 max-w-full">
          <h2 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
            {draft.name || 'Your Name'}
          </h2>
          <VerifiedBadge
            accountType={identity.accountType}
            isVerified={identity.badge.show}
            color={identity.badge.color}
            size="sm"
          />
        </div>

        {/* Username */}
        <div className="text-xs md:text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
          @{cleanUsername || 'username'}
        </div>

        {/* SparkleLink */}
        <div className="text-[11px] md:text-xs font-mono font-medium text-pink-600 dark:text-pink-400 mb-3 bg-pink-500/10 dark:bg-pink-400/10 px-3 py-1 rounded-full border border-pink-500/20">
          {profileLink}
        </div>

        {/* Headline */}
        {draft.headline && draft.headline.trim() && (
          <p className="text-xs md:text-sm font-normal text-neutral-700 dark:text-neutral-300 max-w-sm mb-3 italic">
            "{draft.headline.trim()}"
          </p>
        )}

        {/* Campus & Major Badges */}
        {(draft.campus || draft.major) && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3.5 text-xs font-medium">
            {draft.campus && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300">
                <GraduationCap size={13} className="text-pink-500" />
                <span className="truncate max-w-[180px]">{draft.campus}</span>
              </span>
            )}
            {draft.major && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300">
                <Compass size={13} className="text-purple-500" />
                <span className="truncate max-w-[180px]">{draft.major}</span>
              </span>
            )}
          </div>
        )}

        {/* Biography with live highlighted mentions */}
        {draft.bio && draft.bio.trim() && (
          <div className="w-full max-w-md pt-3 border-t border-neutral-200/80 dark:border-neutral-800 text-xs md:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed text-center">
            <MentionText content={draft.bio} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileIdentityPreview;
