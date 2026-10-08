import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUploadStore, type UploadJob } from '../../store/uploadStore';
import { useNetworkStore } from '../../store/networkStore';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronUp, ChevronDown, CheckCircle, AlertTriangle, 
  X, RefreshCw, Trash2, Play, CloudUpload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadEventBus } from '../../utils/UploadEventBus';
import { create } from 'zustand';

// Decoupled notification store to track visibility independent of raw upload jobs
interface UploadNotificationState {
  hiddenJobs: string[];
  dismissedJobs: string[];
  hideJob: (uploadId: string) => void;
  dismissJob: (uploadId: string) => void;
  resetJob: (uploadId: string) => void;
}

export const useUploadNotificationStore = create<UploadNotificationState>((set) => ({
  hiddenJobs: [],
  dismissedJobs: [],
  hideJob: (uploadId) => set((s) => ({ hiddenJobs: [...s.hiddenJobs, uploadId] })),
  dismissJob: (uploadId) => set((s) => ({ dismissedJobs: [...s.dismissedJobs, uploadId] })),
  resetJob: (uploadId) => set((s) => ({
    hiddenJobs: s.hiddenJobs.filter(id => id !== uploadId),
    dismissedJobs: s.dismissedJobs.filter(id => id !== uploadId)
  })),
}));

export default function UploadNotificationCenter() {
  const { jobs, retryJob, cancelJob, discardJob } = useUploadStore();
  const { isOffline } = useNetworkStore();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const { hiddenJobs, dismissedJobs, hideJob, dismissJob, resetJob } = useUploadNotificationStore();

  // Active uploads are jobs in states that are not final, and are not hidden
  const activeJobs = jobs.filter(
    (j) => 
      j.status !== 'PUBLISHED' && 
      j.status !== 'CANCELLED' && 
      j.status !== 'FAILED' &&
      !hiddenJobs.includes(j.uploadId)
  );

  const failedJobs = jobs.filter(
    (j) => 
      j.status === 'FAILED' && 
      !hiddenJobs.includes(j.uploadId) &&
      !dismissedJobs.includes(j.uploadId)
  );
  
  const completedJobs = jobs.filter(
    (j) => 
      j.status === 'PUBLISHED' && 
      !dismissedJobs.includes(j.uploadId)
  );

  const totalActiveCount = activeJobs.length + failedJobs.length;

  // On mount, auto-dismiss any jobs that are already in final status (so they don't pop up on page load)
  useEffect(() => {
    jobs.forEach(job => {
      if (job.status === 'PUBLISHED' || job.status === 'CANCELLED') {
        dismissJob(job.uploadId);
      }
    });
  }, []); // Run once on mount
  
  // Listen to completed/failed events from the bus to unhide them and show final status toasts
  useEffect(() => {
    const unbindCompleted = UploadEventBus.on('UPLOAD_COMPLETED', (data) => {
      if (data?.uploadId) {
        resetJob(data.uploadId);
      }
    });

    const unbindFailed = UploadEventBus.on('UPLOAD_FAILED', (data) => {
      if (data?.uploadId) {
        resetJob(data.uploadId);
      }
    });

    return () => {
      unbindCompleted();
      unbindFailed();
    };
  }, [resetJob]);

  // ── Auto-dismiss completed jobs after 9 s, resettable on interaction ──
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      completedJobs.forEach(j => dismissJob(j.uploadId));
    }, 9000);
  }, [completedJobs, dismissJob]);

  // Start timer whenever a new completed job appears
  useEffect(() => {
    if (completedJobs.length > 0) {
      startDismissTimer();
    } else {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    }
    return () => { if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current); };
  }, [completedJobs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset timer on user interaction with the banner
  const handleBannerInteraction = useCallback(() => {
    if (completedJobs.length > 0) startDismissTimer();
  }, [completedJobs.length, startDismissTimer]);

  if (jobs.length === 0) return null;

  // Calculate overall progress of active jobs
  const averageProgress = activeJobs.length > 0 
    ? Math.round(activeJobs.reduce((sum, j) => sum + j.progress, 0) / activeJobs.length)
    : 0;

  // Total visible jobs in the banner overlay
  const totalVisibleCount = activeJobs.length + failedJobs.length + completedJobs.length;
  if (totalVisibleCount === 0) return null;

  return (
    <div
      className="fixed top-4 left-4 right-4 md:left-auto md:right-8 md:w-[380px] z-(--z-top) pointer-events-none"
      onMouseEnter={handleBannerInteraction}
      onTouchStart={handleBannerInteraction}
    >
      <AnimatePresence>
        {totalVisibleCount > 0 ? (
          <motion.div
            initial={{ y: -50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0, scale: 0.95 }}
            className="pointer-events-auto bg-[#0a0a0c]/85 dark:bg-[#0a0a0c]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Header / Summary Card */}
            <div 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-4 flex items-center justify-between cursor-pointer active:bg-white/5 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  failedJobs.length > 0 
                    ? 'bg-rose-500/20 text-rose-500' 
                    : activeJobs.length > 0 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-emerald-500/20 text-emerald-500'
                }`}>
                  {failedJobs.length > 0 ? (
                    <AlertTriangle size={16} />
                  ) : activeJobs.length > 0 ? (
                    <CloudUpload size={16} className="animate-pulse" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                </div>
                <div>
                  <h4 className="text-[13px] font-black uppercase tracking-wider text-white">
                    {failedJobs.length > 0 
                      ? `Upload failed (${failedJobs.length})`
                      : activeJobs.length > 0 
                        ? `Uploading ${activeJobs.length} story${activeJobs.length > 1 ? 's' : ''}`
                        : 'Your story is live'
                    }
                  </h4>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
                    {isOffline 
                      ? 'Waiting for connection...' 
                      : activeJobs.length > 0 
                        ? `${averageProgress}% completed` 
                        : 'Tap to view details'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    // Hide active/failed; Dismiss completed
                    activeJobs.forEach(j => hideJob(j.uploadId));
                    failedJobs.forEach(j => hideJob(j.uploadId));
                    completedJobs.forEach(j => dismissJob(j.uploadId));
                  }}
                  className="text-[10px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-2.5 py-1.5 rounded-lg transition-all"
                >
                  {completedJobs.length > 0 && activeJobs.length === 0 && failedJobs.length === 0 ? 'Dismiss' : 'Hide'}
                </button>
                <button className="text-white/40 hover:text-white p-1">
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </button>
              </div>
            </div>

            {/* Consolidated Linear Progress Bar (Only visible when collapsed and active) */}
            {!isExpanded && activeJobs.length > 0 && (
              <div className="w-full h-1 bg-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 transition-all duration-300"
                  style={{ width: `${averageProgress}%` }}
                />
              </div>
            )}

            {/* Expanded List Items */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="border-t border-white/5 overflow-hidden"
                >
                  <div className="max-h-[280px] overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {jobs
                      .filter(
                        (job) => 
                          (job.status !== 'PUBLISHED' && job.status !== 'CANCELLED' && job.status !== 'FAILED' && !hiddenJobs.includes(job.uploadId)) ||
                          (job.status === 'FAILED' && !hiddenJobs.includes(job.uploadId) && !dismissedJobs.includes(job.uploadId)) ||
                          (job.status === 'PUBLISHED' && !dismissedJobs.includes(job.uploadId))
                      )
                      .map((job) => (
                        <div key={job.uploadId} className="bg-white/5 rounded-xl border border-white/5 overflow-hidden relative group">

                          {/* ── Published state ── */}
                          {job.status === 'PUBLISHED' ? (
                            <div className="flex gap-3 p-3">
                              {/* Sharp thumbnail with green check */}
                              <div className="w-14 h-[76px] bg-black rounded-lg overflow-hidden relative flex-shrink-0 border border-white/10">
                                {job.thumbnailUri ? (
                                  <img
                                    src={job.thumbnailUri}
                                    alt="Story"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                    <CheckCircle size={20} className="text-emerald-400" />
                                  </div>
                                )}
                                {/* Green success badge */}
                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full border-2 border-[#0a0a0c] flex items-center justify-center shadow">
                                  <CheckCircle size={10} className="text-white" strokeWidth={3} />
                                </div>
                              </div>

                              {/* Published info + CTAs */}
                              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                <p className="text-[13px] font-black text-white tracking-tight">
                                  Story Published <span aria-hidden="true">🌟</span>
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  {job.serverStoryId && (
                                    <button
                                      onClick={() => navigate(`/stories/${job.serverStoryId}`)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-[11px] font-black rounded-lg shadow-md transition-all active:scale-95"
                                    >
                                      View Story <span aria-hidden="true">→</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => dismissJob(job.uploadId)}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[11px] font-black rounded-lg transition-all active:scale-95"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (

                          /* ── Uploading / queued / failed state ── */
                          <div className="flex gap-3 p-3">
                            {/* Blurred thumbnail or gradient */}
                            <div className="w-14 h-[76px] bg-black rounded-lg overflow-hidden relative flex-shrink-0 border border-white/10">
                              {job.thumbnailUri ? (
                                <img
                                  src={job.thumbnailUri}
                                  alt="Story"
                                  className="w-full h-full object-cover blur-[3px] scale-105 transition-all duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-white/20">
                                  <Play size={16} />
                                </div>
                              )}

                              {/* Spinner overlay */}
                              {(job.status === 'UPLOADING' || job.status === 'GENERATING_THUMBNAIL' || job.status === 'COMPRESSING') && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                              )}
                            </div>

                            {/* Details and actions */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                              <div>
                                <div className="flex justify-between items-start">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-primary italic">
                                    {job.type} • {job.priority} Priority
                                  </span>

                                  {/* Fail actions */}
                                  {job.status === 'FAILED' && (
                                    <div className="flex items-center gap-1.5">
                                      <button onClick={() => { retryJob(job.uploadId); resetJob(job.uploadId); }} className="p-1.5 rounded-md bg-white/5 text-emerald-400 hover:bg-white/10 active:scale-90 transition-all" title="Retry upload">
                                        <RefreshCw size={12} />
                                      </button>
                                      <button onClick={() => hideJob(job.uploadId)} className="px-2 py-1 rounded-md bg-white/5 text-white/60 hover:bg-white/10 active:scale-90 transition-all text-[10px] font-black uppercase" title="Hide">
                                        Hide
                                      </button>
                                      <button onClick={() => discardJob(job.uploadId)} className="p-1.5 rounded-md bg-white/5 text-rose-400 hover:bg-white/10 active:scale-90 transition-all" title="Discard">
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}

                                  {/* Active actions: Hide + Cancel */}
                                  {(job.status === 'UPLOADING' || job.status === 'QUEUED' || job.status === 'GENERATING_THUMBNAIL' || job.status === 'COMPRESSING') && (
                                    <div className="flex items-center gap-1.5">
                                      <button onClick={() => hideJob(job.uploadId)} className="px-2 py-1 rounded-md bg-white/5 text-white/60 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-[10px] font-black uppercase">
                                        Hide
                                      </button>
                                      <button onClick={() => cancelJob(job.uploadId)} className="px-2 py-1 rounded-md bg-white/5 text-rose-400 hover:bg-white/10 hover:text-rose-500 active:scale-90 transition-all text-[10px] font-black uppercase">
                                        Cancel
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <p className="text-[12px] font-black uppercase italic tracking-tight text-white mt-1 truncate">
                                  {job.status === 'GENERATING_THUMBNAIL' ? 'Generating thumbnail...'
                                   : job.status === 'COMPRESSING' ? 'Compressing story media...'
                                   : job.status === 'UPLOADING' ? 'Uploading story...'
                                   : job.status === 'VERIFYING' ? 'Finalizing with server...'
                                   : job.status === 'PROCESSING' ? 'Processing video...'
                                   : job.status === 'FAILED' ? (job.error || 'Upload failed')
                                   : job.status === 'CANCELLED' ? 'Upload cancelled'
                                   : 'Queued'}
                                </p>
                              </div>

                              {/* Progress bar + % */}
                              <div className="mt-2">
                                <div className="flex justify-between items-center text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">
                                  <span>{job.status}</span>
                                  <span>{job.progress}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 rounded-full ${
                                      job.status === 'FAILED'
                                        ? 'bg-rose-500'
                                        : 'bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500'
                                    }`}
                                    style={{ width: `${job.progress}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          )}
                        </div>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
