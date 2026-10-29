import { useCallback, useEffect, useState } from 'react';
import {
  Globe, Users, Check, Lock, ChevronRight, Search, ChevronLeft, X,
} from 'lucide-react';
import api from '../../../api/api';
import { useReelCreatorStore } from '../reelCreatorStore';
import { StageShell, InlineSpinner, PINK } from './shell';
import type { AudienceKind } from '../types';
import { AUDIENCE_LABELS } from '../services/reelPublishService';
import { showError, showSuccess } from '../../../utils/toast';

interface Person {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
  relationship?: string;
}

function Avatar({ url, name }: { url?: string | null; name?: string }) {
  if (url) return <img src={url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />;
  return (
    <span
      className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
      style={{ background: 'rgba(255,0,110,0.35)' }}
    >
      {(name || '?')[0].toUpperCase()}
    </span>
  );
}

function PersonRow({
  person, selected, onToggle, hint,
}: {
  person: Person;
  selected: boolean;
  onToggle: () => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
      style={{
        background: selected ? 'rgba(255,0,110,0.14)' : 'transparent',
        border: `1px solid ${selected ? `${PINK}55` : 'transparent'}`,
      }}
      aria-pressed={selected}
      aria-label={`${selected ? 'Remove' : 'Add'} ${person.username}`}
    >
      <Avatar url={person.avatar_url} name={person.display_name || person.username} />
      <span className="min-w-0 flex-1">
        <span className="block text-white text-[14px] font-bold truncate">@{person.username}</span>
        <span className="block text-white/50 text-[12px] truncate">{hint || person.display_name || ''}</span>
      </span>
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: selected ? PINK : 'transparent',
          border: selected ? 'none' : '2px solid rgba(255,255,255,0.35)',
        }}
      >
        {selected && <Check size={12} color="#fff" />}
      </span>
    </button>
  );
}

/** "Who can see your post?" — audience selection + entries to list editors. */
export function AudienceStage({
  onBack,
  onOpenCloseFriends,
  onOpenList,
}: {
  onBack: () => void;
  onOpenCloseFriends: () => void;
  onOpenList: (mode: 'hide_from' | 'show_only') => void;
}) {
  const audience = useReelCreatorStore(s => s.audience);
  const setAudience = useReelCreatorStore(s => s.setAudience);
  const exclusions = useReelCreatorStore(s => s.audienceExclusions);

  const options: Array<{ id: AudienceKind; icon: React.ReactNode; label: string; hint: string }> = [
    { id: 'public', icon: <Globe size={18} />, label: AUDIENCE_LABELS.public, hint: 'Anyone on Sparkle can watch' },
    { id: 'friends', icon: <Users size={18} />, label: AUDIENCE_LABELS.friends, hint: 'People you follow back' },
    { id: 'close_friends', icon: <Check size={18} />, label: AUDIENCE_LABELS.close_friends, hint: 'Only people on your Close Friends list' },
    { id: 'only_me', icon: <Lock size={18} />, label: AUDIENCE_LABELS.only_me, hint: 'Only you can watch this reel' },
  ];

  return (
    <StageShell title="Who can see this?" leftIcon="back" onLeft={onBack}>
      <div className="px-4 pt-4 flex flex-col gap-2">
        {options.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => setAudience(o.id)}
            className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3.5 text-left"
            style={{
              background: audience === o.id ? 'rgba(255,0,110,0.14)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${audience === o.id ? `${PINK}66` : 'transparent'}`,
            }}
            aria-pressed={audience === o.id}
          >
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: audience === o.id ? PINK : 'rgba(255,255,255,0.1)',
                color: '#fff',
              }}
            >
              {o.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-white text-[15px] font-bold">{o.label}</span>
              <span className="block text-white/50 text-[12px]">{o.hint}</span>
            </span>
            <span
              className="w-5 h-5 rounded-full shrink-0"
              style={{
                background: audience === o.id ? PINK : 'transparent',
                border: audience === o.id ? 'none' : '2px solid rgba(255,255,255,0.3)',
              }}
            />
          </button>
        ))}
      </div>

      <div className="px-4 pt-6 flex flex-col gap-2">
        <p className="text-white/45 text-[11px] font-bold uppercase tracking-wide">Fine-tune</p>
        <button
          type="button"
          onClick={onOpenCloseFriends}
          className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <span className="flex-1 text-white text-[14px] font-bold">Edit Close Friends list</span>
          <ChevronRight size={17} color="rgba(255,255,255,0.5)" />
        </button>
        <button
          type="button"
          onClick={() => onOpenList('hide_from')}
          className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <span className="flex-1">
            <span className="block text-white text-[14px] font-bold">Do not show to</span>
            <span className="block text-white/50 text-[12px]">Hide this reel from specific people</span>
          </span>
          <span className="text-white/50 text-[12px]">{exclusions.hideFrom.length || ''}</span>
          <ChevronRight size={17} color="rgba(255,255,255,0.5)" />
        </button>
        <button
          type="button"
          onClick={() => onOpenList('show_only')}
          className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <span className="flex-1">
            <span className="block text-white text-[14px] font-bold">Only show to</span>
            <span className="block text-white/50 text-[12px]">Share with a few specific people</span>
          </span>
          <span className="text-white/50 text-[12px]">{exclusions.showOnly.length || ''}</span>
          <ChevronRight size={17} color="rgba(255,255,255,0.5)" />
        </button>
        <p className="text-white/40 text-[11px] leading-relaxed pt-2">
          These rules are enforced on the server — hidden reels are never sent to other people's feeds,
          even if someone has the link.
        </p>
      </div>
    </StageShell>
  );
}

/** Close Friends list editor with real interaction-based suggestions. */
export function CloseFriendsStage({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get('/reels/close-friends').catch(() => ({ data: { close_friends: [] } })),
      api.get('/reels/close-friends/suggestions').catch(() => ({ data: { suggestions: [] } })),
    ]).then(([current, sugg]) => {
      if (!alive) return;
      const ids = (current.data?.close_friends || []).map((p: Person) => p.user_id);
      setSelected(new Set(ids));
      setSuggestions(sugg.data?.suggestions || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    if (!q) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get('/reels/people/search', { params: { q } })
        .then(({ data }) => setResults(data?.people || []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setDirty(true);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/reels/close-friends', { user_ids: [...selected] });
      showSuccess(`Close Friends updated — ${selected.size} ${selected.size === 1 ? 'person' : 'people'}.`);
      setDirty(false);
      onBack();
    } catch {
      showError('Could not save your Close Friends list. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const list = query ? results : suggestions;

  return (
    <StageShell
      title="Close Friends"
      leftIcon="back"
      onLeft={onBack}
      right={
        <span className="text-[13px] font-bold" style={{ color: PINK }}>{selected.size}</span>
      }
    >
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 rounded-2xl px-3.5 h-11" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <Search size={16} color="rgba(255,255,255,0.5)" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people…"
            className="flex-1 bg-transparent outline-none text-white text-[14px] placeholder:text-white/40"
            aria-label="Search people"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={15} color="rgba(255,255,255,0.6)" />
            </button>
          )}
        </div>
        <p className="text-white/45 text-[12px] mt-2">
          {query
            ? `Results for “${query}”`
            : 'Suggested from people you message and who comment on your posts'}
        </p>
      </div>

      <div className="px-4 pt-3 pb-6">
        {loading && (
          <div className="flex items-center gap-3 justify-center py-8 text-white/60 text-sm">
            <InlineSpinner /> Loading…
          </div>
        )}
        {!loading && list.length === 0 && (
          <p className="py-6 text-white/50 text-sm text-center">
            {query ? 'No people found.' : 'No suggestions right now — search above to add people.'}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          {list.map(p => (
            <PersonRow
              key={p.user_id}
              person={p}
              selected={selected.has(p.user_id)}
              onToggle={() => toggle(p.user_id)}
              hint={p.display_name || p.relationship || ''}
            />
          ))}
        </div>
      </div>

      <div className="px-4 pb-8">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="w-full py-3.5 rounded-2xl font-extrabold text-white flex items-center justify-center gap-2"
          style={{
            background: dirty ? 'linear-gradient(135deg, #FF6B8B, #FF3D6D)' : 'rgba(255,255,255,0.1)',
            opacity: saving || !dirty ? 0.7 : 1,
          }}
        >
          {saving ? <><InlineSpinner size={15} /> Saving…</> : 'Save list'}
        </button>
      </div>
    </StageShell>
  );
}

/** "Do not show to" / "Only show to" list editor. */
export function AudienceListStage({
  mode,
  onBack,
}: {
  mode: 'hide_from' | 'show_only';
  onBack: () => void;
}) {
  const setExclusions = useReelCreatorStore(s => s.setAudienceExclusions);
  const setAudience = useReelCreatorStore(s => s.setAudience);
  const exclusions = useReelCreatorStore(s => s.audienceExclusions);

  const [selected, setSelected] = useState<Set<string>>(
    new Set(mode === 'hide_from' ? exclusions.hideFrom : exclusions.showOnly),
  );
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const source = mode === 'hide_from' ? '/reels/people/followers' : '/reels/people/friends';
    Promise.all([
      api.get(source).catch(() => ({ data: { people: [] } })),
      api.get('/reels/audience-list', { params: { mode } }).catch(() => ({ data: { users: [] } })),
    ]).then(([base, current]) => {
      if (!alive) return;
      const basePeople: Person[] = base.data?.people || [];
      const currentUsers: Person[] = current.data?.users || [];
      // Merge: current selections first, then the candidate pool
      const map = new Map<string, Person>();
      [...currentUsers, ...basePeople].forEach(p => map.set(String(p.user_id), p));
      setPeople([...map.values()]);
      setSelected(new Set(currentUsers.map(p => String(p.user_id))));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [mode]);

  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    if (!q) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get('/reels/people/search', { params: { q } })
        .then(({ data }) => setResults(data?.people || []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/reels/audience-list', { mode, user_ids: [...selected] });
      if (mode === 'hide_from') {
        setExclusions({ ...exclusions, hideFrom: [...selected] });
      } else {
        setExclusions({ ...exclusions, showOnly: [...selected] });
        if (selected.size > 0) setAudience('only_me'); // narrowed: server narrows via show_only
      }
      showSuccess(
        mode === 'hide_from'
          ? `Hidden from ${selected.size} ${selected.size === 1 ? 'person' : 'people'}.`
          : `Visible to ${selected.size} ${selected.size === 1 ? 'person' : 'people'}.`,
      );
      onBack();
    } catch {
      showError('Could not save this list. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const list = query ? results : people;

  return (
    <StageShell
      title={mode === 'hide_from' ? 'Do not show to' : 'Only show to'}
      leftIcon="back"
      onLeft={onBack}
      right={<span className="text-[13px] font-bold" style={{ color: PINK }}>{selected.size}</span>}
    >
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 rounded-2xl px-3.5 h-11" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <Search size={16} color="rgba(255,255,255,0.5)" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people…"
            className="flex-1 bg-transparent outline-none text-white text-[14px] placeholder:text-white/40"
            aria-label="Search people"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={15} color="rgba(255,255,255,0.6)" />
            </button>
          )}
        </div>
        <p className="text-white/45 text-[12px] mt-2">
          {mode === 'hide_from'
            ? 'These people will never receive this reel.'
            : 'Only these people will receive this reel (plus you).'}
        </p>
      </div>

      <div className="px-4 pt-3 pb-6">
        {loading && (
          <div className="flex items-center gap-3 justify-center py-8 text-white/60 text-sm">
            <InlineSpinner /> Loading…
          </div>
        )}
        {!loading && list.length === 0 && (
          <p className="py-6 text-white/50 text-sm text-center">
            {query ? 'No people found.' : mode === 'hide_from'
              ? 'No followers yet.'
              : 'No mutual friends yet — search above.'}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          {list.map(p => (
            <PersonRow
              key={String(p.user_id)}
              person={p}
              selected={selected.has(String(p.user_id))}
              onToggle={() => toggle(String(p.user_id))}
              hint={p.display_name || p.relationship || ''}
            />
          ))}
        </div>
      </div>

      <div className="px-4 pb-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl font-extrabold text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <><InlineSpinner size={15} /> Saving…</> : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => { setSelected(new Set()); void save(); }}
          className="w-full py-3 rounded-2xl font-bold"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}
        >
          Clear list
        </button>
      </div>
    </StageShell>
  );
}

/** Share-to-story preference: off / always / ask once. */
export function ShareStoryStage({ onBack }: { onBack: () => void }) {
  const shareToStory = useReelCreatorStore(s => s.shareToStory);
  const setShareToStory = useReelCreatorStore(s => s.setShareToStory);

  const options = [
    { id: 'off' as const, label: 'Off', hint: 'Never share reels to your story' },
    { id: 'once' as const, label: 'Ask me once', hint: 'Confirm after each reel is published' },
    { id: 'always' as const, label: 'Always share', hint: 'Automatically post every new reel to your story' },
  ];

  return (
    <StageShell title="Share to story" leftIcon="back" onLeft={onBack}>
      <div className="px-4 pt-4 flex flex-col gap-2">
        {options.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => setShareToStory(o.id)}
            className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3.5 text-left"
            style={{
              background: shareToStory === o.id ? 'rgba(255,0,110,0.14)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${shareToStory === o.id ? `${PINK}66` : 'transparent'}`,
            }}
            aria-pressed={shareToStory === o.id}
          >
            <span className="flex-1">
              <span className="block text-white text-[15px] font-bold">{o.label}</span>
              <span className="block text-white/50 text-[12px]">{o.hint}</span>
            </span>
            <span
              className="w-5 h-5 rounded-full shrink-0"
              style={{
                background: shareToStory === o.id ? PINK : 'transparent',
                border: shareToStory === o.id ? 'none' : '2px solid rgba(255,255,255,0.3)',
              }}
            />
          </button>
        ))}
        <p className="text-white/40 text-[11px] leading-relaxed pt-3">
          Story shares are posted separately — if a story share fails, your reel stays published.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-1.5"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
        >
          <ChevronLeft size={16} /> Back to options
        </button>
      </div>
    </StageShell>
  );
}
