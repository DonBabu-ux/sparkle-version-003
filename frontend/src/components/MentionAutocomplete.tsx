import React, { useEffect, useId, useRef, useState } from 'react';
import type { MentionOption } from '../hooks/useMentionSearch';

export type { MentionOption };

interface OptionRenderContext {
  /** Active (keyboard-highlighted) row. */
  active: boolean;
  index: number;
  /** Spread onto the row: id/role/aria-selected + activation + hover tracking. */
  optionProps: React.HTMLAttributes<HTMLElement>;
}

interface MentionAutocompleteProps {
  options: MentionOption[];
  /** When true and `loadingContent` is set, that content replaces everything else. */
  loading?: boolean;
  onSelect: (option: MentionOption) => void;
  /** Escape closes the surrounding panel. Omit to let Escape bubble through. */
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** Fixed chrome above the scroll area (drag handle, labels…). */
  header?: React.ReactNode;
  /** Rendered inside the scroll area above the options (section labels…). */
  beforeOptions?: React.ReactNode;
  /** Scroll wrapper class for the option area; omit to render options directly. */
  scrollClassName?: string;
  /** Shown instead of the options while `loading`. */
  loadingContent?: React.ReactNode;
  /** Shown when idle with no options. */
  emptyContent?: React.ReactNode;
  /** Custom option row; spreads the provided ARIA/activation props. Defaults to a compact user row. */
  renderOption?: (option: MentionOption, ctx: OptionRenderContext) => React.ReactNode;
  /** Activate on mousedown with preventDefault (keeps input focus during selection). */
  selectOnMouseDown?: boolean;
}

function DefaultOptionRow({
  option,
  active,
  optionProps,
}: {
  option: MentionOption;
  active: boolean;
  optionProps: React.HTMLAttributes<HTMLElement>;
}) {
  return (
    <button
      {...optionProps}
      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-none${active ? ' bg-indigo-50' : ''}`}
    >
      <img src={option.avatar_url || '/uploads/avatars/default.png'} className="w-8 h-8 rounded-full" alt="" />
      <div className="text-left">
        <p className="font-bold text-slate-800 text-sm">@{option.username}</p>
        <p className="text-xs text-slate-500">{option.name}</p>
      </div>
    </button>
  );
}

/**
 * Shared @-mention popup: option list with ARIA listbox semantics plus
 * ArrowUp/ArrowDown/Enter/Escape keyboard handling (capture phase, so Enter
 * selects the active option instead of submitting the underlying input).
 *
 * Call sites own the fetch (via `useMentionSearch`), the panel chrome and the
 * row markup; this component owns the list, the active row and the keys.
 */
export default function MentionAutocomplete({
  options,
  loading = false,
  onSelect,
  onClose,
  className,
  style,
  header,
  beforeOptions,
  scrollClassName,
  loadingContent,
  emptyContent,
  renderOption,
  selectOnMouseDown = false,
}: MentionAutocompleteProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const baseId = useId();
  const onSelectRef = useRef(onSelect);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Fresh results always start at the top.
  useEffect(() => {
    setActiveIndex(0);
  }, [options]);

  // Keyboard navigation while the popup is mounted. Attached on window in the
  // capture phase so it runs before document-level modal a11y handlers (Escape
  // closes the popup first; a second Escape reaches the modal).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCloseRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (options.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === 'Enter') {
        const option = options[activeIndex] ?? options[0];
        if (option) {
          e.preventDefault();
          e.stopPropagation();
          onSelectRef.current(option);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [options, activeIndex]);

  const shownActive = options.length > 0 ? Math.min(activeIndex, options.length - 1) : 0;

  const makeOptionProps = (idx: number): React.HTMLAttributes<HTMLElement> => ({
    id: `${baseId}option-${idx}`,
    role: 'option',
    'aria-selected': idx === shownActive,
    onMouseEnter: () => setActiveIndex(idx),
    ...(selectOnMouseDown
      ? {
          onMouseDown: (e: React.MouseEvent) => {
            e.preventDefault();
            onSelect(options[idx]);
          },
        }
      : {
          onClick: () => onSelect(options[idx]),
        }),
  });

  let content: React.ReactNode = null;
  if (loading && loadingContent != null) {
    content = loadingContent;
  } else if (options.length > 0) {
    content = (
      <div id={`${baseId}list`} role="listbox" aria-activedescendant={`${baseId}option-${shownActive}`}>
        {options.map((option, idx) => (
          <React.Fragment key={String(option.user_id ?? option.id ?? option.username ?? idx)}>
            {renderOption ? (
              renderOption(option, { active: idx === shownActive, index: idx, optionProps: makeOptionProps(idx) })
            ) : (
              <DefaultOptionRow option={option} active={idx === shownActive} optionProps={makeOptionProps(idx)} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  } else if (!loading && emptyContent != null) {
    content = emptyContent;
  }

  // Nothing to show anywhere (e.g. Reshare dropdown before results arrive).
  if (content === null && header == null && beforeOptions == null) return null;

  const scrollArea = (
    <>
      {beforeOptions}
      {content}
    </>
  );

  return (
    <div className={className} style={style}>
      {header}
      {scrollClassName !== undefined ? <div className={scrollClassName}>{scrollArea}</div> : scrollArea}
    </div>
  );
}
