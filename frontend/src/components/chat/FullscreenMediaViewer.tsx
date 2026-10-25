import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Copy, Download, FileText, Forward, Image as ImageIcon, MoreVertical, Pause, Play, RotateCw, Search, Sparkles, Star, Trash2, X } from 'lucide-react';
import Spinner from '../ui/Spinner';
import { Capacitor } from '@capacitor/core';
import api from '../../api/api';
import { getAvatarUrl, getMediaUrl } from '../../utils/imageUtils';
import { showError, showSuccess } from '../../utils/toast';
import { sanitizePartnerName } from '../../utils/nameSanitizer';
import { safeHref } from '../../utils/safeHref';
import { downloadMedia, fetchMediaAsFile } from '../../services/mediaDownload';
import { useThemeStore, type SparkleTheme } from '../../store/themeStore';
import { useUserStore } from '../../store/userStore';
import { logger } from '../../utils/logger';

export interface FullscreenMediaViewerProps {
  message: any | null;
  chat: any | null;
  currentUserId: string;
  onClose: () => void;
  onForward?: (message: any) => void;
  onDelete?: (message: any) => void;
  onViewAllMedia?: () => void;
  onStarToggled?: (messageId: string, starred: boolean) => void;
}

type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'unknown';

type AiPanelState = {
  loading: boolean;
  text?: string;
  error?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function ZoomableImage({ src, rotation }: { src: string; rotation: number }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragOriginRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchOriginRef = useRef<{ dist: number; scale: number } | null>(null);

  useEffect(() => {
    if (scale === 1) setOffset({ x: 0, y: 0 });
  }, [scale]);

  const pointerDistance = () => {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setInteracting(true);
    if (pointersRef.current.size === 2) {
      pinchOriginRef.current = { dist: pointerDistance() || 1, scale };
      dragOriginRef.current = null;
    } else if (scale > 1) {
      dragOriginRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchOriginRef.current) {
      const dist = pointerDistance();
      if (dist > 0) {
        setScale(clamp((pinchOriginRef.current.scale * dist) / pinchOriginRef.current.dist, 1, 5));
      }
      return;
    }

    if (dragOriginRef.current && scale > 1) {
      setOffset({
        x: dragOriginRef.current.ox + (e.clientX - dragOriginRef.current.x),
        y: dragOriginRef.current.oy + (e.clientY - dragOriginRef.current.y),
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchOriginRef.current = null;
    if (pointersRef.current.size === 0) {
      dragOriginRef.current = null;
      setInteracting(false);
    }
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    setScale((prev) => clamp(prev * (1 - e.deltaY * 0.002), 1, 5));
  };

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 text-white/70 px-8 text-center">
        <ImageIcon size={42} className="text-white/30" />
        <p className="text-sm font-semibold">This image isn't available anymore.</p>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
    >
      {!loaded && (
        <Spinner size="large" className="text-white/60" />
      )}
      <img
        src={src}
        alt=""
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className="max-w-full max-h-full object-contain"
        style={{
          opacity: loaded ? 1 : 0,
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
          transition: interacting ? 'none' : 'transform 0.25s ease',
          willChange: 'transform',
        }}
      />
    </div>
  );
}

function AudioStage({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  const fmt = (s: number) => {
    if (!s || Number.isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play().catch(() => setFailed(true));
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    el.currentTime = fraction * duration;
    setCurrent(el.currentTime);
  };

  if (failed) {
    return (
      <div className="text-white/70 text-sm font-semibold px-8 text-center">
        Could not play this audio.
      </div>
    );
  }

  return (
    <div className="mx-6 w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col gap-4">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration || 0)}
        onError={() => setFailed(true)}
      />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          className="w-14 h-14 rounded-full bg-[#ff1493] text-white flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
        </button>
        <div className="flex-1 min-w-0">
          <div
            className="h-2 rounded-full bg-white/10 cursor-pointer relative overflow-hidden"
            onClick={seek}
          >
            <div
              className="absolute inset-y-0 left-0 bg-[#ff1493] rounded-full"
              style={{ width: duration ? `${(current / duration) * 100}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[11px] font-bold text-white/50">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FullscreenMediaViewer({
  message,
  chat,
  currentUserId,
  onClose,
  onForward,
  onDelete,
  onViewAllMedia,
  onStarToggled,
}: FullscreenMediaViewerProps) {
  const navigate = useNavigate();
  const currentUser = useUserStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [setAsOpen, setSetAsOpen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState<'download' | 'avatar' | null>(null);
  const [aiPanel, setAiPanel] = useState<AiPanelState | null>(null);

  const open = Boolean(message);
  const msgType = String(message?.type || '');
  const kind: MediaKind =
    msgType === 'image' || msgType === 'photo'
      ? 'image'
      : msgType === 'video'
        ? 'video'
        : msgType === 'voice_note' || msgType === 'audio'
          ? 'audio'
          : msgType === 'document'
            ? 'document'
            : 'unknown';

  const rawUrl = message?.media_url || message?.mediaUrl || '';
  const resolvedUrl = open ? getMediaUrl(rawUrl) : '';
  const messageId = String(message?.message_id || message?.id || '');

  const isMine = String(message?.sender_id || '') === String(currentUserId || '');
  const partnerName = sanitizePartnerName(chat?.partner_name, chat?.partner_username);
  const senderLabel = isMine ? 'You' : message?.sender_name || partnerName || 'Sender';
  const senderAvatar = isMine
    ? getAvatarUrl(currentUser?.avatar_url)
    : getAvatarUrl(chat?.partner_avatar);
  const isForwarded = Boolean(message?.forwarded || message?.forwarded_from);
  const starred = Boolean(message?.starred);

  const ts = message?.sent_at || message?.created_at;
  const timeLabel = ts
    ? new Date(ts).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const caption = typeof message?.content === 'string' && message.content && message.content !== 'null'
    ? message.content
    : '';

  const documentName =
    kind === 'document' && caption && caption.includes('.')
      ? caption
      : kind === 'document'
        ? 'Attachment'
        : undefined;

  // Reset transient state whenever a different message opens.
  useEffect(() => {
    if (!open) return;
    setMenuOpen(false);
    setSetAsOpen(false);
    setRotation(0);
    setBusy(null);
    setAiPanel(null);
  }, [open, messageId]);

  // Lock body scroll while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape / hardware back closes menu first, then the viewer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menuOpen) setMenuOpen(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, menuOpen, onClose]);

  const runAnalysis = useCallback(async () => {
    if (!resolvedUrl) return;
    setAiPanel({ loading: true });
    try {
      const res = await api.post('/ai/analyze-media', { url: resolvedUrl });
      const text = String(res.data?.text || res.data?.content || '');
      if (!text.trim()) throw new Error('empty');
      setAiPanel({ loading: false, text });
    } catch (err: any) {
      logger.warn('[MediaViewer] AI analysis failed', err);
      setAiPanel({
        loading: false,
        error: err?.response?.data?.message || 'Analysis failed. Check your connection and try again.',
      });
    }
  }, [resolvedUrl]);

  const handleDownload = useCallback(async () => {
    if (!resolvedUrl || busy) return;
    setBusy('download');
    setMenuOpen(false);
    try {
      await downloadMedia(resolvedUrl, documentName);
      showSuccess(Capacitor.isNativePlatform() ? 'Saved to Downloads' : 'Download started');
    } catch (err: any) {
      showError(err?.message || 'Download failed');
    } finally {
      setBusy(null);
    }
  }, [resolvedUrl, documentName, busy]);

  const handleSetAsAvatar = useCallback(async () => {
    if (!resolvedUrl || busy) return;
    setBusy('avatar');
    setMenuOpen(false);
    setSetAsOpen(false);
    try {
      const file = await fetchMediaAsFile(resolvedUrl, 'avatar.jpg');
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Image is too large (max 10 MB)');
      }
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const store = useUserStore.getState();
      if (res.data?.user) {
        store.setUser(res.data.user);
      } else if (store.user) {
        store.setUser({ ...store.user, avatar_url: res.data?.avatar_url });
      }
      showSuccess('Profile picture updated');
    } catch (err: any) {
      showError(err?.response?.data?.error || err?.message || 'Could not update profile picture');
    } finally {
      setBusy(null);
    }
  }, [resolvedUrl, busy]);

  const handleSetAsWallpaper = useCallback(() => {
    const chatId = chat?.chat_id || chat?.id;
    if (!chatId || !resolvedUrl) return;
    const store = useThemeStore.getState();
    const current = store.getThemeForChat(chatId);
    const next: SparkleTheme = {
      ...current,
      wallpaperUrl: resolvedUrl,
      wallpaperStyle: 'cover',
    };
    store.setThemeForChat(chatId, next);
    setMenuOpen(false);
    setSetAsOpen(false);
    showSuccess('Chat wallpaper updated');
  }, [chat, resolvedUrl]);

  const handleStar = useCallback(() => {
    if (!messageId) return;
    setMenuOpen(false);
    onStarToggled?.(messageId, !starred);
  }, [messageId, starred, onStarToggled]);

  const handleShowInChat = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('sparkle:jump-to-message', { detail: { messageId } })
    );
    setMenuOpen(false);
    onClose();
  }, [messageId, onClose]);

  const handleShareToStory = useCallback(() => {
    if (!resolvedUrl) return;
    setMenuOpen(false);
    navigate(`/afterglow/create?imageUrl=${encodeURIComponent(resolvedUrl)}`);
  }, [resolvedUrl, navigate]);

  const openGoogleLens = useCallback(() => {
    if (!resolvedUrl) return;
    window.open(
      `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(resolvedUrl)}`,
      '_blank',
      'noopener,noreferrer'
    );
    setMenuOpen(false);
  }, [resolvedUrl]);

  const copyAiText = useCallback(async () => {
    if (!aiPanel?.text) return;
    try {
      await navigator.clipboard.writeText(aiPanel.text);
      showSuccess('Copied');
    } catch {
      showError('Could not copy');
    }
  }, [aiPanel?.text]);

  const canLens = kind === 'image' && resolvedUrl.startsWith('http');
  const menuItems: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
    busy?: boolean;
  }> = [
    {
      key: 'show',
      icon: <Search size={17} />,
      label: 'Show in chat',
      onClick: handleShowInChat,
    },
    ...(onViewAllMedia
      ? [
          {
            key: 'gallery',
            icon: <ImageIcon size={17} />,
            label: 'View all media',
            onClick: () => {
              setMenuOpen(false);
              onViewAllMedia();
            },
          },
        ]
      : []),
    ...(canLens
      ? [
          {
            key: 'lens',
            icon: <Search size={17} />,
            label: 'Search with Google Lens',
            onClick: openGoogleLens,
          },
        ]
      : []),
    ...(kind === 'image'
      ? [
          {
            key: 'rotate',
            icon: <RotateCw size={17} />,
            label: 'Rotate',
            onClick: () => {
              setRotation((r) => (r + 90) % 360);
              setMenuOpen(false);
            },
          },
          {
            key: 'setas',
            icon: <Check size={17} />,
            label: 'Set as…',
            onClick: () => setSetAsOpen(true),
          },
          {
            key: 'ai',
            icon: <Sparkles size={17} />,
            label: 'Ask Sparkle AI',
            onClick: () => {
              setMenuOpen(false);
              runAnalysis();
            },
          },
        ]
      : []),
    {
      key: 'star',
      icon: <Star size={17} fill={starred ? 'currentColor' : 'none'} />,
      label: starred ? 'Unstar' : 'Star',
      onClick: handleStar,
    },
    {
      key: 'download',
      icon: <Download size={17} />,
      label: 'Download',
      onClick: handleDownload,
      busy: busy === 'download',
    },
    ...(isMine && onDelete
      ? [
          {
            key: 'delete',
            icon: <Trash2 size={17} />,
            label: 'Delete',
            onClick: () => {
              setMenuOpen(false);
              onDelete(message);
            },
            danger: true,
          },
        ]
      : []),
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-(--z-chrome) bg-black select-none"
        >
          {/* ── Header ── */}
          <div
            className="absolute top-0 inset-x-0 z-20 bg-gradient-to-b from-black/85 via-black/40 to-transparent"
            style={{
              paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top, 0px))',
            }}
          >
            <div className="flex items-center gap-3 px-2 py-2">
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition-all shrink-0"
                aria-label="Close media viewer"
              >
                <ArrowLeft size={22} />
              </button>

              <img
                src={senderAvatar}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-white/15 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold text-[13px] truncate max-w-[45vw]">
                    {senderLabel}
                  </span>
                  {isForwarded && (
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/50 border border-white/20 rounded px-1 py-px shrink-0">
                      Forwarded
                    </span>
                  )}
                </div>
                {timeLabel && (
                  <div className="text-white/45 text-[10px] font-semibold truncate">{timeLabel}</div>
                )}
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                {kind === 'image' && resolvedUrl.startsWith('http') && (
                  <button
                    type="button"
                    onClick={handleShareToStory}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition-all"
                    aria-label="Share to story"
                  >
                    <Sparkles size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={busy === 'download'}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition-all disabled:opacity-50"
                  aria-label="Download"
                >
                  {busy === 'download' ? (
                    <Spinner size="medium" />
                  ) : (
                    <Download size={18} />
                  )}
                </button>
                {onForward && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onForward(message);
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition-all"
                    aria-label="Forward"
                  >
                    <Forward size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen((v) => !v);
                    setSetAsOpen(false);
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition-all"
                  aria-label="More options"
                >
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Overflow menu (right-edge aligned) ── */}
          <AnimatePresence>
            {menuOpen && (
              <>
                <div
                  className="absolute inset-0 z-25"
                  onClick={() => {
                    setMenuOpen(false);
                    setSetAsOpen(false);
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-30 top-14 right-2 w-60 rounded-2xl bg-[#1c1c24]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
                >
                  {!setAsOpen ? (
                    <div className="py-1.5 max-h-[70vh] overflow-y-auto">
                      {menuItems.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={item.onClick}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-[13px] font-semibold transition-colors hover:bg-white/5 active:bg-white/10 ${
                            item.danger ? 'text-red-400' : 'text-white/90'
                          }`}
                        >
                          <span className={item.danger ? 'text-red-400' : 'text-white/60'}>
                            {item.busy ? <Spinner size="medium" /> : item.icon}
                          </span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-1.5">
                      <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                        Set as
                      </div>
                      <button
                        type="button"
                        onClick={handleSetAsAvatar}
                        disabled={busy === 'avatar'}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-semibold text-white/90 hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        {busy === 'avatar' ? (
                          <Spinner size="medium" className="text-white/60" />
                        ) : (
                          <ImageIcon size={17} className="text-white/60" />
                        )}
                        Profile picture
                      </button>
                      <button
                        type="button"
                        onClick={handleSetAsWallpaper}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-semibold text-white/90 hover:bg-white/5 active:bg-white/10 transition-colors"
                      >
                        <FileText size={17} className="text-white/60" />
                        Chat wallpaper
                      </button>
                      <button
                        type="button"
                        onClick={() => setSetAsOpen(false)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-semibold text-white/50 hover:bg-white/5 active:bg-white/10 transition-colors"
                      >
                        <ArrowLeft size={17} />
                        Back
                      </button>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* ── Media stage ── */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden pt-16 pb-20">
            {kind === 'image' && resolvedUrl && (
              <ZoomableImage src={resolvedUrl} rotation={rotation} />
            )}
            {kind === 'image' && !resolvedUrl && (
              <div className="flex flex-col items-center gap-3 text-white/70 px-8 text-center">
                <ImageIcon size={42} className="text-white/30" />
                <p className="text-sm font-semibold">This image isn't available anymore.</p>
              </div>
            )}
            {kind === 'video' && resolvedUrl && (
              <video
                key={resolvedUrl}
                src={resolvedUrl}
                controls
                playsInline
                className="max-w-full max-h-full"
              />
            )}
            {kind === 'video' && !resolvedUrl && (
              <div className="text-white/70 text-sm font-semibold px-8 text-center">
                This video isn't available anymore.
              </div>
            )}
            {kind === 'audio' && resolvedUrl && <AudioStage src={resolvedUrl} />}
            {kind === 'audio' && !resolvedUrl && (
              <div className="text-white/70 text-sm font-semibold px-8 text-center">
                This audio isn't available anymore.
              </div>
            )}
            {kind === 'document' && (
              <div className="mx-6 w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                  <FileText size={36} />
                </div>
                <div className="text-white font-bold text-center break-all text-sm">
                  {documentName || 'Document attachment'}
                </div>
                <div className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                  Attachment
                </div>
                <div className="flex gap-3 w-full mt-1">
                  {resolvedUrl && (
                    <a
                      href={safeHref(resolvedUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 rounded-xl bg-white/10 text-white text-center text-[13px] font-bold hover:bg-white/15 transition-colors"
                    >
                      Open file
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={busy === 'download'}
                    className="flex-1 py-3 rounded-xl bg-[#ff1493] text-white text-[13px] font-bold hover:bg-pink-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {busy === 'download' ? <Spinner size="small" /> : null}
                    Download
                  </button>
                </div>
              </div>
            )}
            {kind === 'unknown' && (
              <div className="text-white/70 text-sm font-semibold px-8 text-center">
                This attachment can't be previewed.
              </div>
            )}
          </div>

          {/* ── Caption ── */}
          {caption && !aiPanel && (
            <div
              className="absolute bottom-0 inset-x-0 z-10 px-5 pt-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
              style={{
                paddingBottom: 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 14px)',
              }}
            >
              <p className="text-white/90 text-[13px] font-medium leading-snug">{caption}</p>
            </div>
          )}

          {/* ── Sparkle AI analysis panel ── */}
          <AnimatePresence>
            {aiPanel && (
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                className="absolute bottom-0 inset-x-0 z-30 bg-[#16161e]/95 backdrop-blur-xl border-t border-white/10"
                style={{
                  paddingBottom: 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 12px)',
                }}
              >
                <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                  <Sparkles size={16} className="text-[#ff1493]" />
                  <span className="text-white font-bold text-[13px] flex-1">Sparkle AI</span>
                  {aiPanel.text && (
                    <button
                      type="button"
                      onClick={copyAiText}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
                      aria-label="Copy analysis"
                    >
                      <Copy size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAiPanel(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
                    aria-label="Close analysis"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="px-4 pb-3 max-h-[40vh] overflow-y-auto">
                  {aiPanel.loading && (
                    <div className="flex items-center gap-2.5 text-white/60 text-[13px] font-semibold py-2">
                      <Spinner size="small" />
                      Analyzing media…
                    </div>
                  )}
                  {aiPanel.error && (
                    <div className="flex items-center justify-between gap-3 py-1">
                      <p className="text-red-400 text-[12px] font-semibold">{aiPanel.error}</p>
                      <button
                        type="button"
                        onClick={runAnalysis}
                        className="text-[#ff1493] text-[12px] font-black uppercase tracking-wider shrink-0"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {aiPanel.text && (
                    <p className="text-white/85 text-[13px] leading-relaxed whitespace-pre-wrap">
                      {aiPanel.text}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
