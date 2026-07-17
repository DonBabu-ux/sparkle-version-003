import { useUploadStore, type UploadJob } from '../../store/uploadStore';
import { UploadEventBus } from '../../utils/UploadEventBus';
import { generateVideoThumbnail } from '../../utils/thumbnailGenerator';
import api from '../../api/api';
import { UploadFileDB } from '../uploadFileDB';
import { AuthService } from '../AuthService';
import { UploadError } from '../../utils/UploadError';

// Keep track of active requests so we can cancel them
export const activeXhrRequests = new Map<string, XMLHttpRequest>();

export async function runStoryUploadWorker(job: UploadJob): Promise<string> {
  const { updateJob } = useUploadStore.getState();
  const file = await UploadFileDB.getFile(job.uploadId);
  
  if (!file && job.metadata.textContent === undefined) {
    throw new UploadError('FILE_ERROR', 'No media file or text content found in cache for upload ID: ' + job.uploadId, false);
  }

  // Event: Started
  UploadEventBus.emit('UPLOAD_STARTED', { uploadId: job.uploadId });

  // Phase 1: Thumbnail Generation (if video & not yet done)
  let thumbnailFile: File | null = null;
  const isVideo = file && file.type.startsWith('video/');
  
  if (isVideo && !job.thumbnailUri) {
    updateJob(job.uploadId, { status: 'GENERATING_THUMBNAIL', progress: 5 });
    UploadEventBus.emit('UPLOAD_PROGRESS', { uploadId: job.uploadId, progress: 5, status: 'GENERATING_THUMBNAIL' });
    
    try {
      thumbnailFile = await generateVideoThumbnail(file);
      const thumbUrl = URL.createObjectURL(thumbnailFile);
      updateJob(job.uploadId, { thumbnailUri: thumbUrl, progress: 10 });
      UploadEventBus.emit('UPLOAD_PROGRESS', { uploadId: job.uploadId, progress: 10, status: 'GENERATING_THUMBNAIL' });
    } catch (err) {
      console.warn('[StoryUploadWorker] Thumbnail extraction failed, fallback to normal upload:', err);
    }
  }

  // Phase 2: Compression/Prereading Simulation
  updateJob(job.uploadId, { status: 'COMPRESSING', progress: 15 });
  UploadEventBus.emit('UPLOAD_PROGRESS', { uploadId: job.uploadId, progress: 15, status: 'COMPRESSING' });
  await new Promise((resolve) => setTimeout(resolve, 600)); // Fast micro-delay for visual satisfaction
  updateJob(job.uploadId, { progress: 30 });
  UploadEventBus.emit('UPLOAD_PROGRESS', { uploadId: job.uploadId, progress: 30, status: 'COMPRESSING' });

  // Phase 3: Multipart upload using XMLHttpRequest
  return new Promise((resolve, reject) => {
    updateJob(job.uploadId, { status: 'UPLOADING' });
    UploadEventBus.emit('UPLOAD_PROGRESS', { uploadId: job.uploadId, progress: 30, status: 'UPLOADING' });

    let hasTokenRefreshed = false;

    const sendRequest = async () => {
      let token = '';
      try {
        token = await AuthService.getFreshToken();
      } catch (authErr: any) {
        reject(new UploadError('AUTH_ERROR', authErr.message || 'Session expired. Please sign in again.', false));
        return;
      }

      const xhr = new XMLHttpRequest();
      activeXhrRequests.set(job.uploadId, xhr);

      const formData = new FormData();
      if (file && file.size > 0) {
        formData.append('media', file);
      }
      if (thumbnailFile) {
        formData.append('thumbnail', thumbnailFile);
      }

      // Append metadata
      if (job.metadata.textContent) {
        formData.append('text_content', job.metadata.textContent);
        formData.append('type', 'text');
      }
      if (job.metadata.textConfig) {
        formData.append('text_config', job.metadata.textConfig);
      }
      if (job.metadata.stickers) {
        formData.append('stickers', job.metadata.stickers);
      }
      if (job.metadata.parentStoryId) {
        formData.append('parent_story_id', job.metadata.parentStoryId);
      }
      if (job.metadata.musicInfo) {
        formData.append('music_info', job.metadata.musicInfo);
      }
      // v2 Layer Engine fields
      if (job.metadata.storyLayers) {
        formData.append('story_layers', job.metadata.storyLayers);
      }
      if (job.metadata.storyDuration !== undefined) {
        formData.append('story_duration', String(job.metadata.storyDuration));
      }
      if (job.metadata.storyTheme) {
        formData.append('story_theme', job.metadata.storyTheme);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const uploadPercent = Math.round((event.loaded / event.total) * 100);
          // Map 0-100% upload progress to 30% - 90% range of the job
          const totalProgress = 30 + Math.round(uploadPercent * 0.6);
          updateJob(job.uploadId, { progress: totalProgress });
          UploadEventBus.emit('UPLOAD_PROGRESS', { uploadId: job.uploadId, progress: totalProgress, status: 'UPLOADING' });
        }
      };

      xhr.onload = async () => {
        activeXhrRequests.delete(job.uploadId);
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            const serverStoryId = response.story_id;
            
            updateJob(job.uploadId, { status: 'VERIFYING', progress: 95 });
            UploadEventBus.emit('UPLOAD_PROGRESS', { uploadId: job.uploadId, progress: 95, status: 'VERIFYING' });

            setTimeout(() => {
              updateJob(job.uploadId, { status: 'PUBLISHED', progress: 100, serverStoryId });
              UploadEventBus.emit('UPLOAD_COMPLETED', { uploadId: job.uploadId, serverStoryId });
              resolve(serverStoryId);
            }, 400); // Small delay to show completion verification

          } catch (e) {
            reject(new UploadError('SERVER_ERROR', 'Response processing failed. Please try again.', true));
          }
        } else {
          if (xhr.status === 401) {
            if (!hasTokenRefreshed) {
              hasTokenRefreshed = true;
              console.log('[StoryUploadWorker] 401 response. Retrying with fresh token...');
              try {
                await AuthService.refreshAccessToken();
                sendRequest();
                return;
              } catch (refreshErr) {
                // fall through to reject
              }
            }
            reject(new UploadError('AUTH_ERROR', 'Session expired. Please sign in again.', false));
          } else if (xhr.status === 403) {
            reject(new UploadError('AUTH_ERROR', 'You do not have permission to upload this story.', false));
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
        activeXhrRequests.delete(job.uploadId);
        reject(new UploadError('NETWORK_ERROR', 'Network request failed', true));
      };

      xhr.onabort = () => {
        activeXhrRequests.delete(job.uploadId);
        UploadEventBus.emit('UPLOAD_CANCELLED', { uploadId: job.uploadId });
        reject(new Error('Upload canceled by user'));
      };

      xhr.open('POST', `${api.defaults.baseURL || '/api'}/stories`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    };

    sendRequest();
  });
}

