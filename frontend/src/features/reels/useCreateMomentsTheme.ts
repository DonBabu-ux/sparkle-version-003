import { useEffect, useState } from 'react';
import { useUserStore } from '../../store/userStore';

export interface CreateMomentsTheme {
  isDark: boolean;
  theme: 'dark' | 'light';
}

/**
 * Returns whether Create Moments should render in dark mode or light mode.
 * - Light mode is the default appearance when dark mode is not enabled.
 * - When Sparkle's global appearance setting is Dark, returns isDark=true.
 * - When System mode is used, follows device dark mode preference.
 */
export function useCreateMomentsTheme(): CreateMomentsTheme {
  const userTheme = useUserStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const isDark = userTheme === 'dark' || (userTheme as string === 'system' && systemDark);

  return {
    isDark,
    theme: isDark ? 'dark' : 'light',
  };
}
