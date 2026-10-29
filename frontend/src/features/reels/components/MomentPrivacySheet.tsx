import { useCallback, useEffect, useState } from 'react';
import { Globe, Users, Check, Lock, X, Search } from 'lucide-react';
import api from '../../../api/api';
import { InlineSpinner, PINK } from './shell';
import type { AudienceKind } from '../types';
import { showError, showSuccess } from '../../../utils/toast';
import { logger } from '../../../utils/logger';

interface Person {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
}

const AUDIENCE_OPTIONS: Array<{ id: AudienceKind; icon: React.ReactNode; label: string; hint: string }> = [
  { id: 'public', icon: <Globe size={18} />, label: 'Public', hint: 'Anyone on Sparkle can watch' },
  { id: 'friends', icon: <Users size={18} />, label: 'Friends', hint: 'People you follow back' },
  { id: 'close_friends', icon: <Check size={18} />, label: 'Close Friends', hint: 'Only people on your Close Friends list' },
  { id: 'only_me', icon: <Lock size={18} />, label: 'Only me', hint: 'Only you can watch this reel' },
];

function parseIdList(value: unknown): string[] {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Per-reel privacy editor (owner only): audience + hide-from / show-only
 * exclusions. Loads the current moment (exclusions are returned to owners),
 * saves via PUT /moments/:id — enforcement stays server-side.
 */
export default function MomentPrivacySheet({
  momentId,
  onClose,
  onSaved,
}: {
  momentId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audience, setAudience] = useState<AudienceKind>('public');
  const [hideFrom, setHideFrom] = useState<Set<string>>(new Set());
  const [showOnly, setShowOnly] = useState<Set<string>>(new Set());
  const [hidePeople, setHidePeople] = useState<Person[]>([]);
  const [showPeople, setShowPeople] = useState<Person[]>([]);
  const [listMode, setListMode] = useState<'hide_from' | 'show_only' | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .get(`/moments/${momentId}`)
      .then(({ data }) => {
        if (!alive) return;
        const m = data?.moment || {};
        setAudience((m.audience || 'public') as AudienceKind);
        setHideFrom(new Set(parseIdList(m.hide_from_user_ids)));
        setShowOnly(new Set(parseIdList(m.show_only_user_ids)));
        setLoading(false);
      })
      .catch((err) => {
        logger.warn('[MomentPrivacy] load failed:', err);
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [momentId]);

  // Resolve known exclusion ids to displayable people (best-effort search by id
  // is not available, so chips show the raw id until a known-person merge).
  useEffect(() => {
    if (!listMode) { setResults([]); setQuery(''); return; }
    const q = query.trim().replace(/^@/, '');
    if (!q) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get('/reels/people/search', { params: { q } })
        .then(({ data }) => setResults(Array.isArray(data?.people) ? data.people : []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query, listMode]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.put(`/moments/${momentId}`, {
        audience,
        hide_from: [...hideFrom],
        show_only: [...showOnly],
      });
      showSuccess('Privacy updated — enforced on the server immediately.');
      onSaved?.();
      onClose();
    } catch (err) {
      logger.warn('[MomentPrivacy] save failed:', err);
      showError('Could not save privacy settings. Try again.');
    } finally {
      setSaving(false);
    }
  }, [momentId, audience, hideFrom, showOnly, onSaved, onClose]);

  const activeSet = listMode === 'hide_from' ? hideFrom : showOnly;
  const setActiveSet = listMode === 'hide_from' ? setHideFrom : setShowOnly;
  const activePeople = listMode === 'hide_from' ? hidePeople : showPeople;
  const setActivePeople = listMode === 'hide_from' ? setHidePeople : setShowPeople;

  const toggleInList = (p: Person) => {
    const id = String(p.user_id);
    const next = new Set(activeSet);
    if (next.has(id)) next.delete(id); else next.add(id);
    setActiveSet(next);
    if (!activePeople.find((x) => String(x.user_id) === id)) {
      setActivePeople([...activePeople, p]);
    }
  };

  if (listMode) {
    const list = query ? results : activePeople;
    return (
      <div className="fixed inset-0 z-[var(--z-modal,60)] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:max-w-md bg-white dark:bg-[#0B070C] rounded-t-3xl sm:rounded-3xl max-h-[80dvh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/10">
            <h2 className="text-[15px] font-extrabold text-[#18181b] dark:text-white">
              {listMode === 'hide_from' ? 'Do not show to' : 'Only show to'}
            </h2>
            <button type="button" onClick={() => setListMode(null)} aria-label="Back" className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
              <X size={17} className="text-black/50 dark:text-white/50" />
            </button>
          </div>
          <div className="px-5 py-3">
            <div className="flex items-center gap-2 rounded-2xl px-3.5 h-11 bg-black/5 dark:bg-white/8">
              <Search size={15} className="text-black/40 dark:text-white/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people…"
                className="flex-1 bg-transparent outline-none text-[14px] text-[#18181b] dark:text-white placeholder:text-black/35 dark:placeholder:text-white/35"
                aria-label="Search people"
              />
            </div>
            <p className="text-black/45 dark:text-white/45 text-[12px] mt-2">
              {listMode === 'hide_from'
                ? 'These people will never receive this reel.'
                : 'Only these people will receive this reel (plus you).'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {!query && activeSet.size > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-3">
                {[...activeSet].map((id) => {
                  const person = activePeople.find((p) => String(p.user_id) === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        const next = new Set(activeSet);
                        next.delete(id);
                        setActiveSet(next);
                      }}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                      style={{ background: 'rgba(255,0,110,0.35)' }}
                      aria-label={`Remove ${person?.username || 'person'}`}
                    >
                      @{person?.username || 'person'} <X size={11} />
                    </button>
                  );
                })}
              </div>
            )}
            {list.length === 0 && (
              <p className="py-6 text-black/45 dark:text-white/45 text-[13px] text-center">
                {query ? 'No people found.' : 'Search above to add people.'}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {list.map((p) => (
                <li key={String(p.user_id)}>
                  <button
                    type="button"
                    onClick={() => toggleInList(p)}
                    className="w-full flex items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    aria-pressed={activeSet.has(String(p.user_id))}
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0" style={{ background: 'rgba(255,0,110,0.35)' }}>
                        {(p.username || '?')[0].toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-[#18181b] dark:text-white truncate">@{p.username}</span>
                      {p.display_name ? <span className="block text-[11px] text-black/45 dark:text-white/45 truncate">{p.display_name}</span> : null}
                    </span>
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: activeSet.has(String(p.user_id)) ? PINK : 'transparent',
                        border: activeSet.has(String(p.user_id)) ? 'none' : '2px solid rgba(120,120,120,0.4)',
                      }}
                    >
                      {activeSet.has(String(p.user_id)) && <Check size={12} color="#fff" />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="px-5 pb-6 pt-2 border-t border-black/5 dark:border-white/10">
            <button
              type="button"
              onClick={() => setListMode(null)}
              disabled={saving}
              className="w-full py-3 rounded-2xl font-extrabold text-white"
              style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)', opacity: saving ? 0.7 : 1 }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[var(--z-modal,60)] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Reel privacy settings">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#0B070C] rounded-t-3xl sm:rounded-3xl max-h-[85dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/10">
          <h2 className="text-[15px] font-extrabold text-[#18181b] dark:text-white">Who can see this?</h2>
          <button type="button" onClick={onClose} aria-label="Close privacy settings" className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
            <X size={17} className="text-black/50 dark:text-white/50" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-black/50 dark:text-white/50 text-sm">
            <InlineSpinner size={15} /> Loading…
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
              {AUDIENCE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setAudience(o.id)}
                  className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
                  style={{
                    background: audience === o.id ? 'rgba(255,0,110,0.14)' : 'rgba(120,120,120,0.08)',
                    border: `1px solid ${audience === o.id ? `${PINK}66` : 'transparent'}`,
                  }}
                  aria-pressed={audience === o.id}
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: audience === o.id ? PINK : 'rgba(120,120,120,0.15)', color: '#fff' }}
                  >
                    {o.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-bold text-[#18181b] dark:text-white">{o.label}</span>
                    <span className="block text-[11px] text-black/50 dark:text-white/50">{o.hint}</span>
                  </span>
                  <span
                    className="w-4.5 h-4.5 rounded-full shrink-0"
                    style={{
                      width: 18, height: 18,
                      background: audience === o.id ? PINK : 'transparent',
                      border: audience === o.id ? 'none' : '2px solid rgba(120,120,120,0.4)',
                    }}
                  />
                </button>
              ))}

              <p className="text-black/45 dark:text-white/45 text-[11px] font-bold uppercase tracking-wide pt-3">Fine-tune</p>
              <button
                type="button"
                onClick={() => { setListMode('hide_from'); }}
                className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left bg-black/5 dark:bg-white/8"
              >
                <span className="flex-1">
                  <span className="block text-[13px] font-bold text-[#18181b] dark:text-white">Do not show to</span>
                  <span className="block text-[11px] text-black/50 dark:text-white/50">Hide this reel from specific people</span>
                </span>
                <span className="text-black/50 dark:text-white/50 text-[12px]">{hideFrom.size || ''}</span>
              </button>
              <button
                type="button"
                onClick={() => { setListMode('show_only'); }}
                className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left bg-black/5 dark:bg-white/8"
              >
                <span className="flex-1">
                  <span className="block text-[13px] font-bold text-[#18181b] dark:text-white">Only show to</span>
                  <span className="block text-[11px] text-black/50 dark:text-white/50">Share with a few specific people</span>
                </span>
                <span className="text-black/50 dark:text-white/50 text-[12px]">{showOnly.size || ''}</span>
              </button>
              <p className="text-black/40 dark:text-white/40 text-[11px] leading-relaxed pt-1">
                These rules are enforced on the server — hidden reels are never sent to other people's feeds, even if someone has the link.
              </p>
            </div>

            <div className="px-5 pb-6 pt-2 border-t border-black/5 dark:border-white/10">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="w-full py-3 rounded-2xl font-extrabold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <><InlineSpinner size={14} /> Saving…</> : 'Save privacy'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
