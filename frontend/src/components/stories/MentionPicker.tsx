import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import MentionAutocomplete, { type MentionOption } from '../MentionAutocomplete';
import { useMentionSearch } from '../../hooks/useMentionSearch';
import { logger } from '../../utils/logger';

interface MentionPickerProps {
  onSelect: (user: MentionOption) => void;
  onClose: () => void;
}

/**
 * User lookup for the story mention tool. Reuses the shared mention popup
 * exactly as MentionInput does: `useMentionSearch` drives `/users/search` and
 * `MentionAutocomplete` renders the list + keyboard handling.
 */
const MentionPicker: React.FC<MentionPickerProps> = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const { options, loading } = useMentionSearch(query, { followingsOnBareAt: true });

  const stripAt = (q: string) => q.replace(/^@+/, '').trim();

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md"
        onMouseDown={(e) => { e.preventDefault(); onClose(); }}
        role="presentation"
      />

      <div
        className="fixed inset-x-0 bottom-0 z-[10002] bg-white dark:bg-zinc-900 rounded-t-[40px] shadow-[0_-8px_40px_rgba(0,0,0,0.25)] max-h-[72vh] flex flex-col overflow-hidden"
        style={{ animation: 'mentionSlideUp 0.22s cubic-bezier(0.32,0.72,0,1) forwards' }}
        role="dialog"
        aria-label="Mention someone"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full dark:bg-white/20" />
        </div>

        <div className="px-5 pb-3 shrink-0 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20 dark:text-white/20" size={16} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value.startsWith('@') ? e.target.value : `@${e.target.value}`)}
              placeholder="@username"
              aria-label="Search users to mention"
              className="w-full bg-gray-100 dark:bg-white/5 rounded-full py-3 pl-11 pr-4 text-[14px] font-bold text-[#18181b] dark:text-white outline-none border border-transparent focus:border-primary/50 transition-all placeholder:text-black/30 dark:placeholder:text-white/20"
            />
          </div>
          <button
            onClick={onClose}
            aria-label="Close mention picker"
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[#18181b] dark:text-white active:scale-90"
          >
            <X size={16} strokeWidth={3} />
          </button>
        </div>

        <MentionAutocomplete
          options={options}
          loading={loading && options.length === 0}
          onSelect={(user) => {
            logger.log('[MentionPicker] selected', user.username);
            onSelect(user);
          }}
          onClose={onClose}
          selectOnMouseDown
          className="flex-1 flex flex-col min-h-0"
          header={
            <div className="px-5 pb-2 shrink-0">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.12em]">
                {query === '@' || query === '' ? 'Mention someone' : `Results for "${stripAt(query)}"`}
              </p>
            </div>
          }
          scrollClassName="overflow-y-auto flex-1 overscroll-contain pb-4"
          loadingContent={
            <div className="flex justify-center py-6 text-gray-400 text-[12px] font-bold uppercase tracking-widest">
              Searching...
            </div>
          }
          emptyContent={
            stripAt(query).length > 0 ? (
              <div className="text-center py-8 text-gray-400 text-[13px]">No users found for "{stripAt(query)}"</div>
            ) : undefined
          }
          renderOption={(user, { active, optionProps }) => (
            <button
              {...optionProps}
              className={`w-full px-5 py-3 flex items-center gap-4 transition-colors ${active ? 'bg-gray-50 dark:bg-white/5' : ''} hover:bg-gray-50 dark:hover:bg-white/5 active:bg-gray-100`}
            >
              <img
                src={user.avatar_url || '/uploads/avatars/no-profile.png'}
                className="w-10 h-10 rounded-full object-cover border border-black/5 dark:border-white/10"
                alt=""
              />
              <div className="text-left flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate">{user.name || user.username}</p>
                <p className="text-[12px] text-gray-400 dark:text-zinc-400 truncate">@{user.username}</p>
              </div>
            </button>
          )}
        />
      </div>

      <style>{`
        @keyframes mentionSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>,
    document.body
  );
};

export default MentionPicker;
