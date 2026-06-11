// src/mocks/referralData.ts
export const mockStats = {
  friendsInvited: 23,
  successfulSignups: 17,
  pendingRewards: 6,
  rewardPoints: 2350,
  referralRank: 42,
  currentTier: "Connector",
  currentXP: 480,
  nextTier: "Influencer",
  nextTierXP: 800,
};

export const mockRewards = [
  { id: "pink", label: "Pink Gift Box", unlocked: true },
  { id: "sparkle", label: "Sparkle Plus", unlocked: false },
  { id: "silver", label: "Silver Gift Box", unlocked: false },
  { id: "premiumBadge", label: "Premium Badge", unlocked: false },
  { id: "gold", label: "Gold Gift Box", unlocked: false },
  { id: "discovery", label: "Discovery Boost", unlocked: false },
  { id: "diamond", label: "Diamond Gift Box", unlocked: false },
  { id: "vip", label: "VIP Access", unlocked: false },
  { id: "eliteCrown", label: "Elite Crown Box", unlocked: false },
  { id: "eliteMembership", label: "Elite Membership", unlocked: false },
];

export const mockLeaderboard = [
  { rank: 1, name: "Alice", avatar: "https://i.pravatar.cc/80?img=1", invites: 54, tier: "Legend" }, 
  { rank: 2, name: "Bob", avatar: "https://i.pravatar.cc/80?img=2", invites: 48, tier: "Ambassador" },
  { rank: 3, name: "Carol", avatar: "https://i.pravatar.cc/80?img=3", invites: 42, tier: "Influencer" },
];

export const mockAchievements = [
  { id: "first", label: "First Invite", unlocked: true, progress: 100 },
  { id: "five", label: "5 Invites", unlocked: true, progress: 100 },
  { id: "ten", label: "10 Invites", unlocked: false, progress: 70 },
  { id: "twentyFive", label: "25 Invites", unlocked: false, progress: 30 },
  { id: "fifty", label: "50 Invites", unlocked: false, progress: 0 },
  { id: "hundred", label: "100 Invites", unlocked: false, progress: 0 },
];
