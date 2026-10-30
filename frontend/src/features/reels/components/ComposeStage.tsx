import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Plus, Globe, Users, Lock, ChevronRight, Settings2,
  AlertCircle, Loader2, Check, Save, X, Lightbulb, Sparkles,
  Maximize2, Minimize2, Link2, Share2, Search, AtSign, Hash,
  Play, SlidersHorizontal, ExternalLink, RefreshCw, Send, CheckCircle2
} from 'lucide-react';
import api from '../../../api/api';
import { useReelCreatorStore } from '../reelCreatorStore';
import { useCreateMomentsTheme } from '../useCreateMomentsTheme';
import { BottomSheet, InlineSpinner, PINK } from './shell';
import { saveDraft } from '../services/draftService';
import { publishReelBackground, PublishError, AUDIENCE_LABELS, type PublishProgress } from '../services/reelPublishService';
import { openNativePicker, filesToGalleryItems } from '../services/mediaLibraryService';
import type { AudienceKind } from '../types';
import { showError, showSuccess } from '../../../utils/toast';
import { logger } from '../../../utils/logger';

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

interface HashtagItem {
  tag: string;
  post_count: number;
}

/**
 * Sparkle Reel Publishing Studio 2.0 (ComposeStage):
 * - Image 2: Clean TikTok-style dark publishing layout with header Preview,
 *   cover preview, add-media tile, borderless title & description, toolbar,
 *   settings rows, and bottom Drafts + Post buttons.
 * - Image 3: Intelligent compact keyboard composition mode.
 * - Image 4: Dedicated Mention People screen with People/Videos tabs, search,
 *   recent and friends sections.
 * - Image 5: Inline hashtag autocomplete panel above keyboard.
 */
export default function ComposeStage({
  onBack,
  onOpenAudience,
  onOpenShareStory,
  onPublishedBackground,
  onDraftSaved,
}: {
  onBack: () => void;
  onOpenAudience: () => void;
  onOpenShareStory: () => void;
  onPublishedBackground: (uploadId: string) => void;
  onDraftSaved?: () => void;
}) {
  const s = useReelCreatorStore();
  const { isDark } = useCreateMomentsTheme();

  // ── Keyboard / Composition Mode ──
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<'title' | 'desc' | null>(null);
  const [expandedDesc, setExpandedDesc] = useState(false);

  // ── Cover selection ──
  const [selectedCoverIndex, setSelectedCoverIndex] = useState(0);
  const [coverModalOpen, setCoverModalOpen] = useState(false);

  // ── Description Ideas & AI Assistant Drawers ──
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Hashtags State & Autocomplete (Image 5) ──
  const [activeHashQuery, setActiveHashQuery] = useState<string | null>(null);
  const [hashTokenRange, setHashTokenRange] = useState<{ start: number; end: number } | null>(null);
  const [recentTags, setRecentTags] = useState<string[]>([]);
  const [recentTagsWithCounts, setRecentTagsWithCounts] = useState<HashtagItem[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<HashtagItem[]>([]);
  const hashDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mentions State & Modal (Image 4) ──
  const [mentionModalOpen, setMentionModalOpen] = useState(false);
  const [mentionTab, setMentionTab] = useState<'people' | 'videos'>('people');
  const [mentionModalSearch, setMentionModalSearch] = useState('');
  const [mentionModalResults, setMentionModalResults] = useState<Person[]>([]);
  const [recentPeople, setRecentPeople] = useState<Person[]>([]);
  const [friendsList, setFriendsList] = useState<Person[]>([]);
  const [mentionSearching, setMentionSearching] = useState(false);
  const mentionSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Inline @ Mention Autocomplete ──
  const [activeAtQuery, setActiveAtQuery] = useState<string | null>(null);
  const [atTokenRange, setAtTokenRange] = useState<{ start: number; end: number } | null>(null);
  const [inlineMentionResults, setInlineMentionResults] = useState<Person[]>([]);

  // ── Settings Bottom Sheets ──
  const [audienceSheetOpen, setAudienceSheetOpen] = useState(false);
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const [attachedLink, setAttachedLink] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [shareDestination, setShareDestination] = useState<string>('Standard');

  // ── In-place Reel Preview Modal ──
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // ── Publish / Draft State ──
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [publishError, setPublishError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const idemKeyRef = useRef<string>(
    s.draftId ? `d-${s.draftId}` : (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `idem-${Date.now()}`),
  );

  const descRef = useRef<HTMLTextAreaElement | null>(null);
  const savedCursorPos = useRef<number>(0);

  const duration = s.totalDurationSec();
  const canPublish = s.clips.length > 0 && !s.submitting;
  const coverUrl = s.clips[selectedCoverIndex]?.previewUrl || s.clips[0]?.previewUrl;

  // ── 1. Virtual Keyboard Detection via Visual Viewport ──
  useEffect(() => {
    const handleViewportResize = () => {
      if (typeof window === 'undefined' || !window.visualViewport) return;
      const heightDiff = window.innerHeight - window.visualViewport.height;
      // Meaningful shrink indicates virtual keyboard is present
      setIsKeyboardOpen(heightDiff > 160);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportResize);
    }
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
        window.visualViewport.removeEventListener('scroll', handleViewportResize);
      }
    };
  }, []);

  const isCompactMode = isKeyboardOpen || activeInput !== null;

  // ── 2. Load Recent Hashtags & People on Mount ──
  useEffect(() => {
    let alive = true;
    api.get('/reels/hashtags/recent')
      .then(({ data }) => {
        if (alive) {
          setRecentTags(Array.isArray(data?.hashtags) ? data.hashtags : []);
          // Use real counts from the updated API (hashtagsWithCounts field)
          setRecentTagsWithCounts(
            Array.isArray(data?.hashtagsWithCounts) ? data.hashtagsWithCounts : []
          );
        }
      })
      .catch(() => { /* non-fatal */ });

    api.get('/reels/people/recent')
      .then(({ data }) => {
        if (alive) setRecentPeople(Array.isArray(data?.people) ? data.people : []);
      })
      .catch(() => { /* non-fatal */ });

    api.get('/reels/people/friends')
      .then(({ data }) => {
        if (alive) setFriendsList(Array.isArray(data?.people) ? data.people : []);
      })
      .catch(() => { /* non-fatal */ });

    return () => { alive = false; };
  }, []);

  // ── Helper: Call AI generate endpoint ──
  const callAi = useCallback(async (action: string) => {
    setAiLoading(true);
    setAiResult(null);
    setAiError(null);
    try {
      const { data } = await api.post('/reels/ai/generate', {
        action,
        currentDescription: s.description || undefined,
        title: s.title || undefined,
        hashtags: s.hashtags?.length ? s.hashtags : undefined,
      });
      if (data?.result) {
        setAiResult(data.result);
      } else {
        setAiError('No result returned. Try again.');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAiError(msg || 'AI service unavailable. Try again in a moment.');
    } finally {
      setAiLoading(false);
    }
  }, [s.description, s.title, s.hashtags]);


  // ── 3. Hashtag Suggestions Search (Debounced) ──
  useEffect(() => {
    if (activeHashQuery === null) {
      setTagSuggestions([]);
      return;
    }
    const q = activeHashQuery.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (hashDebounceTimer.current) clearTimeout(hashDebounceTimer.current);

    hashDebounceTimer.current = setTimeout(() => {
      api.get('/reels/hashtags/suggest', { params: { q } })
        .then(({ data }) => {
          const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
          setTagSuggestions(suggestions);
        })
        .catch(() => {
          setTagSuggestions([]);
        });
    }, 180);

    return () => {
      if (hashDebounceTimer.current) clearTimeout(hashDebounceTimer.current);
    };
  }, [activeHashQuery]);

  // ── 4. Mention Search for Modal (Debounced) ──
  useEffect(() => {
    const q = mentionModalSearch.trim().replace(/^@/, '');
    if (!q) {
      setMentionModalResults([]);
      setMentionSearching(false);
      return;
    }
    setMentionSearching(true);
    if (mentionSearchTimer.current) clearTimeout(mentionSearchTimer.current);

    mentionSearchTimer.current = setTimeout(() => {
      api.get('/reels/people/search', { params: { q } })
        .then(({ data }) => {
          setMentionModalResults(Array.isArray(data?.people) ? data.people : []);
        })
        .catch(() => {
          setMentionModalResults([]);
        })
        .finally(() => {
          setMentionSearching(false);
        });
    }, 220);

    return () => {
      if (mentionSearchTimer.current) clearTimeout(mentionSearchTimer.current);
    };
  }, [mentionModalSearch]);

  // ── 5. Inline @ Mention Search (Debounced) ──
  useEffect(() => {
    if (activeAtQuery === null) {
      setInlineMentionResults([]);
      return;
    }
    const q = activeAtQuery.trim().replace(/^@/, '');
    if (!q) {
      setInlineMentionResults(recentPeople.slice(0, 6));
      return;
    }
    const t = setTimeout(() => {
      api.get('/reels/people/search', { params: { q } })
        .then(({ data }) => {
          setInlineMentionResults(Array.isArray(data?.people) ? data.people.slice(0, 8) : []);
        })
        .catch(() => {
          setInlineMentionResults([]);
        });
    }, 180);

    return () => clearTimeout(t);
  }, [activeAtQuery, recentPeople]);

  // ── 6. Cursor & Token Detection in Description ──
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value.slice(0, DESC_MAX);
    s.setDescription(text);

    const pos = e.target.selectionStart || 0;
    savedCursorPos.current = pos;
    detectActiveTokens(text, pos);
  };

  const handleDescriptionKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const pos = (e.target as HTMLTextAreaElement).selectionStart || 0;
    savedCursorPos.current = pos;
    detectActiveTokens(s.description, pos);
  };

  const handleDescriptionClick = () => {
    if (!descRef.current) return;
    const pos = descRef.current.selectionStart || 0;
    savedCursorPos.current = pos;
    detectActiveTokens(s.description, pos);
  };

  const detectActiveTokens = (text: string, pos: number) => {
    const leftText = text.slice(0, pos);

    // Hashtag detection: #tag up to cursor
    const hashMatch = /(?:^|\s)#([a-zA-Z0-9_]*)$/.exec(leftText);
    if (hashMatch) {
      const query = hashMatch[1];
      const matchStart = leftText.lastIndexOf('#' + query);
      setActiveHashQuery(query);
      setHashTokenRange({ start: matchStart, end: pos });
    } else {
      setActiveHashQuery(null);
      setHashTokenRange(null);
    }

    // Mention detection: @username up to cursor
    const atMatch = /(?:^|\s)@([a-zA-Z0-9_.]*)$/.exec(leftText);
    if (atMatch) {
      const query = atMatch[1];
      const matchStart = leftText.lastIndexOf('@' + query);
      setActiveAtQuery(query);
      setAtTokenRange({ start: matchStart, end: pos });
    } else {
      setActiveAtQuery(null);
      setAtTokenRange(null);
    }
  };

  // ── 7. Insert Token Handlers ──
  const insertHashtagToken = (tag: string) => {
    const clean = tag.replace(/^#/, '').toLowerCase().trim();
    if (!clean) return;

    const desc = s.description;
    let newDesc = '';
    let newCursor = 0;

    if (hashTokenRange) {
      const before = desc.slice(0, hashTokenRange.start);
      const after = desc.slice(hashTokenRange.end);
      newDesc = `${before}#${clean} ${after}`;
      newCursor = (before + `#${clean} `).length;
    } else {
      const pos = savedCursorPos.current;
      const before = desc.slice(0, pos);
      const after = desc.slice(pos);
      const prefix = before.endsWith(' ') || before.length === 0 ? '' : ' ';
      newDesc = `${before}${prefix}#${clean} ${after}`;
      newCursor = (before + `${prefix}#${clean} `).length;
    }

    s.setDescription(newDesc);
    s.addHashtag(clean);
    setActiveHashQuery(null);
    setHashTokenRange(null);

    // Re-focus and update cursor
    setTimeout(() => {
      if (descRef.current) {
        descRef.current.focus();
        descRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 50);
  };

  const insertMentionToken = (username: string) => {
    const clean = username.replace(/^@/, '').toLowerCase().trim();
    if (!clean) return;

    const desc = s.description;
    let newDesc = '';
    let newCursor = 0;

    if (atTokenRange) {
      const before = desc.slice(0, atTokenRange.start);
      const after = desc.slice(atTokenRange.end);
      newDesc = `${before}@${clean} ${after}`;
      newCursor = (before + `@${clean} `).length;
    } else {
      const pos = savedCursorPos.current;
      const before = desc.slice(0, pos);
      const after = desc.slice(pos);
      const prefix = before.endsWith(' ') || before.length === 0 ? '' : ' ';
      newDesc = `${before}${prefix}@${clean} ${after}`;
      newCursor = (before + `${prefix}@${clean} `).length;
    }

    s.setDescription(newDesc);
    s.addMention(clean);
    setActiveAtQuery(null);
    setAtTokenRange(null);
    setMentionModalOpen(false);

    setTimeout(() => {
      if (descRef.current) {
        descRef.current.focus();
        descRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 50);
  };

  // ── 8. Add Media Handler ──
  const handleAddMedia = async () => {
    if (s.clips.length >= 10) {
      showError('You can add up to 10 clips per reel.');
      return;
    }
    try {
      const files = await openNativePicker({ multiple: true, accept: 'image/*,video/*' });
      if (!files.length) return;
      const picked = (await filesToGalleryItems(files)).slice(0, 10 - s.clips.length);
      if (!picked.length) return;

      const additions = picked.map(g => ({
        id: g.id,
        kind: g.kind,
        previewUrl: g.thumbnailUrl.startsWith('blob:') ? g.thumbnailUrl : (g.file ? URL.createObjectURL(g.file) : g.thumbnailUrl),
        file: g.file,
        storageKey: null,
        durationSec: g.durationSec ?? (g.kind === 'image' ? 3 : 0),
        trimStart: 0,
        trimEnd: null,
        width: g.width,
        height: g.height,
        name: g.name,
      }));

      s.addClips(additions);
      showSuccess(`Added ${additions.length} clip${additions.length > 1 ? 's' : ''}`);
    } catch (err) {
      logger.warn('[Compose] pick media failed:', err);
    }
  };

  // ── 9. Save Draft ──
  const handleSaveDraft = async () => {
    setDraftSaving(true);
    try {
      await saveDraft();
      showSuccess('Draft saved to this device.');
      onDraftSaved?.();
    } catch (err) {
      logger.warn('[Compose] draft save failed:', err);
      showError('Could not save draft. Try again.');
    } finally {
      setDraftSaving(false);
    }
  };

  // ── 10. Publish Reel ──
  const doPublish = async (isRetry = false) => {
    setPublishError(null);
    if (isRetry) setProgress(null);
    s.setSubmitting(true);
    s.setSubmitProgress(0);
    try {
      const handoff = await publishReelBackground(idemKeyRef.current, (p) => {
        setProgress(p);
        s.setSubmitProgress(p.overall);
      });
      showSuccess('Publishing in the background — you can keep browsing.');
      onPublishedBackground(handoff.uploadId);
    } catch (err) {
      if (err instanceof PublishError) {
        setPublishError({ message: err.message, retryable: err.retryable });
        if (err.code === 'AUTH') showError(err.message);
      } else {
        setPublishError({ message: 'Failed to publish reel. You can retry safely.', retryable: true });
      }
      logger.warn('[Compose] publish failed:', err);
    } finally {
      s.setSubmitting(false);
      setProgress(null);
    }
  };

  // ── Audience Label Helper ──
  const audienceDisplayLabel = useMemo(() => {
    switch (s.audience) {
      case 'public': return 'Everyone can view this reel';
      case 'friends': return 'Friends can view this reel';
      case 'close_friends': return 'Close friends can view this reel';
      case 'only_me': return 'Only you can view this reel';
      default: return 'Everyone can view this reel';
    }
  }, [s.audience]);

  return (
    <div
      className={`fixed inset-0 z-[var(--z-modal,60)] flex flex-col overflow-hidden ${isDark ? 'text-white' : 'text-gray-900'}`}
      style={{
        background: isDark ? '#0D080E' : '#FFFFFF',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="main"
      aria-label="Publish reel studio"
    >
      {/* ── 1. HEADER ── */}
      <header
        className="flex items-center justify-between px-4 h-14 shrink-0 z-20"
        style={{
          background: isDark ? 'rgba(13, 8, 14, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          borderBottom: isDark ? '1px solid #29232C' : '1px solid #E5E7EB',
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (activeInput) {
              setActiveInput(null);
              if (descRef.current) descRef.current.blur();
            } else {
              onBack();
            }
          }}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDark ? 'text-white/90 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>

        {/* Normal Header: Preview Action | Compact Mode: Post Action */}
        {!isCompactMode ? (
          <button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            className={`font-semibold text-sm px-2.5 py-1.5 transition-colors ${isDark ? 'text-white/90 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
          >
            Preview
          </button>
        ) : (
          <button
            type="button"
            disabled={!canPublish}
            onClick={() => void doPublish()}
            className="px-4 py-1.5 rounded-full text-xs font-extrabold transition-all active:scale-95 flex items-center gap-1.5"
            style={{
              background: canPublish ? '#EC1164' : (isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB'),
              color: canPublish ? '#FFFFFF' : (isDark ? 'rgba(255,255,255,0.45)' : '#9CA3AF'),
              cursor: canPublish ? 'pointer' : 'not-allowed',
            }}
          >
            {s.submitting ? <InlineSpinner size={13} /> : 'Post'}
          </button>
        )}
      </header>

      {/* ── 2. SCROLLABLE COMPOSER BODY ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Top Cover and Media Tiles Row */}
        <section className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            {/* Reel Cover Thumbnail */}
            <div
              onClick={() => setCoverModalOpen(true)}
              className={`relative rounded-2xl overflow-hidden cursor-pointer border transition-all duration-200 group active:scale-95 ${isDark ? 'bg-[#181419] border-[#29232C]' : 'bg-gray-100 border-gray-200'} ${
                isCompactMode ? 'w-14 h-16 shrink-0' : 'w-[115px] h-[145px] shrink-0'
              }`}
            >
              {coverUrl ? (
                <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${isDark ? 'text-white/40 bg-[#181419]' : 'text-gray-400 bg-gray-100'}`}>
                  <Play size={20} />
                </div>
              )}
              {/* Cover Pill Badge */}
              <div
                className={`absolute top-2 left-2 rounded-full bg-black/65 backdrop-blur-md text-white font-bold tracking-wider uppercase flex items-center justify-center ${
                  isCompactMode ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
                }`}
              >
                Cover
              </div>
            </div>

            {/* Add Media Tile */}
            {s.clips.length < 10 && (
              <div
                onClick={handleAddMedia}
                className={`rounded-2xl border border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${isDark ? 'bg-[#181419] border-[#29232C] hover:border-white/30' : 'bg-gray-50 border-gray-300 hover:border-gray-400'} ${
                  isCompactMode ? 'w-14 h-16 shrink-0' : 'w-[100px] h-[145px] shrink-0'
                }`}
                role="button"
                aria-label="Add clip"
              >
                <Plus size={isCompactMode ? 18 : 24} className={isDark ? "text-white/70" : "text-gray-600"} />
                {!isCompactMode && (
                  <span className={`text-[11px] font-medium ${isDark ? "text-white/50" : "text-gray-500"}`}>Add clip</span>
                )}
              </div>
            )}

            {/* Multiple Clips Summary (when not in compact mode) */}
            {!isCompactMode && s.clips.length > 1 && (
              <div className="flex-1 min-w-0 pl-1">
                <p className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                  {s.clips.length} clips · {duration.toFixed(1)}s
                </p>
                <p className={`text-[11px] truncate mt-0.5 ${isDark ? "text-[#A6A0A8]" : "text-gray-500"}`}>
                  {s.selectedMusic ? `♪ ${s.selectedMusic.title}` : 'Original audio'}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Title Input */}
        <section className="px-4 pt-2 pb-1" aria-label="Reel title">
          <div className={`border-b pb-2 ${isDark ? "border-[#29232C]" : "border-gray-200"}`}>
            <input
              type="text"
              value={s.title}
              onFocus={() => setActiveInput('title')}
              onBlur={() => setActiveInput(null)}
              onChange={(e) => s.setTitle(e.target.value.slice(0, TITLE_MAX))}
              placeholder="Add a catchy title"
              maxLength={TITLE_MAX}
              className={`w-full bg-transparent outline-none text-[16px] font-semibold ${isDark ? "text-white placeholder:text-[#77717A]" : "text-gray-900 placeholder:text-gray-400"} placeholder:font-normal`}
            />
          </div>
          {s.title.length > 0 && (
            <p className={`text-right text-[11px] mt-1 pr-1 ${isDark ? "text-[#77717A]" : "text-gray-400"}`}>{s.title.length}/{TITLE_MAX}</p>
          )}
        </section>

        {/* Description Writing Area */}
        <section className="px-4 pt-3 pb-1" aria-label="Reel description">
          <textarea
            ref={descRef}
            rows={expandedDesc ? 10 : isCompactMode ? 4 : 5}
            value={s.description}
            onFocus={() => setActiveInput('desc')}
            onBlur={() => {
              // Delay blur clear so clicks on autocomplete suggestions register
              setTimeout(() => setActiveInput(null), 180);
            }}
            onChange={handleDescriptionChange}
            onKeyUp={handleDescriptionKeyUp}
            onClick={handleDescriptionClick}
            placeholder="Write a description..."
            maxLength={DESC_MAX}
            className={`w-full bg-transparent text-[15px] outline-none resize-none leading-relaxed ${isDark ? "text-white placeholder:text-[#77717A]" : "text-gray-900 placeholder:text-gray-400"}`}
          />

          {/* Composer Toolbar (Image 2) */}
          <div className={`flex items-center justify-between pt-2 pb-1 border-t ${isDark ? "border-[#29232C]" : "border-gray-200"}`}>
            <div className="flex items-center gap-2">
              {/* Hashtag trigger */}
              <button
                type="button"
                onClick={() => {
                  insertHashtagToken('');
                  if (descRef.current) descRef.current.focus();
                }}
                className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-extrabold transition-colors active:scale-95 ${isDark ? "bg-[#181419] border-[#29232C] hover:border-[#EC1164] text-white/90" : "bg-white border-gray-300 hover:border-[#EC1164] text-gray-900 shadow-sm font-black"}`}
                aria-label="Add hashtag"
              >
                #
              </button>

              {/* Mention trigger */}
              <button
                type="button"
                onClick={() => setMentionModalOpen(true)}
                className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-extrabold transition-colors active:scale-95 ${isDark ? "bg-[#181419] border-[#29232C] hover:border-[#EC1164] text-white/90" : "bg-white border-gray-300 hover:border-[#EC1164] text-gray-900 shadow-sm font-black"}`}
                aria-label="Mention people"
              >
                @
              </button>

              {/* Description Ideas */}
              <button
                type="button"
                onClick={() => setIdeasOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${isDark ? "bg-[#181419] border-[#29232C] hover:border-white/20 text-[#A6A0A8] hover:text-white" : "bg-white border-gray-300 hover:border-gray-400 text-gray-900 shadow-sm font-bold"}`}
              >
                <Lightbulb size={13} className="text-[#EC1164]" />
                <span>Description ideas</span>
              </button>

              {/* Writing assistant */}
              <button
                type="button"
                onClick={() => setAssistantOpen(true)}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${isDark ? "bg-[#181419] border-[#29232C] hover:border-white/20 text-white/80" : "bg-white border-gray-300 hover:border-gray-400 text-gray-900 shadow-sm"}`}
                aria-label="Writing assistant"
              >
                <Sparkles size={14} className="text-[#EC1164]" />
              </button>
            </div>

            {/* Expand / Minimize editor */}
            <button
              type="button"
              onClick={() => setExpandedDesc(v => !v)}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${isDark ? "bg-[#181419] border-[#29232C] text-[#77717A] hover:text-white" : "bg-white border-gray-300 text-gray-700 hover:text-gray-900 shadow-sm"}`}
              aria-label="Expand editor"
            >
              {expandedDesc ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </section>

        {/* ── 3. INLINE HASHTAG SUGGESTIONS (IMAGE 5) ── */}
        {activeHashQuery !== null && (tagSuggestions.length > 0 || recentTags.length > 0) && (
          <div className={`px-4 py-2 border-t border-b transition-all ${isDark ? "bg-[#181419] border-[#29232C]" : "bg-gray-50 border-gray-200"}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? "text-[#77717A]" : "text-gray-500"}`}>
              {tagSuggestions.length > 0 ? 'Suggested hashtags' : 'Recent hashtags'}
            </p>
            <div className={`flex flex-col divide-y ${isDark ? "divide-[#29232C]/60" : "divide-gray-200"}`}>
              {(tagSuggestions.length > 0
                ? tagSuggestions
                : recentTagsWithCounts.length > 0
                  ? recentTagsWithCounts
                  : recentTags.map(t => ({ tag: t, post_count: 0 }))
              ).slice(0, 5).map(item => (
                <button
                  key={item.tag}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertHashtagToken(item.tag);
                  }}
                  className="flex items-center justify-between py-2.5 px-1 text-left hover:bg-white/[0.04] transition-colors"
                >
                  <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>#{item.tag}</span>
                  <span className="text-[#77717A] text-xs">
                    {item.post_count > 1000000
                      ? `${(item.post_count / 1000000).toFixed(1)}M posts`
                      : item.post_count > 1000
                      ? `${(item.post_count / 1000).toFixed(1)}k posts`
                      : item.post_count > 0
                      ? `${item.post_count} posts`
                      : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. INLINE @ MENTION AUTOCOMPLETE ── */}
        {activeAtQuery !== null && inlineMentionResults.length > 0 && (
          <div className={`px-4 py-2 border-t border-b transition-all ${isDark ? "bg-[#181419] border-[#29232C]" : "bg-gray-50 border-gray-200"}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? "text-[#77717A]" : "text-gray-500"}`}>
              Mention people
            </p>
            <div className={`flex flex-col divide-y ${isDark ? "divide-[#29232C]/60" : "divide-gray-200"}`}>
              {inlineMentionResults.map(p => (
                <button
                  key={p.user_id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMentionToken(p.username);
                  }}
                  className="flex items-center gap-3 py-2 px-1 text-left hover:bg-white/[0.04] transition-colors"
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#EC1164]/30 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {(p.username || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>@{p.username}</p>
                    <p className={`text-xs truncate ${isDark ? "text-[#A6A0A8]" : "text-gray-500"}`}>{p.display_name || ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 5. PUBLISHING SETTINGS SECTION (IMAGE 2) ── */}
        {!isCompactMode && (
          <section className={`px-4 pt-2 pb-24 divide-y text-sm ${isDark ? "divide-[#29232C]" : "divide-gray-200"}`}>
            {/* Row 1: Add Link */}
            <button
              type="button"
              onClick={() => setLinkSheetOpen(true)}
              className="w-full flex items-center justify-between py-3.5 text-left group transition-colors"
            >
              <div className="flex items-center gap-3">
                <Link2 size={18} className={isDark ? "text-[#A6A0A8]" : "text-gray-700"} />
                <span className={`font-bold text-[15px] ${isDark ? "text-white" : "text-gray-900"}`}>
                  {attachedLink ? 'Link attached' : 'Add link'}
                </span>
              </div>
              <div className={`flex items-center gap-1 ${isDark ? "text-[#77717A]" : "text-gray-400"}`}>
                {attachedLink && (
                  <span className="text-xs text-[#EC1164] max-w-[140px] truncate">{attachedLink}</span>
                )}
                <ChevronRight size={18} />
              </div>
            </button>

            {/* Row 2: Audience Privacy */}
            <button
              type="button"
              onClick={() => setAudienceSheetOpen(true)}
              className="w-full flex items-center justify-between py-3.5 text-left group transition-colors"
            >
              <div className="flex items-center gap-3">
                <Globe size={18} className={isDark ? "text-[#A6A0A8]" : "text-gray-700"} />
                <span className={`font-bold text-[15px] ${isDark ? "text-white" : "text-gray-900"}`}>{audienceDisplayLabel}</span>
              </div>
              <ChevronRight size={18} className={isDark ? "text-[#77717A]" : "text-gray-400"} />
            </button>

            {/* Row 3: More Options */}
            <button
              type="button"
              onClick={() => setOptionsSheetOpen(true)}
              className="w-full flex items-center justify-between py-3.5 text-left group transition-colors"
            >
              <div className="flex items-center gap-3">
                <SlidersHorizontal size={18} className={isDark ? "text-[#A6A0A8]" : "text-gray-700"} />
                <span className={`font-bold text-[15px] ${isDark ? "text-white" : "text-gray-900"}`}>More options</span>
              </div>
              <ChevronRight size={18} className={isDark ? "text-[#77717A]" : "text-gray-400"} />
            </button>

            {/* Row 4: Share to */}
            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: s.title || 'Sparkle Reel', text: s.description }).catch(() => {});
                } else {
                  showSuccess('Destination set to standard share');
                }
              }}
              className="w-full flex items-center justify-between py-3.5 text-left group transition-colors"
            >
              <div className="flex items-center gap-3">
                <Share2 size={18} className={isDark ? "text-[#A6A0A8]" : "text-gray-700"} />
                <span className={`font-bold text-[15px] ${isDark ? "text-white" : "text-gray-900"}`}>Share to</span>
              </div>
              <div className={`flex items-center gap-1 ${isDark ? "text-[#77717A]" : "text-gray-400"}`}>
                <span className="text-xs">{shareDestination}</span>
                <ChevronRight size={18} />
              </div>
            </button>
          </section>
        )}
      </div>

      {/* ── 6. BOTTOM PUBLISHING ACTION BAR (IMAGE 2) ── */}
      {!isCompactMode && (
        <div
          className={`fixed bottom-0 inset-x-0 z-30 px-4 py-3 backdrop-blur-md border-t flex items-center gap-3 ${isDark ? "bg-[#0D080E]/95 border-[#29232C]" : "bg-white/95 border-gray-200"}`}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}
        >
          {/* Drafts Button */}
          <button
            type="button"
            disabled={draftSaving}
            onClick={handleSaveDraft}
            className={`flex-1 py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 border active:scale-[0.98] transition-all ${isDark ? "bg-[#181419] border-[#29232C] text-white hover:bg-[#211B22]" : "bg-white border-gray-300 text-gray-900 shadow-sm hover:bg-gray-50"}`}
          >
            {draftSaving ? (
              <InlineSpinner size={15} />
            ) : (
              <>
                <Save size={16} className={isDark ? "text-white/80" : "text-gray-900"} />
                <span>Drafts</span>
              </>
            )}
          </button>

          {/* Post Button */}
          <button
            type="button"
            disabled={!canPublish}
            onClick={() => void doPublish()}
            className="flex-1 py-3.5 rounded-full font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            style={{
              background: canPublish ? '#EC1164' : (isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB'),
              color: canPublish ? '#FFFFFF' : (isDark ? 'rgba(255,255,255,0.45)' : '#9CA3AF'),
              boxShadow: canPublish ? '0 8px 24px rgba(236,17,100,0.35)' : 'none',
              cursor: canPublish ? 'pointer' : 'not-allowed',
            }}
          >
            {s.submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Publishing…</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>Post</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── 7. MENTION PEOPLE FULL-SCREEN SCREEN (IMAGE 4) ── */}
      {mentionModalOpen && (
        <div
          className={`fixed inset-0 z-[var(--z-modal,75)] flex flex-col ${isDark ? "bg-[#0D080E] text-white" : "bg-white text-gray-900"}`}
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Mention people"
        >
          {/* Header */}
          <header className={`flex items-center justify-between px-4 h-14 border-b ${isDark ? "border-[#29232C]" : "border-gray-200"}`}>
            <button
              type="button"
              onClick={() => setMentionModalOpen(false)}
              className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? "text-white/90 hover:text-white" : "text-gray-700 hover:text-gray-900"}`}
              aria-label="Close"
            >
              <X size={22} />
            </button>
            <h2 className="text-[17px] font-bold">Mention</h2>
            <div className="w-10" />
          </header>

          {/* Tabs: People | Videos */}
          <div className={`flex border-b ${isDark ? "border-[#29232C]" : "border-gray-200"}`}>
            <button
              type="button"
              onClick={() => setMentionTab('people')}
              className={`flex-1 py-3 text-center text-sm font-bold relative transition-colors ${
                mentionTab === 'people' ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-[#77717A]' : 'text-gray-500')
              }`}
            >
              People
              {mentionTab === 'people' && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[#EC1164]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMentionTab('videos')}
              className={`flex-1 py-3 text-center text-sm font-bold relative transition-colors ${
                mentionTab === 'videos' ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-[#77717A]' : 'text-gray-500')
              }`}
            >
              Videos
              {mentionTab === 'videos' && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[#EC1164]" />
              )}
            </button>
          </div>

          {/* Search bar */}
          <div className="p-4">
            <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-full border ${isDark ? "bg-[#181419] border-[#29232C]" : "bg-gray-100 border-gray-200"}`}>
              <Search size={16} className={isDark ? "text-[#77717A]" : "text-gray-400"} />
              <input
                type="text"
                value={mentionModalSearch}
                onChange={(e) => setMentionModalSearch(e.target.value)}
                placeholder="Search alias or nickname"
                className={`w-full bg-transparent text-sm outline-none ${isDark ? "text-white placeholder:text-[#77717A]" : "text-gray-900 placeholder:text-gray-400"}`}
              />
              {mentionModalSearch && (
                <button type="button" onClick={() => setMentionModalSearch('')} className="text-[#77717A]">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* User List Sections */}
          <div className="flex-1 overflow-y-auto px-4 pb-12">
            {mentionTab === 'videos' ? (
              <div className="py-12 text-center text-[#77717A] text-sm">
                No videos available to tag in this reel.
              </div>
            ) : mentionSearching ? (
              <div className="flex items-center justify-center py-12 text-[#A6A0A8] text-sm gap-2">
                <InlineSpinner size={18} /> Searching people…
              </div>
            ) : mentionModalSearch.trim() ? (
              // Search Results
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-[#77717A] uppercase tracking-wider mb-2">Results</p>
                {mentionModalResults.length === 0 ? (
                  <p className="text-center py-8 text-sm text-[#77717A]">No people found matching "{mentionModalSearch}".</p>
                ) : (
                  mentionModalResults.map(p => (
                    <div
                      key={p.user_id}
                      onClick={() => insertMentionToken(p.username)}
                      className={`flex items-center justify-between p-2 rounded-2xl cursor-pointer transition-colors ${isDark ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.04]"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-[#EC1164]/30 flex items-center justify-center text-sm font-bold text-white shrink-0">
                            {(p.username || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>{p.display_name || p.username}</p>
                          <p className={`text-xs truncate ${isDark ? "text-[#A6A0A8]" : "text-gray-500"}`}>@{p.username}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          insertMentionToken(p.username);
                        }}
                        className={`w-8 h-8 rounded-full border hover:border-[#EC1164] flex items-center justify-center text-[#EC1164] ${isDark ? "bg-[#181419] border-[#29232C]" : "bg-gray-100 border-gray-200"}`}
                      >
                        <AtSign size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              // Default lists: Recent + Friends
              <div className="flex flex-col gap-6">
                {recentPeople.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#77717A] uppercase tracking-wider mb-2">Recent</p>
                    <div className="flex flex-col gap-1">
                      {recentPeople.map(p => (
                        <div
                          key={p.user_id}
                          onClick={() => insertMentionToken(p.username)}
                          className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/[0.04] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-[#EC1164]/30 flex items-center justify-center text-sm font-bold text-white shrink-0">
                                {(p.username || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>{p.display_name || p.username}</p>
                              <p className="text-[#A6A0A8] text-xs truncate">@{p.username}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              insertMentionToken(p.username);
                            }}
                            className={`w-8 h-8 rounded-full border hover:border-[#EC1164] flex items-center justify-center text-[#EC1164] ${isDark ? "bg-[#181419] border-[#29232C]" : "bg-gray-100 border-gray-200"}`}
                          >
                            <AtSign size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {friendsList.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#77717A] uppercase tracking-wider mb-2">Friends</p>
                    <div className="flex flex-col gap-1">
                      {friendsList.map(p => (
                        <div
                          key={p.user_id}
                          onClick={() => insertMentionToken(p.username)}
                          className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/[0.04] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-[#EC1164]/30 flex items-center justify-center text-sm font-bold text-white shrink-0">
                                {(p.username || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-white text-sm font-bold truncate">{p.display_name || p.username}</p>
                              <p className="text-[#A6A0A8] text-xs truncate">@{p.username}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              insertMentionToken(p.username);
                            }}
                            className={`w-8 h-8 rounded-full border hover:border-[#EC1164] flex items-center justify-center text-[#EC1164] ${isDark ? "bg-[#181419] border-[#29232C]" : "bg-gray-100 border-gray-200"}`}
                          >
                            <AtSign size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 8. DESCRIPTION IDEAS DRAWER ── */}
      <BottomSheet open={ideasOpen} onClose={() => { setIdeasOpen(false); setAiResult(null); setAiError(null); }} title="Description ideas">
        <div className="flex flex-col gap-2 pt-2">
          {aiResult && (
            <div className="p-3.5 rounded-2xl bg-[#EC1164]/10 border border-[#EC1164]/40">
              <p className="text-white text-sm font-medium mb-2 whitespace-pre-wrap">{aiResult}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { s.setDescription(aiResult); setIdeasOpen(false); setAiResult(null); showSuccess('Description applied'); }}
                  className="flex-1 py-2 rounded-full text-xs font-bold bg-[#EC1164] text-white"
                >Use this</button>
                <button type="button" onClick={() => setAiResult(null)} className="px-4 py-2 rounded-full text-xs font-bold bg-white/10 text-white/80">Discard</button>
              </div>
            </div>
          )}
          {aiError && <p className="text-red-400 text-xs px-1">{aiError}</p>}
          {([
            { action: 'generate', label: 'Generate a fresh caption', icon: <Sparkles size={14} /> },
            { action: 'improve', label: 'Improve my description', icon: <RefreshCw size={14} /> },
            { action: 'shorten', label: 'Make it shorter', icon: <Minimize2 size={14} /> },
            { action: 'engaging', label: 'Make it more engaging', icon: <Send size={14} /> },
            { action: 'hashtags', label: 'Suggest hashtags for me', icon: <Hash size={14} /> },
            { action: 'title', label: 'Generate a reel title', icon: <Lightbulb size={14} /> },
          ] as { action: string; label: string; icon: React.ReactNode }[]).map(item => (
            <button key={item.action} type="button" disabled={aiLoading} onClick={() => void callAi(item.action)}
              className={`w-full text-left p-3.5 rounded-2xl border hover:border-[#EC1164] text-sm font-medium transition-colors flex items-center justify-between disabled:opacity-50 ${isDark ? "bg-[#181419] border-[#29232C] text-white" : "bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100"}`}>
              <span>{item.label}</span>
              {aiLoading ? <Loader2 size={14} className="animate-spin text-[#EC1164]" /> : <span className="text-[#EC1164]">{item.icon}</span>}
            </button>
          ))}
        </div>
      </BottomSheet>


      {/* ── 9. WRITING ASSISTANT DRAWER ── */}
      <BottomSheet open={assistantOpen} onClose={() => { setAssistantOpen(false); setAiResult(null); setAiError(null); }} title="Writing assistant">
        <div className="flex flex-col gap-2 pt-2">
          {/* AI Result display */}
          {aiResult && (
            <div className="p-3.5 rounded-2xl bg-[#EC1164]/10 border border-[#EC1164]/40">
              <p className="text-white text-sm font-medium mb-2 whitespace-pre-wrap">{aiResult}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    s.setDescription(aiResult);
                    setAssistantOpen(false);
                    setAiResult(null);
                    showSuccess('Description updated');
                  }}
                  className="flex-1 py-2 rounded-full text-xs font-bold bg-[#EC1164] text-white"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setAiResult(null)}
                  className="px-4 py-2 rounded-full text-xs font-bold bg-white/10 text-white/80"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
          {aiError && (
            <p className="text-red-400 text-xs px-1">{aiError}</p>
          )}
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => void callAi('improve')}
            className={`w-full text-left p-3.5 rounded-2xl border hover:border-[#EC1164] text-sm font-medium flex items-center justify-between disabled:opacity-50 ${isDark ? "bg-[#181419] border-[#29232C] text-white" : "bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100"}`}
          >
            <span>Improve wording</span>
            {aiLoading ? <Loader2 size={14} className="animate-spin text-[#EC1164]" /> : <Sparkles size={16} className="text-[#EC1164]" />}
          </button>
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => void callAi('engaging')}
            className={`w-full text-left p-3.5 rounded-2xl border hover:border-[#EC1164] text-sm font-medium flex items-center justify-between disabled:opacity-50 ${isDark ? "bg-[#181419] border-[#29232C] text-white" : "bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100"}`}
          >
            <span>Make it more engaging</span>
            {aiLoading ? <Loader2 size={14} className="animate-spin text-[#EC1164]" /> : <Send size={16} className="text-[#EC1164]" />}
          </button>
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => void callAi('shorten')}
            className={`w-full text-left p-3.5 rounded-2xl border hover:border-[#EC1164] text-sm font-medium flex items-center justify-between disabled:opacity-50 ${isDark ? "bg-[#181419] border-[#29232C] text-white" : "bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100"}`}
          >
            <span>Make it shorter</span>
            {aiLoading ? <Loader2 size={14} className="animate-spin text-[#EC1164]" /> : <Minimize2 size={16} className="text-[#EC1164]" />}
          </button>
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => void callAi('grammar')}
            className={`w-full text-left p-3.5 rounded-2xl border hover:border-[#EC1164] text-sm font-medium flex items-center justify-between disabled:opacity-50 ${isDark ? "bg-[#181419] border-[#29232C] text-white" : "bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100"}`}
          >
            <span>Fix grammar & spelling</span>
            {aiLoading ? <Loader2 size={14} className="animate-spin text-[#EC1164]" /> : <Check size={16} className="text-[#EC1164]" />}
          </button>
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => void callAi('hashtags')}
            className={`w-full text-left p-3.5 rounded-2xl border hover:border-[#EC1164] text-sm font-medium flex items-center justify-between disabled:opacity-50 ${isDark ? "bg-[#181419] border-[#29232C] text-white" : "bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100"}`}
          >
            <span>Suggest hashtags</span>
            {aiLoading ? <Loader2 size={14} className="animate-spin text-[#EC1164]" /> : <Hash size={16} className="text-[#EC1164]" />}
          </button>
        </div>
      </BottomSheet>

      {/* ── 10. AUDIENCE PRIVACY BOTTOM SHEET ── */}
      <BottomSheet open={audienceSheetOpen} onClose={() => setAudienceSheetOpen(false)} title="Who can view this reel?">
        <div className="flex flex-col gap-2 pt-2">
          {[
            { id: 'public' as AudienceKind, label: 'Everyone', desc: 'Anyone on Sparkle can watch this reel', icon: <Globe size={18} /> },
            { id: 'friends' as AudienceKind, label: 'Friends', desc: 'People you follow back', icon: <Users size={18} /> },
            { id: 'close_friends' as AudienceKind, label: 'Close Friends', desc: 'People on your Close Friends list', icon: <Check size={18} /> },
            { id: 'only_me' as AudienceKind, label: 'Only me', desc: 'Only you can view this reel', icon: <Lock size={18} /> },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                s.setAudience(opt.id);
                setAudienceSheetOpen(false);
              }}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                s.audience === opt.id
                  ? 'bg-[#EC1164]/15 border-[#EC1164]'
                  : isDark ? 'bg-[#181419] border-[#29232C] hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-[#EC1164]">{opt.icon}</span>
                <div>
                  <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{opt.label}</p>
                  <p className={`text-xs ${isDark ? "text-[#A6A0A8]" : "text-gray-500"}`}>{opt.desc}</p>
                </div>
              </div>
              {s.audience === opt.id && <CheckCircle2 size={18} className="text-[#EC1164]" />}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* ── 11. MORE OPTIONS BOTTOM SHEET ── */}
      <BottomSheet open={optionsSheetOpen} onClose={() => setOptionsSheetOpen(false)} title="More options">
        <div className="flex flex-col gap-2 pt-2">
          <label className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer ${isDark ? "bg-[#181419] border-[#29232C]" : "bg-gray-50 border-gray-200"}`}>
            <div>
              <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Allow comments</p>
              <p className={`text-xs ${isDark ? "text-[#A6A0A8]" : "text-gray-500"}`}>
              People can comment on your reel</p>
            </div>
            <input
              type="checkbox"
              checked={s.commentsEnabled}
              onChange={(e) => s.setCommentsEnabled(e.target.checked)}
              className="w-5 h-5 accent-[#EC1164]"
            />
          </label>

          <label className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer ${isDark ? "bg-[#181419] border-[#29232C]" : "bg-gray-50 border-gray-200"}`}>
            <div>
              <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Sparkle watermark</p>
              <p className={`text-xs ${isDark ? "text-[#A6A0A8]" : "text-gray-500"}`}>
              Adds your @username to the video corner</p>
            </div>
            <input
              type="checkbox"
              checked={s.watermark}
              onChange={(e) => s.setWatermark(e.target.checked)}
              className="w-5 h-5 accent-[#EC1164]"
            />
          </label>

          <label className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer ${isDark ? "bg-[#181419] border-[#29232C]" : "bg-gray-50 border-gray-200"}`}>
            <div>
              <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Save to device</p>
              <p className={`text-xs ${isDark ? "text-[#A6A0A8]" : "text-gray-500"}`}>
              Download a copy to device after publish</p>
            </div>
            <input
              type="checkbox"
              checked={s.saveToDevice}
              onChange={(e) => s.setSaveToDevice(e.target.checked)}
              className="w-5 h-5 accent-[#EC1164]"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setOptionsSheetOpen(false);
              onOpenShareStory();
            }}
            className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left ${isDark ? "bg-[#181419] border-[#29232C] hover:border-white/20" : "bg-gray-50 border-gray-200 hover:border-gray-300"}`}
          >
            <div>
              <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Share to my story</p>
              <p className={`text-xs ${isDark ? "text-[#A6A0A8]" : "text-gray-500"}`}>
              
                {s.shareToStory === 'off' ? 'Off' : s.shareToStory === 'always' ? 'Always' : 'Ask once'}
              </p>
            </div>
            <ChevronRight size={18} className="text-[#77717A]" />
          </button>
        </div>
      </BottomSheet>

      {/* ── 12. ADD LINK BOTTOM SHEET ── */}
      <BottomSheet open={linkSheetOpen} onClose={() => setLinkSheetOpen(false)} title="Add link to reel">
        <div className="flex flex-col gap-3 pt-2">
          <input
            type="url"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://example.com"
            className={`w-full p-3.5 rounded-2xl border text-sm outline-none ${isDark ? "bg-[#181419] border-[#29232C] text-white placeholder:text-[#77717A]" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"}`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (linkInput.trim()) {
                  setAttachedLink(linkInput.trim());
                  showSuccess('Link attached to reel');
                } else {
                  setAttachedLink('');
                }
                setLinkSheetOpen(false);
              }}
              className="flex-1 py-3 rounded-full font-bold text-sm bg-[#EC1164] text-white"
            >
              Attach link
            </button>
            {attachedLink && (
              <button
                type="button"
                onClick={() => {
                  setAttachedLink('');
                  setLinkInput('');
                  setLinkSheetOpen(false);
                }}
                className="px-4 py-3 rounded-full font-bold text-sm bg-white/10 text-white"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* ── 13. COVER CHOOSER MODAL ── */}
      <BottomSheet open={coverModalOpen} onClose={() => setCoverModalOpen(false)} title="Select reel cover">
        <div className="pt-2">
          <p className="text-xs text-[#A6A0A8] mb-3">Choose a frame from your reel to use as the cover image.</p>
          <div className="grid grid-cols-3 gap-2 pb-4">
            {s.clips.map((clip, idx) => (
              <div
                key={clip.id}
                onClick={() => {
                  setSelectedCoverIndex(idx);
                  setCoverModalOpen(false);
                  showSuccess(`Cover set to clip ${idx + 1}`);
                }}
                className={`relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                  selectedCoverIndex === idx ? 'border-[#EC1164] scale-[1.02]' : 'border-transparent'
                }`}
              >
                <img src={clip.previewUrl} alt="" className="w-full h-full object-cover" />
                {selectedCoverIndex === idx && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#EC1164] flex items-center justify-center text-white text-[10px] font-bold">
                    ✓
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>

      {/* ── 14. IN-PLACE REEL PREVIEW MODAL ── */}
      {previewModalOpen && (
        <div
          className="fixed inset-0 z-[var(--z-modal,80)] flex flex-col bg-black text-white"
          role="dialog"
          aria-modal="true"
        >
          <header className="flex items-center justify-between px-4 h-14 bg-black/70 backdrop-blur-md absolute top-0 inset-x-0 z-10">
            <button
              type="button"
              onClick={() => setPreviewModalOpen(false)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 text-white"
            >
              <ArrowLeft size={20} />
            </button>
            <p className="font-bold text-sm">Reel preview</p>
            <div className="w-10" />
          </header>
          <div className="flex-1 flex items-center justify-center bg-black">
            {coverUrl ? (
              <div className="relative w-full max-w-sm aspect-[9/16] rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                {s.clips[0]?.kind === 'video' ? (
                  <video
                    src={s.clips[0]?.previewUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img src={coverUrl} alt="Reel preview" className="w-full h-full object-contain" />
                )}
              </div>
            ) : (
              <p className="text-white/50 text-sm">No preview available</p>
            )}
          </div>
        </div>
      )}

      {/* ── 15. PUBLISH PROGRESS OR ERROR OVERLAY ── */}
      {(s.submitting || publishError) && (
        <div
          className="fixed inset-x-0 bottom-0 z-[calc(var(--z-sheet,70)+5)] px-4 pb-5"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
        >
          <div className={`rounded-2xl px-4 py-3.5 border shadow-2xl ${isDark ? "bg-[#181419] border-[#29232C]" : "bg-white border-gray-200"}`}>
            {s.submitting && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {progress?.phase === 'rendering' ? 'Processing video edits…'
                      : progress?.phase === 'uploading' ? 'Uploading reel…'
                      : progress?.phase === 'story' ? 'Sharing to story…'
                      : 'Publishing…'}
                  </span>
                  <span className={`text-xs font-bold ${isDark ? "text-white/60" : "text-gray-500"}`}>{progress?.overall ?? 0}%</span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-200"}`} role="progressbar">
                  <div
                    className="h-full bg-[#EC1164] transition-all duration-300"
                    style={{ width: `${progress?.overall ?? 0}%` }}
                  />
                </div>
              </>
            )}

            {publishError && (
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium">{publishError.message}</p>
                  <div className="flex gap-2 mt-2">
                    {publishError.retryable && (
                      <button
                        type="button"
                        onClick={() => void doPublish(true)}
                        className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#EC1164] text-white"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPublishError(null)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/80"
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
    </div>
  );
}
