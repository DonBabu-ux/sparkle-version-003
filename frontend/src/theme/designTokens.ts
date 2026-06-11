// src/theme/designTokens.ts (updated with call UI tokens)
export const designTokens = {
  // New tokens for modern UI
  editBadge: {
    background: '#ff1493',
    color: '#fff',
    fontSize: '10px',
    padding: '2px 4px',
    borderRadius: '4px',
  },
  replyBorder: {
    width: '3px',
    color: '#ff1493',
  },
  gif: {
    maxHeight: '200px',
    borderRadius: '8px',
  },
  // Call UI tokens
  call: {
    overlayBg: 'rgba(0,0,0,0.6)',
    previewBg: 'rgba(0,0,0,0.3)',
    previewShadow: '0 4px 12px rgba(0,0,0,0.4)',
    gradientDuration: '8s',
    blurAmount: '8px',
    transition: '0.3s ease-in-out',
    borderRadius: '12px',
  },
  // Existing design tokens
  colors: {
    primary: '#FF4FA3',
    background: '#0F0A10',
    surface: '#17111A',
    surfaceDark: '#2B1A2A',
    textPrimary: '#FFFFFF',
    textSecondary: '#FFCCE5',
    border: '#FF8CC8',
    accent: '#FF8CC8',
    success: '#4ADE80',
    warning: '#FFC107',
    error: '#DC3545',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  radii: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    round: '9999px',
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    fontSize: {
      sm: '12px',
      md: '14px',
      lg: '16px',
      xl: '20px',
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      bold: 700,
    },
  },
  shadows: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 2px 4px rgba(0,0,0,0.1)',
    lg: '0 4px 8px rgba(0,0,0,0.15)',
  },
  motion: {
    transition: '0.2s ease-in-out',
  },
};
