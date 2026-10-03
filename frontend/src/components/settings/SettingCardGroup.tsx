import React from 'react';

export interface SettingCardGroupProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const SettingCardGroup: React.FC<SettingCardGroupProps> = ({
  title,
  children,
  className = '',
}) => {
  return (
    <div className={`mb-6 ${className}`}>
      {title && (
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2 px-1">
          {title}
        </h3>
      )}
      <div className="bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800/60 backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
};
