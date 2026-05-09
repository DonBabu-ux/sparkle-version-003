import React from 'react';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large' | 'xl';
  className?: string;
  color?: string;
}

const config = {
  small:  { px: 18, tickWidth: 1.5, tickLength: 4 },
  medium: { px: 28, tickWidth: 2,   tickLength: 6 },
  large:  { px: 40, tickWidth: 2.5, tickLength: 9 },
  xl:     { px: 56, tickWidth: 3,   tickLength: 12 },
};

/**
 * Radial Segmented Spinner / Tick Spinner
 * Uses multiple short radial line segments/ticks rotating continuously.
 * Identical to Instagram/Threads iOS-style radial activity indicators.
 */
const Spinner: React.FC<SpinnerProps> = ({
  size = 'medium',
  className = '',
  color = 'text-primary',
}) => {
  const { px, tickWidth, tickLength } = config[size];
  const center = px / 2;
  const radius = center - 2; // slight padding
  
  // 12 ticks arranged radially
  const ticks = Array.from({ length: 12 }).map((_, i) => {
    const angle = (i * 30) * (Math.PI / 180);
    const innerRadius = radius - tickLength;
    
    // Calculate coordinates for the line segment
    const x1 = center + innerRadius * Math.sin(angle);
    const y1 = center - innerRadius * Math.cos(angle);
    const x2 = center + radius * Math.sin(angle);
    const y2 = center - radius * Math.cos(angle);
    
    // Opacity fades gracefully around the circle to create the comet tail effect
    // Fades from 1 down to 0.15
    const opacity = 1 - (i / 12) * 0.85;

    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="currentColor"
        strokeWidth={tickWidth}
        strokeLinecap="round"
        opacity={opacity}
      />
    );
  });

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      fill="none"
      className={`${color} ${className} motion-safe:animate-spin`}
      style={{
        animationDuration: '1.2s',
        animationTimingFunction: 'steps(12, end)',
      }}
      aria-label="Loading"
      role="status"
    >
      {ticks}
    </svg>
  );
};

// Named convenience aliases
export const SpinnerSmall     = () => <Spinner size="small"  />;
export const SpinnerMedium    = () => <Spinner size="medium" />;
export const SpinnerLarge     = () => <Spinner size="large"  />;
export const SpinnerXL        = () => <Spinner size="xl"     />;
export const ButtonSpinner    = ({ color = 'text-white' }: { color?: string }) => (
  <Spinner size="small" color={color} />
);
export const SpinnerFullscreen = ({ color = 'text-primary' }: { color?: string }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm">
    <Spinner size="xl" color={color} />
  </div>
);

export default Spinner;
export { Spinner };
