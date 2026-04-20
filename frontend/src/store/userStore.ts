import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { User } from '../types/user';

interface UserState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  // Log in with a token + user object returned from the API
  login: (token: string, user: User) => void;
  // Set just the user object (profile updates etc.)
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (token, user) => {
        localStorage.setItem('sparkleToken', token);
        set({ token, user, isAuthenticated: true });
      },

      setUser: (user) =>
        set({ user, isAuthenticated: !!user }),

      logout: () => {
        localStorage.removeItem('sparkleToken');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'user-storage',
      // Only persist user and token — not derived auth state
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
