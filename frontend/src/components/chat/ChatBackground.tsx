import type { SparkleTheme } from '../../store/themeStore';
import { useEffect } from 'react';
import { getMediaUrl } from '../../utils/imageUtils';
import LiveAnimations from './LiveAnimations';

/**
 * Chat wallpaper and the ambient animation layer above it.
 *
 * Extracted from pages/Messages.tsx together with the two module-level values
 * that exist only for it: preloadedWallpapers, a per-render guard so a wallpaper
 * is fetched once rather than every time the theme changes, and
 * lightenWallpaperUrl, which re-sizes Unsplash URLs to a phone-friendly width.
 */

const preloadedWallpapers = new Set<string>();

function lightenWallpaperUrl(url: string): string {
  // Unsplash honors width/quality params — cap at a phone-friendly size.
  if (url.includes('images.unsplash.com')) {
    const u = new URL(url);
    u.searchParams.set('w', '1080');
    u.searchParams.set('q', '60');
    u.searchParams.set('auto', 'format');
    u.searchParams.set('fit', 'crop');
    return u.toString();
  }
  return url;
}

const ChatBackground = ({ theme, mode = 'dark' }: { theme: SparkleTheme | null; mode?: 'light' | 'dark' }) => {
  // Wallpapers live on our own server (/uploads/wallpapers) and are resolved
  // through getMediaUrl so the native APK gets the absolute API origin.
  const wallpaperUrl = theme?.wallpaperUrl ? getMediaUrl(lightenWallpaperUrl(theme.wallpaperUrl)) : null;

  useEffect(() => {
    if (!wallpaperUrl || preloadedWallpapers.has(wallpaperUrl)) return;
    preloadedWallpapers.add(wallpaperUrl);
    const img = new Image();
    img.src = wallpaperUrl;
  }, [wallpaperUrl]);

  const base = mode === 'light'
    ? (theme?.colors?.backgroundLight || '#f8e7ed')
    : (theme?.colors?.backgroundDark || '#18181b');
  const tint = mode === 'light'
    ? (theme?.colors?.backgroundLight || '#fdf8fa')
    : (theme?.colors?.backgroundDark || '#18181b');
  const isDarkMode = mode !== 'light';

  if (!theme) {
    return <div className="absolute inset-0 z-0" style={{ backgroundColor: isDarkMode ? '#18181b' : '#f8e7ed' }} />;
  }

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-700"
      style={{ backgroundColor: base }}
    >
      {/* Base gradient — light in light mode, dark in dark mode */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: `linear-gradient(135deg, ${base} 0%, ${tint} 100%)`,
          opacity: 1,
        }}
      />

      {wallpaperUrl && (
        <>
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: `url(${wallpaperUrl})`,
              backgroundSize: theme?.wallpaperStyle === 'tile' ? '350px' : (theme?.wallpaperStyle || 'cover'),
              backgroundPosition: 'center',
              backgroundRepeat: theme?.wallpaperStyle === 'tile' ? 'repeat' : 'no-repeat',
              opacity: isDarkMode ? 0.55 : 0.4,
            }}
          />
          {/* Readability scrim: heavy in dark mode, light wash in light mode so
              bubble text and timestamps stay legible over any wallpaper */}
          <div
            className="absolute inset-0 z-0"
            style={{
              background: isDarkMode
                ? 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.6) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.75) 100%)',
            }}
          />
        </>
      )}

      {/* Live Animations Layer */}
      <LiveAnimations type={theme?.animationType} />
    </div>
  );
};

export default ChatBackground;
