import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Users, Clock, Radio, Sparkles } from 'lucide-react';
import api from '../api/api';

interface User {
  user_id: string;
  username: string;
  avatar_url: string;
  name: string;
  follower_count?: number;
  is_following?: boolean;
  is_follower?: boolean;
}

interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  onSubmit?: (e?: React.FormEvent) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  replyingToUsername?: string | null;
}

const SPECIALS = [
  {
    id: 'highlight',
    label: 'Highlight',
    desc: 'Flash notification to everyone',
    Icon: Sparkles,
  },
  {
    id: 'followers',
    label: 'Followers',
    desc: 'Alert all your followers',
    Icon: Users,
  },
  {
    id: 'recent',
    label: 'Recent',
    desc: 'Notify your recent contacts',
    Icon: Clock,
  },
  {
    id: 'everyone',
    label: 'Everyone',
    desc: 'Broadcast to the entire community',
    Icon: Radio,
  },
];

function formatCount(n?: number) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onBlur,
  onSubmit,
  placeholder,
  className,
  autoFocus,
  replyingToUsername,
}) => {
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [replyUser, setReplyUser] = useState<User | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch reply-target profile to pin at top
  useEffect(() => {
    if (!replyingToUsername) { setReplyUser(null); return; }
    api.get(`/users/search?q=${replyingToUsername}`)
      .then(res => {
        const users: User[] = Array.isArray(res.data) ? res.data : (res.data.users || []);
        const match = users.find(u => u.username.toLowerCase() === replyingToUsername.toLowerCase());
        if (match) setReplyUser(match);
      })
      .catch(() => {});
  }, [replyingToUsername]);

  const fetchSuggestions = useCallback(async (query: string) => {
    setLoading(true);
    try {
      if (query === '@') {
        // Fetch people you follow
        const res = await api.get('/users/following?q=');
        setSuggestions(res.data || []);
      } else {
        const q = query.replace('@', '');
        const res = await api.get(`/users/search?q=${q}`);
        setSuggestions(Array.isArray(res.data) ? res.data : (res.data.users || []));
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mentionQuery) return;
    setShowPanel(true);
    const timer = setTimeout(() => fetchSuggestions(mentionQuery), mentionQuery === '@' ? 0 : 300);
    return () => clearTimeout(timer);
  }, [mentionQuery, fetchSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    onChange(val);
    setCursorPos(pos);

    const beforeCursor = val.slice(0, pos);
    const match = beforeCursor.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[0]);
    } else {
      setMentionQuery('');
      setSuggestions([]);
      setShowPanel(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  const selectMention = (username: string) => {
    const before = value.slice(0, cursorPos - mentionQuery.length);
    const after = value.slice(cursorPos);
    onChange(`${before}@${username} ${after}`);
    setMentionQuery('');
    setSuggestions([]);
    setShowPanel(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closePanel = () => {
    setShowPanel(false);
    setMentionQuery('');
    setSuggestions([]);
  };

  const isOpen = showPanel && mentionQuery.startsWith('@');

  // Build the ordered list: reply target first, then deduplicated remaining users
  const orderedUsers = React.useMemo(() => {
    if (!replyUser || !mentionQuery.startsWith('@')) return suggestions;
    const rest = suggestions.filter(u => u.user_id !== replyUser.user_id);
    return [replyUser, ...rest];
  }, [suggestions, replyUser, mentionQuery]);

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Delay so onMouseDown on panel buttons fires first
          setTimeout(() => {
            onBlur?.();
          }, 200);
        }}
        autoFocus={autoFocus}
      />

      {/* Full-page panel portal */}
      {isOpen && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[10001]"
            onMouseDown={(e) => { e.preventDefault(); closePanel(); }}
          />

          {/* Panel — full width, anchored above the bottom bar */}
          <div
            className="fixed bottom-[64px] left-0 right-0 z-[10002] bg-white rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.18)] max-h-[72vh] flex flex-col overflow-hidden"
            style={{ animation: 'mentionSlideUp 0.22s cubic-bezier(0.32,0.72,0,1) forwards' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Search context label */}
            <div className="px-5 pb-2 shrink-0">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {mentionQuery === '@' ? 'Mention someone' : `Results for "${mentionQuery}"`}
              </p>
            </div>

            <div className="overflow-y-auto flex-1 overscroll-contain pb-4">

              {/* --- Special broadcasts (only when bare @) --- */}
              {mentionQuery === '@' && (
                <div className="mb-2">
                  <p className="px-5 py-1 text-[10px] font-black text-gray-400 uppercase tracking-[0.12em]">Broadcast</p>
                  {SPECIALS.map(({ id, label, desc, Icon }) => (
                    <button
                      key={id}
                      className="w-full px-5 py-3 flex items-center gap-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      onMouseDown={(e) => { e.preventDefault(); selectMention(id); }}
                    >
                      <div className="w-11 h-11 rounded-full bg-gray-900 flex items-center justify-center shrink-0 shadow-md">
                        <Icon size={20} className="text-white" strokeWidth={2} />
                      </div>
                      <div className="text-left">
                        <p className="text-[15px] font-bold text-gray-900 leading-tight">@{id}</p>
                        <p className="text-[12px] text-gray-400 leading-tight mt-0.5">{desc}</p>
                      </div>
                    </button>
                  ))}
                  <div className="h-px bg-gray-100 mx-5 my-2" />
                </div>
              )}

              {/* --- User results --- */}
              {loading && suggestions.length === 0 ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-pink-500 rounded-full animate-spin" />
                </div>
              ) : orderedUsers.length > 0 ? (
                <div>
                  <p className="px-5 py-1 text-[10px] font-black text-gray-400 uppercase tracking-[0.12em]">
                    {replyUser && mentionQuery === '@' ? 'Replying to' : 'People'}
                  </p>
                  {orderedUsers.map((u, idx) => {
                    const isReplyTarget = u.user_id === replyUser?.user_id;
                    const relationLabel = u.is_following && u.is_follower
                      ? 'Mutual'
                      : u.is_following
                      ? 'Following'
                      : u.is_follower
                      ? 'Follows you'
                      : null;

                    return (
                      <button
                        key={u.user_id}
                        className={`w-full px-5 py-3 flex items-center gap-4 transition-colors ${isReplyTarget ? 'bg-pink-50/60' : 'hover:bg-gray-50 active:bg-gray-100'}`}
                        onMouseDown={(e) => { e.preventDefault(); selectMention(u.username); }}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={u.avatar_url || '/uploads/avatars/default.png'}
                            className="w-11 h-11 rounded-full object-cover border border-gray-100"
                            alt=""
                          />
                          {isReplyTarget && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-pink-500 rounded-full flex items-center justify-center ring-2 ring-white">
                              <span className="text-white text-[8px] font-black">@</span>
                            </div>
                          )}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[15px] font-bold text-gray-900 truncate">{u.name || u.username}</p>
                            {isReplyTarget && (
                              <span className="text-[9px] font-black bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">Reply target</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[12px] text-gray-400 truncate">@{u.username}</p>
                            {relationLabel && (
                              <>
                                <span className="text-gray-300 text-[10px]">·</span>
                                <span className="text-[11px] font-semibold text-blue-500 shrink-0">{relationLabel}</span>
                              </>
                            )}
                            {u.follower_count !== undefined && (
                              <>
                                <span className="text-gray-300 text-[10px]">·</span>
                                <span className="text-[11px] text-gray-400 shrink-0">{formatCount(u.follower_count)} followers</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : mentionQuery.length > 1 && !loading ? (
                <div className="text-center py-8 text-gray-400 text-[13px]">No users found for "{mentionQuery.slice(1)}"</div>
              ) : null}
            </div>
          </div>

          <style>{`
            @keyframes mentionSlideUp {
              from { transform: translateY(100%); opacity: 0; }
              to   { transform: translateY(0);    opacity: 1; }
            }
          `}</style>
        </>,
        document.body
      )}
    </div>
  );
};

export default MentionInput;
