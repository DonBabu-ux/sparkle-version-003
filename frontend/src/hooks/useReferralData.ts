import { useState, useCallback, useEffect } from 'react';
import {
  getReferralStats,
  getRewards,
  getMilestones,
  getAchievements,
  getInviteLink,
  getLeaderboard,
} from '../services/referralService';
import type { ReferralStats, Reward, Milestone, Achievement, InviteLink, LeaderboardEntry } from '../types/referral';

export interface UseReferralDataResult {
  data: {
    stats?: ReferralStats;
    rewards?: Reward[];
    milestones?: Milestone[];
    achievements?: Achievement[];
    inviteLink?: InviteLink;
    leaderboard?: LeaderboardEntry[];
  };
  loading: boolean;
  errors: {
    stats?: string;
    rewards?: string;
    milestones?: string;
    achievements?: string;
    inviteLink?: string;
    leaderboard?: string;
  };
  /** Refresh a single section (e.g., 'inviteLink') */
  refreshSection: (section: keyof UseReferralDataResult['data']) => Promise<void>;
}

export const useReferralData = (): UseReferralDataResult => {
  const [data, setData] = useState<UseReferralDataResult['data']>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [errors, setErrors] = useState<UseReferralDataResult['errors']>({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErrors({});
    const promises = {
      stats: getReferralStats(),
      rewards: getRewards(),
      milestones: getMilestones(),
      achievements: getAchievements(),
      inviteLink: getInviteLink(),
    } as const;
    // Leaderboard is optional – only fetch if feature flag present (placeholder check)
    const includeLeaderboard = false; // adjust as needed
    if (includeLeaderboard) {
      // @ts-ignore – dynamic key addition
      promises.leaderboard = getLeaderboard();
    }
    const results = await Promise.allSettled(Object.entries(promises).map(([, fn]) => fn));
    const keys = Object.keys(promises) as (keyof typeof promises)[];
    const newData: Partial<UseReferralDataResult['data']> = {};
    const newErrors: Partial<UseReferralDataResult['errors']> = {};
    results.forEach((result, idx) => {
      const key = keys[idx];
      if (result.status === 'fulfilled') {
        // @ts-ignore – assign correctly
        newData[key] = result.value;
      } else {
        // @ts-ignore – assign error message
        newErrors[key] = result.reason?.message || 'Failed to load';
      }
    });
    setData(prev => ({ ...prev, ...newData }));
    setErrors(prev => ({ ...prev, ...newErrors }));
    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const refreshSection = useCallback(async (section) => {
    // Simple switch based on section name
    try {
      switch (section) {
        case 'stats': {
          const stats = await getReferralStats();
          setData(d => ({ ...d, stats }));
          break;
        }
        case 'rewards': {
          const rewards = await getRewards();
          setData(d => ({ ...d, rewards }));
          break;
        }
        case 'milestones': {
          const milestones = await getMilestones();
          setData(d => ({ ...d, milestones }));
          break;
        }
        case 'achievements': {
          const achievements = await getAchievements();
          setData(d => ({ ...d, achievements }));
          break;
        }
        case 'inviteLink': {
          const inviteLink = await getInviteLink();
          setData(d => ({ ...d, inviteLink }));
          break;
        }
        case 'leaderboard': {
          const leaderboard = await getLeaderboard();
          setData(d => ({ ...d, leaderboard }));
          break;
        }
        default:
          console.warn('Unknown section refresh', section);
      }
    } catch (e) {
      setErrors(e => ({ ...e, [section]: (e as Error).message }));
    }
  }, []);

  return { data, loading, errors, refreshSection };
};
