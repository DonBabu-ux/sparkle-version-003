import { showError, showSuccess } from '../utils/toast';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Settings, ChevronLeft, Send, Sparkles, Smile, Camera, Music, Search, Plus, TrendingUp, Type, AtSign, Wand2, Music4, ChevronDown, MapPin, AlignLeft, ArrowRightLeft, AlignCenter, AlignRight, CaseUpper, Pipette, CheckCircle2, Play, Pause, Music3, AlertCircle, Globe, Users, Heart, Lock, Pencil, Film, Save, FolderOpen, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/api';
import { EnvironmentService } from '../services/EnvironmentService';
import { useUserStore } from '../store/userStore';
import StickerPicker from '../components/stories/StickerPicker';
import StickerRenderer from '../components/stories/StickerRenderer';
import InteractiveStickerSheet from '../components/stories/InteractiveStickerSheet';
import { isInteractiveStickerType, type InteractiveStickerConfig, type InteractiveStickerType } from '../components/stories/interactiveStickers';
import LocationPicker from '../components/stories/LocationPicker';
import GifPicker, { type GifItem } from '../components/stories/GifPicker';
import DrawingCanvas, { type DrawingResult } from '../components/stories/DrawingCanvas';
import MentionPicker from '../components/stories/MentionPicker';
import * as storyDrafts from '../services/storyDrafts';
import { CameraService } from '../services/CameraService';
import Spinner from '../components/ui/Spinner';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useCamera } from '../components/camera/CameraProvider';
import CameraPreview from '../components/camera/CameraPreview';
import CameraControls from '../components/camera/CameraControls';
import CameraPermissionsManager from '../components/camera/CameraPermissionsManager';
import { useUploadStore, type UploadJob, type StoryMetadata } from '../store/uploadStore';
import { UploadManager } from '../services/UploadManager';
import { logger } from '../utils/logger';
import { validateFile, validateFiles } from '../utils/fileValidation';
import { audioEventBus } from '../audio/EventBus';
import { UploadEventBus } from '../utils/UploadEventBus';
import {
  createSnapshotHistory,
  pushSnapshot,
  redoSnapshot,
  undoSnapshot,
  canUndoSnapshot,
  canRedoSnapshot,
  type SnapshotHistory,
} from '../utils/storyCache';

type Phase = 'entry' | 'camera' | 'editor' | 'music_picker' | 'template_picker' | 'text_story';
type Mode = 'post' | 'story' | 'reel';

const PALETTES = [
  { name: 'Sunset Sparkle', bg: 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)', text: '#FFFFFF' },
  { name: 'Midnight Neon', bg: 'linear-gradient(135deg, #000428 0%, #004e92 100%)', text: '#00F2FF' },
  { name: 'Spring Bloom', bg: 'linear-gradient(135deg, #00b09b 0%, #96c93d 100%)', text: '#0B3B2E' },
  { name: 'Luxury Gold', bg: 'linear-gradient(135deg, #1f1c2c 0%, #5f5a72 100%)', text: '#FFD700' },
  { name: 'Candy Cloud', bg: 'linear-gradient(135deg, #e94057 0%, #f27121 100%)', text: '#18181B' },
  { name: 'Deep Sea', bg: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)', text: '#E0E0E0' },
];

const FONTS = [
  { id: 'classic', name: 'Classic', class: 'font-sans font-medium' },
  { id: 'modern', name: 'Modern', class: 'font-black italic uppercase tracking-tighter' },
  { id: 'neon', name: 'Neon', class: 'font-mono uppercase tracking-[0.2em] drop-shadow-[0_0_8px_currentColor]' },
  { id: 'elegant', name: 'Elegant', class: 'font-serif italic' },
  { id: 'strong', name: 'Strong', class: 'font-sans font-black uppercase text-[1.2em]' },
  { id: 'typewriter', name: 'Writer', class: 'font-mono font-bold' },
  { id: 'rounded', name: 'Rounded', class: 'font-sans rounded-lg px-4 py-1' },
  { id: 'signature', name: 'Script', class: 'font-serif italic tracking-wide text-[1.1em]' },
];

const TEXT_COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Neon Blue', value: '#00F2FF' },
  { name: 'Gold', value: '#FFD700' },
  { name: 'Hot Pink', value: '#FF007F' },
  { name: 'Lime', value: '#32FF00' },
  { name: 'Violet', value: '#8A2BE2' },
  { name: 'Orange', value: '#FF8C00' },
];

// Prompt suggestions for the "Add Yours" sticker. Engagement counts were
// removed: fabricated numbers must never ship.
const TEMPLATE_PROMPTS = [
  { id: 1, prompt: 'Anything from your Gallery' },
  { id: 2, prompt: 'Mention your favorite people...' },
  { id: 3, prompt: 'Music that saves you' },
  { id: 4, prompt: 'Current mood in 1 pic' },
];



const FILTERS = [
  { id: 'normal', name: 'Normal', css: 'none' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.5) contrast(1.2)' },
  { id: 'bw', name: 'B&W', css: 'grayscale(1)' },
  { id: 'cyber', name: 'Cyber', css: 'hue-rotate(90deg) saturate(2)' },
  { id: 'dream', name: 'Dream', css: 'blur(0.5px) brightness(1.1)' },
];

// Audience options for the story privacy selector. Mirrors the backend
// vocabulary in services/story-audience.service.js.
const AUDIENCE_OPTIONS: { id: string; label: string; description: string }[] = [
  { id: 'public', label: 'Everyone', description: 'Anyone on Sparkle can see this story' },
  { id: 'followers', label: 'Followers', description: 'Only people who follow you' },
  { id: 'close_friends', label: 'Close Friends', description: 'Only people on your close friends list' },
  { id: 'only_me', label: 'Only Me', description: 'Only you can see this story' },
];

const AUDIENCE_LABEL_MAP: Record<string, string> = {
  public: 'Everyone',
  followers: 'Followers',
  close_friends: 'Close Friends',
  only_me: 'Only Me',
};

// Minimal follower row shape used by the close-friends picker.
interface SocialRow {
  user_id?: string;
  id?: string;
  username?: string;
  name?: string;
  avatar_url?: string;
}

// Shape of a sticker placed in the story editor. `config` carries the payload
// the sticker renderer reads (text/color/font for text stickers, prompt/emoji
// for the interactive ones), so it stays intentionally open-ended.
interface EditorSticker {
  id: string;
  type: string;
  config: Record<string, unknown>;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

/**
 * One story card in a multi-page composition. Each page owns its own media and
 * stickers; publishing emits one story job per page. A text-only story keeps
 * `file`/`previewUrl` empty and rides the `isText` flag.
 */
interface StoryPage {
  id: string;
  file: File | null;
  previewUrl: string;
  isVideo: boolean;
  isText: boolean;
  stickers: EditorSticker[];
  /** Video trim window (seconds) → video_start / video_duration. */
  trimStart: number | null;
  trimDuration: number | null;
  /** Cover-frame choice, uploaded as the story thumbnail. */
  coverFile: File | null;
}

// Cache loaded device media across active sessions so it shows automatically next time
let sessionDeviceMediaCache: { file?: File, url: string, isVideo: boolean }[] = [];

export default function CreateStory() {
  const navigate = useNavigate();
  const location = useLocation();
  useUserStore();
  
  const {
    stream,
    hasPermission,
    facingMode,
    flash,
    torchSupported,
    zoomLevel,
    isRecording,
    recordingSeconds,
    requestPermission,
    toggleFacingMode,
    toggleFlash,
    setZoomLevel,
    startCamera,
    stopCamera,
    capturePhoto,
    startVideoRecording,
    stopVideoRecording,
    setMaxRecordingSeconds
  } = useCamera();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);
  
  const searchParams = new URLSearchParams(location.search);
  const parentId = searchParams.get('parent');
  // Shared chat media: /afterglow/create?imageUrl=<https-url>
  const sharedImageUrl = searchParams.get('imageUrl');

  const [phase, setPhase] = useState<Phase>('entry');
  const [returnPhase, setReturnPhase] = useState<Phase>('entry');
  const [mode, setMode] = useState<Mode>('story');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deviceMedia, setDeviceMedia] = useState<{file?: File, url: string, isVideo: boolean}[]>(sessionDeviceMediaCache);
  const deviceFilesInputRef = useRef<HTMLInputElement>(null);

  // ── Multi-select entry → multi-page editor ────────────────────────────────
  // `pageIds` holds the device-media ids picked in the entry grid (checked as
  // "Next (N)"). `pages` is the editor's composition; the single-media flow
  // keeps exactly one page, which is what preserves backward compatibility.
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // ── Media tools / drafts entry surfaces ───────────────────────────────────
  const [showDrawing, setShowDrawing] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showDraftsSheet, setShowDraftsSheet] = useState(false);
  const [draftRecords, setDraftRecords] = useState<storyDrafts.StoryDraftRecord[]>([]);
  const [draftSaving, setDraftSaving] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  // Video trim UI state for the active page (mirrored onto the page on change).
  const [trimStart, setTrimStart] = useState<number | null>(null);
  const [trimDuration, setTrimDuration] = useState<number | null>(null);
  const [mediaDuration, setMediaDuration] = useState(0);
  // Cover-frame preview + the <video> element the scrubber seeks.
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverTime, setCoverTime] = useState(0);
  // Story-mode video cap the user picked in the camera (15s or 60s). The
  // provider is configured with it, so the recording loop enforces the cap.
  const [storyRecordDuration, setStoryRecordDuration] = useState(15);
  const maxRecordingSeconds = useMemo(() => (mode === 'story' ? storyRecordDuration : 60), [mode, storyRecordDuration]);

  // Editor States
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickers, setStickers] = useState<any[]>([]);
  // Interactive sticker (poll/quiz/add yours) currently open in the composer,
  // bound to the placed sticker id when editing an existing one.
  const [stickerEditTarget, setStickerEditTarget] = useState<{ id: string; type: InteractiveStickerType } | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(true);
  const [isPreviewingMusic, setIsPreviewingMusic] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);

  // Music Search States
  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const [musicResults, setMusicResults] = useState<any[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [musicAudioProgress, setMusicAudioProgress] = useState(0);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicSearchTimerRef = useRef<any>(null);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [editorText, setEditorText] = useState('');

  // Story audience/privacy (mirrors the moments audience model)
  const [audience, setAudience] = useState<string>('public');
  const [showAudienceSheet, setShowAudienceSheet] = useState(false);
  const [closeFriends, setCloseFriends] = useState<SocialRow[]>([]);
  const [closeFriendLoading, setCloseFriendLoading] = useState(false);
  const [followerPool, setFollowerPool] = useState<SocialRow[]>([]);

  // Load the close-friends list and the pool of followers to add from when
  // the privacy sheet opens.
  useEffect(() => {
    if (!showAudienceSheet) return;
    let cancelled = false;
    setCloseFriendLoading(true);
    Promise.all([
      api.get('/users/close-friends').catch(() => ({ data: [] })),
      api.get('/users/followers').catch(() => ({ data: [] })),
    ]).then(([cf, fw]) => {
      if (cancelled) return;
      setCloseFriends(Array.isArray(cf.data) ? cf.data : []);
      setFollowerPool(Array.isArray(fw.data) ? fw.data : []);
    }).finally(() => { if (!cancelled) setCloseFriendLoading(false); });
    return () => { cancelled = true; };
  }, [showAudienceSheet]);

  const closeFriendIds = useMemo(
    () => new Set(closeFriends.map((f) => f.user_id).filter(Boolean) as string[]),
    [closeFriends]
  );

  const toggleCloseFriend = useCallback(async (friendId: string) => {
    const exists = closeFriendIds.has(friendId);
    const prev = closeFriends;
    // Optimistic update; revert on failure.
    setCloseFriends(exists
      ? closeFriends.filter((f) => f.user_id !== friendId)
      : [...closeFriends, { user_id: friendId }]);
    try {
      if (exists) await api.delete(`/users/close-friends/${friendId}`);
      else await api.post('/users/close-friends', { userId: friendId });
    } catch {
      setCloseFriends(prev);
      showError('Could not update your close friends list');
    }
  }, [closeFriends, closeFriendIds]);
  
  // Text Story States
  const [textStoryContent, setTextStoryContent] = useState('');
  const [activePalette, setActivePalette] = useState(0);
  const [activeFont, setActiveFont] = useState(0);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [selectedTextColor, setSelectedTextColor] = useState<string | null>(null);
  const [textHighlight, setTextHighlight] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Camera Features States
  const [cameraSpeed, setCameraSpeed] = useState<'1x' | '2x' | '0.5x'>('1x');
  const [cameraTimer, setCameraTimer] = useState<0 | 3 | 10>(0);
  const [cameraLayout, setCameraLayout] = useState<'standard' | 'grid' | 'split'>('standard');
  const [isMagicOn, setIsMagicOn] = useState(false);
  const [isWideAspect, setIsWideAspect] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  useRef<any>(null);

  useEffect(() => {
    if (parentId) {
      setPhase('camera');
      setMode('story');
    }
  }, [parentId]);

  // Seed the editor from a shared chat-media URL (Share to story).
  useEffect(() => {
    if (!sharedImageUrl || !/^https?:\/\//i.test(sharedImageUrl)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(sharedImageUrl, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!blob || blob.size === 0) throw new Error('empty media');
        if (cancelled) return;
        const mimeType = blob.type || 'image/jpeg';
        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
        const sharedFile = new File([blob], `shared-media.${ext}`, { type: mimeType });
        const sharedPreview = URL.createObjectURL(sharedFile);
        setFile(sharedFile);
        setPreviewUrl(sharedPreview);
        openSingleMediaEditor(sharedFile, sharedPreview, mimeType.startsWith('video/'));
        setMode('story');
        setPhase('editor');
      } catch (err) {
        logger.warn('[CreateStory] Failed to load shared imageUrl', err);
        showError('Could not load media for your story');
      }
    })();
    return () => {
      cancelled = true;
    };
    // openSingleMediaEditor is a plain component-scope helper (no state of its
    // own), so re-running the seeding effect on its identity change would just
    // re-fetch the shared media.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedImageUrl]);

  // Leaving the composer mid-preview must stop the music preview.
  useEffect(() => {
    return () => {
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const loadDevicePhotos = async () => {
      // 1. Try native mobile platform folder reading first if we are inside a mobile Capacitor shell
      if (Capacitor.isNativePlatform()) {
        try {
          if (Filesystem.requestPermissions) {
            await Filesystem.requestPermissions();
          }

          const directoriesToTry = [
            { path: 'DCIM/Camera', dir: Directory.ExternalStorage },
            { path: 'DCIM', dir: Directory.ExternalStorage },
            { path: 'Pictures', dir: Directory.ExternalStorage },
            { path: 'DCIM/Camera', dir: Directory.External },
            { path: 'DCIM', dir: Directory.External },
            { path: 'Pictures', dir: Directory.External }
          ];

          let foundFiles: any[] = [];

          for (const target of directoriesToTry) {
            try {
              const result = await Filesystem.readdir({
                path: target.path,
                directory: target.dir
              });

              if (result.files && result.files.length > 0) {
                const validFiles = result.files.filter(f => {
                  const name = f.name.toLowerCase();
                  return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm');
                });

                if (validFiles.length > 0) {
                  const mapped = validFiles.map(f => {
                    const secureUrl = Capacitor.convertFileSrc(f.uri || f.path);
                    const isVideo = f.name.toLowerCase().endsWith('.mp4') || f.name.toLowerCase().endsWith('.mov') || f.name.toLowerCase().endsWith('.webm');
                    return {
                      url: secureUrl,
                      path: f.path || f.uri,
                      isVideo,
                      name: f.name
                    };
                  });
                  foundFiles = [...foundFiles, ...mapped];
                }
              }
            } catch (e) {
              // Directory read error (e.g. permission or not found), try next directory
            }
          }

          if (foundFiles.length > 0) {
            // Sort by name so it shows recent photos first
            foundFiles.sort((a, b) => b.name.localeCompare(a.name));
            const sliced = foundFiles.slice(0, 15);
            
            const list = await Promise.all(sliced.map(async item => {
              try {
                const fileData = await Filesystem.readFile({
                  path: item.path
                });
                
                const byteString = atob(fileData.data);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i);
                }
                const blob = new Blob([ab], { type: item.isVideo ? 'video/mp4' : 'image/jpeg' });
                const fileObj = new File([blob], item.name, { type: item.isVideo ? 'video/mp4' : 'image/jpeg' });
                
                return {
                  file: fileObj,
                  url: item.url,
                  isVideo: item.isVideo
                };
              } catch (err) {
                return {
                  url: item.url,
                  isVideo: item.isVideo
                };
              }
            }));
            
            setDeviceMedia(list);
            sessionDeviceMediaCache = list;
            return;
          }
        } catch (err) {
          logger.error('Failed to load native phone gallery files:', err);
        }
      }

      // 2. Load persisted local storage cache if available
      try {
        const stored = localStorage.getItem('sparkle_device_media_cache');
        if (stored) {
          const list = JSON.parse(stored);
          const mapped = list.map((item: any) => {
            const byteString = atob(item.base64.split(',')[1]);
            const mimeString = item.base64.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });
            const fileObj = new File([blob], item.name, { type: mimeString });
            return {
              file: fileObj,
              url: item.base64,
              isVideo: item.isVideo
            };
          });
          if (mapped.length > 0) {
            setDeviceMedia(mapped);
            sessionDeviceMediaCache = mapped;
            return;
          }
        }
      } catch (e) {
        logger.error('Failed to load local media cache:', e);
      }

      // 3. Fallback on browser: user loads media explicitly via the
      // "Load Media" tile (no auto file-dialog popup — Instagram-style).
    };

    loadDevicePhotos();
  }, []);

  // Start/Stop camera stream lifecycle based on phase.
  // startCamera and stopCamera are stable (no state in deps) so we only
  // depend on phase — this prevents spurious double-starts.
  useEffect(() => {
    if (phase === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Push the mode's capture cap into the camera provider so the recording loop
  // auto-stops. Story mode is capped at 15s (its card is a 15s window); reel
  // mode keeps the longer 60s ceiling.
  useEffect(() => {
    setMaxRecordingSeconds(maxRecordingSeconds);
  }, [maxRecordingSeconds, setMaxRecordingSeconds]);

  // Refresh the draft list whenever the drafts sheet opens.
  useEffect(() => {
    if (showDraftsSheet) void refreshDraftList();
  }, [showDraftsSheet]);

  // Bind active MediaStream to video element ref.
  // videoRef is a ref (stable identity) — excluded from deps intentionally.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        logger.warn('[CreateStory] Auto-play interrupted:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  // --- HANDLERS ---

  const makePageId = () => `pg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const makePage = (input: Partial<StoryPage> & { file: File | null; previewUrl: string; isVideo: boolean }): StoryPage => ({
    id: makePageId(),
    isText: false,
    stickers: [],
    trimStart: null,
    trimDuration: null,
    coverFile: null,
    ...input,
  });

  // The editor's live `stickers`/`file`/`previewUrl` view is the active page.
  // Mirror them back onto the page BEFORE a page switch or a submit, otherwise
  // whatever is being dragged/edited right now would be lost.
  const syncActivePage = (): StoryPage[] => {
    if (activePageIndex < 0 || activePageIndex >= pages.length) return pages;
    const snapshot = pages.map((p, i) =>
      i === activePageIndex ? { ...p, stickers, file, previewUrl } : p
    );
    setPages(snapshot);
    return snapshot;
  };

  const loadPageIntoView = (page: StoryPage | undefined, index: number) => {
    setStickers(page?.stickers ?? []);
    setFile(page?.file ?? null);
    setPreviewUrl(page?.previewUrl ?? '');
    setActivePageIndex(index);
    setTrimStart(page?.trimStart ?? null);
    setTrimDuration(page?.trimDuration ?? null);
  };

  /** Single-media entry (camera capture, one gallery tap, shared image). */
  const openSingleMediaEditor = (file: File | null, previewUrl: string, isVideo = false) => {
    const page = makePage({ file, previewUrl, isVideo, stickers: [] });
    setPages([page]);
    setStickers([]);
    setActivePageIndex(0);
    setTrimStart(null);
    setTrimDuration(null);
  };

  /** Multi-select entry: build one page per picked item and open the editor. */
  const openMultiMediaEditor = (items: { file: File | null; url: string; isVideo: boolean }[]) => {
    const nextPages = items.map(item => makePage({
      file: item.file,
      previewUrl: item.url,
      isVideo: item.isVideo,
      stickers: [],
    }));
    setPages(nextPages);
    setStickers(nextPages[0]?.stickers ?? []);
    setActivePageIndex(0);
    setTrimStart(null);
    setTrimDuration(null);
    setFile(nextPages[0]?.file ?? null);
    setPreviewUrl(nextPages[0]?.previewUrl ?? '');
  };

  const handleSwitchPage = (nextIndex: number) => {
    const snapshot = syncActivePage();
    if (nextIndex < 0 || nextIndex >= snapshot.length) return;
    loadPageIntoView(snapshot[nextIndex], nextIndex);
  };

  /** Persist a media-tool choice (trim window / cover frame) onto its page. */
  const updateActivePageMedia = (updates: Partial<StoryPage>) => {
    setPages(prev => prev.map((p, i) => (i === activePageIndex ? { ...p, ...updates } : p)));
  };

  const handleTrimChange = (start: number | null, duration: number | null) => {
    setTrimStart(start);
    setTrimDuration(duration);
    updateActivePageMedia({ trimStart: start, trimDuration: duration });
  };

  /**
   * Read the frame under the scrubber into a PNG file. The video element is the
   * one already on screen, so the seek is positional (no re-decode).
   */
  const captureCoverFrame = async (timeSec: number): Promise<File | null> => {
    const video = videoPreviewRef.current;
    if (!video) return null;
    try {
      await new Promise<void>((resolve) => {
        const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = Math.max(0, Math.min(timeSec, video.duration || timeSec));
      });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) return null;
      const file = new File([blob], `cover-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setCoverUrl(URL.createObjectURL(file));
      updateActivePageMedia({ coverFile: file });
      return file;
    } catch (err) {
      logger.error('[CreateStory] Cover frame capture failed', err);
      return null;
    }
  };

  const handleCapture = async () => {
    if (cameraTimer > 0 && !isRecording) {
      await new Promise(resolve => setTimeout(resolve, cameraTimer * 1000));
    }

    try {
      // Reel AND story mode record video. The recording loop auto-stops at the
      // cap the provider was configured with (see the effect below).
      if (mode === 'reel' || mode === 'story') {
        if (isRecording) {
          const videoFile = await stopVideoRecording();
          if (videoFile) {
            const objectUrl = URL.createObjectURL(videoFile);
            setPreviewUrl(objectUrl);
            setFile(videoFile);
            openSingleMediaEditor(videoFile, objectUrl);
            setPhase('editor');
          }
        } else {
          startVideoRecording();
        }
        return;
      }

      if (videoRef.current) {
        const dataUrl = await capturePhoto(videoRef.current, activeFilter.css);
        if (dataUrl) {
          setPreviewUrl(dataUrl);
          const blob = await CameraService.convertUriToBlob(dataUrl);
          const fileObj = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });

          // Image compression integration
          const compressedFile = await CameraService.compressImage(fileObj);

          setFile(compressedFile);
          openSingleMediaEditor(compressedFile, dataUrl);
          setPhase('editor');
        }
      }
    } catch (e) {
      logger.error('In-app media capture failed:', e);
    }
  };

  const handleGalleryClick = () => fileInputRef.current?.click();

  // ── Entry-grid multi-select → multi-page editor ────────────────────────────
  // Each entry tile is identified by its device-media key so the same file
  // picked twice stays a single selection.
  const mediaKeyOf = (item: { file?: File, url: string, isVideo: boolean }, i: number) =>
    item.file ? `${item.file.name}:${item.file.size}:${item.file.lastModified}` : item.url || `media-${i}`;

  const togglePageSelection = (key: string) => {
    setPageIds(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  };

  const confirmMultiSelection = () => {
    const picked = deviceMedia
      .map((item, i) => ({ item, key: mediaKeyOf(item, i) }))
      .filter(({ key }) => pageIds.includes(key))
      .map(({ item }) => item);
    if (picked.length === 0) return;
    if (picked.length === 1) {
      handleSelectDeviceMedia(picked[0]);
    } else {
      openMultiMediaEditor(picked);
      setPhase('editor');
    }
    setPageIds([]);
  };

  // ── Drafts ─────────────────────────────────────────────────────────────────
  const refreshDraftList = async () => {
    try {
      const drafts = await storyDrafts.listDrafts();
      setDraftRecords(drafts.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    } catch (err) {
      logger.error('[CreateStory] Failed to list drafts', err);
    }
  };

  const handleSaveDraft = async () => {
    setDraftSaving(true);
    try {
      const snapshot = syncActivePage();
      const draftId = activeDraftId || storyDrafts.newDraftId();
      const mediaRefs: Array<{ key: string; name: string; kind: string; isVideo: boolean; storageBytes: number }> = [];
      const pagePayload: Array<Omit<storyDrafts.StoryDraftPage, 'mediaKey'>> = [];
      for (const page of snapshot) {
        let mediaKey: string | null = null;
        if (page.file) {
          mediaKey = `story-${draftId}-${page.id}`;
          await storyDrafts.saveStoryMedia(mediaKey, page.file);
          mediaRefs.push({
            key: mediaKey,
            name: page.file.name,
            kind: page.file.type.startsWith('video/') ? 'video' : 'image',
            isVideo: page.isVideo,
            storageBytes: page.file.size,
          });
        }
        if (page.coverFile) {
          await storyDrafts.saveStoryMedia(`story-cover-${draftId}-${page.id}`, page.coverFile);
        }
        pagePayload.push({
          id: page.id,
          kind: page.isText ? 'text' : page.isVideo ? 'video' : 'image',
          name: page.file?.name || 'page',
          stickers: page.stickers,
          isVideo: page.isVideo,
          trimStart: page.trimStart,
          trimDuration: page.trimDuration,
          coverUrl: null,
          mediaKey,
        });
      }
      await storyDrafts.saveDraft(storyDrafts.buildDraftRecord({
        draftId,
        title: caption.trim() || 'Story draft',
        pages: pagePayload,
        mediaRefs,
        stickers: snapshot[0]?.stickers ?? [],
        selectedMusic,
        audience,
        textStoryContent: textStoryContent || '',
        editorText: editorText || '',
        mode,
      }));
      setActiveDraftId(draftId);
      showSuccess('Draft saved');
    } catch (err) {
      logger.error('[CreateStory] Failed to save draft', err);
      showError('Could not save draft');
    } finally {
      setDraftSaving(false);
    }
  };

  const handleResumeDraft = async (draftId: string) => {
    try {
      const draft = await storyDrafts.getDraft(draftId);
      if (!draft) { showError('Draft not found'); return; }
      const restored = await storyDrafts.loadDraftMedia(draft);
      const nextPages: StoryPage[] = restored.map(page => makePage({
        id: page.id,
        file: null,
        previewUrl: page.previewUrl,
        isVideo: page.isVideo,
        isText: page.kind === 'text',
        stickers: (page.stickers as EditorSticker[]) ?? [],
        trimStart: page.trimStart ?? null,
        trimDuration: page.trimDuration ?? null,
      }));
      if (nextPages.length === 0) { showError('Draft media is no longer available'); return; }
      // Reload the blobs as Files so the upload worker gets real media back.
      const withFiles = await Promise.all(nextPages.map(async (page, idx) => {
        const ref = (draft.mediaRefs || [])[idx];
        if (!ref) return page;
        const blob = await storyDrafts.getStoryMedia(ref.key);
        if (!blob) return page;
        const file = new File([blob], ref.name || 'media', { type: blob.type || (ref.isVideo ? 'video/mp4' : 'image/jpeg') });
        return { ...page, file, previewUrl: URL.createObjectURL(file) };
      }));
      setPages(withFiles);
      setFile(withFiles[0].file);
      setPreviewUrl(withFiles[0].previewUrl);
      setStickers(withFiles[0].stickers);
      setActivePageIndex(0);
      setSelectedMusic(draft.metadata.selectedMusic ?? null);
      setAudience(draft.metadata.audience || 'public');
      setCaption(draft.metadata.editorText || '');
      if (draft.metadata.textStoryContent) setTextStoryContent(draft.metadata.textStoryContent);
      setActiveDraftId(draftId);
      setShowDraftsSheet(false);
      setPhase('editor');
      showSuccess('Draft restored');
    } catch (err) {
      logger.error('[CreateStory] Failed to resume draft', err);
      showError('Could not restore draft');
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      await storyDrafts.deleteStoryDraft(draftId);
      setDraftRecords(prev => prev.filter(d => d.draft_id !== draftId));
      if (activeDraftId === draftId) setActiveDraftId(null);
    } catch (err) {
      logger.error('[CreateStory] Failed to delete draft', err);
    }
  };

  const handleSelectDeviceMedia = async (item: { file?: File, url: string, isVideo: boolean }) => {
    if (item.file) {
      const isVideo = item.isVideo || item.file.type.startsWith('video/');
      setFile(item.file);
      setPreviewUrl(item.url);
      openSingleMediaEditor(item.file, item.url, isVideo);
      setPhase('editor');
    } else {
      setUploading(true);
      try {
        const response = await fetch(item.url);
        const blob = await response.blob();
        const mimeType = blob.type || 'image/jpeg';
        const extension = mimeType.split('/')[1] || 'jpg';
        const fileObj = new File([blob], `device-${Date.now()}.${extension}`, { type: mimeType });
        setFile(fileObj);
        setPreviewUrl(item.url);
        openSingleMediaEditor(fileObj, item.url, item.isVideo);
        setPhase('editor');
      } catch (err) {
        logger.error('Failed to load remote media:', err);
        setPreviewUrl(item.url);
        openSingleMediaEditor(null, item.url, item.isVideo);
        setPhase('editor');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDeviceFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const check = validateFiles(selectedFiles, { kind: 'any', maxSizeMB: 20 });
      if (!check.ok) {
        showError(check.error!);
        e.target.value = '';
        return;
      }
      const mediaList = selectedFiles.map(fileObj => ({
        file: fileObj,
        url: URL.createObjectURL(fileObj),
        isVideo: fileObj.type.startsWith('video/')
      }));
      setDeviceMedia(prev => {
        const updated = [...mediaList, ...prev];
        sessionDeviceMediaCache = updated;
        return updated;
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      logger.log('File selected:', selectedFile.name, selectedFile.type, selectedFile.size);

      const check = validateFile(selectedFile, { kind: 'any', maxSizeMB: 20 });
      if (!check.ok) {
        showError(check.error!);
        e.target.value = '';
        return;
      }
      
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }

      setFile(selectedFile);
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      openSingleMediaEditor(selectedFile, objectUrl, selectedFile.type.startsWith('video/'));
      setPhase('editor');
    }
  };

  const handleTemplateSelect = (template: any) => {
    setStickers([{ id: 'st-' + Date.now(), type: 'add_yours', config: { prompt: template.prompt, avatars: [], responses_count: template.count }, x: 50, y: 35, scale: 1, rotation: 0 }]);
    setPhase('camera');
  };

  const fetchMusicTracks = useCallback(async (query: string) => {
    setMusicLoading(true);
    setMusicError(null);
    try {
      const params = new URLSearchParams({ per_page: '20' });
      if (query.trim()) params.set('q', query.trim());
      // Match the same token resolution as api.ts interceptor
      const token = useUserStore.getState().token || '';
      const res = await fetch(`${EnvironmentService.getApiBaseUrl()}/music/search?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setMusicResults(data.tracks || []);
      } else {
        setMusicError(data.message || 'Could not load music.');
      }
    } catch (err) {
      setMusicError('Network error. Please check your connection.');
    } finally {
      setMusicLoading(false);
    }
  }, []);

  const openMusicPicker = (fromPhase: Phase) => {
    setReturnPhase(fromPhase);
    setPhase('music_picker');
    setIsPreviewingMusic(false);
    // Load trending tracks on open if results are empty
    if (musicResults.length === 0) {
      fetchMusicTracks('');
    }
  };

  // Debounced search
  useEffect(() => {
    if (phase !== 'music_picker') return;
    clearTimeout(musicSearchTimerRef.current);
    musicSearchTimerRef.current = setTimeout(() => {
      fetchMusicTracks(musicSearchQuery);
    }, 450);
    return () => clearTimeout(musicSearchTimerRef.current);
  }, [musicSearchQuery, phase, fetchMusicTracks]);

  const handleMusicClick = (music: any) => {
    // Stop any currently playing preview
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;
    }
    setSelectedMusic(music);
    setIsPreviewingMusic(true);
    setIsPlayingMusic(true);
    setMusicAudioProgress(0);
    // Start audio preview
    if (music.audioUrl) {
      const audio = new Audio(music.audioUrl);
      audio.crossOrigin = 'anonymous';
      musicAudioRef.current = audio;
      audio.ontimeupdate = () => {
        if (audio.duration) {
          setMusicAudioProgress(Math.round((audio.currentTime / audio.duration) * 100));
        }
      };
      audio.onended = () => setIsPlayingMusic(false);
      audio.play().catch(() => {});
    }
  };

  const toggleMusicPlayback = () => {
    const audio = musicAudioRef.current;
    if (!audio) return;
    if (isPlayingMusic) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlayingMusic(!isPlayingMusic);
  };

  const handleMusicConfirm = () => {
    // Keep audio playing in picker — stop it when phase changes away
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;
    }
    setPhase(returnPhase);
    setIsPreviewingMusic(false);
  };

  const handleMusicRemove = () => {
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;
    }
    setSelectedMusic(null);
    setIsPlayingMusic(false);
    setMusicAudioProgress(0);
  };

  // ── Music window (15s) scrubber ────────────────────────────────────────────
  // `selectedMusic.start` is where the story's 15-second music window begins.
  // `duration` on the track record is the full track length, so the playhead
  // must be clamped to duration - WINDOW to keep the whole window in range.
  const MUSIC_WINDOW_SEC = 15;

  const musicTrackDuration = useMemo(() => {
    const d = Number(selectedMusic?.duration);
    return Number.isFinite(d) && d > 0 ? d : MUSIC_WINDOW_SEC;
  }, [selectedMusic]);

  const musicWindowEnd = useMemo(() => {
    const start = Number(selectedMusic?.start) || 0;
    return Math.min(start + MUSIC_WINDOW_SEC, musicTrackDuration);
  }, [selectedMusic, musicTrackDuration]);

  /** Draggable playhead: rewinds the preview and stores the new window start. */
  const handleMusicScrub = (seconds: number) => {
    if (!selectedMusic) return;
    const maxStart = Math.max(0, musicTrackDuration - MUSIC_WINDOW_SEC);
    const next = Math.max(0, Math.min(seconds, maxStart));
    setSelectedMusic({ ...selectedMusic, start: next, duration: MUSIC_WINDOW_SEC });
    setMusicAudioProgress(Math.round((next / musicTrackDuration) * 100));
    const audio = musicAudioRef.current;
    if (audio) {
      audio.currentTime = next;
      audio.play().catch(() => {});
      setIsPlayingMusic(true);
    }
  };

  // Format seconds → m:ss
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Haptics go through the shared audio event bus so they respect the user's
  // haptics setting (HapticManager subscribes to 'trigger_haptic' there).
  const triggerHaptic = (type: 'click' | 'success') => {
    audioEventBus.emit('trigger_haptic', type);
  };

  // ── Editor overlay text styling (text/mention tool) ──
  const [overlayFontId, setOverlayFontId] = useState<string>(FONTS[0].id);
  const [overlayAlign, setOverlayAlign] = useState<'left' | 'center' | 'right'>('center');
  const [overlayColor, setOverlayColor] = useState<string>(TEXT_COLORS[0].value);
  const [overlayHighlight, setOverlayHighlight] = useState(false);

  // ── Caption / save-to-device (story metadata, sent with the upload) ──
  const [caption, setCaption] = useState('');
  const [saveToGallery, setSaveToGallery] = useState(false);

  // ── Undo/redo for sticker + text placements ──
  const [stickerHistory, setStickerHistory] = useState<SnapshotHistory<EditorSticker[]>>(() => createSnapshotHistory<EditorSticker[]>([]));
  const canUndo = canUndoSnapshot(stickerHistory);
  const canRedo = canRedoSnapshot(stickerHistory);

  /** Applies a sticker array and records the previous one as an undo step. */
  const commitStickers = (next: EditorSticker[]) => {
    setStickerHistory(prev => pushSnapshot(prev, stickers));
    setStickers(next);
  };

  // Stable undo/redo: the latest stack lives in a ref so the handlers keep a
  // fixed identity (the keyboard effect re-subscribes otherwise).
  const stickerHistoryRef = useRef(stickerHistory);
  stickerHistoryRef.current = stickerHistory;

  const applyHistoryStep = useCallback((direction: 'undo' | 'redo') => {
    const current = stickerHistoryRef.current;
    const next = direction === 'undo' ? undoSnapshot(current) : redoSnapshot(current);
    if (next === current) return;
    setStickerHistory(next);
    setStickers(next.present);
  }, []);

  const handleUndoStickers = useCallback(() => applyHistoryStep('undo'), [applyHistoryStep]);
  const handleRedoStickers = useCallback(() => applyHistoryStep('redo'), [applyHistoryStep]);

  // Ctrl+Z / Ctrl+Shift+Z undo/redo while the editor is open. Typing in a
  // field keeps its native undo, so the shortcut steps aside there.
  useEffect(() => {
    if (phase !== 'editor') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) handleRedoStickers();
      else handleUndoStickers();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleUndoStickers, handleRedoStickers]);

  // Publish confirmation: the upload keeps running in the background, but the
  // composer should feel the success the same way a direct upload does.
  useEffect(() => {
    const off = UploadEventBus.on('UPLOAD_COMPLETED', () => triggerHaptic('success'));
    return off;
  }, []);

  const handleAddTextSticker = (content: string, type: 'text' | 'mention' = 'text') => {
    if (!content.trim()) return;
    const cleanContent = type === 'mention' && !content.startsWith('@') ? `@${content}` : content;
    const chosenFont = FONTS.find(f => f.id === overlayFontId) || FONTS[0];
    commitStickers([...stickers, {
      id: 'st-' + Date.now(),
      type: 'text',
      config: {
        text: cleanContent,
        color: overlayColor,
        font: chosenFont,
        align: overlayAlign,
        highlight: overlayHighlight,
      },
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0
    }]);
    triggerHaptic('click');
    setEditorText('');
    setActiveTool(null);
  };

  // Saves an edited config back onto a placed sticker (poll/quiz/add yours).
  const handleStickerConfigSave = (id: string, config: InteractiveStickerConfig) => {
    setStickers(prev => prev.map(s => s.id === id ? { ...s, config } : s));
    setStickerEditTarget(null);
  };

  const handleSubmit = async () => {
      if (!file && !selectedMusic && phase !== 'text_story') {
        showError('Capture or select something first');
        return;
      }
      logger.log('Submission started. Mode:', mode, 'File:', file?.name, 'Type:', file?.type, 'Size:', file?.size);
      setUploading(true);
      try {
          // ── STORY MODE: Background queue (instant close) ──
          if (mode === 'story') {
              // Multi-page: one upload job per page. Single-media keeps its
              // original one-page path (publishing the legacy flat state).
              const storyPages: StoryPage[] = pages.length > 0
                ? syncActivePage()
                : [{ ...makePage({ file, previewUrl: previewUrl ?? '', isVideo: !!file?.type.startsWith('video/'), stickers }) }];

              // The 15s music window ride the FIRST page's job; every later
              // page's story carries no music layer (its own duration owns it).
              const musicPayload = selectedMusic ? JSON.stringify(selectedMusic) : undefined;

              for (const [pageIndex, page] of storyPages.entries()) {
                const uploadId = `story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

                // --- Compile Generic StoryLayer Array ---
                const compiledLayers: any[] = [];

                // 1. Convert stickers → layers
                (page.stickers || []).forEach((st: any, idx: number) => {
                  compiledLayers.push({
                    id: st.id || `st-${idx}-${Date.now()}`,
                    type: st.type || 'emoji',
                    x: st.x ?? 50,
                    y: st.y ?? 50,
                    scale: st.scale ?? 1,
                    rotation: st.rotation ?? 0,
                    opacity: 1,
                    zIndex: idx + 1,
                    locked: false,
                    hidden: false,
                    data: st.config || st.data || {}
                  });
                });

                // 2. Convert selected music → music layer (first page only)
                if (selectedMusic && pageIndex === 0) {
                  compiledLayers.push({
                    id: `music-${Date.now()}`,
                    type: 'music',
                    x: 50,
                    y: 75,
                    scale: 1,
                    rotation: 0,
                    opacity: 1,
                    zIndex: 20,
                    locked: false,
                    hidden: false,
                    data: {
                      trackId: selectedMusic.id || selectedMusic.trackId || 'unknown',
                      title: selectedMusic.title || 'Unknown Track',
                      artist: selectedMusic.artist || selectedMusic.artistName || 'Unknown Artist',
                      url: selectedMusic.audioUrl || selectedMusic.url || '',
                      start: selectedMusic.start || 0,
                      duration: selectedMusic.duration || 15,
                      style: selectedMusic.style || 1,
                      thumbnailUrl: selectedMusic.thumbnailUrl || selectedMusic.artwork || null,
                    }
                  });
                }

                // 3. Add text layer for text stories
                if (phase === 'text_story' && textStoryContent) {
                  compiledLayers.push({
                    id: `text-${Date.now()}`,
                    type: 'text',
                    x: 50,
                    y: 50,
                    scale: 1,
                    rotation: 0,
                    opacity: 1,
                    zIndex: 10,
                    locked: true,
                    hidden: false,
                    data: {
                      text: textStoryContent,
                      font: FONTS[activeFont],
                      color: selectedTextColor || PALETTES[activePalette].text,
                      highlight: textHighlight,
                      align: textAlign,
                    }
                  });
                }

                // Build serializable metadata
                const metadata: StoryMetadata = {
                  stickers: JSON.stringify(page.stickers || []),
                  parentStoryId: parentId || undefined,
                  musicInfo: pageIndex === 0 ? musicPayload : undefined,
                  storyLayers: JSON.stringify(compiledLayers),
                  storyDuration: page.isVideo || page.file?.type.startsWith('video/') ? undefined : 10,
                  audience,
                  caption: caption.trim() || undefined,
                  save_to_gallery: saveToGallery,
                  videoStart: page.isVideo && page.trimStart ? page.trimStart : undefined,
                  videoDuration: page.isVideo && page.trimDuration ? page.trimDuration : undefined,
                };
                // The caption belongs to the story as a whole — only the first
                // page's job carries it, so a multi-page publish doesn't stamp
                // the same text onto every card.
                if (pageIndex > 0) metadata.caption = undefined;
                if (phase === 'text_story') {
                  metadata.textContent = textStoryContent;
                  metadata.textConfig = JSON.stringify({
                    palette: PALETTES[activePalette],
                    font: FONTS[activeFont],
                    align: textAlign,
                    color: selectedTextColor || PALETTES[activePalette].text,
                    highlight: textHighlight,
                  });
                }

                // Create a local preview URL for the optimistic ring
                const localUri = page.file ? URL.createObjectURL(page.file) : '';

                const job: UploadJob = {
                  uploadId,
                  type: 'STORY',
                  priority: 'NORMAL',
                  localUri,
                  thumbnailUri: page.coverFile ? URL.createObjectURL(page.coverFile) : null,
                  status: 'QUEUED',
                  progress: 0,
                  retryCount: 0,
                  error: null,
                  metadata,
                };

                // Queue the job (file goes into IndexedDB, job goes into persisted store)
                if (page.file) {
                  await useUploadStore.getState().addJob(job, page.file);
                } else {
                  // Text-only story: no file, but still queue the job
                  await useUploadStore.getState().addJob(job, new File([], 'text-story-placeholder'));
                }
              }

              // Wake the upload manager to pick up the new jobs. A page's cover
              // frame rides job.thumbnailUri; the worker only auto-generates a
              // thumbnail when that is unset, so the chosen frame survives.
              UploadManager.wake();

              // Published: purge the draft this session was editing.
              if (activeDraftId) {
                void storyDrafts.deleteStoryDraft(activeDraftId).catch(err =>
                  logger.error('[CreateStory] Draft purge after publish failed', err)
                );
                setActiveDraftId(null);
              }

              logger.log(`✅ Story queued for background upload (${storyPages.length} page(s))`);
              sessionStorage.setItem('sparkle_story_posted', '1');
              // Publish feedback on this page: the upload continues in the
              // background, but the user must see a confirmation here rather
              // than being shipped to a dashboard with no signal.
              showSuccess('Story pushed - uploading in the background');
              navigate('/dashboard');
              return; // Exit early — upload happens in background
          }

          // ── POST / REEL / LIVE: Traditional upload (unchanged) ──
          const formData = new FormData();
          if (file) {
              logger.log('Appending media to FormData:', file.name);
              formData.append('media', file);
          }
          if (phase === 'text_story') {
              formData.append('text_content', textStoryContent);
              formData.append('text_config', JSON.stringify({ palette: PALETTES[activePalette], font: FONTS[activeFont], align: textAlign, color: selectedTextColor || PALETTES[activePalette].text, highlight: textHighlight }));
          }

          if (mode === 'post') {
              formData.append('content', editorText || textStoryContent || '');
              formData.append('post_type', 'public');
              await api.post('/posts', formData);
              showSuccess('Post published');
              navigate('/dashboard');
          } else if (mode === 'reel') {
              formData.append('caption', editorText || textStoryContent || '');
              await api.post('/moments', formData);
              showSuccess('Reel shared');
              navigate('/moments');
          }
      } catch (e) {
          logger.error('Upload failed', e);
          showError('Upload failed - it was saved and will retry automatically.');
      } finally {
          setUploading(false);
      }
  };

  // --- GENIUS COMPONENTS ---
  const MusicIndicator = () => (
    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-16 left-1/2 -translate-x-1/2 z-[400] flex items-center justify-center pointer-events-none">
        <div className="bg-black/20 backdrop-blur-3xl border border-white/20 rounded-full py-2.5 px-4 flex items-center gap-3 pointer-events-auto active:scale-95 transition-all shadow-2xl" onClick={() => openMusicPicker(phase)}>
            <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center shadow-lg overflow-hidden shrink-0">
                {selectedMusic?.thumbnailUrl ? (
                  <img src={selectedMusic.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}>
                    <Music3 size={14} className="text-white" />
                  </motion.div>
                )}
            </div>
            <div className="flex flex-col max-w-[110px]">
                <span className="text-sm font-semibold text-white truncate">{selectedMusic?.title}</span>
                <span className="text-xs font-medium text-white/70 truncate">{selectedMusic?.artist}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleMusicRemove(); }} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white active:bg-white/20">
                <X size={12} strokeWidth={3} />
            </button>
        </div>
    </motion.div>
  );

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none safe-area-top safe-area-bottom">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
      <input type="file" ref={deviceFilesInputRef} className="hidden" multiple accept="image/*,video/*" onChange={handleDeviceFilesChange} />
      
      {/* Universal Music Pill */}
      {selectedMusic && phase !== 'music_picker' && phase !== 'entry' && phase !== 'template_picker' && <MusicIndicator />}

      <AnimatePresence mode="wait">
          {/* 1. ENTRY PHASE — Instagram/WhatsApp style: one clean gallery picker */}
          {phase === 'entry' && (
              <motion.div key="entry" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute inset-0 bg-[#f8e7ed] dark:bg-zinc-900 text-[#18181b] dark:text-zinc-100 z-[200] flex flex-col">
                  <div className="p-6 flex items-center justify-between border-b border-[#ede3e9] dark:border-zinc-900">
                      <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full text-slate-600 dark:text-zinc-300 hover:bg-[#ede3e9] dark:hover:bg-zinc-700 transition-colors"><X size={28} strokeWidth={3} /></button>
                      <h2 className="text-lg font-bold flex-1 text-center text-[#18181b] dark:text-zinc-100">Add to story</h2>
                      <button onClick={() => { void refreshDraftList(); setShowDraftsSheet(true); }} className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 text-sm font-semibold text-[#ff1493] hover:bg-[#ede3e9] dark:hover:bg-zinc-700 transition-colors">Drafts <FolderOpen size={14} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                      <div className="grid grid-cols-3 gap-3">
                          <button onClick={() => { setPhase('camera'); setMode('story'); }} className="row-span-2 col-span-1 rounded-3xl bg-[#fdf8fa] dark:bg-zinc-800 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 hover:border-[#ff1493] transition-colors">
                              <Camera size={32} strokeWidth={2} className="text-[#ff1493]" />
                               <span className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Camera</span>
                          </button>
                          {/* Type mode — text-only stories, no media required */}
                          <button
                              onClick={() => { setMode('story'); setPhase('text_story'); }}
                               className="rounded-3xl bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 flex flex-col items-center justify-center gap-3 aspect-square active:scale-95 transition-all shadow-sm hover:border-[#ff1493]"
                           >
                               <Type size={28} strokeWidth={2} className="text-[#ff1493]" />
                                <span className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Type</span>
                           </button>
                          {deviceMedia.map((item, i) => {
                              const key = mediaKeyOf(item, i);
                              const isPicked = pageIds.includes(key);
                              const pickOrder = pageIds.indexOf(key) + 1;
                              return (
                                  <button
                                      key={`media-${i}`}
                                      onClick={() => togglePageSelection(key)}
                                      aria-pressed={isPicked}
                                      aria-label={`Select media ${i + 1}${isPicked ? ', selected' : ''}`}
                                      className={`rounded-3xl bg-[#fdf8fa] dark:bg-zinc-800 relative overflow-hidden active:scale-95 transition-transform border group ${i === 0 ? 'aspect-[3/4]' : 'aspect-square'} ${isPicked ? 'border-[#ff1493]' : 'border-[#e6d8e1] dark:border-zinc-700'}`}
                                  >
                                      {item.isVideo || (item.file && item.file.type.startsWith('video/')) ? (
                                          <video
                                              src={item.url}
                                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                              muted
                                              playsInline
                                          />
                                      ) : (
                                          <img
                                              src={item.url}
                                              alt=""
                                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                          />
                                      )}
                                      <div className={`absolute inset-0 transition-colors ${isPicked ? 'bg-[#ff1493]/20' : 'bg-black/0 group-hover:bg-black/0'}`} />
                                      {/* Selection badge: order in the page strip */}
                                      <span
                                          aria-hidden="true"
                                          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${isPicked ? 'bg-[#ff1493] text-white scale-110' : 'bg-[#fdf8fa] dark:bg-zinc-800 border-2 border-[#e6d8e1] dark:border-zinc-700 text-transparent'}`}
                                      >
                                          {pickOrder || ''}
                                      </span>
                                  </button>
                              );
                          })}
                          {/* Load-more tile — lets users pick additional local files */}
                          <button
                              onClick={() => deviceFilesInputRef.current?.click()}
                              className="rounded-3xl bg-[#f6eef3] dark:bg-zinc-900 flex flex-col items-center justify-center gap-2 border border-dashed border-[#e6d8e1] dark:border-zinc-700 hover:border-[#ff1493] active:scale-95 transition-all group aspect-square"
                          >
                              <Plus size={24} strokeWidth={2} className="text-slate-600 dark:text-zinc-300 group-hover:text-[#ff1493] transition-colors" />
                              <span className="text-sm font-semibold text-slate-600 dark:text-zinc-300 group-hover:text-[#ff1493] transition-colors">Load media</span>
                          </button>
                      </div>
                      {deviceMedia.length === 0 && (
                          <p className="text-center text-sm text-slate-600 dark:text-zinc-300 mt-10">
                              No photos loaded yet — tap “Load media” to pick images or videos.
                          </p>
                      )}
                  </div>
                  {/* Multi-select action: opens the editor with one page per pick */}
                  <AnimatePresence>
                      {pageIds.length > 0 && (
                          <motion.div
                              initial={{ y: 60, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: 60, opacity: 0 }}
                              className="absolute bottom-8 left-0 right-0 px-6 z-10"
                          >
                              <div className="flex items-center gap-3">
                                  <button
                                      onClick={() => setPageIds([])}
                                      className="h-14 px-6 rounded-full bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 text-sm font-semibold text-[#18181b] dark:text-zinc-100 hover:bg-[#ede3e9] dark:hover:bg-zinc-700 active:scale-95 transition-colors"
                                  >
                                      Clear
                                  </button>
                                  <button
                                      onClick={confirmMultiSelection}
                                      className="h-14 flex-1 bg-[#ff1493] hover:bg-[#ff2d87] text-white rounded-full text-sm font-semibold active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                                  >
                                      <span>Next ({pageIds.length})</span>
                                      <Layers size={18} strokeWidth={3} />
                                  </button>
                              </div>
                          </motion.div>
                      )}
                  </AnimatePresence>
              </motion.div>
          )}

          {/* Drafts sheet — resumes a saved editor session */}
          <AnimatePresence>
              {showDraftsSheet && (
                  <motion.div
                      key="drafts-sheet"
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                      className="absolute inset-x-0 bottom-0 top-16 z-[650] bg-[#fdf8fa] dark:bg-zinc-800 rounded-t-[40px] px-6 pt-6 pb-10 flex flex-col"
                      role="dialog"
                      aria-label="Story drafts"
                  >
                      <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#e6d8e1] dark:bg-zinc-700" />
                      <div className="flex items-center justify-between mb-6">
                          <h2 className="text-lg font-bold text-[#18181b] dark:text-zinc-100">Drafts</h2>
                          <button onClick={() => setShowDraftsSheet(false)} aria-label="Close drafts" className="w-10 h-10 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-[#ede3e9] dark:hover:bg-zinc-600 transition-colors"><X size={20} /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto no-scrollbar">
                          {draftRecords.length === 0 ? (
                              <p className="text-center text-sm text-slate-600 dark:text-zinc-300 mt-16">
                                  No drafts yet — compose a story, then tap “Save draft”.
                              </p>
                          ) : (
                              <div className="flex flex-col gap-3">
                                  {draftRecords.map((draft) => (
                                      <div key={draft.draft_id} className="flex items-center gap-3 p-3 rounded-2xl bg-[#f6eef3] dark:bg-zinc-900">
                                          <div className="w-12 h-12 rounded-2xl bg-[#f0e5ec] dark:bg-zinc-700 flex items-center justify-center shrink-0">
                                              <Film size={20} className="text-[#ff1493]" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <p className="text-sm font-semibold text-[#18181b] dark:text-zinc-100 truncate">{draft.title || 'Story draft'}</p>
                                              <p className="text-xs text-slate-600 dark:text-zinc-300">
                                                  {(draft.metadata?.pages?.length ?? 0)} page(s) · {new Date(draft.updated_at).toLocaleDateString()}
                                              </p>
                                          </div>
                                          <button
                                              onClick={() => handleResumeDraft(draft.draft_id)}
                                              className="h-10 px-5 rounded-full bg-[#ff1493] hover:bg-[#ff2d87] text-white text-sm font-semibold active:scale-95 transition-all"
                                          >
                                              Resume
                                          </button>
                                          <button
                                              onClick={() => handleDeleteDraft(draft.draft_id)}
                                              aria-label={`Delete draft ${draft.title || ''}`}
                                              className="w-10 h-10 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-[#ede3e9] dark:hover:bg-zinc-600 transition-colors"
                                          >
                                              <X size={16} />
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </motion.div>
              )}
          </AnimatePresence>

          {/* 2. TEXT STORY PHASE */}
          {phase === 'text_story' && (
              <motion.div key="text_story" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[500] flex flex-col" style={{ background: PALETTES[activePalette].bg }}>
                  <div className="p-10 pt-16 flex items-center justify-between z-10">
                      <button onClick={() => setPhase('entry')} className="w-12 h-12 bg-black/20 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white"><X size={24} strokeWidth={3} /></button>
                      <div className="flex items-center gap-3">
                          {!selectedMusic && (
                            <button onClick={() => openMusicPicker('text_story')} className="w-12 h-12 rounded-full flex items-center justify-center bg-black/20 text-white border border-white/20"><Music size={20} /></button>
                          )}
                          <button onClick={() => setShowColorPicker(true)} className="h-12 px-6 bg-black/20 backdrop-blur-xl border border-white/20 rounded-full flex items-center gap-3 text-white"><div className="w-4 h-4 rounded-full border border-white" style={{ background: selectedTextColor || PALETTES[activePalette].text }} /><span className="text-sm font-semibold">Color</span></button>
                          <button onClick={() => setTextAlign(textAlign === 'left' ? 'center' : textAlign === 'center' ? 'right' : 'left')} className="w-12 h-12 bg-black/20 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white">{textAlign === 'left' ? <AlignLeft size={20} /> : textAlign === 'center' ? <AlignCenter size={20} /> : <AlignRight size={20} />}</button>
                          <button onClick={() => setTextHighlight(!textHighlight)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${textHighlight ? 'bg-white text-[#18181b]' : 'bg-black/20 text-white border border-white/20'}`}><CaseUpper size={20} strokeWidth={textHighlight ? 4 : 2} /></button>
                      </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-10 overflow-hidden"><textarea autoFocus placeholder="Start typing..." value={textStoryContent} onChange={(e) => setTextStoryContent(e.target.value)} className={`story-type-field w-full bg-transparent border-none outline-none text-center resize-none transition-all duration-300 ${FONTS[activeFont].class} ${textStoryContent.length > 50 ? 'text-[28px]' : 'text-[42px]'} ${textHighlight ? 'px-6 py-2 bg-black/20 rounded-[20px]' : ''}`} style={{ color: selectedTextColor || PALETTES[activePalette].text, textAlign: textAlign }} /></div>
                  <div className="px-6 z-20"><div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-4 px-2">{FONTS.map((font, i) => (<button key={font.id} onClick={() => setActiveFont(i)} className={`min-w-fit px-6 py-3 rounded-full transition-all border-2 flex items-center justify-center whitespace-nowrap shadow-xl ${activeFont === i ? 'bg-white text-[#18181b] border-white scale-110' : 'bg-black/20 text-white border-white/20 opacity-70'}`}><span className={`text-xs ${font.class}`}>{font.name}</span></button>))}</div></div>
                  <div className="p-8 pb-16 flex flex-col gap-6 z-10"><div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2">{PALETTES.map((p, i) => (<button key={i} onClick={() => setActivePalette(i)} className={`min-w-[44px] h-11 rounded-2xl border-2 transition-all ${activePalette === i ? 'border-white scale-110 shadow-lg' : 'border-white/30'}`} style={{ background: p.bg }} />))}</div><div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-xs font-medium text-white/70">Story vibe</span><span className="text-sm font-semibold text-white">{PALETTES[activePalette].name}</span></div><button onClick={handleSubmit} disabled={uploading || !textStoryContent} className="h-16 px-10 bg-[#ff1493] hover:bg-[#ff2d87] text-white rounded-full text-sm font-semibold flex items-center gap-3 active:scale-95 transition-all shadow-2xl">{uploading ? <Spinner size="medium" color="text-primary" /> : <><span>Push to story</span><Send size={18} strokeWidth={3} /></>}</button></div></div>
                  <AnimatePresence>{showColorPicker && (<motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="absolute inset-x-6 bottom-40 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl p-8 z-[600] shadow-2xl"><div className="flex items-center justify-between mb-8"><h4 className="text-sm font-semibold text-[#18181b] dark:text-zinc-100">Choose text color</h4><button onClick={() => setShowColorPicker(false)} className="w-8 h-8 bg-[#f0e5ec] dark:bg-zinc-700 rounded-full flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-[#ede3e9] dark:hover:bg-zinc-600 active:scale-75 transition-all"><X size={16} /></button></div><div className="grid grid-cols-5 gap-4"><button onClick={() => { setSelectedTextColor(null); setShowColorPicker(false); }} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${selectedTextColor === null ? 'ring-2 ring-[#ff1493] scale-110' : 'border-2 border-[#e6d8e1] dark:border-zinc-700'}`}><Pipette size={20} className="text-slate-600 dark:text-zinc-300" /></button>{TEXT_COLORS.map(c => (<button key={c.value} onClick={() => { setSelectedTextColor(c.value); setShowColorPicker(false); }} className={`w-12 h-12 rounded-2xl transition-all ${selectedTextColor === c.value ? 'ring-2 ring-[#ff1493] scale-110 shadow-lg' : 'border-2 border-[#e6d8e1] dark:border-zinc-700'}`} style={{ background: c.value }} />))}</div><button onClick={() => setShowColorPicker(false)} className="w-full mt-8 h-14 bg-[#ff1493] hover:bg-[#ff2d87] text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2">Done <CheckCircle2 size={16} /></button></motion.div>)}</AnimatePresence>
              </motion.div>
          )}

          {/* 3. CAMERA PHASE */}
          {phase === 'camera' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[250] flex flex-col bg-black">
                  {hasPermission === false ? (
                      <CameraPermissionsManager onRequestPermission={requestPermission} />
                  ) : (
                      <>
                          <CameraPreview 
                              videoRef={videoRef}
                              facingMode={facingMode}
                              activeFilter={activeFilter}
                              zoomLevel={zoomLevel}
                              onZoomChange={setZoomLevel}
                          />

                          {cameraLayout === 'grid' && (
                              <div className="absolute inset-0 z-10 pointer-events-none opacity-30">
                                  <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                                  <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                                  <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                                  <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
                              </div>
                          )}

                          {flash && (
                              <div className="absolute inset-0 bg-white/10 pointer-events-none z-30 mix-blend-screen animate-pulse" />
                          )}

                          <CameraControls 
                              mode={mode}
                              onModeChange={setMode}
                              flash={flash}
                              torchSupported={torchSupported}
                              onFlashToggle={toggleFlash}
                              cameraType={facingMode}
                              onCameraTypeToggle={toggleFacingMode}
                              onGalleryClick={handleGalleryClick}
                              onCapture={handleCapture}
                              isRecording={isRecording}
                              recordingSeconds={recordingSeconds}
                              maxRecordingSeconds={maxRecordingSeconds}
                              onDurationChange={(seconds) => setStoryRecordDuration(seconds)}
                              cameraTimer={cameraTimer}
                              onTimerToggle={() => setCameraTimer(t => t === 0 ? 3 : t === 3 ? 10 : 0)}
                              cameraSpeed={cameraSpeed}
                              onSpeedToggle={() => setCameraSpeed(s => s === '1x' ? '2x' : s === '2x' ? '0.5x' : '1x')}
                              cameraLayout={cameraLayout === 'grid' ? 'grid' : 'standard'}
                              onLayoutToggle={() => setCameraLayout(l => l === 'standard' ? 'grid' : 'standard')}
                              isMagicOn={isMagicOn}
                              onMagicToggle={() => setIsMagicOn(!isMagicOn)}
                              isWideAspect={isWideAspect}
                              onRatioToggle={() => setIsWideAspect(!isWideAspect)}
                              filters={FILTERS}
                              activeFilter={activeFilter}
                              onFilterChange={setActiveFilter}
                              onClose={() => setPhase('entry')}
                          />
                      </>
                  )}
              </motion.div>
          )}

          {/* 4. MUSIC PICKER PHASE */}
          {phase === 'music_picker' && (
              <motion.div key="music" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute inset-0 bg-[#0A0A0A] text-white z-[600] flex flex-col">
                  {/* Header */}
                  <div className="p-8 pt-14 flex items-center justify-between shrink-0">
                      <button
                        onClick={() => {
                          if (musicAudioRef.current) { musicAudioRef.current.pause(); musicAudioRef.current = null; }
                          setPhase(returnPhase);
                        }}
                        className="p-2 rounded-full text-zinc-300 hover:bg-white/10 transition-colors"
                      >
                        <ChevronLeft size={32} strokeWidth={3} />
                      </button>
                      <div className="flex flex-col items-center">
                        <h2 className="text-lg font-bold">Add music</h2>
                        <span className="text-xs text-white/70">Powered by Pixabay</span>
                      </div>
                      {selectedMusic && isPreviewingMusic ? (
                          <button onClick={handleMusicConfirm} className="px-6 py-2 bg-[#ff1493] hover:bg-[#ff2d87] text-white rounded-full text-sm font-semibold shadow-2xl active:scale-90 transition-all">Use track</button>
                      ) : <div className="w-20" />}
                  </div>

                  {!isPreviewingMusic ? (
                    <>
                      {/* Search Bar */}
                      <div className="px-6 pb-4 shrink-0">
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                          <input
                            placeholder="Search tracks, artists, moods..."
                            value={musicSearchQuery}
                            onChange={(e) => setMusicSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-12 pr-6 text-sm text-white placeholder:text-zinc-400 outline-none focus:border-[#ff1493] transition-all"
                          />
                          {musicLoading && (
                            <Spinner size="small" className="absolute right-5 top-1/2 -translate-y-1/2 text-rose-400" />
                          )}
                        </div>
                      </div>

                      {/* Quick mood chips */}
                      <div className="px-6 pb-4 shrink-0">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                          {['Trending', 'Chill', 'Hip Hop', 'Love', 'Party', 'Sad', 'Epic', 'Jazz'].map(mood => (
                            <button
                              key={mood}
                              onClick={() => setMusicSearchQuery(mood === 'Trending' ? '' : mood)}
                              className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                                (mood === 'Trending' && musicSearchQuery === '') || musicSearchQuery.toLowerCase() === mood.toLowerCase()
                                  ? 'bg-[#ff1493] border-[#ff1493] text-white'
                                  : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                              }`}
                            >
                              {mood}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Track List */}
                      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-24">
                        {musicError ? (
                          <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
                            <AlertCircle size={32} className="text-zinc-400" />
                            <p className="text-sm text-zinc-300">{musicError}</p>
                            <button onClick={() => fetchMusicTracks(musicSearchQuery)} className="px-6 py-2 bg-white/10 rounded-full text-xs font-semibold text-white hover:bg-white/20 transition-colors">Retry</button>
                          </div>
                        ) : musicLoading && musicResults.length === 0 ? (
                          <div className="flex flex-col gap-4 mt-2">
                            {[...Array(6)].map((_, i) => (
                              <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-[24px] animate-pulse">
                                <div className="w-14 h-14 bg-white/10 rounded-[18px] shrink-0" />
                                <div className="flex-1 space-y-2">
                                  <div className="h-3 bg-white/10 rounded-full w-2/3" />
                                  <div className="h-2 bg-white/5 rounded-full w-1/3" />
                                </div>
                                <div className="w-8 h-8 bg-white/5 rounded-full" />
                              </div>
                            ))}
                          </div>
                        ) : musicResults.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                            <Music3 size={36} className="text-zinc-400" />
                            <p className="text-sm text-zinc-300">No tracks found</p>
                            <p className="text-xs text-zinc-300">Try a different search term</p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 mt-2">
                            {musicResults.map((track, idx) => (
                              <motion.button
                                key={track.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                onClick={() => handleMusicClick(track)}
                                className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-[24px] border border-white/5 hover:bg-white/10 active:scale-[0.98] transition-all group text-left"
                              >
                                {/* Album Art */}
                                 <div className="w-14 h-14 rounded-2xl shrink-0 overflow-hidden bg-gradient-to-br from-rose-600 to-pink-900 flex items-center justify-center shadow-lg">
                                   {track.thumbnailUrl ? (
                                     <img src={track.thumbnailUrl} alt={track.title} className="w-full h-full object-cover" />
                                   ) : (
                                     <Music3 size={22} className="text-white/60" />
                                   )}
                                 </div>
                                 {/* Info */}
                                 <div className="flex-1 min-w-0">
                                   <h4 className="text-sm font-semibold truncate text-white">{track.title}</h4>
                                   <p className="text-xs font-medium text-zinc-300 truncate">{track.artist}</p>
                                 </div>
                                 {/* Duration + Play */}
                                 <div className="flex flex-col items-center gap-1 shrink-0">
                                   <div className="w-9 h-9 rounded-full bg-white/5 group-hover:bg-rose-500 flex items-center justify-center transition-all">
                                     <Play size={14} className="text-zinc-300 group-hover:text-white transition-colors ml-0.5" fill="currentColor" />
                                   </div>
                                   {track.duration > 0 && (
                                     <span className="text-xs font-medium text-zinc-300 tabular-nums">{formatDuration(track.duration)}</span>
                                   )}
                                 </div>
                              </motion.button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Preview Screen */
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center p-10">
                        {/* Album art */}
                        <div className="w-56 h-56 rounded-[48px] overflow-hidden bg-gradient-to-br from-rose-600 to-pink-900 flex items-center justify-center shadow-2xl shadow-rose-500/30 mb-8 relative">
                          {isPlayingMusic && (
                            <div className="absolute inset-0 rounded-[48px] border-[8px] border-rose-400/20 animate-ping" />
                          )}
                          {selectedMusic?.thumbnailUrl ? (
                            <img src={selectedMusic.thumbnailUrl} alt={selectedMusic.title} className="w-full h-full object-cover" />
                          ) : (
                            <motion.div animate={isPlayingMusic ? { rotate: 360 } : {}} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
                              <Music3 size={72} className="text-white/60" />
                            </motion.div>
                          )}
                        </div>

                        <h3 className="text-lg font-bold mb-1 text-center max-w-xs truncate text-white">{selectedMusic?.title}</h3>
                        <p className="text-sm font-semibold text-rose-400 mb-10">{selectedMusic?.artist}</p>

                         {/* Window scrubber — the 15s the story will actually use */}
                         <div className="w-full max-w-[300px] mb-3">
                           <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-medium text-white/70">Story window</span>
                             <span className="text-xs font-medium text-white tabular-nums">
                               {formatDuration((Number(selectedMusic?.start) || 0))} &ndash; {formatDuration(musicWindowEnd)}
                             </span>
                           </div>
                           <div className="relative h-9 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                             {/* Highlighted 15s window */}
                             <div
                               className="absolute inset-y-0 bg-rose-500/25 border-x-2 border-rose-400"
                               style={{
                                 left: `${((Number(selectedMusic?.start) || 0) / musicTrackDuration) * 100}%`,
                                 width: `${(MUSIC_WINDOW_SEC / musicTrackDuration) * 100}%`,
                               }}
                             />
                             {/* Draggable playhead */}
                             <input
                               type="range"
                               min={0}
                               max={Math.max(0, musicTrackDuration - MUSIC_WINDOW_SEC)}
                               step={0.5}
                               value={Number(selectedMusic?.start) || 0}
                               onChange={(e) => handleMusicScrub(Number(e.target.value))}
                               aria-label="Music window start"
                               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                             />
                             <div
                               className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg pointer-events-none"
                               style={{ left: `calc(${((Number(selectedMusic?.start) || 0) / musicTrackDuration) * 100}% - 7px)` }}
                             />
                             {/* Playback position within the window (preview only) */}
                             <div
                               className="absolute inset-y-0 left-0 bg-white/20 pointer-events-none"
                               style={{ width: `${musicAudioProgress}%` }}
                             />
                           </div>
                            <p className="text-xs text-white/70 mt-2 text-center">
                                Drag to pick where the {MUSIC_WINDOW_SEC}s clip starts · track {formatDuration(musicTrackDuration)}
                            </p>
                         </div>

                        {/* Waveform visualiser (decorative) */}
                        <div className="flex gap-0.5 items-end h-8 mb-10">
                          {[...Array(28)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="w-1 rounded-full bg-rose-500"
                              animate={isPlayingMusic ? { height: [6, 4 + Math.random() * 20, 6] } : { height: 4 }}
                              transition={isPlayingMusic ? { duration: 0.6 + Math.random() * 0.5, repeat: Infinity, delay: i * 0.04, ease: 'easeInOut' } : {}}
                            />
                          ))}
                        </div>

                        {/* Controls */}
                        <div className="flex gap-4">
                          <button
                            onClick={toggleMusicPlayback}
                            className="w-16 h-16 rounded-full bg-white dark:bg-zinc-800 text-[#18181b] dark:text-white flex items-center justify-center shadow-xl active:scale-90 transition-all"
                          >
                            {isPlayingMusic ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
                          </button>
                          <button
                            onClick={() => { setIsPreviewingMusic(false); if (musicAudioRef.current) { musicAudioRef.current.pause(); musicAudioRef.current = null; } }}
                            className="h-16 px-7 bg-white/5 border border-white/10 rounded-full flex items-center gap-3 text-xs font-semibold text-white hover:bg-white/10 active:bg-white/10 transition-all"
                          >
                            <ArrowRightLeft size={15} /> Change
                          </button>
                        </div>
                    </motion.div>
                  )}
              </motion.div>
          )}

          {/* 5. EDITOR PHASE (Requirement: Functional Side Icons) */}
          {phase === 'editor' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-(--z-top) bg-black">
                  {/* The Media Content */}
                  {!previewUrl ? (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-sm text-zinc-400">Loading Preview...</div>
                  ) : (file?.type?.startsWith('video') || (file?.name?.toLowerCase().match(/\.(mp4|webm|mov|avi|m4v)$/i))) ? (
                    <video
                        ref={videoPreviewRef}
                        key={previewUrl}
                        src={previewUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        onLoadedData={(e) => { setMediaDuration(e.currentTarget.duration || 0); logger.log('✅ Video preview ready'); }}
                        onError={(e) => logger.error('❌ Video Preview Error:', e)}
                        className={`w-full h-full object-cover transition-all duration-700 ${isMagicOn ? 'sepia-[0.4] saturate-[1.2] contrast-[1.1]' : ''}`}
                    />
                  ) : (
                    <img 
                        key={previewUrl}
                        src={previewUrl} 
                        onLoad={() => logger.log('✅ Image preview ready')}
                        onError={(e) => logger.error('❌ Image Preview Error:', e)}
                        className={`w-full h-full object-cover transition-all duration-700 ${isMagicOn ? 'sepia-[0.4] saturate-[1.2] contrast-[1.1]' : ''}`} 
                        alt="Preview" 
                    />
                  )}
                  
                  {/* Magic Layer */}
                  {isMagicOn && <div className="absolute inset-0 bg-purple-500/10 pointer-events-none mix-blend-overlay" />}

                  {/* Top Bar */}
                  <div className="absolute top-14 left-6 z-[350] flex flex-col gap-3 items-start">
                    <button onClick={() => setPhase('camera')} className="w-12 h-12 bg-black/20 backdrop-blur-3xl border border-white/20 rounded-full flex items-center justify-center text-white"><X size={24} strokeWidth={3} /></button>
                    <button
                      onClick={() => setShowAudienceSheet(true)}
                      aria-haspopup="dialog"
                      className="h-9 px-4 bg-black/20 backdrop-blur-3xl border border-white/20 rounded-full flex items-center gap-2 text-white active:scale-95 transition-all"
                    >
                      {audience === 'public' && <Globe size={14} />}
                      {audience === 'followers' && <Users size={14} />}
                      {audience === 'close_friends' && <Heart size={14} />}
                      {audience === 'only_me' && <Lock size={14} />}
                      <span className="text-sm font-semibold">{AUDIENCE_LABEL_MAP[audience] || 'Everyone'}</span>
                      <ChevronDown size={12} />
                    </button>
                  </div>

                  {/* Functional Side Icons */}
                  <div className="absolute top-1/2 -translate-y-1/2 right-6 flex flex-col gap-6 z-[350]">
                      <button onClick={() => setActiveTool('text')} className={`editor-tool-btn ${activeTool === 'text' ? 'text-primary' : ''}`}><Type size={20} /><span>Text</span></button>
                      <button onClick={() => setShowStickerPicker(true)} className="editor-tool-btn"><Smile size={20} /><span>Stickers</span></button>
                      {!selectedMusic && (
                        <button onClick={() => openMusicPicker('editor')} className="editor-tool-btn"><Music4 size={20} /><span>Music</span></button>
                      )}
                      <button onClick={() => setActiveTool('mention')} className={`editor-tool-btn ${activeTool === 'mention' ? 'text-primary' : ''}`}><AtSign size={20} /><span>Mention</span></button>
                      <button onClick={() => setShowDrawing(true)} className="editor-tool-btn"><Pencil size={20} /><span>Draw</span></button>
                      <button onClick={() => { setActiveTool('draw'); setShowEditMenu(false); }} className={`editor-tool-btn ${activeTool === 'draw' ? 'text-primary' : ''}`}><Film size={20} /><span>Trim</span></button>
                      <button onClick={() => setIsMagicOn(!isMagicOn)} className={`editor-tool-btn ${isMagicOn ? 'text-purple-400' : ''}`}><Wand2 size={20} fill={isMagicOn ? "currentColor" : "none"} /><span>Magic</span></button>
                      <button onClick={() => setShowEditMenu(!showEditMenu)} className={`editor-tool-btn ${showEditMenu ? 'text-primary' : ''}`}><Settings size={20} /><span>Edit</span></button>
                      <button onClick={handleSaveDraft} disabled={draftSaving} aria-label="Save draft" className="editor-tool-btn disabled:opacity-40"><Save size={20} /><span>Draft</span></button>
                  </div>

                  {/* Media tools: video trim + cover frame (only for video pages) */}
                  <AnimatePresence>
                      {activeTool === 'draw' && (
                        <motion.div
                          initial={{ x: 100, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: 100, opacity: 0 }}
                          className="absolute right-24 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-3xl border border-white/20 rounded-[32px] p-5 flex flex-col gap-5 z-[350] w-[248px]"
                          role="dialog"
                          aria-label="Media tools"
                        >
                          {!pages[activePageIndex]?.isVideo ? (
                            <p className="text-sm font-semibold text-white text-center py-6">
                              Trim + cover are video-only
                            </p>
                          ) : (
                            <>
                              {/* Trim window */}
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-white/70">Trim</span>
                                  <span className="text-xs font-medium text-white tabular-nums">
                                    {formatDuration(trimStart ?? 0)} &ndash; {formatDuration((trimStart ?? 0) + (trimDuration ?? 15))}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={Math.max(1, Math.floor(mediaDuration) - 15)}
                                  step={0.5}
                                  value={trimStart ?? 0}
                                  onChange={(e) => {
                                    const start = Number(e.target.value);
                                    const duration = Math.min(15, Math.max(1, mediaDuration - start));
                                    handleTrimChange(start, duration);
                                  }}
                                  aria-label="Video trim start"
                                  className="w-full accent-[var(--primary,#ff1493)]"
                                />
                                <div className="flex gap-2">
                                  {[5, 10, 15].map(d => (
                                    <button
                                      key={d}
                                      onClick={() => handleTrimChange(trimStart ?? 0, d)}
                                      aria-pressed={(trimDuration ?? 15) === d}
                                      className={`flex-1 h-9 rounded-full text-xs font-semibold transition-all ${((trimDuration ?? 15) === d) ? 'bg-[#ff1493] text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                    >
                                      {d}s
                                    </button>
                                  ))}
                                </div>
                                {(trimStart !== null || trimDuration !== null) && (
                                  <button
                                    onClick={() => handleTrimChange(null, null)}
                                    className="h-9 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:bg-white/10 active:scale-95 transition-all"
                                  >
                                    Reset trim
                                  </button>
                                )}
                              </div>

                              {/* Cover frame */}
                              <div className="flex flex-col gap-2 pt-4 border-t border-white/20">
                                <span className="text-xs font-medium text-white/70">Cover frame</span>
                                <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-white/5 border border-white/20">
                                  {coverUrl ? (
                                    <img src={coverUrl} alt="Chosen cover frame" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/70">
                                      <Film size={22} />
                                    </div>
                                  )}
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={Math.max(1, Math.floor(mediaDuration))}
                                  step={0.2}
                                  defaultValue={0}
                                  onChange={(e) => {
                                    const t = Number(e.target.value);
                                    setCoverTime(t);
                                  }}
                                  aria-label="Cover frame position"
                                  className="w-full accent-[var(--primary,#ff1493)]"
                                />
                                <button
                                  onClick={() => void captureCoverFrame(coverTime)}
                                  className="h-11 rounded-full bg-[#ff1493] hover:bg-[#ff2d87] text-white text-xs font-semibold active:scale-95 transition-all"
                                >
                                  Set cover from {coverTime.toFixed(1)}s
                                </button>
                              </div>
                            </>
                          )}
                        </motion.div>
                      )}
                  </AnimatePresence>

                  {/* Page filmstrip — multi-page story rail */}
                  <AnimatePresence>
                      {pages.length > 1 && (
                        <motion.div
                          initial={{ y: 40, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 40, opacity: 0 }}
                          className="absolute bottom-32 left-0 right-0 z-[360] px-6"
                        >
                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            {pages.map((page, i) => (
                              <button
                                key={page.id}
                                onClick={() => handleSwitchPage(i)}
                                aria-pressed={i === activePageIndex}
                                aria-label={`Go to page ${i + 1}`}
                                className={`relative shrink-0 w-14 h-20 rounded-2xl overflow-hidden border-2 transition-all active:scale-95 ${i === activePageIndex ? 'border-[#ff1493]' : 'border-white/30'}`}
                              >
                                {page.isVideo ? (
                                  <video src={page.previewUrl} className="w-full h-full object-cover" muted playsInline />
                                ) : (
                                  <img src={page.previewUrl} alt="" className="w-full h-full object-cover" />
                                )}
                                <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                  </AnimatePresence>

                  {/* Sticker Layer */}
                  <StickerRenderer
                    stickers={stickers}
                    isEditing={true}
                    onDelete={(id) => setStickers(stickers.filter(s => s.id !== id))}
                    onUpdate={(id, updates) => setStickers(stickers.map(s => s.id === id ? { ...s, ...updates } : s))}
                    onEdit={(sticker) => {
                      if (!isInteractiveStickerType(sticker.type)) return;
                      setStickerEditTarget({ id: sticker.id, type: sticker.type });
                    }}
                  />

                  {/* Interactive sticker composer, re-opened by tapping a placed sticker */}
                  <AnimatePresence>
                    {stickerEditTarget && (
                      <InteractiveStickerSheet
                        key={`edit-${stickerEditTarget.id}`}
                        type={stickerEditTarget.type}
                        initialConfig={stickers.find(s => s.id === stickerEditTarget.id)?.config}
                        confirmLabel="Save"
                        onCancel={() => setStickerEditTarget(null)}
                        onConfirm={(config) => handleStickerConfigSave(stickerEditTarget.id, config)}
                      />
                    )}
                  </AnimatePresence>

                  {/* Text/Mention Tool Overlay (Genius Input).
                      Mentions now open MentionPicker instead of this overlay. */}
                  <AnimatePresence>
                      {activeTool === 'text' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[500] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-10">
                            <input
                                autoFocus
                                value={editorText}
                                onChange={(e) => setEditorText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTextSticker(editorText)}
                                placeholder="Type something..."
                                className={`w-full bg-transparent border-none outline-none text-white text-[42px] placeholder-white/50 ${FONTS.find(f => f.id === overlayFontId)?.class || FONTS[0].class} ${overlayHighlight ? 'px-6 py-2 bg-black/30 rounded-[20px]' : ''}`}
                                style={{ color: overlayColor, textAlign: overlayAlign }}
                            />

                            {/* Styling bar — font / alignment / colour + background, the
                                same affordances the text-story phase has. */}
                            <div className="mt-8 w-full max-w-[520px] flex flex-col gap-4">
                              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                                {FONTS.map(font => (
                                  <button
                                    key={font.id}
                                    onClick={() => setOverlayFontId(font.id)}
                                    aria-pressed={overlayFontId === font.id}
                                    className={`shrink-0 px-4 py-2 rounded-full border-2 transition-all ${overlayFontId === font.id ? 'bg-white text-[#18181b] border-white' : 'bg-white/10 text-white border-white/20'}`}
                                  >
                                    <span className={`text-xs ${font.class}`}>{font.name}</span>
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  {(['left', 'center', 'right'] as const).map(align => (
                                    <button
                                      key={align}
                                      onClick={() => setOverlayAlign(align)}
                                      aria-label={`Align ${align}`}
                                      aria-pressed={overlayAlign === align}
                                      className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${overlayAlign === align ? 'bg-white text-[#18181b]' : 'bg-white/10 text-white'}`}
                                    >
                                      {align === 'left' ? <AlignLeft size={18} /> : align === 'center' ? <AlignCenter size={18} /> : <AlignRight size={18} />}
                                    </button>
                                  ))}
                                  <button
                                    onClick={() => setOverlayHighlight(v => !v)}
                                    aria-label="Toggle text background"
                                    aria-pressed={overlayHighlight}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${overlayHighlight ? 'bg-white text-[#18181b]' : 'bg-white/10 text-white'}`}
                                  >
                                    <CaseUpper size={18} strokeWidth={overlayHighlight ? 4 : 2} />
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  {TEXT_COLORS.map(color => (
                                    <button
                                      key={color.value}
                                      onClick={() => setOverlayColor(color.value)}
                                      aria-label={color.name}
                                      aria-pressed={overlayColor === color.value}
                                      className={`w-8 h-8 rounded-full border-2 transition-all active:scale-90 ${overlayColor === color.value ? 'border-white scale-110' : 'border-white/30'}`}
                                      style={{ background: color.value }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="mt-10 flex gap-4">
                                <button onClick={() => setActiveTool(null)} className="h-14 px-8 bg-white/10 rounded-full text-sm font-semibold text-white hover:bg-white/20 transition-colors">Cancel</button>
                                <button onClick={() => handleAddTextSticker(editorText, activeTool === 'mention' ? 'mention' : 'text')} className="h-14 px-10 bg-[#ff1493] hover:bg-[#ff2d87] text-white rounded-full text-sm font-semibold transition-all">Add</button>
                            </div>
                        </motion.div>
                      )}
                  </AnimatePresence>

                  {/* Edit Sub-Menu Overlay */}
                  <AnimatePresence>
                    {showEditMenu && (
                      <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="absolute right-24 top-1/2 -translate-y-1/2 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl p-2 flex flex-col gap-1 z-[350] shadow-2xl">
                         <button onClick={() => { setShowEditMenu(false); setShowLocationPicker(true); }} className="edit-sub-btn text-[#18181b] dark:text-zinc-100 hover:bg-[#ede3e9] dark:hover:bg-zinc-700 rounded-2xl"><MapPin size={18} /><span>Location</span></button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Location Picker Sheet */}
                  <AnimatePresence>
                    {showLocationPicker && (
                      <LocationPicker
                        onClose={() => setShowLocationPicker(false)}
                        onSelect={(place) => {
                          setStickers([...stickers, { id: 'loc-'+Date.now(), type: 'location', config: { name: place.name, address: place.address }, x: 50, y: 30, scale: 1, rotation: 0 }]);
                          setShowLocationPicker(false);
                          showSuccess('Location added');
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Audience / Privacy Sheet */}
                  <AnimatePresence>
                    {showAudienceSheet && (
                      <motion.div
                        key="audience-sheet"
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                        className="absolute inset-x-0 bottom-0 z-[600] bg-[#fdf8fa] dark:bg-zinc-800 rounded-t-[40px] px-8 pt-6 pb-10 max-h-[80%] overflow-y-auto no-scrollbar"
                        role="dialog" aria-label="Story privacy"
                      >
                        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-[#e6d8e1] dark:bg-zinc-700" />
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-lg font-bold text-[#18181b] dark:text-zinc-100">Story privacy</h2>
                          <button onClick={() => setShowAudienceSheet(false)} className="w-10 h-10 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-[#ede3e9] dark:hover:bg-zinc-600 transition-colors"><X size={20} /></button>
                        </div>

                        <div className="flex flex-col gap-2 mb-2">
                          {AUDIENCE_OPTIONS.map((opt) => {
                            const optIcon = opt.id === 'public' ? <Globe size={18} />
                              : opt.id === 'followers' ? <Users size={18} />
                                : opt.id === 'close_friends' ? <Heart size={18} />
                                  : <Lock size={18} />;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => setAudience(opt.id)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${audience === opt.id
                                  ? 'border-[#ff1493] bg-[#ff1493]/5'
                                  : 'border-transparent bg-[#f6eef3] dark:bg-zinc-900'}`}
                              >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${audience === opt.id ? 'bg-[#ff1493] text-white' : 'bg-[#f0e5ec] dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'}`}>
                                  {optIcon}
                                </div>
                                <div className="flex-1 text-left">
                                  <p className="text-sm font-semibold text-[#18181b] dark:text-zinc-100">{opt.label}</p>
                                  <p className="text-xs text-slate-600 dark:text-zinc-300 leading-tight">{opt.description}</p>
                                </div>
                                {audience === opt.id && <CheckCircle2 size={20} className="text-[#ff1493]" />}
                              </button>
                            );
                          })}
                        </div>

                        {/* Close Friends management - only relevant for that audience */}
                        {audience === 'close_friends' && (
                          <div className="mt-6 rounded-3xl bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-[#18181b] dark:text-zinc-100">Close Friends <span className="text-[#ff1493]">({closeFriends.length})</span></p>
                              {closeFriendLoading && <Spinner size="small" />}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-zinc-300 mb-3">Pick from your followers. Your close friends list also controls who can see your close-friends stories.</p>
                            {followerPool.length === 0 ? (
                              <p className="text-xs text-slate-600 dark:text-zinc-300">{closeFriendLoading ? 'Loading followers...' : 'No followers yet - invite people to see close-friends stories.'}</p>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {followerPool.map((f) => {
                                  const id = f.user_id || f.id || '';
                                  const isClose = closeFriendIds.has(id);
                                  const name = f.username || f.name || 'Unknown';
                                  return (
                                    <div key={id} className="flex items-center gap-3 py-1.5">
                                      <div className="w-9 h-9 rounded-full overflow-hidden bg-[#f0e5ec] dark:bg-zinc-700 flex items-center justify-center text-[#ff1493] font-semibold text-sm">
                                        {f.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
                                      </div>
                                      <p className="flex-1 text-sm font-medium text-[#18181b] dark:text-zinc-100 truncate">{name}</p>
                                      <button
                                        onClick={() => toggleCloseFriend(id)}
                                        className={`h-8 px-4 rounded-full text-xs font-semibold active:scale-95 transition-all ${isClose
                                          ? 'bg-[#ff1493] text-white'
                                          : 'bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 text-[#18181b] dark:text-zinc-100 hover:bg-[#ede3e9] dark:hover:bg-zinc-700'}`}
                                      >
                                        {isClose ? 'Added' : 'Add'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => setShowAudienceSheet(false)}
                          className="mt-6 h-14 w-full bg-[#ff1493] hover:bg-[#ff2d87] text-white rounded-full text-sm font-semibold active:scale-95 transition-all"
                        >
                          Apply
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Bottom Bar */}
                  <div className="absolute bottom-12 left-0 right-0 px-10 flex flex-col gap-3 z-[350]">
                      <div className="flex items-center justify-between gap-3">
                        <input
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          placeholder="Add a caption..."
                          maxLength={200}
                          className="flex-1 h-11 min-w-0 bg-black/30 backdrop-blur-3xl border border-white/10 rounded-full px-5 text-[13px] text-white placeholder-white/40 outline-none focus:border-primary/60"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleUndoStickers}
                            disabled={!canUndo}
                            aria-label="Undo last placement"
                            className="h-11 px-4 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-full text-sm font-semibold text-white active:scale-90 transition-all disabled:opacity-30"
                          >
                            Undo
                          </button>
                          <button
                            onClick={handleRedoStickers}
                            disabled={!canRedo}
                            aria-label="Redo last placement"
                            className="h-11 px-4 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-full text-sm font-semibold text-white active:scale-90 transition-all disabled:opacity-30"
                          >
                            Redo
                          </button>
                          <button
                            onClick={() => setSaveToGallery(v => !v)}
                            aria-pressed={saveToGallery}
                            className={`h-11 px-4 rounded-full text-sm font-semibold active:scale-90 transition-all border ${saveToGallery ? 'bg-[#ff1493] border-[#ff1493] text-white' : 'bg-white/10 border-white/20 text-white'}`}
                          >
                            {saveToGallery ? 'Saved to device' : 'Save to device'}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                      <button onClick={() => setPhase('camera')} className="h-16 w-16 shrink-0 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-full flex items-center justify-center text-white active:scale-90 transition-all"><ChevronLeft size={24} /></button>
                      <button onClick={handleSubmit} disabled={uploading} className="h-16 flex-1 min-w-0 bg-[#ff1493] hover:bg-[#ff2d87] text-white rounded-full text-sm font-semibold flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg">
                        {uploading ? <Spinner size="medium" color="text-primary" /> : (
                        <>
                              <span>
                                {mode === 'story' ? 'Push to story' : mode === 'post' ? 'Post to feed' : 'Share reel'}
                              </span>
                              <Send size={18} strokeWidth={3} />
                            </>
                          )}
                      </button>
                      </div>
                  </div>
              </motion.div>
          )}

          {phase === 'template_picker' && (
              <motion.div key="templates" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute inset-0 bg-[#f8e7ed] dark:bg-zinc-900 text-[#18181b] dark:text-zinc-100 z-[300] flex flex-col"><div className="p-4 md:p-6 flex items-center justify-between bg-[#f8e7ed] dark:bg-zinc-900 sticky top-0 z-10 border-b border-[#ede3e9] dark:border-zinc-900"><button onClick={() => setPhase('entry')} className="p-2 -ml-2 rounded-full text-slate-600 dark:text-zinc-300 hover:bg-[#ede3e9] dark:hover:bg-zinc-700 transition-colors"><ChevronLeft size={28} strokeWidth={2} /></button><h2 className="text-lg font-bold text-[#18181b] dark:text-zinc-100">Templates</h2><button onClick={() => setPhase('camera')} className="w-11 h-11 bg-[#ff1493] hover:bg-[#ff2d87] text-white rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-colors"><Plus size={22} strokeWidth={2.5} /></button></div><div className="flex-1 overflow-y-auto no-scrollbar pb-20"><div className="p-4 md:p-6"><h3 className="text-sm font-semibold text-slate-600 dark:text-zinc-300 mb-4 px-1">Essential stickers</h3><div className="grid grid-cols-2 gap-3"><button onClick={() => handleTemplateSelect({ prompt: 'Ask me anything', count: '5k' })} className="template-mini-card bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 text-[#ff1493]"><Smile size={24} /><span>Add yours</span></button><button onClick={() => setShowStickerPicker(true)} className="template-mini-card bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 text-[#ff1493]"><Sparkles size={24} /><span>Stickers</span></button></div></div><div className="p-4 md:p-6 bg-[#f6eef3] dark:bg-zinc-900"><h3 className="text-sm font-semibold text-slate-600 dark:text-zinc-300 mb-4 px-1 flex items-center gap-2"><TrendingUp size={16} /> Trending prompts</h3><div className="flex flex-col gap-4">{TEMPLATE_PROMPTS.map(p => (<button key={p.id} onClick={() => handleTemplateSelect(p)} className="w-full bg-[#fdf8fa] dark:bg-zinc-800 p-6 rounded-3xl border border-[#e6d8e1] dark:border-zinc-700 hover:border-[#ff1493] active:scale-[0.98] transition-colors flex flex-col items-center text-center"><p className="text-lg font-semibold mb-4 text-[#18181b] dark:text-zinc-100 leading-tight">{p.prompt}</p><div className="px-4 py-1.5 bg-[#f0e5ec] dark:bg-zinc-700 rounded-full"><span className="text-xs font-semibold text-[#ff1493]">Add yours</span></div></button>))}</div></div></div></motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>{showStickerPicker && (<StickerPicker onClose={() => setShowStickerPicker(false)} onSelect={(type, config) => { setStickers([...stickers, { id: 'st-' + Date.now(), type, config, x: 50, y: 50, scale: 1, rotation: 0 }]); setShowStickerPicker(false); }} />)}</AnimatePresence>

      {/* GIF picker (independent entry — the StickerPicker 'GIFs' tab is the other route) */}
      <AnimatePresence>
        {showGifPicker && (
          <GifPicker
            onClose={() => setShowGifPicker(false)}
            onSelect={(gif: GifItem) => {
              setStickers([...stickers, {
                id: 'st-' + Date.now(),
                type: 'gif',
                config: { url: gif.url, still: gif.still, title: gif.title },
                x: 50, y: 50, scale: 1, rotation: 0,
              }]);
              setShowGifPicker(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Freehand drawing surface */}
      <AnimatePresence>
        {showDrawing && (
          <DrawingCanvas
            onClose={() => setShowDrawing(false)}
            onSave={(result: DrawingResult) => {
              setStickers([...stickers, {
                id: 'st-' + Date.now(),
                type: 'drawing',
                config: { dataUrl: result.dataUrl, strokes: result.strokes.length },
                x: 50, y: 50, scale: 1, rotation: 0,
              }]);
              setShowDrawing(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Mention autocomplete — replaces the plain '@Username' overlay */}
      <AnimatePresence>
        {activeTool === 'mention' && (
          <MentionPicker
            onClose={() => setActiveTool(null)}
            onSelect={(user) => {
              setStickers([...stickers, {
                id: 'st-' + Date.now(),
                type: 'mention',
                config: { user_id: user.user_id || user.id, username: user.username },
                x: 50, y: 50, scale: 1, rotation: 0,
              }]);
              setActiveTool(null);
            }}
          />
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .mask-fade-edges { mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent); }
        /* Text-story placeholder inherits the palette's text colour so it stays
           legible on the light palettes (white-on-light-green vanished). */
        .story-type-field::placeholder { color: currentColor; opacity: 0.55; }
        .camera-tool-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; color: white; transition: all 0.2s; min-height: 48px; }
        .camera-tool-btn:active { transform: scale(0.9); opacity: 0.7; }
        .camera-tool-btn span { font-size: 11px; font-weight: 600; letter-spacing: 0.02em; opacity: 0.9; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
        .entry-action-card { min-width: 80px; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; border-radius: 20px; transition: all 0.3s; }
        .template-mini-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 20px; border-radius: 24px; transition: all 0.3s; }
        .template-mini-card span { font-size: 13px; font-weight: 600; }
        .editor-tool-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; color: white; transition: all 0.3s; }
        .editor-tool-btn span { font-size: 10px; font-weight: 600; letter-spacing: 0.02em; opacity: 0.85; }
        .edit-sub-btn { display: flex; align-items: center; gap: 12px; color: white; padding: 12px 20px; border-radius: 24px; transition: all 0.2s; min-width: 140px; }
        .edit-sub-btn:active { background: rgba(255,255,255,0.1); }
        .edit-sub-btn span { font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
        .toolbar-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; color: white; transition: all 0.3s; opacity: 0.8; }
        .toolbar-btn:active { transform: scale(0.8); opacity: 0.5; }
        .toolbar-btn span { font-size: 10px; font-weight: 600; letter-spacing: 0.02em; opacity: 0.85; }
      `}</style>
    </div>
  );
}

// Pixabay music search now powers the music picker — MOCK_MUSIC removed.



