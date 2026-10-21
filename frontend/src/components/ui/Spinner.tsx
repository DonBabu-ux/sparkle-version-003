import React from 'react';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large' | 'xl';
  className?: string;
  color?: string;
}

const sizeConfig = {
  small: { box: 20, dot: 4, offset: 8 },
  medium: { box: 32, dot: 6, offset: 12 },
  large: { box: 44, dot: 8, offset: 16 },
  xl: { box: 60, dot: 10, offset: 22 },
};

/**
 * Sparkle Brand Splash Loader / Spinner
 * Uses 4 orbiting pulsing dots matching the exact splash screen brand animation.
 */
const Spinner: React.FC<SpinnerProps> = ({
  size = 'medium',
  className = '',
  color,
}) => {
  const { box, dot, offset } = sizeConfig[size];
  const center = box / 2;
  const radius = dot / 2;

  // Determine fill colors: if custom color is passed, use it, else default to brand pink and rose
  const isClassColor = color && (color.startsWith('text-') || color.startsWith('bg-'));
  const dotColor1 = color && !isClassColor ? color : '#ff1493';
  const dotColor2 = color && !isClassColor ? color : '#fb7185';

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 ${isClassColor ? color : ''} ${className}`}
      style={{ width: `${box}px`, height: `${box}px` }}
      aria-label="Loading"
      role="status"
    >
      <svg
        width={box}
        height={box}
        viewBox={`0 0 ${box} ${box}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <circle
          cx={center}
          cy={center - offset}
          r={radius}
          fill={isClassColor ? 'currentColor' : dotColor1}
          className="animate-dot-pulse"
          style={{ transformOrigin: `${center}px ${center - offset}px`, animationDelay: '0ms' }}
        />
        <circle
          cx={center + offset}
          cy={center}
          r={radius}
          fill={isClassColor ? 'currentColor' : dotColor2}
          className="animate-dot-pulse"
          style={{ transformOrigin: `${center + offset}px ${center}px`, animationDelay: '150ms' }}
        />
        <circle
          cx={center}
          cy={center + offset}
          r={radius}
          fill={isClassColor ? 'currentColor' : dotColor1}
          className="animate-dot-pulse"
          style={{ transformOrigin: `${center}px ${center + offset}px`, animationDelay: '300ms' }}
        />
        <circle
          cx={center - offset}
          cy={center}
          r={radius}
          fill={isClassColor ? 'currentColor' : dotColor2}
          className="animate-dot-pulse"
          style={{ transformOrigin: `${center - offset}px ${center}px`, animationDelay: '450ms' }}
        />
      </svg>
    </div>
  );
};

// Named convenience aliases
export const SpinnerSmall = () => <Spinner size="small" />;
export const SpinnerMedium = () => <Spinner size="medium" />;
export const SpinnerLarge = () => <Spinner size="large" />;
export const SpinnerXL = () => <Spinner size="xl" />;
export const ButtonSpinner = ({ color = '#ffffff' }: { color?: string }) => (
  <Spinner size="small" color={color} />
);
export const SpinnerFullscreen = ({ color = '#ff1493' }: { color?: string }) => (
  <div className="fixed inset-0 z-(--z-top) flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm">
    <Spinner size="xl" color={color} />
  </div>
);

export default Spinner;
export { Spinner };
