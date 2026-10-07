import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { capacitorStorage } from './capacitorStorage';

import type { User } from '../types/user';

export interface AccountSession {
  user: User;
  token: string;
  refreshToken: string;
}

interface UserState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  accounts: AccountSession[];
  activeAccountId: string | null;
  theme: 'light' | 'dark';

  setTheme: (theme: 'light' | 'dark') => void;
  login: (token: string, refreshToken: string, user: User) => void;
  setToken: (token: string, refreshToken?: string) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  switchAccount: (userId: string) => void;
  removeAccount: (userId: string) => void;
}

// A.4 #7 / #2: account-scoped data that must never outlive its session — the
// SW `api-cache` (the previous account's feed/inbox served offline) and the
// immortal `sparkle_signup_*` keys. Purged on logout AND on account
// switch/removal, which share the same cross-account leak vector.
const purgeAccountScopedCaches = (): void => {
  try {
    if (typeof caches !== 'undefined') {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k === 'api-cache' || k.startsWith('api-cache'))
              .map((k) => caches.delete(k))
          )
        )
        .catch(() => {});
    }
  } catch { /* no Cache API */ }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sparkle_signup_token');
      localStorage.removeItem('sparkle_signup_refresh');
      localStorage.removeItem('sparkle_signup_user');
    }
  } catch { /* storage unavailable */ }
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      accounts: [],
      activeAccountId: null,
      theme: 'light',

      setTheme: (theme) => set({ theme }),
      login: (token, refreshToken, user) => {
        const accounts = get().accounts;
        const existingAccountIndex = accounts.findIndex(acc => acc.user.user_id === user.user_id);
        
        const newAccounts = [...accounts];
        if (existingAccountIndex > -1) {
          newAccounts[existingAccountIndex] = { token, refreshToken, user };
        } else {
          newAccounts.push({ token, refreshToken, user });
        }

        set({ 
          token, 
          refreshToken,
          user, 
          isAuthenticated: true, 
          accounts: newAccounts,
          activeAccountId: user.user_id 
        });
      },

      setToken: (token, refreshToken) => {
        const currentRefreshToken = refreshToken || get().refreshToken;
        set({ token, refreshToken: currentRefreshToken });
        
        // Update current account session
        const activeId = get().activeAccountId;
        if (activeId) {
          const accounts = get().accounts.map(acc => 
            acc.user.user_id === activeId ? { ...acc, token, refreshToken: currentRefreshToken as string } : acc
          );
          set({ accounts });
        }
      },

      setUser: (user) => {
        if (!user) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        const accounts = get().accounts;
        const newAccounts = accounts.map(acc => 
          acc.user.user_id === user.user_id ? { ...acc, user } : acc
        );

        set({ user, isAuthenticated: true, accounts: newAccounts });
      },

      logout: () => {
        // Clear all UI blocking states (Modals)
        try {
          const { closeModal } = require('./modalStore').useModalStore.getState();
          closeModal();
        } catch (e) {}
        try {
          const { setActiveModal } = require('./marketplaceStore').useMarketplaceStore.getState();
          setActiveModal(null);
        } catch (e) {}

        purgeAccountScopedCaches();

        const activeId = get().activeAccountId;
        const accounts = get().accounts.filter(acc => acc.user.user_id !== activeId);
        
        if (accounts.length > 0) {
          // Switch to the first available account
          const nextAccount = accounts[0];
          set({ 
            user: nextAccount.user, 
            token: nextAccount.token, 
            refreshToken: nextAccount.refreshToken,
            isAuthenticated: true, 
            accounts,
            activeAccountId: nextAccount.user.user_id
          });
        } else {
          set({ 
            user: null, 
            token: null, 
            refreshToken: null,
            isAuthenticated: false, 
            accounts: [],
            activeAccountId: null 
          });
        }
      },

      switchAccount: (userId) => {
        // Clear all UI blocking states (Modals)
        try {
          const { closeModal } = require('./modalStore').useModalStore.getState();
          closeModal();
        } catch (e) {}
        try {
          const { setActiveModal } = require('./marketplaceStore').useMarketplaceStore.getState();
          setActiveModal(null);
        } catch (e) {}

        // Same cross-account leak as logout: the new account must not inherit
        // the previous account's offline API cache.
        purgeAccountScopedCaches();

        const account = get().accounts.find(acc => acc.user.user_id === userId);
        if (account) {
          set({ 
            user: account.user, 
            token: account.token, 
            refreshToken: account.refreshToken,
            isAuthenticated: true, 
            activeAccountId: userId 
          });
        }
      },

      removeAccount: (userId) => {
        const accounts = get().accounts.filter(acc => acc.user.user_id !== userId);
        const isActive = get().activeAccountId === userId;

        if (isActive) {
          // Active session is ending — same purge as logout.
          purgeAccountScopedCaches();
          if (accounts.length > 0) {
            const nextAccount = accounts[0];
            set({ 
              user: nextAccount.user, 
              token: nextAccount.token, 
              refreshToken: nextAccount.refreshToken,
              isAuthenticated: true, 
              accounts,
              activeAccountId: nextAccount.user.user_id
            });
          } else {
            set({ 
              user: null, 
              token: null, 
              refreshToken: null,
              isAuthenticated: false, 
              accounts: [],
              activeAccountId: null 
            });
          }
        } else {
          set({ accounts });
        }
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => capacitorStorage),
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
        theme: state.theme
      }),
    }
  )
);
