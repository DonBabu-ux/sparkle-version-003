import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import { User as UserIcon, Loader2 } from 'lucide-react';
import { VerifiedBadge } from '../common/VerifiedBadge';

export interface MentionUser {
  id: string | number;
  user_id?: string;
  name?: string;
  username: string;
  avatar?: string;
  avatar_url?: string;
  account_type?: string;
  is_verified?: boolean | number;
}

interface BioMentionRailProps {
  query: string;
  onSelectUser: (user: MentionUser) => void;
  className?: string;
}

export const BioMentionRail: React.FC<BioMentionRailProps> = ({
  query,
  onSelectUser,
  className = '',
}) => {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    const cleanQuery = query.trim();

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(cleanQuery)}`);
        if (!isCancelled) {
          const list = Array.isArray(res.data) ? res.data : (res.data?.users || []);
          setUsers(list.slice(0, 8));
          setSelectedIndex(0);
        }
      } catch (err) {
        if (!isCancelled) {
          setUsers([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (users.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % users.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (users[selectedIndex]) {
          onSelectUser(users[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [users, selectedIndex, onSelectUser]);

  return (
    <div
      className={`w-full overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-2xl backdrop-blur-2xl transition-all ${className}`}
    >
      <div className="px-3 py-2 border-b border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] font-bold text-black/40 dark:text-white/40 uppercase tracking-wider">
        <span>Mention User</span>
        {loading && <Loader2 size={12} className="animate-spin text-pink-500" />}
      </div>

      <div className="max-h-48 overflow-y-auto divide-y divide-black/[0.03] dark:divide-white/[0.03]">
        {loading && users.length === 0 ? (
          <div className="py-4 text-center text-xs text-black/40 dark:text-white/40">
            Searching Sparkle users...
          </div>
        ) : users.length === 0 ? (
          <div className="py-4 text-center text-xs text-black/40 dark:text-white/40">
            No matching users found
          </div>
        ) : (
          users.map((user, idx) => {
            const isSelected = idx === selectedIndex;
            const displayName = user.name || user.username;
            const avatarUrl = user.avatar_url || user.avatar;

            return (
              <button
                key={user.id || user.user_id || user.username}
                type="button"
                onClick={() => onSelectUser(user)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                  isSelected
                    ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-black dark:text-white'
                }`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-black/5 dark:bg-white/10 flex items-center justify-center border border-black/5 dark:border-white/10">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;
                      }}
                    />
                  ) : (
                    <UserIcon size={14} className="text-black/40 dark:text-white/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold truncate">{displayName}</span>
                    {user.is_verified && (
                      <VerifiedBadge
                        accountType={user.account_type || 'user'}
                        isVerified={true}
                        size="xs"
                      />
                    )}
                  </div>
                  <div className="text-[11px] text-black/40 dark:text-white/40 font-mono truncate">
                    @{user.username}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BioMentionRail;
