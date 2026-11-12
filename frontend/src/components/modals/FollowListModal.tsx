import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clock,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserX,
  X,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { useUserStore } from "../../store/userStore";
import { getAvatarUrl } from "../../utils/imageUtils";
import { VerifiedBadge } from "../common/VerifiedBadge";
import { logger } from "../../utils/logger";
import { showError, showSuccess } from "../../utils/toast";

type TabType = "followers" | "following" | "flagged" | "mutual";

interface FollowUser {
  id: string;
  user_id?: string;
  username: string;
  name?: string;
  display_name?: string;
  avatar_url?: string;
  profile_picture?: string;
  is_followed_by_me?: boolean;
  follows_me?: boolean;
  outgoing_request_pending?: boolean;
  has_story?: boolean;
  bio?: string;
  campus?: string;
  mutual_connections?: number;
  is_verified?: boolean;
  account_type?: string;
}

interface FlaggedRequest {
  id: string;
  requester_id?: string;
  target_user_id?: string;
  username: string;
  name?: string;
  avatar_url?: string;
  campus?: string;
  created_at?: string;
  status?: string;
  flag_reason?: string;
  is_verified?: boolean;
}

export interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: "Followers" | "Following" | "Flagged" | "Mutual";
  profileId: string;
  onFollowersCountChange?: (delta: number) => void;
  onFollowingCountChange?: (delta: number) => void;
}

// Smart Follow Button
interface FollowButtonProps {
  user: FollowUser;
  currentUserId: string;
  processing: boolean;
  onFollow: (u: FollowUser) => void;
  onUnfollow: (u: FollowUser) => void;
  onCancelRequest: (u: FollowUser) => void;
}

function SmartFollowButton({ user, currentUserId, processing, onFollow, onUnfollow, onCancelRequest }: FollowButtonProps) {
  const uid = user.id || user.user_id || "";
  if (uid === currentUserId) return null;

  if (user.is_followed_by_me) {
    return (
      <button type="button" disabled={processing} onClick={() => onUnfollow(user)}
        className="px-4 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 text-xs font-black text-black dark:text-white transition-all active:scale-95 disabled:opacity-50 shrink-0">
        Following
      </button>
    );
  }
  if (user.outgoing_request_pending) {
    return (
      <button type="button" disabled={processing} onClick={() => onCancelRequest(user)}
        className="px-4 py-1.5 rounded-xl bg-black/10 dark:bg-white/15 text-xs font-black text-black/60 dark:text-white/60 transition-all active:scale-95 disabled:opacity-50 shrink-0">
        Requested
      </button>
    );
  }
  if (user.follows_me) {
    return (
      <button type="button" disabled={processing} onClick={() => onFollow(user)}
        className="px-4 py-1.5 rounded-xl bg-[#FF008C] text-white text-xs font-black shadow-sm shadow-[#FF008C]/30 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 shrink-0">
        Follow Back
      </button>
    );
  }
  return (
    <button type="button" disabled={processing} onClick={() => onFollow(user)}
      className="px-4 py-1.5 rounded-xl bg-[#FF008C] text-white text-xs font-black shadow-sm shadow-[#FF008C]/30 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 shrink-0">
      Follow
    </button>
  );
}

function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 pt-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] animate-pulse">
          <div className="w-12 h-12 rounded-full bg-black/10 dark:bg-white/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-black/10 dark:bg-white/10 rounded w-1/3" />
            <div className="h-2.5 bg-black/5 dark:bg-white/5 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface UserRowProps {
  user: FollowUser;
  currentUserId: string;
  isOwnProfile: boolean;
  processing: boolean;
  onNavigate: (username: string) => void;
  onFollow: (u: FollowUser) => void;
  onUnfollow: (u: FollowUser) => void;
  onCancelRequest: (u: FollowUser) => void;
  onRemoveFollower?: (u: FollowUser) => void;
  showRemove?: boolean;
}

function UserRow({ user, currentUserId, isOwnProfile, processing, onNavigate, onFollow, onUnfollow, onCancelRequest, onRemoveFollower, showRemove = false }: UserRowProps) {
  const uid = user.id || user.user_id || "";
  const isSelf = uid === currentUserId;
  return (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60">
      <div className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer" onClick={() => onNavigate(user.username)}>
        <div className={`w-12 h-12 rounded-full shrink-0 ${user.has_story ? "p-0.5 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500" : ""}`}>
          <img src={getAvatarUrl(user.avatar_url || user.profile_picture, user.username)} alt={user.username}
            className="w-full h-full rounded-full object-cover border border-black/15 dark:border-white/15" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="font-extrabold text-[15px] text-black dark:text-white truncate">{user.name || user.display_name || user.username}</span>
            <VerifiedBadge isVerified={Boolean(user.is_verified)} accountType={user.account_type} size="xs" />
          </div>
          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate mt-0.5">@{user.username}</p>
          {!isSelf && user.follows_me && !user.is_followed_by_me && (
            <p className="text-[11px] text-[#FF008C] font-semibold mt-0.5">Follows you</p>
          )}
          {user.mutual_connections != null && user.mutual_connections > 0 && (
            <p className="text-[11px] text-[#FF008C] font-semibold mt-0.5">{user.mutual_connections} mutual connection{user.mutual_connections > 1 ? "s" : ""}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {showRemove && isOwnProfile && !isSelf && onRemoveFollower && (
          <button type="button" onClick={() => onRemoveFollower(user)}
            className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 text-xs font-bold text-black dark:text-white transition-colors">
            Remove
          </button>
        )}
        <SmartFollowButton user={user} currentUserId={currentUserId} processing={processing} onFollow={onFollow} onUnfollow={onUnfollow} onCancelRequest={onCancelRequest} />
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, heading, subtext }: { icon: React.ElementType; heading: string; subtext: string }) {
  return (
    <div className="text-center py-20 px-6 flex flex-col items-center justify-center">
      <div className="w-20 h-20 rounded-full bg-[#FFE4F3] dark:bg-pink-950/40 text-[#FF008C] flex items-center justify-center mb-5 shadow-inner">
        <Icon size={40} strokeWidth={2.2} />
      </div>
      <h2 className="text-2xl font-black text-black dark:text-white tracking-tight uppercase italic mb-2">{heading}</h2>
      <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 max-w-sm leading-relaxed">{subtext}</p>
    </div>
  );
}

export default function FollowListModal({ isOpen, onClose, title = "Followers", profileId, onFollowersCountChange, onFollowingCountChange }: FollowListModalProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useUserStore();
  const currentUserId = String(currentUser?.id || currentUser?.user_id || "");
  const isOwnProfile = Boolean(currentUser?.id && String(currentUser.id) === String(profileId)) || Boolean(currentUser?.user_id && String(currentUser.user_id) === String(profileId));

  const getInitialTab = (): TabType => {
    if (title === "Following") return "following";
    if (title === "Flagged") return "flagged";
    if (title === "Mutual") return "mutual";
    return "followers";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [flaggedRequests, setFlaggedRequests] = useState<FlaggedRequest[]>([]);
  const [mutualFollowers, setMutualFollowers] = useState<FollowUser[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [loadingFlagged, setLoadingFlagged] = useState(false);
  const [loadingMutual, setLoadingMutual] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [userToRemove, setUserToRemove] = useState<FollowUser | null>(null);

  const addProcessing = (id: string) => setProcessingIds((p) => new Set([...p, id]));
  const removeProcessing = (id: string) => setProcessingIds((p) => { const n = new Set(p); n.delete(id); return n; });

  useEffect(() => {
    if (isOpen) { setActiveTab(getInitialTab()); setSearchQuery(""); }
  }, [isOpen, title]);

  const fetchFollowers = useCallback(async () => {
    if (!profileId) return;
    setLoadingFollowers(true);
    try { const res = await api.get(`/users/${profileId}/followers`); setFollowers(Array.isArray(res.data) ? res.data : []); }
    catch (err) { logger.error("Failed to fetch followers:", err); }
    finally { setLoadingFollowers(false); }
  }, [profileId]);

  const fetchFollowing = useCallback(async () => {
    if (!profileId) return;
    setLoadingFollowing(true);
    try { const res = await api.get(`/users/${profileId}/following`); setFollowing(Array.isArray(res.data) ? res.data : []); }
    catch (err) { logger.error("Failed to fetch following:", err); }
    finally { setLoadingFollowing(false); }
  }, [profileId]);

  const fetchFlagged = useCallback(async () => {
    if (!isOwnProfile) return;
    setLoadingFlagged(true);
    try { const res = await api.get("/users/follow-requests"); setFlaggedRequests(Array.isArray(res.data) ? res.data : (res.data?.requests || [])); }
    catch (err) { logger.error("Failed to fetch flagged:", err); }
    finally { setLoadingFlagged(false); }
  }, [isOwnProfile]);

  const fetchMutual = useCallback(async () => {
    if (!profileId || isOwnProfile) return;
    setLoadingMutual(true);
    try { const res = await api.get(`/users/${profileId}/mutual-followers`); setMutualFollowers(Array.isArray(res.data) ? res.data : []); }
    catch (err) { logger.error("Failed to fetch mutual:", err); }
    finally { setLoadingMutual(false); }
  }, [profileId, isOwnProfile]);

  useEffect(() => {
    if (!isOpen) return;
    fetchFollowers(); fetchFollowing();
    if (isOwnProfile) { fetchFlagged(); } else { fetchMutual(); }
  }, [isOpen, fetchFollowers, fetchFollowing, fetchFlagged, fetchMutual, isOwnProfile]);

  const patchList = (setter: React.Dispatch<React.SetStateAction<FollowUser[]>>, id: string, patch: Partial<FollowUser>) =>
    setter((p) => p.map((u) => (u.id === id || u.user_id === id ? { ...u, ...patch } : u)));
  const patchAll = (id: string, patch: Partial<FollowUser>) => { patchList(setFollowers, id, patch); patchList(setFollowing, id, patch); patchList(setMutualFollowers, id, patch); };

  const handleFollow = async (targetUser: FollowUser) => {
    const tid = targetUser.id || targetUser.user_id || "";
    if (!tid || processingIds.has(tid)) return;
    addProcessing(tid);
    patchAll(tid, { is_followed_by_me: true, outgoing_request_pending: false });
    try {
      const res = await api.post(`/users/follow/${tid}`);
      const status: string = res.data?.status;
      if (status === "requested") { patchAll(tid, { is_followed_by_me: false, outgoing_request_pending: true }); }
      else if (status === "unfollowed") { patchAll(tid, { is_followed_by_me: false, outgoing_request_pending: false }); }
      else { onFollowingCountChange?.(1); }
    } catch (err) { logger.error("Follow failed:", err); showError("Could not follow. Please try again."); patchAll(tid, { is_followed_by_me: false }); }
    finally { removeProcessing(tid); }
  };

  const handleUnfollow = async (targetUser: FollowUser) => {
    const tid = targetUser.id || targetUser.user_id || "";
    if (!tid || processingIds.has(tid)) return;
    addProcessing(tid);
    patchAll(tid, { is_followed_by_me: false, outgoing_request_pending: false });
    onFollowingCountChange?.(-1);
    try { await api.delete(`/users/follow/${tid}`); }
    catch (err) { logger.error("Unfollow failed:", err); showError("Could not unfollow. Please try again."); patchAll(tid, { is_followed_by_me: true }); onFollowingCountChange?.(1); }
    finally { removeProcessing(tid); }
  };

  const handleCancelRequest = async (targetUser: FollowUser) => {
    const tid = targetUser.id || targetUser.user_id || "";
    if (!tid || processingIds.has(tid)) return;
    addProcessing(tid);
    patchAll(tid, { outgoing_request_pending: false });
    try { await api.delete(`/users/follow-request/${tid}`); }
    catch (err) { logger.error("Cancel request failed:", err); showError("Could not cancel request. Please try again."); patchAll(tid, { outgoing_request_pending: true }); }
    finally { removeProcessing(tid); }
  };

  const handleConfirmRemoveFollower = async () => {
    if (!userToRemove) return;
    const tid = userToRemove.id || userToRemove.user_id || "";
    const snap = [...followers];
    setUserToRemove(null);
    addProcessing(tid);
    setFollowers((p) => p.filter((u) => u.id !== tid && u.user_id !== tid));
    onFollowersCountChange?.(-1);
    try { await api.delete(`/users/followers/${tid}`); showSuccess(`Removed @${userToRemove.username} from your followers`); }
    catch (err) { logger.error("Remove follower failed:", err); showError("Failed to remove follower."); setFollowers(snap); onFollowersCountChange?.(1); }
    finally { removeProcessing(tid); }
  };

  const handleConfirmFlagged = async (req: FlaggedRequest) => {
    if (processingIds.has(req.id)) return;
    addProcessing(req.id);
    const snap = [...flaggedRequests];
    setFlaggedRequests((p) => p.filter((r) => r.id !== req.id));
    onFollowersCountChange?.(1);
    try { await api.post(`/users/follow-requests/${req.id}/accept`); showSuccess(`Confirmed follow request from @${req.username}`); fetchFollowers(); }
    catch (err) { logger.error("Accept request failed:", err); showError("Failed to confirm request"); setFlaggedRequests(snap); onFollowersCountChange?.(-1); }
    finally { removeProcessing(req.id); }
  };

  const handleDeleteFlagged = async (req: FlaggedRequest) => {
    if (processingIds.has(req.id)) return;
    addProcessing(req.id);
    const snap = [...flaggedRequests];
    setFlaggedRequests((p) => p.filter((r) => r.id !== req.id));
    try { await api.post(`/users/follow-requests/${req.id}/reject`); showSuccess(`Removed request from @${req.username}`); }
    catch (err) { logger.error("Reject request failed:", err); showError("Failed to delete request"); setFlaggedRequests(snap); }
    finally { removeProcessing(req.id); }
  };

  const filterUsers = (list: FollowUser[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((u) => u.username?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q));
  };

  const filteredFollowers = useMemo(() => filterUsers(followers), [followers, searchQuery]);
  const filteredFollowing = useMemo(() => filterUsers(following), [following, searchQuery]);
  const filteredMutual = useMemo(() => filterUsers(mutualFollowers), [mutualFollowers, searchQuery]);
  const filteredFlagged = useMemo(() => {
    if (!searchQuery.trim()) return flaggedRequests;
    const q = searchQuery.toLowerCase();
    return flaggedRequests.filter((r) => r.username?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q));
  }, [flaggedRequests, searchQuery]);

  const handleNavigate = (username: string) => { onClose(); navigate(`/profile/${username}`); };

  if (!isOpen) return null;

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "followers", label: "Followers", count: followers.length },
    { key: "following", label: "Following", count: following.length },
    isOwnProfile
      ? { key: "flagged", label: "Flagged", count: flaggedRequests.length }
      : { key: "mutual", label: "Mutual", count: mutualFollowers.length },
  ];

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] bg-white dark:bg-zinc-950 text-[#10112D] dark:text-white flex flex-col overflow-hidden animate-fade-in">
      <header className="pt-[calc(1.25rem+var(--safe-area-inset-top))] px-4 pb-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-3 bg-white dark:bg-zinc-950 shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-black dark:text-white active:scale-95 transition-all focus:outline-none" aria-label="Back to Profile">
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>
          <h1 className="text-lg font-black tracking-tight text-black dark:text-white">Connections</h1>
        </div>
        <button type="button" onClick={() => setShowSearch(!showSearch)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showSearch ? "bg-[#FF008C] text-white shadow-md shadow-[#FF008C]/30" : "hover:bg-black/5 dark:hover:bg-white/10 text-black dark:text-white"}`}
          aria-label="Toggle Search">
          <Search size={20} strokeWidth={2.2} />
        </button>
      </header>

      {showSearch && (
        <div className="px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] border-b border-black/10 dark:border-white/10 shrink-0 animate-slide-down">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3 text-black/60 dark:text-white/60" />
            <input type="text" placeholder={`Search ${activeTab}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus
              className="w-full bg-white dark:bg-zinc-900 border border-black/20 dark:border-white/20 rounded-xl pl-9 pr-8 py-2 text-sm text-black dark:text-white font-medium placeholder-black/50 dark:placeholder-white/50 focus:outline-none focus:border-[#FF008C]" />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center border-b border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 shrink-0 sticky top-0 z-10 px-2">
        {tabs.map(({ key, label, count }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-3 px-2 text-center text-xs font-bold uppercase tracking-wider relative transition-colors flex items-center justify-center gap-2 ${
                isActive
                  ? "text-[#FF008C] font-black"
                  : "text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
              }`}
            >
              <span>{label}</span>
              {count != null && count > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums shrink-0 leading-none ${
                    isActive
                      ? key === "flagged"
                        ? "bg-amber-500 text-white"
                        : "bg-[#FF008C] text-white shadow-xs shadow-[#FF008C]/30"
                      : "bg-black/10 dark:bg-white/15 text-black/70 dark:text-white/70"
                  }`}
                  style={{
                    lineHeight: 1,
                  }}
                >
                  {count}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 inset-x-4 h-0.5 bg-[#FF008C] rounded-full shadow-[0_0_8px_rgba(255,0,140,0.6)]"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(3rem+env(safe-area-inset-bottom))]">

        {activeTab === "followers" && (
          <div className="space-y-2.5">
            {loadingFollowers ? <ListSkeleton /> : filteredFollowers.length > 0 ? (
              filteredFollowers.map((u) => (
                <UserRow key={u.id || u.user_id} user={u} currentUserId={currentUserId} isOwnProfile={isOwnProfile}
                  processing={processingIds.has(u.id || u.user_id || "")}
                  onNavigate={handleNavigate} onFollow={handleFollow} onUnfollow={handleUnfollow} onCancelRequest={handleCancelRequest}
                  onRemoveFollower={setUserToRemove} showRemove={isOwnProfile} />
              ))
            ) : (
              <EmptyState icon={Sparkles} heading="No followers found"
                subtext={searchQuery ? `No results matching "${searchQuery}"` : "When people follow this profile, they will appear here."} />
            )}
          </div>
        )}

        {activeTab === "following" && (
          <div className="space-y-2.5">
            {loadingFollowing ? <ListSkeleton /> : filteredFollowing.length > 0 ? (
              filteredFollowing.map((u) => (
                <UserRow key={u.id || u.user_id} user={u} currentUserId={currentUserId} isOwnProfile={isOwnProfile}
                  processing={processingIds.has(u.id || u.user_id || "")}
                  onNavigate={handleNavigate} onFollow={handleFollow} onUnfollow={handleUnfollow} onCancelRequest={handleCancelRequest} />
              ))
            ) : (
              <EmptyState icon={Sparkles} heading="Not following anyone yet"
                subtext={searchQuery ? `No results matching "${searchQuery}"` : "Discover interesting creators and accounts on Sparkle to follow."} />
            )}
          </div>
        )}

        {activeTab === "flagged" && isOwnProfile && (
          <div className="space-y-3">
            {loadingFlagged ? <ListSkeleton count={3} /> : filteredFlagged.length > 0 ? (
              filteredFlagged.map((req) => (
                <div key={req.id} className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-amber-200/70 dark:border-amber-900/40 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer" onClick={() => handleNavigate(req.username)}>
                      <img src={getAvatarUrl(req.avatar_url, req.username)} alt={req.username} className="w-12 h-12 rounded-full object-cover border border-amber-300 dark:border-amber-700/50 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 leading-tight">
                          <span className="font-extrabold text-[15px] text-black dark:text-white truncate">{req.name || req.username}</span>
                          <VerifiedBadge isVerified={Boolean(req.is_verified)} size="xs" />
                        </div>
                        <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate mt-0.5">@{req.username}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50">
                            <Clock size={11} /> Review Recommended
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 pt-1">
                    <button type="button" onClick={() => handleConfirmFlagged(req)} disabled={processingIds.has(req.id)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF008C] hover:bg-[#FF168F] text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm shadow-[#FF008C]/30 active:scale-95 transition-all disabled:opacity-50">
                      <Check size={16} strokeWidth={2.6} /> Confirm
                    </button>
                    <button type="button" onClick={() => handleDeleteFlagged(req)} disabled={processingIds.has(req.id)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 text-black dark:text-white active:scale-95 transition-all disabled:opacity-50">
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-24 px-6 flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-[#FFE4F3] dark:bg-pink-950/40 text-[#FF008C] flex items-center justify-center mb-5 shadow-inner">
                  <ShieldCheck size={44} strokeWidth={2.4} />
                </div>
                <h2 className="text-2xl font-black text-black dark:text-white tracking-tight uppercase italic mb-2">No Flagged Requests</h2>
                <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 max-w-sm leading-relaxed">Suspicious follow requests will appear here for your review.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "mutual" && !isOwnProfile && (
          <div className="space-y-2.5">
            {loadingMutual ? <ListSkeleton /> : filteredMutual.length > 0 ? (
              filteredMutual.map((u) => (
                <UserRow key={u.id || u.user_id} user={u} currentUserId={currentUserId} isOwnProfile={false}
                  processing={processingIds.has(u.id || u.user_id || "")}
                  onNavigate={handleNavigate} onFollow={handleFollow} onUnfollow={handleUnfollow} onCancelRequest={handleCancelRequest} />
              ))
            ) : (
              <EmptyState icon={Users} heading="No Mutual Followers" subtext="You don't share any followers with this account yet." />
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {userToRemove && (
          <div className="fixed inset-0 z-[1200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-black/10 dark:border-white/10 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 mx-auto flex items-center justify-center mb-3">
                <UserX size={26} strokeWidth={2.4} />
              </div>
              <h3 className="text-base font-black text-[#10112D] dark:text-white mb-1">Remove Follower?</h3>
              <p className="text-xs text-[#565177] dark:text-zinc-400 mb-6 leading-relaxed">
                Sparkle won't tell <span className="font-bold text-[#10112D] dark:text-white">@{userToRemove.username}</span> that they were removed from your followers.
              </p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setUserToRemove(null)} className="flex-1 py-3 rounded-2xl bg-black/5 dark:bg-white/10 text-xs font-bold text-[#565177] dark:text-zinc-300 hover:bg-black/10 transition-colors">Cancel</button>
                <button type="button" onClick={handleConfirmRemoveFollower} className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-600/30">Remove</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
