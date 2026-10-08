// frontend/src/services/referralService.ts
// Production Sparkle Referral & Attribution Service
import api from '../api/api';

export interface ReferralStats {
  referralCode: string;
  inviteCode?: string;
  referralLink: string;
  url?: string;
  stats: {
    invited: number;
    joined: number;
    qualified: number;
    pending: number;
    rewards: number;
    pendingRewards: number;
    currency: string;
  };
  // Flat backwards-compatible fields
  friendsInvited: number;
  successfulSignups: number;
  pendingReferrals: number;
  totalEarnings: number;
  pendingRewards: number;
  weeklyInvites?: number;
  weeklyActive?: number;
  weeklyEarnings?: number;
}

export interface RewardRule {
  id: string;
  title: string;
  reward: string;
  description: string;
  icon?: string;
}

export interface LeaderboardUser {
  rank: number;
  userId?: string;
  username: string;
  name: string;
  avatar?: string;
  invites: number;
  earnings: number;
}

export interface LeaderboardData {
  topReferrers: LeaderboardUser[];
  currentUser?: {
    rank: number;
    invites: number;
    earnings: number;
  } | null;
}

export interface ReferralHistoryItem {
  id: string;
  userId?: string;
  username: string;
  name?: string;
  avatar?: string;
  joinedDate: string;
  createdAt?: string;
  status: 'Pending' | 'Active' | 'Rewarded' | 'Joined';
  rawStatus?: string;
  reward: string;
  rewardAmount?: number;
}

export interface InviteLink {
  code: string;
  url: string;
}

export interface PublicInviteInfo {
  valid: boolean;
  code?: string;
  message?: string;
  referrer?: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  };
}

export interface ReferralClickResult {
  success: boolean;
  clickId: string;
  handoffToken: string;
  referralCode: string;
  canonicalUrl: string;
  referrer: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  };
  expiresAt: string;
}

// ── Authenticated Calls ──────────────────────────────────────────────────────

export const getReferralStats = async (): Promise<ReferralStats> => {
  const { data } = await api.get<any>('/referral/stats');
  return data?.data || data;
};

export const getInviteLink = async (): Promise<InviteLink> => {
  const { data } = await api.get<any>('/referral/invite-link');
  return data?.data || data;
};

export const getRewards = async (): Promise<RewardRule[]> => {
  const { data } = await api.get<any>('/referral/rewards');
  return data?.data?.rules || data?.rules || [];
};

export const getLeaderboard = async (): Promise<LeaderboardData> => {
  const { data } = await api.get<any>('/referral/leaderboard');
  return data?.data || { topReferrers: [], currentUser: null };
};

export const getReferralHistory = async (): Promise<ReferralHistoryItem[]> => {
  const { data } = await api.get<any>('/referral/history');
  return data?.data?.history || data?.history || [];
};

export const claimReferral = async (payload: { referralCode?: string; handoffToken?: string }) => {
  const { data } = await api.post<any>('/referral/claim', payload);
  return data;
};

export const claimManualReferral = async (code: string) => {
  const { data } = await api.post<any>('/referral/manual', { code });
  return data;
};

// ── Public Calls (Landing Page / APK Handoff) ────────────────────────────────

export const validateReferralCode = async (code: string): Promise<PublicInviteInfo> => {
  try {
    const { data } = await api.get<any>(`/referral/validate/${encodeURIComponent(code)}`);
    return {
      valid: true,
      code: data?.data?.code || code,
      referrer: data?.data?.referrer
    };
  } catch (err: any) {
    return {
      valid: false,
      message: err.response?.data?.message || 'This invitation is no longer available.'
    };
  }
};

export const recordReferralClick = async (payload: {
  code: string;
  anonymousSessionId?: string;
  platform?: string;
  source?: string;
}): Promise<ReferralClickResult | null> => {
  try {
    const { data } = await api.post<any>('/referral/click', payload);
    return data?.data || null;
  } catch (err) {
    console.warn('Failed to record referral click:', err);
    return null;
  }
};

export const resolveReferralHandoff = async (payload: {
  handoffToken?: string;
  code?: string;
}) => {
  try {
    const { data } = await api.post<any>('/referral/resolve', payload);
    return data?.data || null;
  } catch (err) {
    console.warn('Failed to resolve referral handoff:', err);
    return null;
  }
};
