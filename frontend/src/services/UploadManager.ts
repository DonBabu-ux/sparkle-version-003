import { useUploadStore, type UploadJob } from '../store/uploadStore';
import { useNetworkStore } from '../store/networkStore';
import { runStoryUploadWorker, activeXhrRequests } from './workers/StoryUploadWorker';
import { UploadEventBus } from '../utils/UploadEventBus';
import { UploadFileDB } from '../services/uploadFileDB';
import { UploadError } from '../utils/UploadError';
import { logger } from '../utils/logger';

const runningJobs = new Set<string>();
const retryTimers = new Map<string, any>();

// Concurrency limits based on connection quality
function getConcurrencyLimit(): number {
  const { isOffline, quality } = useNetworkStore.getState();
  if (isOffline) return 0;
  
  switch (quality) {
    case 'strong':
      return 3;
    case 'weak':
    case 'unstable':
      return 2;
    case 'offline':
      return 0;
    default:
      return 1;
  }
}

export const UploadManager = {
  init() {
    logger.log('[UploadManager] Initializing background upload scheduler...');

    // Subscribe to store changes to trigger wake when new jobs are added
    useUploadStore.subscribe((state) => {
      // Clean up canceled requests if they are still running
      state.jobs.forEach((job) => {
        if (job.status === 'CANCELLED' && runningJobs.has(job.uploadId)) {
          const xhr = activeXhrRequests.get(job.uploadId);
          if (xhr) {
            xhr.abort();
            activeXhrRequests.delete(job.uploadId);
          }
          runningJobs.delete(job.uploadId);
          this.wake();
        }
      });

      this.wake();
    });

    // Subscribe to network changes to resume when online
    useNetworkStore.subscribe(() => {
      this.wake();
    });

    // Event listeners
    window.addEventListener('online', () => {
      logger.log('[UploadManager] Internet restored, waking queue...');
      this.wake();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        logger.log('[UploadManager] App foregrounded, waking queue...');
        this.wake();
      }
    });

    // Run initial wake
    this.wake();
  },

  wake() {
    const { jobs } = useUploadStore.getState();
    const limit = getConcurrencyLimit();

    if (limit === 0) {
      logger.log('[UploadManager] Scheduler paused: Network is offline.');
      return;
    }

    if (runningJobs.size >= limit) {
      return; // Concurrency limit reached
    }

    // Filter and sort queued jobs: Priority HIGH first, then NORMAL, then LOW
    const queuedJobs = jobs
      .filter((job) => job.status === 'QUEUED' && !runningJobs.has(job.uploadId))
      .sort((a, b) => {
        const priorityWeight = { HIGH: 3, NORMAL: 2, LOW: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      });

    if (queuedJobs.length === 0) return;

    // Start as many jobs as allowed by concurrency limits
    const slotsAvailable = limit - runningJobs.size;
    const jobsToStart = queuedJobs.slice(0, slotsAvailable);

    jobsToStart.forEach((job) => {
      this.startJob(job);
    });
  },

  async startJob(job: UploadJob) {
    const { updateJob } = useUploadStore.getState();
    runningJobs.add(job.uploadId);

    logger.log(`[UploadManager] Starting job ${job.uploadId} (Priority: ${job.priority})`);

    try {
      if (job.type === 'STORY') {
        await runStoryUploadWorker(job);
      } else {
        throw new Error(`Unsupported upload type: ${job.type}`);
      }

      // Success cleanup
      runningJobs.delete(job.uploadId);
      this.cleanupJobAssets(job.uploadId);
      this.wake();

    } catch (err: any) {
      runningJobs.delete(job.uploadId);
      const isCanceled = err.message?.includes('canceled') || err.message?.includes('abort');

      if (isCanceled) {
        logger.log(`[UploadManager] Job ${job.uploadId} canceled successfully.`);
        this.cleanupJobAssets(job.uploadId);
        this.wake();
        return;
      }

      logger.error(`[UploadManager] Job ${job.uploadId} failed:`, err.message);

      // Handle specific error classifications if it's an UploadError
      if (err instanceof UploadError) {
        if (err.type === 'AUTH_ERROR') {
          // No auto-retry, require user action (re-login / click retry)
          updateJob(job.uploadId, { 
            status: 'FAILED', 
            error: err.userMessage || 'Authentication expired. Please log in again.' 
          });
          UploadEventBus.emit('UPLOAD_FAILED', { uploadId: job.uploadId, error: err.userMessage, isRetrying: false });
          this.wake();
          return;
        }

        if (err.type === 'NETWORK_ERROR') {
          // NETWORK_ERROR is retried when the browser goes online or online event fires.
          // We do not increment the retryCount to prevent transient cellular drops from failing the job.
          updateJob(job.uploadId, { 
            status: 'FAILED', 
            error: 'Network connection lost. Will retry when connection is restored.' 
          });
          UploadEventBus.emit('UPLOAD_FAILED', { uploadId: job.uploadId, error: err.userMessage, isRetrying: true });
          this.wake();
          return;
        }

        if (err.type === 'RATE_LIMIT') {
          // Retry after the specified duration, do not count against standard retry count
          const delayMs = err.retryAfterMs || 5000;
          updateJob(job.uploadId, { 
            status: 'FAILED', 
            error: `Rate limited. Retrying in ${delayMs / 1000}s...` 
          });
          UploadEventBus.emit('UPLOAD_FAILED', { uploadId: job.uploadId, error: err.userMessage, isRetrying: true });

          if (retryTimers.has(job.uploadId)) {
            clearTimeout(retryTimers.get(job.uploadId));
          }

          const timer = setTimeout(() => {
            retryTimers.delete(job.uploadId);
            updateJob(job.uploadId, { status: 'QUEUED', error: null });
            this.wake();
          }, delayMs);

          retryTimers.set(job.uploadId, timer);
          return;
        }

        if (err.type === 'FILE_ERROR') {
          // Permanent failure, no retry.
          updateJob(job.uploadId, { 
            status: 'FAILED', 
            error: err.userMessage || 'Invalid file format or file size too large.' 
          });
          UploadEventBus.emit('UPLOAD_FAILED', { uploadId: job.uploadId, error: err.userMessage, isRetrying: false });
          this.wake();
          return;
        }
      }

      // Default retry strategy: Exponential backoff for SERVER_ERROR or general errors
      const preventRetry = err.preventRetry === true;
      const { jobs } = useUploadStore.getState();
      const currentJob = jobs.find((j) => j.uploadId === job.uploadId);
      const currentRetry = currentJob ? currentJob.retryCount : 0;

      if (currentRetry < 3 && !preventRetry) {
        const nextRetry = currentRetry + 1;
        const delayMs = Math.pow(2, nextRetry) * 1000; // 2s, 4s, 8s

        updateJob(job.uploadId, { 
          retryCount: nextRetry, 
          status: 'FAILED', // Temporarily marked failed until backoff timer fires
          error: `Failed (Attempt ${nextRetry}/3). Retrying in ${delayMs / 1000}s...` 
        });
        UploadEventBus.emit('UPLOAD_FAILED', { uploadId: job.uploadId, error: err.message, isRetrying: true });

        // Clear existing timer if any
        if (retryTimers.has(job.uploadId)) {
          clearTimeout(retryTimers.get(job.uploadId));
        }

        const timer = setTimeout(() => {
          retryTimers.delete(job.uploadId);
          updateJob(job.uploadId, { status: 'QUEUED', error: null });
          this.wake();
        }, delayMs);

        retryTimers.set(job.uploadId, timer);

      } else {
        // Permanent failure
        updateJob(job.uploadId, { 
          status: 'FAILED', 
          error: err.userMessage || err.message || 'Upload failed after 3 attempts.' 
        });
        UploadEventBus.emit('UPLOAD_FAILED', { uploadId: job.uploadId, error: err.message, isRetrying: false });
        this.wake();
      }
    }
  },

  cleanupJobAssets(uploadId: string) {
    const { jobs } = useUploadStore.getState();
    const job = jobs.find((j) => j.uploadId === uploadId);

    if (job) {
      if (job.localUri && job.localUri.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(job.localUri);
        } catch (e) {}
      }
      if (job.thumbnailUri && job.thumbnailUri.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(job.thumbnailUri);
        } catch (e) {}
      }
    }

    UploadFileDB.deleteFile(uploadId).catch(logger.error);
    if (retryTimers.has(uploadId)) {
      clearTimeout(retryTimers.get(uploadId));
      retryTimers.delete(uploadId);
    }
  }
};
