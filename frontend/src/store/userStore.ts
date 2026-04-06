import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string; // Backend returns 'id' in login response
  user_id?: string; // Some models use user_id
  username: string;
  name: string;
  avatar_url?: string;
  campus?: string;
  major?: string;
  year_of_study?: string;
  bio?: string;
  is_private?: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
}


interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: any | null) => void;
  logout: () => void;
}


export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'user-storage',
    }
  )
);
