import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Hash, AtSign, Globe, Users, Lock, ChevronRight, Settings2,
  AlertCircle, Loader2, Check, Save, X,
} from 'lucide-react';
import api from '../../../api/api';
import { useReelCreatorStore } from '../reelCreatorStore';
import { StageShell, BottomSheet, InlineSpinner, PINK } from './shell';
import { saveDraft } from '../services/draftService';
import { publishReel, PublishError, AUDIENCE_LABELS, type PublishProgress } from '../services/reelPublishService';
import { showError, showSuccess } from '../../../utils/toast';
import { logger } from '../../../utils/logger';

const TITLE_WORDS = 80;
const TITLE_MAX = 250;
const DESC_MAX = 5000;
const MAX_HASHTAGS = 5;
const MAX_MENTIONS = 10;

interface Person {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
  relationship?: string;
}

/**
 * Compose stage — "New reel": title/description, hashtags, mentions,
 * audience entry, more-options sheet, real draft save, and the publish
 * pipeline with progress / retry.
 */
export default function ComposeStage({
  onBack,
  onOpenAudience,
  onOpenShareStory,
  onPublished,
  onDraftSaved,
}: {
  onBack: () => void;
  onOpenAudience: () => void;
  onOpenShareStory: () => void;
  onPublished: (momentId: string) => void;
  /** Called after a draft save succeeds — closes the composer and returns to a fresh create-reel page. */
  onDraftSaved?: () => void;
}) {
  const s = useReelCreatorStore();

  // ── Hashtags ──
  const [tagInput, setTagInput] = useState('');
  const [recentTags, setRecentTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<{ tag: string; post_count: number }[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);

  // ── Mentions ──
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<Person[]>([]);
  const [mentionRecent, setMentionRecent] = useState<Person[]>([]);
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const mentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Options sheet ──
  const [optionsOpen, setOptionsOpen] = useState(false);

  // ── Publish / draft state ──
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [publishError, setPublishError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const idemKeyRef = useRef<string>(
    s.draftId ? `d-${s.draftId}` : (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `idem-${Date.now()}`),
  );

  const titleWords = s.title.trim() ? s.title.trim().split(/\s+/).length : 0;
  const duration = s.totalDurationSec();
  const canPublish = s.clips.length > 0 && !s.submitting && !publishedId;

  // ── Data loads ──
  useEffect(() => {
    api.get('/reels/hashtags/recent')
      .then(({ data }) => setRecentTags(Array.isArray(data?.hashtags) ? data.hashtags : []))
      .catch(() => { /* non-fatal */ });
    api.get('/reels/people/recent')
      .then(({ data }) => setMentionRecent(Array.isArray(data?.people) ? data.people : []))
      .catch(() => { /* non-fatal */ });
  }, []);

  // Hashtag suggestions (debounced)
  useEffect(() => {
    const q = tagInput.replace(/^#/, '').trim();
    if (!q) { setTagSuggestions([]); return; }
    const t = setTimeout(() => {
      api.get('/reels/hashtags/suggest', { params: { q } })
        .then(({ data }) => setTagSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []))
        .catch(() => setTagSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [tagInput]);

  // People search (debounced)
  useEffect(() => {
    const q = mentionQuery.replace(/^@/, '').trim();
    if (!q) { setMentionResults([]); return; }
    if (mentionTimer.current) clearTimeout(mentionTimer.current);
    mentionTimer.current = setTimeout(() => {
      api.get('/reels/people/search', { params: { q } })
        .then(({ data }) => setMentionResults(Array.isArray(data?.people) ? data.people : []))
        .catch(() => setMentionResults([]));
    }, 300);
    return () => {
      if (mentionTimer.current) clearTimeout(mentionTimer.current);
    };
  }, [mentionQuery]);

  const commitTag = useCallback((raw: string) => {
    const clean = raw.toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_]/g, '');
    if (!clean) return;
    if (s.hashtags.length >= MAX_HASHTAGS) { showError(`Up to ${MAX_HASHTAGS} hashtags per reel.`); return; }
    if (!s.addHashtag(clean)) { showError('Already added.'); return; }
    setTagInput('');
    setTagSuggestions([]);
    setTagsOpen(false);
  }, [s]);

  const commitMention = useCallback((username: string) => {
    const clean = username.replace(/^@/, '').toLowerCase();
    if (!clean) return;
    if (s.mentions.length >= MAX_MENTIONS) { showError(`Up to ${MAX_MENTIONS} mentions per reel.`); return; }
    if (!s.addMention(clean)) { showError('Already mentioned.'); return; }
    setMentionQuery('');
    setMentionResults([]);
    setMentionsOpen(false);
  }, [s]);

  // ── Draft save ──
  const handleSaveDraft = async () => {
    setDraftSaving(true);
    try {
      await saveDraft();
      showSuccess('Draft saved to this device.');
      // Close the compose page and land on a fresh create-new-reel page.
      onDraftSaved?.();
    } catch (err) {
      logger.warn('[Compose] draft save failed:', err);
      showError('Could not save draft. Your edits are still here — try again.');
    } finally {
      setDraftSaving(false);
    }
  };

  // ── Publish ──
  const doPublish = async (isRetry = false) => {
    setPublishError(null);
    if (isRetry) setProgress(null);
    s.setSubmitting(true);
    s.setSubmitProgress(0);
    try {
      const outcome = await publishReel((p) => {
        setProgress(p);
        s.setSubmitProgress(p.overall);
      }, idemKeyRef.current);
      setPublishedId(outcome.momentId);
      s.setPublishedMomentId(outcome.momentId);
      if (outcome.storyError) showError(outcome.storyError);
      if (outcome.saveError) showError(outcome.saveError);
      onPublished(outcome.momentId);
    } catch (err) {
      if (err instanceof PublishError) {
        setPublishError({ message: err.message, retryable: err.retryable });
        if (err.code === 'AUTH') showError(err.message);
      } else {
        setPublishError({ message: 'Something went wrong while publishing. Retry — it will not duplicate.', retryable: true });
      }
      logger.warn('[Compose] publish failed:', err);
    } finally {
      s.setSubmitting(false);
      setProgress(null);
    }
  };

  const audienceIcon = useMemo(() => {
    switch (s.audience) {
      case 'public': return <Globe size={17} />;
      case 'friends': return <Users size={17} />;
      case 'close_friends': return <Check size={17} />;
      case 'only_me': return <Lock size={17} />;
    }
  }, [s.audience]);

  const exclusionNote = useMemo(() => {
    const { hideFrom, showOnly } = s.audienceExclusions;
    if (showOnly.length) return `Only shown to ${showOnly.length} selected ${showOnly.length === 1 ? 'person' : 'people'}`;
    if (hideFrom.length) return `Hidden from ${hideFrom.length} ${hideFrom.length === 1 ? 'person' : 'people'}`;
    return null;
  }, [s.audienceExclusions]);

  return (
    <StageShell
      title="New reel"
      leftIcon="back"
      onLeft={onBack}
      right={
        canPublish ? (
          <button
            type="button"
            onClick={() => void doPublish()}
            className="px-4 h-9 rounded-full text-[13px] font-extrabold text-white"
            style={{ background: PINK }}
          >
            Share
          </button>
        ) : (
          <span className="text-[13px] font-bold" style={{ color: publishedId ? '#7CFF6B' : 'rgba(255,255,255,0.5)' }}>
            {publishedId ? 'Shared ✓' : s.submitting ? '…' : ''}
          </span>
        )
      }
    >
      {/* Media summary */}
      <button
        type="button"
        onClick={onBack}
        className="w-full flex items-center gap-3 px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.05)' }}
        aria-label={`Review ${s.clips.length} clips, ${duration.toFixed(1)} seconds`}
      >
        <div className="flex -space-x-2">
          {s.clips.slice(0, 3).map(c => (
            <img
              key={c.id}
              src={c.previewUrl}
              alt=""
              className="w-11 h-11 rounded-lg object-cover"
              style={{ border: '2px solid #0B070C' }}
            />
          ))}
          {s.clips.length > 3 && (
            <span
              className="w-11 h-11 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
              style={{ background: 'rgba(255,0,110,0.7)', border: '2px solid #0B070C' }}
            >
              +{s.clips.length - 3}
            </span>
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-white text-[14px] font-bold">
            {s.clips.length} clip{s.clips.length === 1 ? '' : 's'} · {duration.toFixed(1)}s
          </p>
          <p className="text-white/50 text-[12px] truncate">
            {s.selectedMusic ? `♪ ${s.selectedMusic.title}` : 'No music'} · tap to edit
          </p>
        </div>
        <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
      </button>

      {/* Title */}
      <section className="px-4 pt-4" aria-label="Reel title">
        <div className="rounded-2xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <input
            type="text"
            value={s.title}
            onChange={(e) => s.setTitle(e.target.value.slice(0, TITLE_MAX))}
            placeholder="Add a title (max 80 words)"
            className="w-full bg-transparent outline-none text-white text-[15px] font-bold placeholder:text-white/35 placeholder:font-normal"
            aria-label="Title"
            maxLength={TITLE_MAX}
          />
        </div>
        <div className="flex justify-between mt-1 px-1">
          <span className="text-white/40 text-[11px]">{titleWords}/{TITLE_WORDS} words</span>
          <span className="text-white/40 text-[11px]" style={{ color: s.title.length > TITLE_MAX - 20 ? '#FFB3C6' : undefined }}>
            {s.title.length}/{TITLE_MAX}
          </span>
        </div>
      </section>

      {/* Description */}
      <section className="px-4 pt-3" aria-label="Description">
        <textarea
          value={s.description}
          onChange={(e) => s.setDescription(e.target.value.slice(0, DESC_MAX))}
          rows={4}
          placeholder="Write a description…"
          className="w-full rounded-2xl px-3.5 py-3 bg-transparent text-white text-[14px] outline-none resize-none placeholder:text-white/35"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          aria-label="Description"
        />
        <p className="text-right text-white/40 text-[11px] -mt-1 pr-1">{s.description.length}/{DESC_MAX}</p>
      </section>

      {/* Hashtags */}
      <section className="px-4 pt-2" aria-label="Hashtags">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Hash size={15} color={PINK} />
          {s.hashtags.map(t => (
            <span
              key={t}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[12px] font-bold"
              style={{ background: 'rgba(255,0,110,0.18)', color: '#FFD9E7' }}
            >
              #{t}
              <button
                type="button"
                onClick={() => s.removeHashtag(t)}
                className="w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.18)' }}
                aria-label={`Remove hashtag ${t}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <span className="text-white/35 text-[11px]">{s.hashtags.length}/{MAX_HASHTAGS}</span>
        </div>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => { setTagInput(e.target.value); setTagsOpen(true); }}
          onFocus={() => setTagsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commitTag(tagInput); }
          }}
          placeholder="Add hashtags…"
          className="w-full rounded-xl px-3 py-2.5 bg-transparent text-white text-[14px] outline-none placeholder:text-white/35"
          style={{ border: '1px dashed rgba(255,255,255,0.18)' }}
          aria-label="Add hashtag"
        />
        {tagsOpen && (tagSuggestions.length > 0 || recentTags.length > 0) && (
          <div className="mt-2 rounded-2xl p-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {tagSuggestions.length > 0 && (
              <p className="text-white/45 text-[11px] px-1.5 mb-1">Suggestions</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {(tagSuggestions.length ? tagSuggestions.map(x => x.tag) : recentTags).slice(0, 12).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => commitTag(t)}
                  className="px-2.5 py-1.5 rounded-full text-[12px] font-bold"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
                >
                  #{t}
                </button>
              ))}
            </div>
            {recentTags.length > 0 && tagSuggestions.length === 0 && (
              <p className="text-white/35 text-[11px] px-1.5 mt-1.5">From your recent posts</p>
            )}
          </div>
        )}
      </section>

      {/* Mentions */}
      <section className="px-4 pt-4" aria-label="Mentions">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <AtSign size={15} color={PINK} />
          {s.mentions.map(m => (
            <span
              key={m}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[12px] font-bold"
              style={{ background: 'rgba(0,229,255,0.14)', color: '#BFF6FF' }}
            >
              @{m}
              <button
                type="button"
                onClick={() => s.removeMention(m)}
                className="w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.18)' }}
                aria-label={`Remove mention ${m}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <span className="text-white/35 text-[11px]">{s.mentions.length}/{MAX_MENTIONS}</span>
        </div>
        <input
          type="text"
          value={mentionQuery}
          onChange={(e) => { setMentionQuery(e.target.value); setMentionsOpen(true); }}
          onFocus={() => setMentionsOpen(true)}
          placeholder="Mention people…"
          className="w-full rounded-xl px-3 py-2.5 bg-transparent text-white text-[14px] outline-none placeholder:text-white/35"
          style={{ border: '1px dashed rgba(255,255,255,0.18)' }}
          aria-label="Mention people"
        />
        {mentionsOpen && (
          <div className="mt-2 rounded-2xl p-2 max-h-52 overflow-y-auto" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-white/45 text-[11px] px-1.5 mb-1">
              {mentionQuery ? 'Results' : 'Recent people'}
            </p>
            {(mentionQuery ? mentionResults : mentionRecent).length === 0 && (
              <p className="text-white/40 text-[13px] px-1.5 py-2">
                {mentionQuery ? 'No people found.' : 'People who interacted with your posts will appear here.'}
              </p>
            )}
            {(mentionQuery ? mentionResults : mentionRecent).map(p => (
              <button
                key={p.user_id}
                type="button"
                onClick={() => commitMention(p.username)}
                className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-left"
                style={{ background: 'transparent' }}
                aria-label={`Mention @${p.username}`}
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
                    style={{ background: 'rgba(255,0,110,0.35)' }}
                  >
                    {(p.username || '?')[0].toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-white text-[13px] font-bold truncate">@{p.username}</span>
                  <span className="block text-white/50 text-[11px] truncate">{p.display_name || ''}</span>
                </span>
                {p.relationship && p.relationship !== 'none' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                    {p.relationship}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Audience row */}
      <section className="px-4 pt-5" aria-label="Audience">
        <button
          type="button"
          onClick={onOpenAudience}
          className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,0,110,0.2)', color: '#FFD9E7' }}>
            {audienceIcon}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-white text-[14px] font-bold">{AUDIENCE_LABELS[s.audience]}</span>
            <span className="block text-white/50 text-[12px] truncate">
              {exclusionNote || (s.audience === 'close_friends'
                ? (s.audienceExclusions.hideFrom.length || s.audienceExclusions.showOnly.length ? 'Custom list' : 'People on your Close Friends list')
                : s.audience === 'public' ? 'Visible to everyone' : s.audience === 'friends' ? 'People you follow back' : 'Only you can see this')}
            </span>
          </span>
          <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
        </button>
      </section>

      {/* More options */}
      <section className="px-4 pt-3">
        <button
          type="button"
          onClick={() => setOptionsOpen(true)}
          className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <Settings2 size={17} />
          </span>
          <span className="flex-1">
            <span className="block text-white text-[14px] font-bold">More options</span>
            <span className="block text-white/50 text-[12px]">
              Comments {s.commentsEnabled ? 'on' : 'off'} · {s.watermark ? 'Watermark on' : 'Watermark off'}
              {s.shareToStory !== 'off' ? ' · Share to story' : ''}
            </span>
          </span>
          <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
        </button>
      </section>

      {/* Actions */}
      <div className="px-4 pt-5 pb-10 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void doPublish()}
          disabled={!canPublish}
          className="w-full py-3.5 rounded-2xl font-extrabold text-white text-[15px] flex items-center justify-center gap-2"
          style={{
            background: canPublish ? '#ff1493' : 'rgba(255,255,255,0.1)',
            opacity: canPublish ? 1 : 0.6,
          }}
        >
          {s.submitting ? <><Loader2 size={17} className="animate-spin" /> Publishing…</> : 'Share reel'}
        </button>
        <button
          type="button"
          onClick={() => void handleSaveDraft()}
          disabled={draftSaving}
          className="w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', opacity: draftSaving ? 0.7 : 1 }}
        >
          {draftSaving ? <><InlineSpinner size={15} /> Saving…</> : <><Save size={16} /> Save draft</>}
        </button>
        {s.clips.length === 0 && (
          <p className="text-center text-white/45 text-[12px]">Add at least one photo or video to share.</p>
        )}
      </div>

      {/* ── More options sheet ── */}
      <BottomSheet open={optionsOpen} onClose={() => setOptionsOpen(false)} title="More options">
        <div className="flex flex-col gap-2">
          <ToggleRow
            label="Allow comments"
            hint="People can comment on your reel"
            checked={s.commentsEnabled}
            onChange={v => s.setCommentsEnabled(v)}
          />
          <ToggleRow
            label="Watermark"
            hint="Adds your @username in the corner"
            checked={s.watermark}
            onChange={v => s.setWatermark(v)}
          />
          <ToggleRow
            label="Save to device"
            hint="Download a copy after publishing"
            checked={s.saveToDevice}
            onChange={v => s.setSaveToDevice(v)}
          />
          <button
            type="button"
            onClick={() => { setOptionsOpen(false); onOpenShareStory(); }}
            className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <span className="flex-1">
              <span className="block text-white text-[14px] font-bold">Share to my story</span>
              <span className="block text-white/50 text-[12px]">
                {s.shareToStory === 'off' ? 'Off' : s.shareToStory === 'always' ? 'Always share new reels' : 'Ask once after publishing'}
              </span>
            </span>
            <ChevronRight size={17} color="rgba(255,255,255,0.5)" />
          </button>
          <div className="rounded-2xl px-3.5 py-3 mt-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-white/70 text-[13px] leading-relaxed">
              Your reel is stored on your profile only for the audience you choose. You can change this before sharing.
            </p>
          </div>
        </div>
      </BottomSheet>

      {/* ── Publish progress / error ── */}
      {(s.submitting || publishError) && (
        <div
          className="fixed inset-x-0 bottom-0 z-[calc(var(--z-sheet,70)+2)] px-4 pb-5"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)', pointerEvents: 'auto' }}
        >
          <div className="rounded-2xl px-4 py-3.5" style={{ background: '#16101A', border: '1px solid rgba(255,255,255,0.12)' }}>
            {s.submitting && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-[13px] font-bold">
                    {progress?.phase === 'rendering' ? 'Processing edits…'
                      : progress?.phase === 'uploading' ? 'Uploading…'
                      : progress?.phase === 'story' ? 'Sharing to story…'
                      : 'Publishing…'}
                  </span>
                  <span className="text-white/60 text-[12px]">{progress?.overall ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }} role="progressbar"
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.overall ?? 0} aria-label="Publish progress">
                  <div
                    className="h-full"
                    style={{
                      width: `${progress?.overall ?? 0}%`,
                      background: `linear-gradient(90deg, ${PINK}, #FF6B8B)`,
                      transition: 'width 0.25s ease',
                    }}
                  />
                </div>
              </>
            )}
            {publishError && (
              <div className="flex items-start gap-2">
                <AlertCircle size={17} color="#FF8A8A" className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 text-[13px]">{publishError.message}</p>
                  <div className="flex gap-2 mt-2">
                    {publishError.retryable && (
                      <button
                        type="button"
                        onClick={() => void doPublish(true)}
                        className="px-4 py-2 rounded-xl text-[12px] font-bold text-white"
                        style={{ background: PINK }}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPublishError(null)}
                      className="px-4 py-2 rounded-xl text-[12px] font-bold"
                      style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </StageShell>
  );
}

function ToggleRow({
  label, hint, checked, onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="flex items-center gap-3 rounded-2xl px-3.5 py-3 cursor-pointer"
      style={{ background: 'rgba(255,255,255,0.06)' }}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-white text-[14px] font-bold">{label}</span>
        <span className="block text-white/50 text-[12px]">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 accent-pink-500 shrink-0"
        aria-label={label}
      />
    </label>
  );
}
