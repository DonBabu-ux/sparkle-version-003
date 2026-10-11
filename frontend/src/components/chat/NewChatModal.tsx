import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, X, Check, MessageSquare, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import api from '../../api/api';
import { useUserStore } from '../../store/userStore';
import { getAvatarUrl } from '../../utils/imageUtils';
import { VerifiedBadge } from '../common/VerifiedBadge';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { logger } from '../../utils/logger';

export interface ContactUser {
  user_id: string;
  id?: string;
  name: string;
  username: string;
  avatar_url?: string;
  is_online?: boolean;
  is_verified?: boolean;
  is_followed_by_me?: boolean;
  last_message_at?: string;
}

export interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: any[];
  onStartChat: (selectedContacts: ContactUser[]) => Promise<void>;
}

function normalizeContact(u: any): ContactUser {
  return {
    user_id: String(u.user_id || u.id || ''),
    id: String(u.user_id || u.id || ''),
    name: u.name || u.full_name || u.display_name || u.username || 'Sparkle User',
    username: (u.username || '').replace(/^@/, ''),
    avatar_url: u.avatar_url || u.profile_picture || u.avatar || '',
    is_online: Boolean(u.is_online === 1 || u.is_online === true),
    is_verified: Boolean(u.is_verified === 1 || u.is_verified === true),
    is_followed_by_me: Boolean(u.is_followed_by_me)
  };
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  conversations,
  onStartChat
}) => {
  const currentUser = useUserStore((state) => state.user);
  const currentUserId = String(currentUser?.id || currentUser?.user_id || '');
  const reducedMotion = useReducedMotion();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Selected contacts stored by stable user ID
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const selectedUsersCacheRef = useRef<Map<string, ContactUser>>(new Map());

  // Data states
  const [rawFollowers, setRawFollowers] = useState<ContactUser[]>([]);
  const [rawFollowing, setRawFollowing] = useState<ContactUser[]>([]);
  const [rawEveryone, setRawEveryone] = useState<ContactUser[]>([]);
  const [searchResults, setSearchResults] = useState<ContactUser[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  // Status states
  const [loading, setLoading] = useState(false);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // System user id constant
  const systemUserId = 'd75fe3b5-7a45-4581-ab13-91934d8b54de';

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedUserIds(new Set());
      setSearchQuery('');
      setDebouncedQuery('');
      setSearchResults([]);
    }
  }, [isOpen]);

  // Load followers, following, suggestions & blocks on modal open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const [followersRes, followingRes, suggestionsRes, blocksRes] = await Promise.allSettled([
          api.get('/users/followers'),
          api.get('/users/following'),
          api.get('/users/suggestions?limit=50'),
          api.get('/users/blocks')
        ]);

        if (cancelled) return;

        // Blocked users
        const blockedSet = new Set<string>();
        if (blocksRes.status === 'fulfilled' && Array.isArray(blocksRes.value.data)) {
          blocksRes.value.data.forEach((b: any) => {
            const bid = String(b.blocked_user_id || b.user_id || b.id || '');
            if (bid) blockedSet.add(bid);
          });
        }
        setBlockedUserIds(blockedSet);

        // Followers (person follows current user)
        if (followersRes.status === 'fulfilled') {
          const raw = Array.isArray(followersRes.value.data)
            ? followersRes.value.data
            : followersRes.value.data?.followers;
          if (Array.isArray(raw)) {
            setRawFollowers(raw.map(normalizeContact));
          }
        }

        // Following (current user follows person)
        if (followingRes.status === 'fulfilled') {
          const raw = Array.isArray(followingRes.value.data)
            ? followingRes.value.data
            : followingRes.value.data?.users;
          if (Array.isArray(raw)) {
            setRawFollowing(raw.map(normalizeContact));
          }
        }

        // Everyone (suggestions/discovery)
        if (suggestionsRes.status === 'fulfilled') {
          const raw = Array.isArray(suggestionsRes.value.data)
            ? suggestionsRes.value.data
            : suggestionsRes.value.data?.users;
          if (Array.isArray(raw)) {
            setRawEveryone(raw.map(normalizeContact));
          }
        }
      } catch (err) {
        logger.warn('[NewChatModal] Failed to load contact data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Extract Recents from existing conversations data (ordered newest activity first)
  const recentUsers = useMemo(() => {
    if (!Array.isArray(conversations)) return [];
    const seen = new Set<string>();
    const recents: ContactUser[] = [];

    // Filter out group chats, self chats, system accounts
    const validConvs = [...conversations].filter(c => {
      if (!c) return false;
      if (c.is_group || c.chat_type === 'group') return false;
      const pid = String(c.partner_id || '');
      if (!pid || pid === currentUserId || pid === systemUserId) return false;
      if (c.is_system || c.is_system_account) return false;
      return true;
    });

    // Sort by most recent activity timestamp descending
    validConvs.sort((a, b) => {
      const timeA = new Date(a.last_message_at || a.last_message_time || 0).getTime();
      const timeB = new Date(b.last_message_at || b.last_message_time || 0).getTime();
      return timeB - timeA;
    });

    for (const c of validConvs) {
      const pid = String(c.partner_id);
      if (!seen.has(pid)) {
        seen.add(pid);
        recents.push({
          user_id: pid,
          id: pid,
          name: c.partner_name || c.partner_username || 'Sparkle User',
          username: (c.partner_username || '').replace(/^@/, ''),
          avatar_url: c.partner_avatar,
          is_online: Boolean(c.partner_online),
          last_message_at: c.last_message_at || c.last_message_time
        });
      }
    }

    return recents;
  }, [conversations, currentUserId]);

  // Server-side search fallback when query is typed
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    let active = true;
    setIsSearchingServer(true);

    api.get(`/users/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(res => {
        if (!active) return;
        const results = Array.isArray(res.data) ? res.data : (res.data?.users || []);
        if (Array.isArray(results)) {
          setSearchResults(results.map(normalizeContact));
        }
      })
      .catch(err => {
        logger.warn('[NewChatModal] Server search error:', err);
      })
      .finally(() => {
        if (active) setIsSearchingServer(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  // Section Deduplication with Strict Precedence:
  // 1. Recents
  // 2. Followers
  // 3. Following
  // 4. Everyone
  const { recents, followers, following, everyone, allContactsMap } = useMemo(() => {
    const seenIds = new Set<string>();
    if (currentUserId) seenIds.add(currentUserId);
    if (systemUserId) seenIds.add(systemUserId);
    blockedUserIds.forEach(id => seenIds.add(id));

    const contactsMap = new Map<string, ContactUser>();

    // 1. Recents
    const recentsList: ContactUser[] = [];
    for (const c of recentUsers) {
      if (c.user_id && !seenIds.has(c.user_id)) {
        seenIds.add(c.user_id);
        recentsList.push(c);
        contactsMap.set(c.user_id, c);
      }
    }

    // 2. Followers (person follows current user)
    const followersList: ContactUser[] = [];
    for (const c of rawFollowers) {
      if (c.user_id && !seenIds.has(c.user_id)) {
        seenIds.add(c.user_id);
        followersList.push(c);
        contactsMap.set(c.user_id, c);
      }
    }

    // 3. Following (current user follows person)
    const followingList: ContactUser[] = [];
    for (const c of rawFollowing) {
      if (c.user_id && !seenIds.has(c.user_id)) {
        seenIds.add(c.user_id);
        followingList.push(c);
        contactsMap.set(c.user_id, c);
      }
    }

    // 4. Everyone (suggestions + search results, strictly excluding prior sections)
    const everyoneList: ContactUser[] = [];
    const sourceEveryone = searchResults.length > 0 ? [...searchResults, ...rawEveryone] : rawEveryone;
    for (const c of sourceEveryone) {
      if (c.user_id && !seenIds.has(c.user_id)) {
        seenIds.add(c.user_id);
        everyoneList.push(c);
        contactsMap.set(c.user_id, c);
      }
    }

    return {
      recents: recentsList,
      followers: followersList,
      following: followingList,
      everyone: everyoneList,
      allContactsMap: contactsMap
    };
  }, [recentUsers, rawFollowers, rawFollowing, rawEveryone, searchResults, currentUserId, blockedUserIds]);

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    const q = debouncedQuery;
    if (!q) {
      return { recents, followers, following, everyone };
    }

    const matchesQuery = (u: ContactUser) => {
      const nameMatch = u.name && u.name.toLowerCase().includes(q);
      const userMatch = u.username && u.username.toLowerCase().includes(q);
      return Boolean(nameMatch || userMatch);
    };

    return {
      recents: recents.filter(matchesQuery),
      followers: followers.filter(matchesQuery),
      following: following.filter(matchesQuery),
      everyone: everyone.filter(matchesQuery)
    };
  }, [recents, followers, following, everyone, debouncedQuery]);

  // Total count of visible contacts
  const totalVisibleCount =
    filteredSections.recents.length +
    filteredSections.followers.length +
    filteredSections.following.length +
    filteredSections.everyone.length;

  // Toggle user selection
  const toggleUserSelection = useCallback((contact: ContactUser) => {
    const uid = contact.user_id;
    if (!uid) return;

    // Cache user object so it survives any filtering changes
    selectedUsersCacheRef.current.set(uid, contact);

    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  }, []);

  // Handle start chat button
  const handleStartChat = async () => {
    if (selectedUserIds.size === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const selectedContacts: ContactUser[] = [];
      selectedUserIds.forEach(id => {
        const userObj = allContactsMap.get(id) || selectedUsersCacheRef.current.get(id);
        if (userObj) {
          selectedContacts.push(userObj);
        }
      });

      if (selectedContacts.length > 0) {
        await onStartChat(selectedContacts);
      }
    } catch (err) {
      logger.error('[NewChatModal] Failed to start conversation:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCount = selectedUserIds.size;

  const slideVariants = {
    initial: { x: '100%', opacity: 0.9 },
    animate: { x: 0, opacity: 1, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
    exit: { x: '100%', opacity: 0.9, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/60 overflow-hidden">
        <motion.div
          variants={reducedMotion ? undefined : slideVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full lg:max-w-xl h-full bg-[#111118] text-white flex flex-col shadow-2xl relative overflow-hidden select-none"
        >
          {/* Header */}
          <header className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-white/[0.08] flex items-center justify-between bg-[#13131a] sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1 text-white/80 hover:text-white rounded-full hover:bg-white/10 active:bg-white/20 transition-colors"
                aria-label="Back to messages"
              >
                <ArrowLeft size={22} strokeWidth={2.2} />
              </button>
              <h2 className="text-lg font-bold text-white tracking-tight">New message</h2>
            </div>
          </header>

          {/* Search Field */}
          <div className="px-4 py-2.5 border-b border-white/[0.06] bg-[#111118] sticky top-[57px] z-10">
            <div className="relative flex items-center bg-white/[0.06] border border-white/10 rounded-full px-3.5 py-2 focus-within:border-[#ff1493]/60 focus-within:ring-1 focus-within:ring-[#ff1493]/40 transition-all">
              <Search size={18} className="text-zinc-400 shrink-0 mr-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people..."
                className="w-full bg-transparent text-sm text-white placeholder-zinc-400 focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors shrink-0"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Contact Lists (Scroll Area) */}
          <div className="flex-1 overflow-y-auto pb-28 divide-y divide-transparent">
            {loading && !recentUsers.length ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-[#ff1493]" size={28} />
                <span className="text-xs text-zinc-400">Loading contacts...</span>
              </div>
            ) : totalVisibleCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center text-zinc-400">
                <p className="text-sm font-semibold text-white/80">No people found</p>
                <p className="text-xs mt-1 text-zinc-500">
                  {debouncedQuery
                    ? 'Try searching with a different name or username.'
                    : 'Connect with people on Sparkle to start chatting.'}
                </p>
              </div>
            ) : (
              <>
                {/* Section 1: Recents */}
                {filteredSections.recents.length > 0 && (
                  <div className="mb-2">
                    <div className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Recents
                    </div>
                    <div>
                      {filteredSections.recents.map(contact => (
                        <ContactRow
                          key={`recent-${contact.user_id}`}
                          contact={contact}
                          isSelected={selectedUserIds.has(contact.user_id)}
                          onToggle={toggleUserSelection}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 2: Followers */}
                {filteredSections.followers.length > 0 && (
                  <div className="mb-2">
                    <div className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-t border-white/[0.04]">
                      Followers
                    </div>
                    <div>
                      {filteredSections.followers.map(contact => (
                        <ContactRow
                          key={`follower-${contact.user_id}`}
                          contact={contact}
                          isSelected={selectedUserIds.has(contact.user_id)}
                          onToggle={toggleUserSelection}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 3: Following */}
                {filteredSections.following.length > 0 && (
                  <div className="mb-2">
                    <div className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-t border-white/[0.04]">
                      Following
                    </div>
                    <div>
                      {filteredSections.following.map(contact => (
                        <ContactRow
                          key={`following-${contact.user_id}`}
                          contact={contact}
                          isSelected={selectedUserIds.has(contact.user_id)}
                          onToggle={toggleUserSelection}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 4: Everyone */}
                {filteredSections.everyone.length > 0 && (
                  <div className="mb-2">
                    <div className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-t border-white/[0.04]">
                      Everyone
                    </div>
                    <div>
                      {filteredSections.everyone.map(contact => (
                        <ContactRow
                          key={`everyone-${contact.user_id}`}
                          contact={contact}
                          isSelected={selectedUserIds.has(contact.user_id)}
                          onToggle={toggleUserSelection}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {isSearchingServer && (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-400">
                    <Loader2 size={14} className="animate-spin text-[#ff1493]" />
                    <span>Searching more users...</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Persistent Bottom Action Bar */}
          <div className="absolute bottom-0 left-0 right-0 z-30 px-4 py-3 bg-[#13131a]/98 backdrop-blur-md border-t border-white/[0.08] flex items-center justify-between pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {/* Left side: selection count or instruction */}
            <div className="text-xs sm:text-sm font-medium text-zinc-400 truncate pr-2">
              {selectedCount === 0 && 'Select people to start a chat'}
              {selectedCount === 1 && '1 person selected'}
              {selectedCount > 1 && `${selectedCount} people selected`}
            </div>

            {/* Right side: Chat button */}
            <button
              type="button"
              disabled={selectedCount === 0 || isSubmitting}
              onClick={handleStartChat}
              className={clsx(
                "px-5 py-2.5 rounded-full font-semibold text-sm flex items-center gap-2 transition-all select-none shrink-0",
                selectedCount > 0 && !isSubmitting
                  ? "bg-[#ff1493] text-white hover:brightness-110 active:scale-95 shadow-md shadow-[#ff1493]/30 cursor-pointer"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <MessageSquare size={16} strokeWidth={2.2} />
                  <span>Chat</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// --- Contact Row Component ---
interface ContactRowProps {
  contact: ContactUser;
  isSelected: boolean;
  onToggle: (contact: ContactUser) => void;
}

const ContactRow: React.FC<ContactRowProps> = ({ contact, isSelected, onToggle }) => {
  const [imgError, setImgError] = useState(false);

  const initials = (contact.name || contact.username || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <button
      type="button"
      onClick={() => onToggle(contact)}
      className={clsx(
        "w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left group select-none cursor-pointer",
        isSelected ? "bg-[#ff1493]/10" : "hover:bg-white/[0.04] active:bg-white/[0.08]"
      )}
      aria-pressed={isSelected}
      aria-label={`${contact.name || contact.username}, @${contact.username}${isSelected ? ', selected' : ''}`}
    >
      {/* Avatar (38px circular) */}
      <div className="relative shrink-0">
        {contact.avatar_url && !imgError ? (
          <img
            src={getAvatarUrl(contact.avatar_url, contact.username)}
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-white/10 bg-zinc-800"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-semibold text-white/90">
            {initials}
          </div>
        )}
        {contact.is_online && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#111118]" />
        )}
      </div>

      {/* Center: Name & Username */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-white truncate">
            {contact.name || contact.username}
          </span>
          {contact.is_verified && (
            <VerifiedBadge isVerified={true} size="xs" />
          )}
        </div>
        <span className="text-xs text-zinc-400 truncate block">
          @{contact.username}
        </span>
      </div>

      {/* Right: Circular Selection Control */}
      <div
        className={clsx(
          "w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0",
          isSelected
            ? "bg-[#ff1493] text-white shadow-sm"
            : "border-2 border-white/30 bg-transparent group-hover:border-white/50"
        )}
        aria-hidden="true"
      >
        {isSelected && <Check size={12} strokeWidth={3.2} className="text-white" />}
      </div>
    </button>
  );
};
