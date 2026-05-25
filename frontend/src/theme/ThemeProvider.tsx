// src/theme/ThemeProvider.tsx
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { designTokens } from './designTokens';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextProps {
  mode: ThemeMode;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextProps>({
  mode: 'light',
  toggleMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

interface Props {
  children: ReactNode;
}

export const ThemeProvider: React.FC<Props> = ({ children }) => {
  const [mode, setMode] = React.useState<ThemeMode>('light');

  const toggleMode = () => setMode(prev => (prev === 'light' ? 'dark' : 'light'));

  const theme = useMemo(() => {
    const isDark = mode === 'dark';
    const colors = isDark
      ? {
          background: designTokens.colors.surfaceDark,
          surface: '#3A3F44',
          textPrimary: '#FFFFFF',
          textSecondary: '#B0B3B8',
          border: '#4F545C',
        }
      : {
          background: designTokens.colors.background,
          surface: designTokens.colors.surface,
          textPrimary: designTokens.colors.textPrimary,
          textSecondary: designTokens.colors.textSecondary,
          border: designTokens.colors.border,
        };
    return { ...designTokens, colors: { ...designTokens.colors, ...colors }, mode };
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <div
        style={{
          backgroundColor: theme.colors.background,
          color: theme.colors.textPrimary,
          minHeight: '100vh',
          fontFamily: theme.typography.fontFamily,
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};
