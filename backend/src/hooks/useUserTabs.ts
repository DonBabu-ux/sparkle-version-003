// src/hooks/useUserTabs.ts
// Hook to fetch per‑user custom tabs from the backend.
// Returns the tabs array and a loading flag.

import { useState, useEffect } from 'react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

export interface UserTab {
  id: number;
  userId: number;
  tabId: string;
  label: string;
  chatIds?: string[];
}

export const useUserTabs = () => {
  const { user } = useUserStore();
  const [tabs, setTabs] = useState<UserTab[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user?.id && !user?.user_id) {
      setLoading(false);
      return;
    }
    const userId = (user?.id ?? user?.user_id) as number;
    const fetchTabs = async () => {
      try {
        const res = await api.get(`/users/${userId}/tabs`);
        if (Array.isArray(res?.data?.data)) {
          setTabs(res.data.data);
        } else if (Array.isArray(res?.data)) {
          setTabs(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch user tabs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTabs();
  }, [user]);

  return { tabs, loading };
};
