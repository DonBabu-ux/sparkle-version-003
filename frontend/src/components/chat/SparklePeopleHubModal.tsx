import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  X,
  Users,
  Sparkles,
  MessageSquare,
  UserCheck,
  UserPlus,
  Share2,
  Lock,
  PhoneCall,
  CheckCircle2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import api from '../../api/api';
import { useUserStore } from '../../store/userStore';
import { getAvatarUrl } from '../../utils/imageUtils';
import { logger } from '../../utils/logger';

export interface PeopleHubUser {
  user_id: string;
  id?: string;
  name: string;
  username: string;
  avatar_url?: string;
  campus?: string;
  bio?: string;
  is_online?: boolean | number;
  last_seen_at?: string;
  is_mutual?: boolean;
  is_following?: boolean;
  follows_me?: boolean;
  in_contacts?: boolean;
  mutual_since?: string;
  chat_id?: string;
  phone_number?: string;
}

export interface DeviceContactItem {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  matchedUser?: PeopleHubUser;
}

interface SparklePeopleHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: PeopleHubUser) => void;
  onNavigateProfile?: (username: string) => void;
  title?: string;
  actionLabel?: string;
}

// Sample fallback contacts for browser preview / device permission testing
const DEMO_DEVICE_CONTACTS: DeviceContactItem[] = [
  { id: 'c1', name: 'Alex Morgan', phone: '+254712345678' },
  { id: 'c2', name: 'Brian K.', phone: '+254722998877' },
  { id: 'c3', name: 'Catherine W.', phone: '+254733112233' },
  { id: 'c4', name: 'David Ochieng', phone: '+254700554433' },
  { id: 'c5', name: 'Emma Watson', phone: '+254788111222' }
];

export const SparklePeopleHubModal: React.FC<SparklePeopleHubModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
  onNavigateProfile,
  title,
  actionLabel
}) => {
  const currentUser = useUserStore((state) => state.user);

  // Active Tab: 'sparkle' (Mutual connections) | 'contacts' (Device contacts)
  const [activeTab, setActiveTab] = useState<'sparkle' | 'contacts'>('sparkle');

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Data states
  const [mutualUsers, setMutualUsers] = useState<PeopleHubUser[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<PeopleHubUser[]>([]);
  const [matchedContacts, setMatchedContacts] = useState<PeopleHubUser[]>([]);
  const [unmatchedContacts, setUnmatchedContacts] = useState<DeviceContactItem[]>([]);

  // Status & Permission states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contactsPermission, setContactsPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [startingChatId, setStartingChatId] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch mutual connections from backend
  const fetchMutualConnections = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Primary endpoint: Mutual followers
      const res = await api.get('/users/mutual-followers');
      if (res.data && res.data.success && Array.isArray(res.data.mutual)) {
        setMutualUsers(res.data.mutual.map((u: any) => ({ ...u, is_mutual: true })));
      } else {
        // Fallback: Fetch followers and filter
        const followersRes = await api.get('/users/followers');
        if (Array.isArray(followersRes.data)) {
          const mutuals = followersRes.data
            .filter((f: any) => f.is_followed_by_me)
            .map((f: any) => ({ ...f, is_mutual: true }));
          setMutualUsers(mutuals);
        }
      }

      // 2. Fetch general suggestions for fallback
      const sugRes = await api.get('/users/suggestions').catch(() => null);
      if (sugRes && Array.isArray(sugRes.data)) {
        setSuggestedUsers(sugRes.data);
      }
    } catch (err) {
      logger.warn('[PeopleHub] Failed to fetch mutual connections:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Request & Read Device Contacts safely
  const handleRequestContacts = async () => {
    try {
      let rawContacts: DeviceContactItem[] = [];

      // Check if Capacitor / Web Contacts API is available
      if (typeof window !== 'undefined' && 'contacts' in navigator && 'select' in (navigator as any).contacts) {
        try {
          const selected = await (navigator as any).contacts.select(['name', 'tel', 'email'], { multiple: true });
          if (Array.isArray(selected)) {
            rawContacts = selected.map((c: any, i: number) => ({
              id: `web-${i}`,
              name: c.name?.[0] || 'Unknown',
              phone: c.tel?.[0] || ''
            }));
          }
        } catch (e) {
          logger.warn('[PeopleHub] Web contacts selector cancelled or failed:', e);
        }
      }

      // Fallback demo contacts if running in browser dev environment
      if (rawContacts.length === 0) {
        rawContacts = DEMO_DEVICE_CONTACTS;
      }

      setContactsPermission('granted');
      await processContactMatching(rawContacts);
    } catch (err) {
      logger.error('[PeopleHub] Contact permission error:', err);
      setContactsPermission('denied');
    }
  };

  // Match device contacts against registered Sparkle users
  const processContactMatching = async (deviceContacts: DeviceContactItem[]) => {
    try {
      const searchNames = deviceContacts.map(c => c.name).filter(Boolean);
      const res = await api.post('/contacts/match', { queries: searchNames }).catch(() => null);

      if (res && res.data && Array.isArray(res.data.matches)) {
        const matches: PeopleHubUser[] = res.data.matches.map((u: any) => ({
          ...u,
          in_contacts: true
        }));

        setMatchedContacts(matches);

        // Update mutual users in_contacts flag if present
        const matchedUserIds = new Set(matches.map(m => m.user_id));
        setMutualUsers(prev =>
          prev.map(m => (matchedUserIds.has(m.user_id) ? { ...m, in_contacts: true } : m))
        );

        // Filter unmatched device contacts for invite section
        const matchedNamesLower = new Set(matches.map(m => m.name.toLowerCase()));
        setUnmatchedContacts(
          deviceContacts.filter(c => !matchedNamesLower.has(c.name.toLowerCase()))
        );
      } else {
        // Fallback: match using demo matching logic
        setMatchedContacts([]);
        setUnmatchedContacts(deviceContacts);
      }
    } catch (e) {
      logger.warn('[PeopleHub] Contact matching error:', e);
    }
  };

  // Load initial data on mount
  useEffect(() => {
    if (isOpen) {
      fetchMutualConnections();
    }
  }, [isOpen, fetchMutualConnections]);

  // Handle Message Action
  const handleMessageClick = (user: PeopleHubUser) => {
    const targetUserId = user.user_id || user.id;
    if (!targetUserId) return;
    setStartingChatId(targetUserId);
    onSelectUser(user);
    setTimeout(() => {
      setStartingChatId(null);
      onClose();
    }, 150);
  };

  // Handle Share Invite
  const handleInviteContact = (contact: DeviceContactItem) => {
    const inviteText = `Hey ${contact.name}! Join me on Sparkle to chat, share moments, and connect: https://sparkle.app/download`;
    if (navigator.share) {
      navigator.share({ title: 'Sparkle Invite', text: inviteText }).catch(() => {});
    } else {
      window.open(`sms:?body=${encodeURIComponent(inviteText)}`, '_blank');
    }
  };

  // Categorize & Tier Sparkle Connections
  const { crossoverUsers, recentMutuals, remainingMutuals } = useMemo(() => {
    let filtered = mutualUsers;

    if (debouncedQuery) {
      filtered = filtered.filter(
        u =>
          (u.name && u.name.toLowerCase().includes(debouncedQuery)) ||
          (u.username && u.username.toLowerCase().includes(debouncedQuery))
      );
    }

    // TIER 1: Mutual Sparkle + In Phone Contacts
    const crossover = filtered.filter(u => u.in_contacts);

    // TIER 2 & 3: Remaining Mutual Users
    const nonCrossover = filtered.filter(u => !u.in_contacts);
    const recent = nonCrossover.slice(0, 3);
    const remaining = nonCrossover.slice(3);

    return {
      crossoverUsers: crossover,
      recentMutuals: recent,
      remainingMutuals: remaining
    };
  }, [mutualUsers, debouncedQuery]);

  // Filter Contacts Tab
  const filteredMatchedContacts = useMemo(() => {
    if (!debouncedQuery) return matchedContacts;
    return matchedContacts.filter(
      c =>
        (c.name && c.name.toLowerCase().includes(debouncedQuery)) ||
        (c.username && c.username.toLowerCase().includes(debouncedQuery))
    );
  }, [matchedContacts, debouncedQuery]);

  const filteredUnmatchedContacts = useMemo(() => {
    if (!debouncedQuery) return unmatchedContacts;
    return unmatchedContacts.filter(
      c =>
        (c.name && c.name.toLowerCase().includes(debouncedQuery)) ||
        (c.phone && c.phone.includes(debouncedQuery))
    );
  }, [unmatchedContacts, debouncedQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-0 z-[120] bg-[#0b141a] text-white flex flex-col overflow-hidden select-none"
      >
        {/* --- HEADER BAR --- */}
        <div className="h-16 px-4 border-b border-white/10 bg-[#13131a]/90 backdrop-blur-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center text-white/80 hover:text-white"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>

            <div>
              <h2 className="text-lg font-bold text-white leading-tight flex items-center gap-2">
                <span>{title || 'People'}</span>
                <Sparkles size={16} className="text-[#ff1493]" />
              </h2>
              <p className="text-[11px] font-semibold text-white/50 leading-none">
                {title ? 'Select a contact to share' : 'People you can connect with'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchMutualConnections(true)}
              disabled={refreshing}
              className="w-10 h-10 rounded-full hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center text-white/70 hover:text-white"
              title="Refresh People"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin text-[#ff1493]' : ''} />
            </button>

            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${
                showSearch ? 'bg-[#ff1493] text-white' : 'hover:bg-white/10 text-white/70 hover:text-white'
              }`}
            >
              <Search size={20} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* --- SEARCH BAR EXPANDABLE --- */}
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-3 bg-[#13131a] border-b border-white/10"
          >
            <div className="relative flex items-center bg-white/5 rounded-2xl px-4 h-11 border border-white/10 focus-within:border-[#ff1493]">
              <Search size={18} className="text-white/40 shrink-0" />
              <input
                type="text"
                placeholder={activeTab === 'sparkle' ? 'Search Sparkle connections...' : 'Search phone contacts...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-transparent outline-none ml-3 text-sm text-white font-medium placeholder:text-white/30"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* --- TWO PRIMARY TABS --- */}
        <div className="px-4 pt-3 pb-2 bg-[#0b141a] border-b border-white/5 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('sparkle')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'sparkle'
                ? 'bg-gradient-to-r from-[#ff1493] to-[#e0115f] text-white shadow-lg shadow-[#ff1493]/30 scale-[1.01]'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Sparkles size={15} />
            <span>✨ SPARKLE ({mutualUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'contacts'
                ? 'bg-gradient-to-r from-[#ff1493] to-[#e0115f] text-white shadow-lg shadow-[#ff1493]/30 scale-[1.01]'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Users size={15} />
            <span>CONTACTS {contactsPermission === 'granted' ? `(${matchedContacts.length})` : ''}</span>
          </button>
        </div>

        {/* --- MAIN CONTENT SCROLL AREA --- */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 no-scrollbar">

          {/* ========================================================================= */}
          {/* TAB 1: SPARKLE (MUTUAL CONNECTIONS)                                        */}
          {/* ========================================================================= */}
          {activeTab === 'sparkle' && (
            <>
              {/* Header Title Banner */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white">Your Sparkle Connections</h3>
                  <p className="text-xs text-white/50 mt-0.5 font-medium">
                    People you follow who follow you back
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-[#ff1493]/20 border border-[#ff1493]/40 flex items-center justify-center text-[#ff1493]">
                  <UserCheck size={18} />
                </div>
              </div>

              {loading ? (
                /* Skeleton Loader */
                <div className="space-y-3 pt-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse flex items-center px-4 gap-3">
                      <div className="w-11 h-11 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 bg-white/10 rounded" />
                        <div className="h-2 w-1/4 bg-white/10 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : mutualUsers.length === 0 ? (
                /* Empty State */
                <div className="py-12 text-center space-y-4 max-w-xs mx-auto">
                  <div className="w-16 h-16 rounded-full bg-[#ff1493]/10 border border-[#ff1493]/20 flex items-center justify-center text-[#ff1493] mx-auto shadow-lg shadow-[#ff1493]/20">
                    <Sparkles size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-white">No Sparkle connections yet</h4>
                    <p className="text-xs text-white/60 mt-1 leading-relaxed">
                      Follow people and connect when they follow you back to start conversations.
                    </p>
                  </div>

                  {suggestedUsers.length > 0 && (
                    <div className="pt-4 text-left border-t border-white/10 space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/40">Suggested for you</span>
                      {suggestedUsers.slice(0, 3).map(sug => (
                        <div key={sug.user_id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={getAvatarUrl(sug.avatar_url, sug.username)} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
                            <div className="min-w-0">
                              <h5 className="font-bold text-xs text-white truncate">{sug.name}</h5>
                              <p className="text-[10px] text-white/40 truncate">@{sug.username}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleMessageClick(sug)}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-[#ff1493] text-white text-xs font-bold transition-all shrink-0"
                          >
                            Message
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* TIER 1: CROSSOVER (MUTUAL + PHONE CONTACT) */}
                  {crossoverUsers.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#ff1493]">
                        <Sparkles size={14} />
                        <span>✨ YOU ALREADY KNOW</span>
                      </div>

                      <div className="space-y-2">
                        {crossoverUsers.map(user => (
                          <UserRowCard
                            key={`crossover-${user.user_id}`}
                            user={user}
                            badgeLabel="In your contacts · Mutual"
                            badgeColor="text-[#ff1493] bg-[#ff1493]/15 border-[#ff1493]/30"
                            isStarting={startingChatId === user.user_id}
                            onMessage={() => handleMessageClick(user)}
                            onNavigateProfile={onNavigateProfile}
                            actionLabel={actionLabel}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TIER 2: RECENT CONNECTIONS */}
                  {recentMutuals.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/50">
                        <span>✨ RECENT CONNECTIONS</span>
                      </div>

                      <div className="space-y-2">
                        {recentMutuals.map(user => (
                          <UserRowCard
                            key={`recent-${user.user_id}`}
                            user={user}
                            badgeLabel="✨ Mutual connection"
                            badgeColor="text-pink-400 bg-pink-500/10 border-pink-500/20"
                            isStarting={startingChatId === user.user_id}
                            onMessage={() => handleMessageClick(user)}
                            onNavigateProfile={onNavigateProfile}
                            actionLabel={actionLabel}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TIER 3: ALL REMAINING MUTUAL CONNECTIONS */}
                  {remainingMutuals.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/40">
                        <span>ALL SPARKLE CONNECTIONS</span>
                      </div>

                      <div className="space-y-2">
                        {remainingMutuals.map(user => (
                          <UserRowCard
                            key={`all-${user.user_id}`}
                            user={user}
                            badgeLabel="Mutual"
                            badgeColor="text-white/60 bg-white/5 border-white/10"
                            isStarting={startingChatId === user.user_id}
                            onMessage={() => handleMessageClick(user)}
                            onNavigateProfile={onNavigateProfile}
                            actionLabel={actionLabel}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CONTACTS (DEVICE CONTACTS)                                         */}
          {/* ========================================================================= */}
          {activeTab === 'contacts' && (
            <>
              {contactsPermission !== 'granted' ? (
                /* Permission Prompt */
                <div className="py-10 px-4 text-center space-y-5 bg-white/5 rounded-3xl border border-white/10 max-w-sm mx-auto my-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#ff1493] to-[#ff69b4] flex items-center justify-center text-white mx-auto shadow-xl shadow-[#ff1493]/30 animate-pulse">
                    <Users size={32} />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">Find your people on Sparkle</h3>
                    <p className="text-xs text-white/70 leading-relaxed px-2">
                      Allow Sparkle to access your contacts to discover people you already know who are on Sparkle.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleRequestContacts}
                      className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#ff1493] to-[#e0115f] text-white text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#ff1493]/30"
                    >
                      Allow Contacts
                    </button>
                    <button
                      onClick={() => setActiveTab('sparkle')}
                      className="w-full py-2.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-[#ff1493] text-xs font-bold transition-all"
                    >
                      Not Now
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* TIER 4: CONTACTS ON SPARKLE */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-[#ff1493] flex items-center gap-1.5">
                        <Sparkles size={14} />
                        <span>✨ ON SPARKLE ({filteredMatchedContacts.length})</span>
                      </span>
                    </div>

                    {filteredMatchedContacts.length === 0 ? (
                      <div className="p-4 bg-white/5 rounded-2xl text-center text-xs text-white/50">
                        No phone contacts found on Sparkle yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredMatchedContacts.map(user => (
                          <UserRowCard
                            key={`matched-${user.user_id}`}
                            user={user}
                            badgeLabel="From your contacts"
                            badgeColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            isStarting={startingChatId === user.user_id}
                            onMessage={() => handleMessageClick(user)}
                            onNavigateProfile={onNavigateProfile}
                            actionLabel={actionLabel}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* TIER 5: INVITE TO SPARKLE */}
                  {filteredUnmatchedContacts.length > 0 && (
                    <div className="space-y-2 pt-4">
                      <span className="text-xs font-black uppercase tracking-wider text-white/40">
                        INVITE TO SPARKLE ({filteredUnmatchedContacts.length})
                      </span>

                      <div className="space-y-2">
                        {filteredUnmatchedContacts.slice(0, 15).map(contact => (
                          <div
                            key={`unmatched-${contact.id}`}
                            className="flex items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/80 font-black text-sm shrink-0">
                                {contact.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-bold text-xs text-white truncate">{contact.name}</h5>
                                <p className="text-[10px] text-white/40 truncate mt-0.5">{contact.phone || 'Phone Contact'}</p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleInviteContact(contact)}
                              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-[#ff1493] text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
                            >
                              <Share2 size={13} />
                              <span>Invite</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Reusable User Row Component
interface UserRowCardProps {
  user: PeopleHubUser;
  badgeLabel: string;
  badgeColor: string;
  isStarting: boolean;
  onMessage: () => void;
  onNavigateProfile?: (username: string) => void;
  actionLabel?: string;
}

const UserRowCard: React.FC<UserRowCardProps> = ({
  user,
  badgeLabel,
  badgeColor,
  isStarting,
  onMessage,
  onNavigateProfile,
  actionLabel
}) => {
  return (
    <div className="flex items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all active:scale-[0.99] group select-none">
      <div
        onClick={() => onNavigateProfile && onNavigateProfile(user.username || user.user_id)}
        className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
      >
        <div className="relative shrink-0">
          <img
            src={getAvatarUrl(user.avatar_url, user.username)}
            className="w-11 h-11 rounded-2xl object-cover border border-white/10 shadow-sm"
            alt=""
          />
          {user.is_online === 1 || user.is_online === true ? (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0b141a]" />
          ) : null}
        </div>

        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            <h4 className="font-bold text-sm text-white truncate leading-tight group-hover:text-[#ff1493] transition-colors">
              {user.name || user.username}
            </h4>
          </div>

          <p className="text-[11px] font-medium text-white/40 truncate mt-0.5">
            @{user.username}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider border ${badgeColor}`}>
              {badgeLabel}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onMessage}
        disabled={isStarting}
        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff1493] to-[#e0115f] hover:brightness-110 text-white text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 shadow-md shadow-[#ff1493]/20 active:scale-95"
      >
        {isStarting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <>
            <MessageSquare size={14} />
            <span>{actionLabel || 'Message'}</span>
          </>
        )}
      </button>
    </div>
  );
};
