import React from 'react';

export type TriState = boolean | null;

interface ThreeStateToggleProps {
  value: TriState;
  defaultValue?: boolean;
  onChange: (value: TriState) => void;
  labels?: {
    default?: string;
    on?: string;
    off?: string;
  };
  disabled?: boolean;
  className?: string;
}

export const ThreeStateToggle: React.FC<ThreeStateToggleProps> = ({
  value,
  defaultValue = true,
  onChange,
  labels = {
    default: `Default (${defaultValue ? 'On' : 'Off'})`,
    on: 'Allow',
    off: "Don't allow"
  },
  disabled = false,
  className = ''
}) => {
  const currentSelection: 'default' | 'on' | 'off' = 
    value === null || value === undefined ? 'default' : value ? 'on' : 'off';

  return (
    <div 
      className={`inline-flex items-center p-1 bg-black/[0.04] dark:bg-white/[0.06] rounded-xl border border-black/5 dark:border-white/10 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
          currentSelection === 'default'
            ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm font-bold scale-[1.02]'
            : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'
        }`}
      >
        {labels.default || `Default (${defaultValue ? 'On' : 'Off'})`}
      </button>

      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
          currentSelection === 'on'
            ? 'bg-[#ff1493] text-white shadow-sm font-bold scale-[1.02]'
            : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'
        }`}
      >
        {labels.on || 'Allow'}
      </button>

      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
          currentSelection === 'off'
            ? 'bg-zinc-800 text-white dark:bg-zinc-700 shadow-sm font-bold scale-[1.02]'
            : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'
        }`}
      >
        {labels.off || "Don't allow"}
      </button>
    </div>
  );
};

export default ThreeStateToggle;
