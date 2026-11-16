import { useCallback, useEffect, useRef, useState } from 'react';

interface SplashScreenProps {
  /** When true the splash is shown. */
  show?: boolean;
  /**
   * Minimum time the splash stays visible after first mounting (ms) so the
   *  logo registers even on instant boots. Default 1500.
   */
  minHoldMs?: number;
  /**
   * Fired once the minimum hold time has elapsed, after which the splash
   *  unmounts itself. Set to false for pure-visual usage (e.g. a React
   *  Suspense fallback) where the parent unmounts it instead.
   */
  autoRelease?: boolean;
  onHoldComplete?: () => void;
  theme?: 'light' | 'dark';
}

const DEFAULT_MIN_HOLD_MS = 1500;

export const SplashScreen: React.FC<SplashScreenProps> = ({
  show = true,
  minHoldMs = DEFAULT_MIN_HOLD_MS,
  autoRelease = true,
  onHoldComplete,
  theme = 'light',
}) => {
  const [released, setReleased] = useState(false);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!show) {
      setReleased(false);
      startedAt.current = null;
      clear();
      return;
    }
    if (!autoRelease) return;

    if (startedAt.current === null) startedAt.current = Date.now();

    const release = () => {
      setReleased(true);
      onHoldComplete?.();
    };

    const elapsed = Date.now() - startedAt.current;
    const remaining = Math.max(0, minHoldMs - elapsed);
    clear();
    if (remaining <= 0) {
      release();
    } else {
      timer.current = setTimeout(release, remaining);
    }
    return () => clear();
  }, [show, minHoldMs, autoRelease, onHoldComplete, clear]);

  if (!show || released) return null;

  const dark = theme === 'dark';
  return (
    <>
      <style>{`
        @keyframes splashShine {
          0%   { transform: translateX(-100%) skewX(-14deg); }
          55%  { transform: translateX(300%) skewX(-14deg); }
          100% { transform: translateX(300%) skewX(-14deg); }
        }
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.14); }
        }
      `}</style>
      <div
        className={`fixed inset-0 flex flex-col items-center justify-center font-sans transition-colors duration-500 ${dark ? 'bg-zinc-900' : 'bg-[#f8e7ed]'}`}
      >
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="relative h-24 w-24 md:h-32 md:w-32">
            <img
              src="/sparklelogo.png"
              alt="Sparkle"
              width={128}
              height={128}
              decoding="async"
              className="h-full w-full object-contain drop-shadow-md"
              style={{ animation: 'splashPulse 2s ease-in-out infinite', willChange: 'transform' }}
            />
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent dark:via-[#fb7185]/35"
                style={{ animation: 'splashShine 2.2s ease-in-out infinite' }}
              />
            </div>
          </div>

          <h1 className={`mt-6 font-heading text-3xl font-bold tracking-tight md:text-4xl ${dark ? 'text-zinc-100' : 'text-[#18181b]'}`}>
            Sparkle
          </h1>
          <p className={`mt-2 text-sm ${dark ? 'text-zinc-300' : 'text-slate-600'}`}>
            Connect. Share. Shine.
          </p>
        </div>
      </div>
    </>
  );
};

export default SplashScreen;