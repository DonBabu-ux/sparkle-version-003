import React, { ReactNode } from 'react';

/**
 * RewardIcon – a wrapper that applies premium visual effects to reward SVGs.
 * It adds a subtle glow, gradient background, and glass‑morphism style.
 */
const RewardIcon: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 backdrop-blur-sm border border-white/10 shadow-[0_0_8px_#ff008a] hover:shadow-[0_0_12px_#ff66c4] transition-shadow">
      {/* Apply a soft pink gradient overlay */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#ff008a]/10 to-[#ff66c4]/10 pointer-events-none" />
      {/* The actual SVG */}
      <div className="relative z-10" style={{ width: '24px', height: '24px' }}>
        {children}
      </div>
    </div>
  );
};

export default RewardIcon;
