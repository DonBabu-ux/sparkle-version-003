import { useState, useCallback, useEffect } from 'react';
import {
  getReferralStats,
  getRewards,
  getInviteLink,
  getLeaderboard,
  type ReferralStats,
  type RewardRule,
  type LeaderboardData,
  type InviteLink,
} from '../services/referralService';

export interface UseReferralDataResult {
  data: {
    stats?: ReferralStats;
    rewards?: RewardRule[];
    inviteLink?: InviteLink;
    leaderboard?: LeaderboardData;
  };
  loading: boolean;
  errors: {
    stats?: string;
    rewards?: string;
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

    const [statsResult, rewardsResult, inviteLinkResult] = await Promise.allSettled([
      getReferralStats(),
      getRewards(),
      getInviteLink(),
    ]);

    const newData: Partial<UseReferralDataResult['data']> = {};
    const newErrors: Partial<UseReferralDataResult['errors']> = {};

    if (statsResult.status === 'fulfilled') newData.stats = statsResult.value;
    else newErrors.stats = statsResult.reason?.message || 'Failed to load stats';

    if (rewardsResult.status === 'fulfilled') newData.rewards = rewardsResult.value;
    else newErrors.rewards = rewardsResult.reason?.message || 'Failed to load rewards';

    if (inviteLinkResult.status === 'fulfilled') newData.inviteLink = inviteLinkResult.value;
    else newErrors.inviteLink = inviteLinkResult.reason?.message || 'Failed to load invite link';

    setData(prev => ({ ...prev, ...newData }));
    setErrors(prev => ({ ...prev, ...newErrors }));
    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const refreshSection = useCallback(async (section: keyof UseReferralDataResult['data']) => {
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
      setErrors(prev => ({ ...prev, [section]: (e as Error).message }));
    }
  }, []);

  return { data, loading, errors, refreshSection };
};
