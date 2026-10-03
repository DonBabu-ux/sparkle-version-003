import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface SettingRowProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  value?: string | React.ReactNode;
  rightElement?: 'chevron' | 'toggle' | 'badge' | 'custom';
  toggleValue?: boolean;
  onToggleChange?: (checked: boolean) => void;
  badgeText?: string;
  badgeVariant?: 'pink' | 'slate' | 'green' | 'amber';
  customRight?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  icon: Icon,
  title,
  description,
  value,
  rightElement = 'chevron',
  toggleValue = false,
  onToggleChange,
  badgeText,
  badgeVariant = 'pink',
  customRight,
  onClick,
  disabled = false,
}) => {
  const isClickable = !!onClick && !disabled;

  const badgeStyles = {
    pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    slate: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  };

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`group flex items-center justify-between p-4 transition-all duration-200 ${
        isClickable ? 'cursor-pointer hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 active:scale-[0.99]' : ''
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Left side: Circular Icon + Content */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
        <div className="w-10 h-10 rounded-full bg-pink-500/10 dark:bg-pink-500/15 text-[#ff1493] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate tracking-tight">
              {title}
            </h4>
          </div>
          {description && (
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-2">
              {description}
            </p>
          )}
          {value && typeof value === 'string' && (
            <p className="text-xs font-medium text-[#ff1493] dark:text-pink-400 mt-0.5">
              {value}
            </p>
          )}
          {value && typeof value !== 'string' && (
            <div className="mt-1">{value}</div>
          )}
        </div>
      </div>

      {/* Right side: Control Element */}
      <div className="flex items-center gap-2 shrink-0">
        {rightElement === 'badge' && badgeText && (
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badgeStyles[badgeVariant]}`}>
            {badgeText}
          </span>
        )}

        {rightElement === 'toggle' && (
          <button
            type="button"
            role="switch"
            aria-checked={toggleValue}
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleChange) onToggleChange(!toggleValue);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
              toggleValue ? 'bg-[#ff1493]' : 'bg-slate-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-sm ${
                toggleValue ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        )}

        {rightElement === 'custom' && customRight}

        {rightElement === 'chevron' && (
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
        )}
      </div>
    </div>
  );
};
