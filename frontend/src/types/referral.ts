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
  title: string;
  description: string;
  earned: boolean;
  iconUrl?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  progress: number; // 0-100
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  iconUrl?: string;
}

export interface InviteLink {
  url: string;
  qrCodeUrl?: string; // optional pre‑generated QR code URL
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  count: number;
}
