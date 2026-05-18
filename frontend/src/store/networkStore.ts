import { create } from 'zustand';

export type NetworkQuality = 'strong' | 'weak' | 'unstable' | 'offline';

interface NetworkState {
  isOffline: boolean;
  quality: NetworkQuality;
  saveDataMode: boolean; // True if user is on cellular/weak connection
  
  setOffline: (isOffline: boolean) => void;
  setQuality: (quality: NetworkQuality) => void;
  setSaveDataMode: (enabled: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOffline: !navigator.onLine,
  quality: 'strong', // Default
  saveDataMode: false,

  setOffline: (isOffline) => set({ isOffline, quality: isOffline ? 'offline' : 'strong' }),
  setQuality: (quality) => set({ quality }),
  setSaveDataMode: (saveDataMode) => set({ saveDataMode }),
}));
