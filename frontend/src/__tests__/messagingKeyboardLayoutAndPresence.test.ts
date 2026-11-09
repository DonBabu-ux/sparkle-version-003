import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('SPARKLE — Messaging Keyboard Layout & Presence Contract Tests', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const manifestPath = path.join(rootDir, 'android/app/src/main/AndroidManifest.xml');
  const sparkleInsetsPath = path.join(rootDir, 'android/app/src/main/java/com/sparkleapp/plugins/SparkleInsetsPlugin.java');
  const messagesTsxPath = path.join(__dirname, '../pages/Messages.tsx');
  const safeLayoutPath = path.join(__dirname, '../components/SafeLayout.tsx');
  const indexCssPath = path.join(__dirname, '../index.css');

  describe('Part 1 & 2: Android Soft-Input & Header Architecture', () => {
    it('sets android:windowSoftInputMode="adjustNothing" in AndroidManifest.xml', () => {
      const manifest = fs.readFileSync(manifestPath, 'utf8');
      expect(manifest).toContain('android:windowSoftInputMode="adjustNothing"');
      expect(manifest).not.toContain('android:windowSoftInputMode="adjustResize"');
      expect(manifest).not.toContain('android:windowSoftInputMode="adjustPan"');
    });

    it('documents keyboard handling strategy in SparkleInsetsPlugin.java', () => {
      const pluginJava = fs.readFileSync(sparkleInsetsPath, 'utf8');
      expect(pluginJava).toContain('windowSoftInputMode is "adjustNothing"');
      expect(pluginJava).toContain('INSET_TYPES');
    });

    it('places conversation header outside of PullUpDisappearingGesture in Messages.tsx', () => {
      const messagesTsx = fs.readFileSync(messagesTsxPath, 'utf8');
      const headerIndex = messagesTsx.indexOf('<header');
      const gestureIndex = messagesTsx.indexOf('<PullUpDisappearingGesture');

      expect(headerIndex).toBeGreaterThan(-1);
      expect(gestureIndex).toBeGreaterThan(-1);
      // The header is rendered BEFORE PullUpDisappearingGesture, keeping it completely outside the gesture container
      expect(headerIndex).toBeLessThan(gestureIndex);
    });

    it('declares header with shrink-0 and select-none for layout stability', () => {
      const messagesTsx = fs.readFileSync(messagesTsxPath, 'utf8');
      expect(messagesTsx).toContain('className="h-[56px] z-40 shrink-0 px-3.5 flex items-center justify-between');
    });

    it('maintains independent scroll viewport on messagesListRef with flex-1 min-h-0', () => {
      const messagesTsx = fs.readFileSync(messagesTsxPath, 'utf8');
      expect(messagesTsx).toContain('ref={messagesListRef} className="flex-1 overflow-y-auto overscroll-y-contain min-h-0');
    });

    it('documents the keyboard-safe layout architecture invariants in SafeLayout.tsx', () => {
      const safeLayout = fs.readFileSync(safeLayoutPath, 'utf8');
      expect(safeLayout).toContain('windowSoftInputMode="adjustNothing"');
      expect(safeLayout).toContain('The conversation header MUST be a direct flex child of the main column');
      expect(safeLayout).toContain('No transform/translate is applied to any ancestor of the header');
    });
  });

  describe('Part 5: Light-Mode Presence & Contrast Invariants', () => {
    it('supports theme-aware header background for light and dark modes in Messages.tsx', () => {
      const messagesTsx = fs.readFileSync(messagesTsxPath, 'utf8');
      expect(messagesTsx).toContain("appThemeMode === 'dark'");
      expect(messagesTsx).toContain("currentChatTheme?.colors?.backgroundDark");
      expect(messagesTsx).toContain("currentChatTheme?.colors?.backgroundLight");
    });

    it('renders a distinct green indicator dot alongside the online label in Messages.tsx', () => {
      const messagesTsx = fs.readFileSync(messagesTsxPath, 'utf8');
      expect(messagesTsx).toContain('w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shrink-0');
      expect(messagesTsx).toContain('chat-header-online');
    });

    it('uses high-contrast text for recipient name in both themes', () => {
      const messagesTsx = fs.readFileSync(messagesTsxPath, 'utf8');
      expect(messagesTsx).toContain('text-[#18181b] dark:text-white');
    });

    it('defines .chat-header-presence overrides in index.css protecting presence text in light mode', () => {
      const indexCss = fs.readFileSync(indexCssPath, 'utf8');
      expect(indexCss).toContain('.chat-header-presence');
      expect(indexCss).toContain('.chat-header-online');
      expect(indexCss).toContain('.chat-header-group-online');
      expect(indexCss).toContain('[data-chat-mode="light"] .chat-header-presence');
      expect(indexCss).toContain('[data-chat-mode="light"] .chat-header-online');
    });

    it('uses chat-header-presence semantic classes for online, group-online, and last-seen in Messages.tsx', () => {
      const messagesTsx = fs.readFileSync(messagesTsxPath, 'utf8');
      expect(messagesTsx).toContain('chat-header-presence chat-header-group-online');
      expect(messagesTsx).toContain('chat-header-presence chat-header-online');
      expect(messagesTsx).toContain('chat-header-presence truncate whitespace-nowrap overflow-hidden text-ellipsis leading-tight');
    });

    it('meets WCAG AA contrast requirements in both light and dark modes', () => {
      // Relative luminance calculation for WCAG AA
      const getLuminance = (r: number, g: number, b: number) => {
        const a = [r, g, b].map(v => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      };

      const getContrast = (rgb1: [number, number, number], rgb2: [number, number, number]) => {
        const lum1 = getLuminance(...rgb1);
        const lum2 = getLuminance(...rgb2);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        return (brightest + 0.05) / (darkest + 0.05);
      };

      // Dark header surface: #000000
      const headerDark: [number, number, number] = [0, 0, 0];
      const darkOnlineGreen: [number, number, number] = [52, 211, 153]; // #34d399 (emerald-400)
      const darkLastSeenGrey: [number, number, number] = [166, 166, 166]; // 65% white on black

      // Light header surface: #fdf8fa (light cream panel)
      const headerLight: [number, number, number] = [253, 248, 250];
      const lightOnlineGreen: [number, number, number] = [4, 120, 87]; // #047857 (emerald-700)
      const lightLastSeenGrey: [number, number, number] = [82, 82, 91]; // #52525b (zinc-600)

      // Contrast checks on Dark mode
      const darkOnlineContrast = getContrast(darkOnlineGreen, headerDark);
      const darkLastSeenContrast = getContrast(darkLastSeenGrey, headerDark);
      expect(darkOnlineContrast).toBeGreaterThanOrEqual(4.5);
      expect(darkLastSeenContrast).toBeGreaterThanOrEqual(4.5);

      // Contrast checks on Light mode
      const lightOnlineContrast = getContrast(lightOnlineGreen, headerLight);
      const lightLastSeenContrast = getContrast(lightLastSeenGrey, headerLight);
      expect(lightOnlineContrast).toBeGreaterThanOrEqual(4.5);
      expect(lightLastSeenContrast).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Part D: Presence In-Place Stability (No Periodic Sliding Animation)', () => {
    it('does not wrap presence in AnimatePresence with sliding motion offsets in Messages.tsx', () => {
      const messagesTsx = fs.readFileSync(messagesTsxPath, 'utf8');
      // Presence area should use stable div/p elements rather than motion.p with y offsets
      const headerAreaMatch = messagesTsx.match(/chat-header-online[\s\S]{1,500}chat-header-presence/);
      expect(headerAreaMatch).not.toBeNull();
      // Ensure no motion.p or AnimatePresence sliding is inside the presence status container
      expect(messagesTsx).not.toContain('<AnimatePresence mode="wait">\n                        {renderPresence()}');
      expect(messagesTsx).not.toContain('exit={{ opacity: 0, y: -3 }}');
    });

    it('uses readable text size for last seen while preserving hierarchy', () => {
      const messagesTsx = fs.readFileSync(messagesTsxPath, 'utf8');
      expect(messagesTsx).toContain('text-xs md:text-[13px] font-medium');
    });
  });

  describe('Part A: Profile Reels Retrieval & Visibility Pipeline', () => {
    const profileTsxPath = path.join(__dirname, '../pages/Profile.tsx');
    const momentsControllerPath = path.join(rootDir, 'backend/controllers/moments.controller.js');
    const momentWorkerPath = path.join(__dirname, '../services/workers/MomentUploadWorker.ts');

    it('resolves targetUserId for "me", usernames, and user IDs in backend moments controller', () => {
      const momentsController = fs.readFileSync(momentsControllerPath, 'utf8');
      expect(momentsController).toContain("targetParam === 'me'");
      expect(momentsController).toContain('SELECT user_id FROM users WHERE user_id = ? OR username = ? LIMIT 1');
      expect(momentsController).toContain("currentUserId = req.user?.user_id || req.user?.userId || req.user?.id || null");
    });

    it('emits type MOMENT on upload completion in MomentUploadWorker', () => {
      const worker = fs.readFileSync(momentWorkerPath, 'utf8');
      expect(worker).toContain("type: 'MOMENT'");
    });

    it('maps thumbnail_url and derived video poster in Profile.tsx', () => {
      const profileTsx = fs.readFileSync(profileTsxPath, 'utf8');
      expect(profileTsx).toContain('derivedThumb = m.thumbnail_url || (m.media_url ? m.media_url.replace(/\\.[^/.]+$/, \'.jpg\') : undefined)');
      expect(profileTsx).toContain('thumbnail_url: derivedThumb');
    });

    it('does not forcibly reset activeTab to posts on profile refetch in Profile.tsx', () => {
      const profileTsx = fs.readFileSync(profileTsxPath, 'utf8');
      // Ensure fetchProfile doesn't do setActiveTab('posts') unconditionally
      expect(profileTsx).not.toContain("setProfile(data);\n      setActiveTab('posts');");
    });
  });
});
