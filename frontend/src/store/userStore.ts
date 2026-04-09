import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id?: string;
  user_id?: string;
  username?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  campus?: string;
  major?: string;
  year_of_study?: string;
  bio?: string;
  headline?: string;
  website?: string;
  phone_number?: string;
  birthday?: string;
  two_factor_enabled?: boolean;
  is_private?: boolean;
  show_contact_info?: boolean;
  show_birthday?: boolean;
  dm_permission?: 'everyone' | 'followers' | 'none';
  theme?: 'light' | 'dark';
  email_verified?: boolean;
  phone_verified?: boolean;
}

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
