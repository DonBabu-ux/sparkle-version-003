import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MoreHorizontal, Bookmark, EyeOff, AlertTriangle, Download } from 'lucide-react';
import { useModalStore } from '../../store/modalStore';
import { logger } from '../../utils/logger';
import { useModalA11y } from '../../hooks/useModalA11y';
import Spinner from '../ui/Spinner';

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

export default function MediaPreviewModal() {
  const { modalData, closeModal } = useModalStore();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const a11yRef = useModalA11y(!!modalData, closeModal);

  // Zoom / Pan / Dismiss Gesture state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dismissY, setDismissY] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [interacting, setInteracting] = useState(false);

  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragOriginRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchOriginRef = useRef<{ dist: number; scale: number } | null>(null);
  const swipeDismissStartRef = useRef<{ y: number } | null>(null);

  useEffect(() => {
    if (scale === 1) {
      setOffset({ x: 0, y: 0 });
    }
  }, [scale]);

  if (!modalData) return null;

  // Handle both { post: Post } and { url: string } structures
  const data = modalData as any;
  const mediaUrl = data.post?.media_url || data.url;
  const mediaType = data.post?.media_type || 'image';

  if (!mediaUrl) return null;

  const isVideo = mediaType === 'video' || mediaUrl.match(/\.(mp4|webm|ogg|mov|quicktime)$/i);

  const handleDownload = async () => {
    if (!mediaUrl) return;
    try {
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = mediaUrl.split('/').pop() || 'sparkle-media';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Download failed:', err);
      window.open(mediaUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleHide = () => {
    if (data.post) {
      const hidden = JSON.parse(localStorage.getItem('hiddenPostIds') || '[]');
      hidden.push(data.post.post_id);
      localStorage.setItem('hiddenPostIds', JSON.stringify(hidden));
      closeModal();
      window.dispatchEvent(new Event('postHidden')); 
    }
  };

  // Touch & Pointer Gesture Handlers
  const pointerDistance = () => {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isVideo) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setInteracting(true);

    if (pointersRef.current.size === 2) {
      pinchOriginRef.current = { dist: pointerDistance() || 1, scale };
      dragOriginRef.current = null;
      swipeDismissStartRef.current = null;
    } else if (scale > 1) {
      dragOriginRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      swipeDismissStartRef.current = null;
    } else if (scale === 1) {
      swipeDismissStartRef.current = { y: e.clientY };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isVideo || !pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch Pinch Zoom
    if (pointersRef.current.size >= 2 && pinchOriginRef.current) {
      const dist = pointerDistance();
      if (dist > 0) {
        setScale(clamp((pinchOriginRef.current.scale * dist) / pinchOriginRef.current.dist, 1, 5));
      }
      return;
    }

    // Pan when zoomed
    if (dragOriginRef.current && scale > 1) {
      setOffset({
        x: dragOriginRef.current.ox + (e.clientX - dragOriginRef.current.x),
        y: dragOriginRef.current.oy + (e.clientY - dragOriginRef.current.y),
      });
      return;
    }

    // Swipe down to dismiss gesture when at 1x scale
    if (swipeDismissStartRef.current && scale === 1) {
      const deltaY = e.clientY - swipeDismissStartRef.current.y;
      if (deltaY > 0) {
        setDismissY(deltaY);
      } else {
        setDismissY(0);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isVideo) return;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchOriginRef.current = null;
    if (pointersRef.current.size === 0) {
      dragOriginRef.current = null;
      setInteracting(false);

      if (dismissY > 90) {
        closeModal();
      } else {
        setDismissY(0);
      }
      swipeDismissStartRef.current = null;
    }
  };

  const handleDoubleClick = () => {
    if (isVideo) return;
    if (scale > 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isVideo) return;
    setScale((prev) => clamp(prev * (1 - e.deltaY * 0.002), 1, 5));
  };

  return (
    <div
      ref={a11yRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="fixed inset-0 z-(--z-toast) bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-fade-in overflow-hidden select-none"
      onClick={(e) => {
        // Dismiss if clicking background outside the image content
        if (e.target === e.currentTarget && scale === 1) {
          closeModal();
        }
      }}
    >
      {/* Top Header Bar — Strictly respects status bar & camera cutout safe area */}
      <div
        className="absolute top-0 inset-x-0 px-4 pb-4 flex items-center justify-between z-50 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none"
        style={{
          paddingTop: 'calc(0.75rem + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))',
        }}
      >
        <button
          onClick={closeModal}
          className="w-11 h-11 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full transition-all text-white backdrop-blur-md border border-white/15 active:scale-95 shadow-lg pointer-events-auto"
          aria-label="Close photo preview"
          title="Close"
        >
          <X size={22} strokeWidth={2.5} />
        </button>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleDownload}
            className="w-11 h-11 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full transition-all text-white backdrop-blur-md border border-white/15 active:scale-95 shadow-lg"
            aria-label="Download photo"
            title="Download"
          >
            <Download size={20} strokeWidth={2.2} />
          </button>

          {data.post && (
            <button
              onClick={() => setShowMenu(true)}
              className="w-11 h-11 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full transition-all text-white backdrop-blur-md border border-white/15 active:scale-95 shadow-lg"
              aria-label="More options"
              title="More"
            >
              <MoreHorizontal size={22} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area with Zoom, Pan and Smooth Gestures */}
      <div
        className="w-full h-full flex items-center justify-center p-2 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{
          transform: `translate3d(0, ${dismissY}px, 0)`,
          opacity: 1 - Math.min(dismissY / 300, 0.7),
          transition: interacting ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
        }}
      >
        {!loaded && !isVideo && (
          <Spinner size="large" className="text-white/60 absolute" />
        )}

        {isVideo ? (
          <video
            src={mediaUrl}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <img
            src={mediaUrl}
            alt="Preview"
            draggable={false}
            onLoad={() => setLoaded(true)}
            className="max-w-full max-h-full object-contain rounded-md shadow-2xl transition-opacity duration-200"
            style={{
              opacity: loaded ? 1 : 0,
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              transition: interacting ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'transform',
            }}
          />
        )}
      </div>

      {/* Bottom Menu (Action Modal for Post Media) */}
      {showMenu && (
        <div className="absolute inset-0 z-[60] flex flex-col justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowMenu(false)} />
          <div
            className="relative bg-white dark:bg-zinc-800 rounded-t-2xl p-4 animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.3)] border-t border-black/10 dark:border-white/10"
            style={{
              paddingBottom: 'calc(1rem + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))',
            }}
          >
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-zinc-600 rounded-full mx-auto mb-6 cursor-pointer" onClick={() => setShowMenu(false)} />

            <div className="space-y-1">
              <button
                onClick={handleDownload}
                className="w-full flex items-center gap-4 p-3 hover:bg-gray-100 dark:hover:bg-zinc-700/60 rounded-xl transition-colors text-left group"
              >
                <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-700 rounded-full flex items-center justify-center group-hover:bg-white dark:group-hover:bg-zinc-600 transition-colors">
                  <Bookmark size={20} className="text-gray-700 dark:text-zinc-200" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-gray-900 dark:text-white">Save to device</p>
                  <p className="text-[12px] text-gray-500 dark:text-zinc-300">Download this to your storage</p>
                </div>
              </button>

              <button
                onClick={handleHide}
                className="w-full flex items-center gap-4 p-3 hover:bg-gray-100 dark:hover:bg-zinc-700/60 rounded-xl transition-colors text-left group"
              >
                <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-700 rounded-full flex items-center justify-center group-hover:bg-white dark:group-hover:bg-zinc-600 transition-colors">
                  <EyeOff size={20} className="text-gray-700 dark:text-zinc-200" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-gray-900 dark:text-white">I don't want to see this</p>
                  <p className="text-[12px] text-gray-500 dark:text-zinc-300">Hide this post from your feed</p>
                </div>
              </button>

              <button
                onClick={() => { closeModal(); navigate('/support'); }}
                className="w-full flex items-center gap-4 p-3 hover:bg-gray-100 dark:hover:bg-zinc-700/60 rounded-xl transition-colors text-left group"
              >
                <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-700 rounded-full flex items-center justify-center group-hover:bg-white dark:group-hover:bg-zinc-600 transition-colors">
                  <AlertTriangle size={20} className="text-gray-700 dark:text-zinc-200" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-gray-900 dark:text-white">Find support or report media</p>
                  <p className="text-[12px] text-gray-500 dark:text-zinc-300">I'm concerned about this content</p>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowMenu(false)}
              className="w-full mt-4 py-3 bg-gray-100 dark:bg-zinc-700 font-bold text-gray-700 dark:text-zinc-200 rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        .animate-slide-up { animation: slide-up 0.15s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
