import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UploadFileDB } from '../services/uploadFileDB';
import { logger } from '../utils/logger';

export type JobPriority = 'HIGH' | 'NORMAL' | 'LOW';

export type JobState = 
  | 'LOCAL'
  | 'QUEUED'
  | 'GENERATING_THUMBNAIL'
  | 'COMPRESSING'
  | 'UPLOADING'
  | 'VERIFYING'
  | 'PROCESSING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED';

export interface StoryMetadata {
  textContent?: string;
  textConfig?: string;
  stickers?: string;
  parentStoryId?: string;
  musicInfo?: string;
  storyLayers?: string; // Serialized JSON of StoryLayer[]
  storyDuration?: number; // Duration in seconds
  storyTheme?: string;
}

export interface UploadJob {
  uploadId: string;
  serverStoryId?: string;
  type: 'STORY' | 'MOMENT' | 'CHAT' | 'PROFILE';
  priority: JobPriority;
  localUri: string; // Preview URL (blob: URL)
  thumbnailUri: string | null;
  status: JobState;
  progress: number;
  retryCount: number;
  error: string | null;
  metadata: StoryMetadata; // Can be unioned with MomentMetadata | ChatMetadata, etc.
}

interface UploadState {
  jobs: UploadJob[];
  addJob: (job: UploadJob, file: File) => Promise<void>;
  updateJob: (uploadId: string, updates: Partial<UploadJob>) => void;
  retryJob: (uploadId: string) => void;
  cancelJob: (uploadId: string) => void;
  discardJob: (uploadId: string) => void;
  clearFinishedJobs: () => void;
}

export const useUploadStore = create<UploadState>()(
  persist(
    (set) => ({
      jobs: [],

      addJob: async (job, file) => {
        // Register raw file in IndexedDB
        await UploadFileDB.saveFile(job.uploadId, file);
        set((state) => ({
          jobs: [...state.jobs, job]
        }));
      },

      updateJob: (uploadId, updates) => set((state) => ({
        jobs: state.jobs.map((job) => 
          job.uploadId === uploadId ? { ...job, ...updates } : job
        )
      })),

      retryJob: (uploadId) => set((state) => ({
        jobs: state.jobs.map((job) => 
          job.uploadId === uploadId 
            ? { ...job, status: 'QUEUED', progress: 0, error: null } 
            : job
        )
      })),

      cancelJob: (uploadId) => set((state) => {
        // Cleanup cache when canceled
        const job = state.jobs.find(j => j.uploadId === uploadId);
        if (job && job.localUri && job.localUri.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(job.localUri);
          } catch (e) {}
        }
        if (job && job.thumbnailUri && job.thumbnailUri.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(job.thumbnailUri);
          } catch (e) {}
        }
        UploadFileDB.deleteFile(uploadId).catch(logger.error);

        return {
          jobs: state.jobs.map((j) => 
            j.uploadId === uploadId ? { ...j, status: 'CANCELLED', progress: 0 } : j
          )
        };
      }),

      discardJob: (uploadId) => set((state) => {
        // Cleanup cache when discarded
        const job = state.jobs.find(j => j.uploadId === uploadId);
        if (job && job.localUri && job.localUri.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(job.localUri);
          } catch (e) {}
        }
        if (job && job.thumbnailUri && job.thumbnailUri.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(job.thumbnailUri);
          } catch (e) {}
        }
        UploadFileDB.deleteFile(uploadId).catch(logger.error);

        return {
          jobs: state.jobs.filter((j) => j.uploadId !== uploadId)
        };
      }),

      clearFinishedJobs: () => set((state) => {
        // Remove jobs that are published or discarded, cleaning up references
        const activeJobs = state.jobs.filter(j => j.status !== 'PUBLISHED' && j.status !== 'CANCELLED');
        const finishedJobs = state.jobs.filter(j => j.status === 'PUBLISHED' || j.status === 'CANCELLED');
        
        finishedJobs.forEach(job => {
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
          UploadFileDB.deleteFile(job.uploadId).catch(logger.error);
        });

        return { jobs: activeJobs };
      })
    }),
    {
      name: 'sparkle-upload-storage',
      storage: createJSONStorage(() => localStorage),
      // Only serialize the state fields, we do not serialize the File object which lives in the DB anyway
      partialize: (state) => ({
        // Reset dynamic states to QUEUED or preserve FAILED/CANCELLED/PUBLISHED states
        jobs: state.jobs.map((job) => ({
          ...job,
          status: (job.status === 'UPLOADING' || job.status === 'LOCAL' || job.status === 'GENERATING_THUMBNAIL' || job.status === 'COMPRESSING') 
            ? 'QUEUED' 
            : job.status,
          progress: (job.status === 'UPLOADING' || job.status === 'LOCAL' || job.status === 'GENERATING_THUMBNAIL' || job.status === 'COMPRESSING') 
            ? 0 
            : job.progress
        }))
      })
    }
  )
);
