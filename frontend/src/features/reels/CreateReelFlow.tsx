import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReelCreatorStore } from './reelCreatorStore';
import CreateStage from './components/CreateStage';
import MusicDiscoveryStage from './components/MusicDiscoveryStage';
import CameraStage from './components/CameraStage';
import PreviewStage from './components/PreviewStage';
import TextOverlayEditor from './components/TextOverlayEditor';
import ClipEditorStage from './components/ClipEditorStage';
import ComposeStage from './components/ComposeStage';
import { AudienceStage, CloseFriendsStage, AudienceListStage, ShareStoryStage } from './components/AudienceStages';
import { ConfirmDiscardDialog, InlineSpinner } from './components/shell';
import { stopPreview } from './services/musicService';
import { resumeDraft, saveDraft, deleteDraft } from './services/draftService';
import { openNativePicker, filesToGalleryItems, probeVideo } from './services/mediaLibraryService';
import type { ReelStage } from './types';
import { logger } from '../../utils/logger';
import { showError, showSuccess } from '../../utils/toast';

const HISTORY_KEY = '__reelFlow';

/**
 * Create reel orchestrator: runs the full-screen stage machine, coordinates
 * Android back / Escape / route exits (with unsaved-changes guard), resumes
 * drafts via ?draft=, and cleans up all media resources on unmount.
 */
export default function CreateReelFlow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftParam = searchParams.get('draft');

  const stage = useReelCreatorStore(s => s.stage);
  const setStage = useReelCreatorStore(s => s.setStage);
  const resetSession = useReelCreatorStore(s => s.resetSession);
  const hasUnsavedChanges = useReelCreatorStore(s => s.hasUnsavedChanges);
  const clips = useReelCreatorStore(s => s.clips);
  const addClips = useReelCreatorStore(s => s.addClips);
  const title = useReelCreatorStore(s => s.title);
  const dirty = useReelCreatorStore(s => s.dirty);

  const [listMode, setListMode] = useState<'hide_from' | 'show_only'>('hide_from');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(!!draftParam);
  const [booting, setBooting] = useState(true);
  const pendingExitRef = useRef<(() => void) | null>(null);
  const stageRef = useRef<ReelStage>(stage);
  const depthRef = useRef(1);
  const draftTrailingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stage sync ref ──
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // ── Boot: push a history entry so Android back steps through the flow ──
  useEffect(() => {
    const state = window.history.state || {};
    window.history.replaceState({ ...state, [HISTORY_KEY]: { stage: stageRef.current, depth: 1 } }, '');
    depthRef.current = 1;

    const onPop = (e: PopStateEvent) => {
      const entry = (e.state as Record<string, unknown> | null)?.[HISTORY_KEY] as
        | { stage: ReelStage; depth: number }
        | undefined;
      if (entry) {
        // Back into the flow — restore that stage
        depthRef.current = entry.depth;
        const target = entry.stage;
        if (target !== stageRef.current) {
          useReelCreatorStore.setState({ stage: target, previousStage: stageRef.current });
        }
        return;
      }
      // Popped below our flow entry → leaving the flow
      if (hasUnsavedChanges()) {
        // Re-anchor the flow entry and ask before leaving
        window.history.pushState(
          { ...(window.history.state || {}), [HISTORY_KEY]: { stage: stageRef.current, depth: depthRef.current } },
          '',
        );
        pendingExitRef.current = () => {
          setDiscardOpen(false);
          window.history.back();
        };
        setDiscardOpen(true);
      }
    };

    window.addEventListener('popstate', onPop);
    const started = { done: false };
    void (async () => {
      try {
        if (draftParam) {
          setLoadingDraft(true);
          const restored = await resumeDraft(draftParam);
          if (restored === 0) {
            showError('The media for this draft is no longer on this device. The text settings were restored.');
          } else {
            showSuccess('Draft restored');
          }
        }
      } catch (err) {
        logger.warn('[ReelFlow] draft resume failed:', err);
        showError('Could not open that draft.');
      } finally {
        setLoadingDraft(false);
        started.done = true;
        setBooting(false);
      }
    })();

    return () => {
      window.removeEventListener('popstate', onPop);
      stopPreview();
      if (draftTrailingSaveRef.current) clearTimeout(draftTrailingSaveRef.current);
      // Session teardown: release every blob preview URL created by this
      // flow (camera/picker/draft-resume) so nothing leaks between sessions.
      useReelCreatorStore.getState().clips.forEach(c => {
        if (c.previewUrl.startsWith('blob:')) {
          try { URL.revokeObjectURL(c.previewUrl); } catch (_) { /* already gone */ }
        }
      });
      void started;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Push a history entry whenever the stage moves forward ──
  const pushStage = useCallback((next: ReelStage) => {
    if (next === stageRef.current) return;
    depthRef.current += 1;
    window.history.pushState(
      { ...(window.history.state || {}), [HISTORY_KEY]: { stage: next, depth: depthRef.current } },
      '',
    );
    setStage(next);
  }, [setStage]);

  // ── Escape = back within the flow (mirrors Android back) ──
  const requestBack = useCallback(() => {
    window.history.back();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // let inputs close their own UI
      if (stageRef.current === 'create') {
        if (hasUnsavedChanges()) {
          pendingExitRef.current = () => setDiscardOpen(false);
          setDiscardOpen(true);
        } else {
          navigate('/dashboard');
        }
      } else {
        requestBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasUnsavedChanges, navigate, requestBack]);

  // ── Body scroll lock while the flow is open ──
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Camera recording → clips ──
  const handleRecorded = useCallback((result: { blob: Blob; durationSec: number; width: number; height: number; mimeType: string }) => {
    const ext = result.mimeType.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([result.blob], `reel-${Date.now()}.${ext}`, { type: result.mimeType || `video/${ext}` });
    if (clips.length >= 10) { showError('You can add up to 10 clips per reel.'); return; }
    addClips([{
      id: `cam_${Date.now()}`,
      kind: 'video',
      previewUrl: URL.createObjectURL(file),
      file,
      storageKey: null,
      durationSec: result.durationSec,
      trimStart: 0,
      trimEnd: null,
      width: result.width,
      height: result.height,
      name: file.name,
    }]);
    pushStage('preview');
  }, [addClips, clips.length, pushStage]);

  // ── Gallery picker from camera stage fallback ──
  const handleOpenPicker = useCallback(async () => {
    try {
      const files = await openNativePicker({ multiple: true, accept: 'image/*,video/*' });
      const picked = (await filesToGalleryItems(files)).slice(0, 10 - clips.length);
      if (!picked.length) return;
      const additions = await Promise.all(picked.map(async g => {
        let durationSec = g.durationSec ?? (g.kind === 'image' ? 3 : 0);
        if (g.kind === 'video' && (!durationSec || durationSec <= 0)) {
          const probeUrl = URL.createObjectURL(g.file);
          try {
            durationSec = (await probeVideo(probeUrl)).durationSec;
          } finally {
            URL.revokeObjectURL(probeUrl);
          }
        }
        return {
          id: g.id,
          kind: g.kind,
          previewUrl: URL.createObjectURL(g.file),
          file: g.file,
          storageKey: null,
          durationSec,
          trimStart: 0,
          trimEnd: null as number | null,
          width: g.width,
          height: g.height,
          name: g.name,
        };
      }));
      addClips(additions);
      showSuccess(`${additions.length} added`);
      pushStage('preview');
    } catch (err) {
      logger.warn('[ReelFlow] picker failed:', err);
      showError('Could not open the file picker.');
    }
  }, [addClips, clips.length, pushStage]);

  // ── Published ──
  const handlePublished = useCallback((momentId: string) => {
    stopPreview();
    const draftId = useReelCreatorStore.getState().draftId;
    if (draftId) {
      // The draft was posted — remove it (record + local media) from this device.
      void deleteDraft(draftId).catch(err => logger.warn('[ReelFlow] draft cleanup failed:', err));
    }
    // Small delay so the success UI registers before teardown
    setTimeout(() => {
      useReelCreatorStore.getState().clips.forEach(c => {
        if (c.previewUrl.startsWith('blob:')) {
          try { URL.revokeObjectURL(c.previewUrl); } catch (_) { /* already gone */ }
        }
      });
      resetSession();
      navigate(`/moments/${momentId}`, { replace: true });
    }, 600);
  }, [navigate, resetSession]);

  // ── Draft saved → close compose, unwind to a fresh create-new-reel page ──
  const handleDraftSaved = useCallback(() => {
    stopPreview();
    // Release this session's clip previews — the composer is closing.
    useReelCreatorStore.getState().clips.forEach(c => {
      if (c.previewUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(c.previewUrl); } catch (_) { /* already gone */ }
      }
    });
    resetSession(); // stage → 'create', dirty → false (no leave-confirm needed)
    const unwind = depthRef.current - 1;
    if (unwind > 0) window.history.go(-unwind);
  }, [resetSession]);

  // ── Discard / leave ──
  const releaseClips = useCallback(() => {
    useReelCreatorStore.getState().clips.forEach(c => {
      if (c.previewUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(c.previewUrl); } catch (_) { /* already gone */ }
      }
    });
  }, []);

  const doDiscard = useCallback(() => {
    stopPreview();
    releaseClips();
    resetSession();
    setDiscardOpen(false);
    const exit = pendingExitRef.current;
    pendingExitRef.current = null;
    if (exit) exit();
    else navigate('/dashboard', { replace: true });
  }, [navigate, releaseClips, resetSession]);

  const keepEditing = useCallback(() => {
    setDiscardOpen(false);
    pendingExitRef.current = null;
  }, []);

  const closeFlow = useCallback(() => {
    if (hasUnsavedChanges()) {
      pendingExitRef.current = null;
      setDiscardOpen(true);
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [hasUnsavedChanges, navigate]);

  // ── Background auto-save for resumed drafts (debounced 8s) ──
  useEffect(() => {
    if (!draftParam || !dirty) return;
    if (draftTrailingSaveRef.current) clearTimeout(draftTrailingSaveRef.current);
    draftTrailingSaveRef.current = setTimeout(() => {
      saveDraft().catch(err => logger.warn('[ReelFlow] autosave failed:', err));
    }, 8000);
    return () => {
      if (draftTrailingSaveRef.current) clearTimeout(draftTrailingSaveRef.current);
    };
  }, [draftParam, dirty, stage, clips, title]);

  const content = useMemo(() => {
    if (loadingDraft || booting) {
      return (
        <div className="fixed inset-0 z-[var(--z-modal,60)] flex flex-col items-center justify-center gap-4" style={{ background: '#0B070C' }}>
          <InlineSpinner size={30} />
          <p className="text-white/70 text-sm">{loadingDraft ? 'Restoring draft…' : 'Preparing…'}</p>
        </div>
      );
    }

    switch (stage) {
      case 'create':
        return (
          <CreateStage
            onOpenMusic={() => pushStage('music')}
            onOpenCamera={() => pushStage('camera')}
            onNext={() => pushStage('preview')}
          />
        );
      case 'music':
        return <MusicDiscoveryStage onBack={requestBack} />;
      case 'camera':
        return (
          <CameraStage
            onClose={requestBack}
            onRecorded={handleRecorded}
            onOpenPicker={() => { void handleOpenPicker(); }}
            onOpenMusic={() => pushStage('music')}
            onNext={() => pushStage('preview')}
          />
        );
      case 'preview':
        return (
          <PreviewStage
            onBack={requestBack}
            onNext={() => pushStage('clipEdit')}
            onOpenMusic={() => pushStage('music')}
            onOpenTextEditor={() => pushStage('text')}
            onAddClip={() => pushStage('camera')}
          />
        );
      case 'text':
        return <TextOverlayEditor onDone={() => pushStage('preview')} />;
      case 'clipEdit':
        return <ClipEditorStage onBack={requestBack} onNext={() => pushStage('compose')} />;
      case 'compose':
        return (
          <ComposeStage
            onBack={requestBack}
            onOpenAudience={() => pushStage('audience')}
            onOpenShareStory={() => pushStage('shareStory')}
            onPublished={handlePublished}
            onDraftSaved={handleDraftSaved}
          />
        );
      case 'audience':
        return (
          <AudienceStage
            onBack={requestBack}
            onOpenCloseFriends={() => pushStage('closeFriends')}
            onOpenList={(mode) => { setListMode(mode); pushStage('audienceList'); }}
          />
        );
      case 'closeFriends':
        return <CloseFriendsStage onBack={requestBack} />;
      case 'audienceList':
        return <AudienceListStage mode={listMode} onBack={requestBack} />;
      case 'shareStory':
        return <ShareStoryStage onBack={requestBack} />;
      case 'mentions':
        return (
          <ComposeStage
            onBack={requestBack}
            onOpenAudience={() => pushStage('audience')}
            onOpenShareStory={() => pushStage('shareStory')}
            onPublished={handlePublished}
            onDraftSaved={handleDraftSaved}
          />
        );
      default:
        return (
          <CreateStage
            onOpenMusic={() => pushStage('music')}
            onOpenCamera={() => pushStage('camera')}
            onNext={() => pushStage('preview')}
          />
        );
    }
  }, [
    booting, loadingDraft, stage, listMode,
    pushStage, requestBack, handleRecorded, handleOpenPicker, handlePublished, handleDraftSaved,
  ]);

  // The create stage renders inside the app shell (not full-screen) so the
  // bottom navigation stays visible — matching the main app layout.
  return (
    <>
      <div className={stage === 'create' ? 'min-h-[100dvh] pb-24' : ''} style={stage === 'create' ? { background: '#0B070C' } : undefined}>
        {stage === 'create' ? (
          <>
            <header
              className="sticky top-0 z-20 flex items-center justify-between px-4 h-14"
              style={{ background: 'rgba(11,7,12,0.96)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <button
                type="button"
                onClick={closeFlow}
                aria-label="Close reel creation"
                className="text-white/80 text-sm font-bold px-2 py-1.5"
              >
                Close
              </button>
              <h1 className="text-white font-extrabold text-[17px]" style={{ fontFamily: "'Varela Round', sans-serif" }}>
                Create reel
              </h1>
              <button
                type="button"
                onClick={() => pushStage('camera')}
                className="text-white/80 text-sm font-bold px-2 py-1.5"
                aria-label="Open camera"
              >
                Camera
              </button>
            </header>
            <CreateStage
              onOpenMusic={() => pushStage('music')}
              onOpenCamera={() => pushStage('camera')}
              onNext={() => pushStage('preview')}
            />
          </>
        ) : (
          content
        )}
      </div>

      <ConfirmDiscardDialog
        open={discardOpen}
        onKeepEditing={keepEditing}
        onDiscard={doDiscard}
      />
    </>
  );
}
