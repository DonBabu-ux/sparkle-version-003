import { useEffect, useState } from 'react';
import { Loader2, X, RefreshCw, AlertCircle } from 'lucide-react';
import { useUploadStore, type UploadJob } from '../../../store/uploadStore';
import { UploadFileDB } from '../../../services/uploadFileDB';
import { UploadManager } from '../../../services/UploadManager';
import { generateVideoThumbnail } from '../../../utils/thumbnailGenerator';
import { logger } from '../../../utils/logger';

const RING_R = 22;
const RING_CIRC = 2 * Math.PI * RING_R;

/**
 * Pending reel tile in the owner's profile Reels grid: real first-frame
 * thumbnail, live circular progress ring, distinct PROCESSING state, and
 * retry/discard actions for failed background uploads.
 */
export default function PendingReelTile({ job, viewMode }: { job: UploadJob; viewMode: 'grid' | 'list' }) {
  const updateJob = useUploadStore((s) => s.updateJob);
  const cancelJob = useUploadStore((s) => s.cancelJob);
  const discardJob = useUploadStore((s) => s.discardJob);
  const [thumb, setThumb] = useState<string | null>(
    job.thumbnailUri && job.thumbnailUri.startsWith('blob:') ? job.thumbnailUri : null,
  );

  // After a page reload the stored thumbnailUri is a dead blob: URL —
  // re-extract a real frame from the IndexedDB-held file.
  useEffect(() => {
    if (thumb) return;
    let alive = true;
    let created: string | null = null;
    void (async () => {
      try {
        const file = await UploadFileDB.getFile(job.uploadId);
        if (!file || !alive) return;
        const thumbFile = await generateVideoThumbnail(file, 0.5);
        if (!alive) return;
        created = URL.createObjectURL(thumbFile);
        setThumb(created);
      } catch (err) {
        logger.warn('[PendingReelTile] thumbnail extraction failed:', err);
      }
    })();
    return () => {
      alive = false;
      // The tile owns only the fallback-extracted URL; job.thumbnailUri is
      // revoked by the store on cleanup.
      if (created) {
        try { URL.revokeObjectURL(created); } catch (_) { /* already gone */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.uploadId, thumb]);

  const isProcessing = job.status === 'PROCESSING' || job.status === 'VERIFYING';
  const isFailed = job.status === 'FAILED';
  const pct = Math.max(0, Math.min(100, job.progress || 0));
  const dash = (pct / 100) * RING_CIRC;

  const statusLabel = isFailed
    ? 'Upload failed'
    : isProcessing
      ? 'Processing…'
      : job.status === 'QUEUED' || job.status === 'LOCAL'
        ? 'Waiting to upload…'
        : `Uploading ${pct}%`;

  return (
    <div
      className={`relative overflow-hidden bg-gray-100 dark:bg-white/5 ${viewMode === 'grid' ? 'aspect-square' : 'aspect-[4/3] md:aspect-[3/2] h-48'}`}
      role="status"
      aria-label={`Reel upload ${statusLabel}`}
    >
      {thumb ? (
        <img src={thumb} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FF6B8B]/25 to-purple-500/15">
          <Loader2 size={28} className="text-[#FF1F6D] animate-spin" />
        </div>
      )}

      <div className="absolute inset-0 bg-black/45" />

      {/* Circular progress ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r={RING_R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
          <circle
            cx="28"
            cy="28"
            r={RING_R}
            fill="none"
            stroke={isFailed ? '#EF4444' : isProcessing ? '#A78BFA' : '#FF1F6D'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${RING_CIRC - dash}`}
            transform="rotate(-90 28 28)"
          />
          {isFailed ? (
            <g transform="translate(20 20)">
              <path d="M2 2 L12 12 M12 2 L2 12" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          ) : isProcessing ? (
            <text x="28" y="32" textAnchor="middle" fontSize="14" fill="white" fontWeight="700">⋯</text>
          ) : (
            <text x="28" y="32" textAnchor="middle" fontSize="11" fill="white" fontWeight="700">{pct}</text>
          )}
        </svg>
      </div>

      {/* Status strip */}
      <div className="absolute bottom-0 inset-x-0 px-2.5 py-2 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-white text-[11px] font-bold drop-shadow-md truncate">
          {statusLabel}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isFailed ? (
            <>
              <button
                type="button"
                aria-label="Retry upload"
                onClick={() => {
                  updateJob(job.uploadId, { status: 'QUEUED', progress: 0, error: null });
                  UploadManager.wake();
                }}
                className="w-7 h-7 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <RefreshCw size={13} />
              </button>
              <button
                type="button"
                aria-label="Discard failed upload"
                onClick={() => discardJob(job.uploadId)}
                className="w-7 h-7 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-label="Cancel upload"
              onClick={() => cancelJob(job.uploadId)}
              className="w-7 h-7 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {job.error && (
        <div className="absolute top-2 left-2 right-2 flex items-center gap-1.5">
          <AlertCircle size={12} className="text-red-400 shrink-0" />
          <span className="text-red-200 text-[10px] font-semibold drop-shadow line-clamp-1">{job.error}</span>
        </div>
      )}
    </div>
  );
}
