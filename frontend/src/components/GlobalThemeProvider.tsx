import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import OtaService from '../services/OtaService';


/**
 * Transitional dark-mode scope (S3 / §3 P2-4): routes whose screens have NOT
 * yet been converted to explicit `dark:` variants keep the legacy remap rules
 * (scoped in index.css under `.dark.theme-legacy`). Converted/global surfaces
 * are excluded so the old `!important` hacks can no longer break glass,
 * spinners, or mixed-theme components. Remove entries as pages convert.
 */
const LEGACY_THEME_ROUTES = [
  '/login', '/signup', '/forgot-password',
  '/about', '/legal', '/legal/:documentId',
  '/admin', '/admin/storage',
  '/settings/accounts', '/settings/blocked',
  '/groups/create', '/groups/:id/settings', '/groups/:id',
  '/marketplace', '/marketplace/category/:categoryId', '/marketplace/inbox', '/marketplace/sell',
  '/marketplace/report/:id', '/marketplace/my-shop', '/marketplace/orders', '/marketplace/my-listings',
  '/marketplace/listings/:id', '/marketplace/order', '/marketplace/safety', '/marketplace/seller/:id',
  '/marketplace/messages/:conversationId', '/marketplace/settings', '/marketplace/sparkly',
  '/wishlist', '/skill-market', '/skill-market/hub',
  '/clubs', '/clubs/:id', '/events', '/events/admin',
  '/polls', '/polls/:id',
  '/professional-dashboard', '/ads', '/studio', '/analytics', '/wallet/history',
  '/lost-found', '/support', '/support/ticket/:ticketId',
  '/gallery', '/invite', '/help', '/learn-more',
  '/messages', '/messages/:targetId', '/messages/settings',
  '/story/:storyId', '/stories/:userId', '/moments', '/moments/:id', '/moments/create', '/streams',
  '/search/history',
  '/sparkly', '/sparkly/*', '/sparklybot', '/sparkly-bot', '/sparkly-bot/*',
  '/ai/sparkly', '/ai/sparkly-bot',
].map(routeToRegex);

function routeToRegex(route: string): RegExp {
  const pattern = route
    .split('/')
    .map(seg => {
      if (seg === '*') return '.*';
      if (seg.startsWith(':')) return '[^/]+';
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${pattern}$`);
}

export const GlobalThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const theme = useUserStore((state) => state.theme);
    const { pathname } = useLocation();

    useEffect(() => {
        // 1. Sync Dark/Light theme class to the document node
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            root.style.colorScheme = 'dark';
        } else {
            root.classList.remove('dark');
            root.style.colorScheme = 'light';
        }

        const isLegacyTheme = LEGACY_THEME_ROUTES.some(rx => rx.test(pathname));
        root.classList.toggle('theme-legacy', isLegacyTheme);

        // 2. Set dynamic CSS variables for safe area insets to prevent double padding gaps!
        if (OtaService.isMobile()) {
            // Native mobile safe status bar padding - evaluate dynamically from browser!
            root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 24px)');
            root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 12px)');
        } else {
            // Web / Chrome preview standard boundaries
            root.style.setProperty('--safe-area-inset-top', '0px');
            root.style.setProperty('--safe-area-inset-bottom', '0px');
        }
    }, [theme, pathname]);

    return (
        <div 
            className="sparkle-global-theme-wrapper" 
            style={{ 
                width: '100%', 
                height: '100%', 
                backgroundColor: theme === 'dark' ? '#000000' : '#f0f2f5',
                // Smooth hardware-accelerated color scheme transitions like Telegram/Discord
                transition: 'background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {children}
        </div>
    );
};

export default GlobalThemeProvider;
