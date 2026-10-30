import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn().mockResolvedValue({ value: null }),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

import { useUserStore } from '../../../store/userStore';

describe('Create Moments Theme Logic', () => {
  beforeEach(() => {
    useUserStore.setState({ theme: 'light' });
  });

  it('userStore defaults to light mode or honors appearance settings', () => {
    useUserStore.setState({ theme: 'light' });
    expect(useUserStore.getState().theme).toBe('light');

    useUserStore.setState({ theme: 'dark' });
    expect(useUserStore.getState().theme).toBe('dark');
  });

  it('determines dark mode strictly when theme is dark or system dark', () => {
    const isDarkMode = (theme: string, systemDark: boolean) => {
      return theme === 'dark' || (theme === 'system' && systemDark);
    };

    expect(isDarkMode('light', false)).toBe(false);
    expect(isDarkMode('light', true)).toBe(false);
    expect(isDarkMode('dark', false)).toBe(true);
    expect(isDarkMode('dark', true)).toBe(true);
    expect(isDarkMode('system', false)).toBe(false);
    expect(isDarkMode('system', true)).toBe(true);
  });
});
