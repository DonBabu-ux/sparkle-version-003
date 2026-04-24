import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { capacitorStorage } from './capacitorStorage';

import type { User } from '../types/user';

export interface AccountSession {
  user: User;
  token: string;
}

interface UserState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  accounts: AccountSession[];
  activeAccountId: string | null;
  
  login: (token: string, user: User) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  switchAccount: (userId: string) => void;
  removeAccount: (userId: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      accounts: [],
      activeAccountId: null,

      login: (token, user) => {
        const accounts = get().accounts;
        const existingAccountIndex = accounts.findIndex(acc => acc.user.user_id === user.user_id);
        
        const newAccounts = [...accounts];
        if (existingAccountIndex > -1) {
          newAccounts[existingAccountIndex] = { token, user };
        } else {
          newAccounts.push({ token, user });
        }

        set({ 
          token, 
          user, 
          isAuthenticated: true, 
          accounts: newAccounts,
          activeAccountId: user.user_id 
        });
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
        const activeId = get().activeAccountId;
        const accounts = get().accounts.filter(acc => acc.user.user_id !== activeId);
        
        if (accounts.length > 0) {
          // Switch to the first available account
          const nextAccount = accounts[0];
          set({ 
            user: nextAccount.user, 
            token: nextAccount.token, 
            isAuthenticated: true, 
            accounts,
            activeAccountId: nextAccount.user.user_id
          });
        } else {
          set({ 
            user: null, 
            token: null, 
            isAuthenticated: false, 
            accounts: [],
            activeAccountId: null 
          });
        }
      },

      switchAccount: (userId) => {
        const account = get().accounts.find(acc => acc.user.user_id === userId);
        if (account) {
          set({ 
            user: account.user, 
            token: account.token, 
            isAuthenticated: true, 
            activeAccountId: userId 
          });
        }
      },

      removeAccount: (userId) => {
        const accounts = get().accounts.filter(acc => acc.user.user_id !== userId);
        const isActive = get().activeAccountId === userId;

        if (isActive) {
          if (accounts.length > 0) {
            const nextAccount = accounts[0];
            set({ 
              user: nextAccount.user, 
              token: nextAccount.token, 
              isAuthenticated: true, 
              accounts,
              activeAccountId: nextAccount.user.user_id
            });
          } else {
            set({ 
              user: null, 
              token: null, 
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
        isAuthenticated: state.isAuthenticated,
        accounts: state.accounts,
        activeAccountId: state.activeAccountId
      }),
    }
  )
);
