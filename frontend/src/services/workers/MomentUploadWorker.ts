import { useUploadStore, type UploadJob, type MomentMetadata } from '../../store/uploadStore';
import { UploadEventBus } from '../../utils/UploadEventBus';
import api from '../../api/api';
import { UploadFileDB } from '../uploadFileDB';
import { AuthService } from '../AuthService';
import { UploadError } from '../../utils/UploadError';
import { logger } from '../../utils/logger';
import { saveReelToDevice } from '../../features/reels/services/shareService';

// Active XHRs so UploadManager.cancelJob can abort in-flight moment uploads.
export const activeMomentXhrRequests = new Map<string, XMLHttpRequest>();

/**
 * Background worker for MOMENT (reel) publish jobs.
 * Uploads the rendered file to POST /moments with real progress, maps
 * server responses to job states (UPLOADING → PROCESSING → PUBLISHED),
 * and never leaves the job in a silent state on failure.
 */
export async function runMomentUploadWorker(job: UploadJob): Promise<string> {
  const { updateJob } = useUploadStore.getState();
  const meta = job.metadata as MomentMetadata;
  const file = await UploadFileDB.getFile(job.uploadId);

  if (!file) {
    throw new UploadError('FILE_ERROR', 'Reel file missing. Please create the reel again.', false);
  }

  UploadEventBus.emit('UPLOAD_STARTED', { uploadId: job.uploadId });

  return new Promise((resolve, reject) => {
    updateJob(job.uploadId, { status: 'UPLOADING', progress: 0 });
    UploadEventBus.emit('UPLOAD_PROGRESS', { uploadId: job.uploadId, progress: 0, status: 'UPLOADING' });

    let hasTokenRefreshed = false;

    const sendRequest = async () => {
      let token = '';
      try {
        token = await AuthService.getFreshToken();
      } catch (authErr) {
        reject(new UploadError('AUTH_ERROR', (authErr as Error).message || 'Session expired. Please sign in again.', false));
        return;
      }

      const xhr = new XMLHttpRequest();
      activeMomentXhrRequests.set(job.uploadId, xhr);

      const formData = new FormData();
      formData.append('media', file, file.name);
      Object.entries(meta.fields).forEach(([k, v]) => {
        if (v != null) formData.append(k, v);
      });

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          updateJob(job.uploadId, { progress: pct });
          UploadEventBus.emit('UPLOAD_PROGRESS', { uploadId: job.uploadId, progress: pct, status: 'UPLOADING' });
          // Upload bytes are fully on the wire — the server is now processing.
          if (pct >= 100) {
            updateJob(job.uploadId, { status: 'PROCESSING', progress: 97 });
            UploadEventBus.emit('UPLOAD_PROGRESS', { uploadId: job.uploadId, progress: 97, status: 'PROCESSING' });
          }
        }
      };

      xhr.onload = async () => {
        activeMomentXhrRequests.delete(job.uploadId);

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            const momentId: string | undefined = response?.moment?.moment_id;
            if (!momentId && !response?.deduplicated) {
              reject(new UploadError('SERVER_ERROR', 'The server did not confirm the reel. Retry — it will not duplicate.', true));
              return;
            }

            updateJob(job.uploadId, { status: 'PUBLISHED', progress: 100, serverMomentId: momentId });
            UploadEventBus.emit('UPLOAD_COMPLETED', { uploadId: job.uploadId, momentId, serverMomentId: momentId });

            // Optional save-to-device — publish already succeeded; a failure
            // here is best-effort and never rolls back the reel.
            if (meta.saveToDevice) {
              try {
                const ext = meta.fileExt || (file.type.split('/')[1] || 'mp4');
                await saveReelToDevice(file, `sparkle-${momentId || job.uploadId}.${ext}`);
              } catch (saveErr) {
                logger.warn('[MomentUploadWorker] save-to-device failed:', saveErr);
              }
            }

            resolve(momentId || job.uploadId);
          } catch {
            reject(new UploadError('SERVER_ERROR', 'Response processing failed. Please try again.', true));
          }
        } else {
          if (xhr.status === 401) {
            if (!hasTokenRefreshed) {
              hasTokenRefreshed = true;
              logger.log('[MomentUploadWorker] 401 response. Retrying with fresh token...');
              try {
                await AuthService.refreshAccessToken();
                sendRequest();
                return;
              } catch {
                // fall through to reject
              }
            }
            reject(new UploadError('AUTH_ERROR', 'Session expired. Please sign in again.', false));
          } else if (xhr.status === 403) {
            reject(new UploadError('AUTH_ERROR', 'You do not have permission to publish this reel.', false));
          } else if (xhr.status === 413) {
            reject(new UploadError('FILE_ERROR', 'File size is too large to upload.', false));
          } else if (xhr.status === 429) {
            const retryAfterHeader = xhr.getResponseHeader('Retry-After');
            const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 5000;
            reject(new UploadError('RATE_LIMIT', 'Too many requests. Please wait before retrying.', true, retryAfterMs));
          } else if (xhr.status >= 500) {
            reject(new UploadError('SERVER_ERROR', 'Server error. Please try again later.', true));
          } else {
            reject(new UploadError('SERVER_ERROR', 'Upload failed. Please try again.', true));
          }
        }
      };

      xhr.onerror = () => {
        activeMomentXhrRequests.delete(job.uploadId);
        reject(new UploadError('NETWORK_ERROR', 'Network request failed', true));
      };

      xhr.onabort = () => {
        activeMomentXhrRequests.delete(job.uploadId);
        UploadEventBus.emit('UPLOAD_CANCELLED', { uploadId: job.uploadId });
        reject(new Error('Upload canceled by user'));
      };

      xhr.open('POST', `${api.defaults.baseURL || '/api'}/moments`);
      xhr.timeout = 300_000;
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    };

    void sendRequest();
  });
}
