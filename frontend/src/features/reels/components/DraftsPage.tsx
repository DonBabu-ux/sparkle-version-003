import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Trash2, Play, HardDrive, ChevronRight } from 'lucide-react';
import { listDrafts, deleteDraft, formatBytes, type DraftListItem } from '../services/draftService';
import DraftPreview from './DraftPreview';
import { InlineSpinner, PINK } from './shell';
import { useCreateMomentsTheme } from '../useCreateMomentsTheme';
import { showError, showSuccess } from '../../../utils/toast';
import { logger } from '../../../utils/logger';

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(diff / 86_400_000);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Reel drafts manager: retrieves drafts stored on this device, resume/delete with confirm. */
export default function DraftsPage() {
  const navigate = useNavigate();
  const { isDark } = useCreateMomentsTheme();
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDrafts();
      setDrafts(res.drafts);
      setTotalBytes(res.totalBytes);
    } catch (err) {
      logger.warn('[Drafts] load failed:', err);
      setError('Could not read drafts from this device. Storage may be unavailable — try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDraft(id);
      setDrafts(prev => prev.filter(d => d.draft_id !== id));
      showSuccess('Draft deleted');
    } catch (err) {
      logger.warn('[Drafts] delete failed:', err);
      showError('Could not delete this draft. Try again.');
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const handleResume = async (id: string) => {
    setResumingId(id);
    // resumeDraft runs inside CreateReelFlow via ?draft= so all media
    // rehydration + session state lives in one place.
    navigate(`/moments/create?draft=${encodeURIComponent(id)}`);
    setResumingId(null);
  };

  return (
    <div className="min-h-[100dvh]" style={{ background: isDark ? '#0B070C' : '#FFFFFF', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header
        className="sticky top-0 z-20 flex items-center gap-2 px-3 h-14"
        style={{
          background: isDark ? 'rgba(11,7,12,0.96)' : 'rgba(255,255,255,0.96)',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E5E7EB',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6',
            color: isDark ? '#fff' : '#111827',
          }}
        >
          <ArrowLeft size={19} />
        </button>
        <h1 className={`font-extrabold text-[17px] ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Varela Round', sans-serif" }}>
          Drafts
        </h1>
        <span className={`ml-auto text-[12px] pr-2 ${isDark ? 'text-white/45' : 'text-gray-500'}`}>
          {drafts.length} saved · {formatBytes(totalBytes)}
        </span>
      </header>

      <div className="px-4 pt-4 pb-10">
        <div
          className="flex items-center gap-2 rounded-2xl px-3.5 py-3 mb-4"
          style={{ background: 'rgba(255,0,110,0.1)', border: '1px solid rgba(255,0,110,0.25)' }}
        >
          <HardDrive size={16} color={PINK} />
          <p className={`text-[12px] leading-snug ${isDark ? "text-white/70" : "text-gray-700"}`}>
            Drafts are saved on this device only — clips, captions and settings stay private until you post.
            Drafts are saved on this device only — clips, captions and settings stay private until you post.
          </p>
        </div>

        {loading && (
          <div className={`flex items-center gap-3 justify-center py-12 text-sm ${isDark ? "text-white/60" : "text-gray-500"}`}>
            <InlineSpinner /> Loading drafts…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl px-4 py-4 text-center" style={{ background: 'rgba(255,80,80,0.12)' }}>
            <p className="text-[#FFC9C9] text-sm mb-3">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="px-5 py-2 rounded-xl font-bold text-white text-sm"
              style={{ background: PINK }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && drafts.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }}>
              <FileText size={26} color={isDark ? "rgba(255,255,255,0.5)" : "#9CA3AF"} />
            </div>
            <p className={`text-sm ${isDark ? "text-white/70" : "text-gray-700"}`}>No drafts yet.</p>
            <button
              type="button"
              onClick={() => navigate('/moments/create')}
              className="px-6 py-3 rounded-2xl font-bold text-white"
              style={{ background: '#ff1493' }}
            >
              Create a reel
            </button>
          </div>
        )}

        {!loading && !error && drafts.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {drafts.map(d => {
              const clipCount = Array.isArray(d.media_refs) ? d.media_refs.length : 0;
              const meta = d.metadata || {};
              const duration = Number(meta.durationSec) || 0;
              return (
                <li
                  key={d.draft_id}
                  className="rounded-2xl px-3 py-3 flex items-center gap-3"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB'}`,
                  }}
                >
                  <div
                    className="w-14 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                    style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6' }}
                  >
                    <DraftPreview
                      draft={d}
                      className="w-full h-full object-cover"
                      fallback={<FileText size={20} color={PINK} />}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleResume(d.draft_id)}
                    disabled={resumingId === d.draft_id}
                    className="flex-1 min-w-0 text-left"
                    aria-label={`Resume draft ${d.title || 'Untitled reel'}`}
                  >
                    <span className={`block text-[14px] font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                      {d.title || 'Untitled reel'}
                    </span>
                    <span className={`block text-[12px] truncate ${isDark ? "text-white/50" : "text-gray-500"}`}>
                      {clipCount} clip{clipCount === 1 ? '' : 's'}
                      {duration ? ` · ${duration.toFixed(1)}s` : ''}
                      {meta.audience ? ` · ${meta.audience.replace('_', ' ')}` : ''}
                    </span>
                    <span className={`block text-[11px] ${isDark ? "text-white/35" : "text-gray-400"}`}>
                      Updated {timeAgo(d.updated_at)} · {formatBytes(d.storage_bytes || 0)}
                    </span>
                  </button>

                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleResume(d.draft_id)}
                      disabled={resumingId === d.draft_id}
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: PINK, color: '#fff' }}
                      aria-label="Resume this draft"
                      title="Resume"
                    >
                      {resumingId === d.draft_id ? <InlineSpinner size={15} color="#fff" /> : <Play size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(d.draft_id)}
                      disabled={deletingId === d.draft_id}
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,60,60,0.16)', color: '#FF9C9C' }}
                      aria-label="Delete this draft"
                      title="Delete"
                    >
                      {deletingId === d.draft_id ? <InlineSpinner size={14} color="#FF9C9C" /> : <Trash2 size={16} />}
                    </button>
                  </div>

                  <ChevronRight size={16} color={isDark ? "rgba(255,255,255,0.3)" : "#9CA3AF"} className="shrink-0" />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmId && (
        <div
          className="fixed inset-0 z-[var(--z-modal,60)] flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          role="alertdialog"
          aria-modal="true"
          aria-label="Delete draft"
        >
          <div className="w-full max-w-sm rounded-3xl p-6 text-center" style={{
            background: isDark ? '#16101A' : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'}`,
            boxShadow: isDark ? 'none' : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}>
            <h2 className={`font-extrabold text-lg mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Varela Round', sans-serif" }}>
              Delete this draft?
            </h2>
            <p className={`text-sm mb-6 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
              The saved clips and settings for this draft will be removed. This can't be undone.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="w-full py-3 rounded-2xl font-bold text-white"
                style={{ background: '#ff1493' }}
              >
                Keep draft
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(confirmId)}
                className="w-full py-3 rounded-2xl font-bold"
                style={{ background: 'rgba(255,60,60,0.18)', color: '#FF9C9C' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
