import api from '../api/api';

export interface ReferralStats {
  friendsInvited: number;
  successfulSignups: number;
  pendingReferrals: number;
  rewardsEarned: number;
  currentReferralTier: string;
  currentXP: number;
  nextTier?: string;
  nextTierXP?: number;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  earnedAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  progress: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
}

export interface InviteLink {
  url: string;
}

export const getReferralStats = async () => {
  const { data } = await api.get<ReferralStats>('/referral/stats');
  return data;
};

export const getRewards = async () => {
  const { data } = await api.get<Reward[]>('/referral/rewards');
  return data;
};

export const getMilestones = async () => {
  const { data } = await api.get<Milestone[]>('/referral/milestones');
  return data;
};

export const getAchievements = async () => {
  const { data } = await api.get<Achievement[]>('/referral/achievements');
  return data;
};

export const getInviteLink = async () => {
  const { data } = await api.get<InviteLink>('/referral/invite-link');
  return data;
};

// Leaderboard is optional and controlled via feature flag
export const getLeaderboard = async () => {
  const { data } = await api.get<any>('/referral/leaderboard');
  return data;
};
