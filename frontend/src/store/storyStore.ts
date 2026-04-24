import { create } from 'zustand';

interface StoryState {
  pendingFile: File | null;
  setPendingFile: (file: File | null) => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  pendingFile: null,
  setPendingFile: (file) => set({ pendingFile: file })
}));
