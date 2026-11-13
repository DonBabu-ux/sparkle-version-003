import { create } from 'zustand';
import api from '../api/api';

export interface ActiveStreamSummary {
  stream_id: string;
  streamer_id: string;
  title: string;
  category?: string;
  viewer_count: number;
  started_at: string;
  username: string;
  name?: string;
  avatar_url?: string | null;
}

interface LiveState {
  activeStreams: ActiveStreamSummary[];
  activeUserIds: Set<string>;
  lastFetched: number | null;
  isLoading: boolean;
  fetchActiveStreams: () => Promise<void>;
  isUserLive: (userId?: string | null) => boolean;
  getStreamForUser: (userId?: string | null) => ActiveStreamSummary | null;
  addOrUpdateStream: (stream: ActiveStreamSummary) => void;
  removeStream: (streamId: string, streamerId?: string) => void;
}

export const useLiveStore = create<LiveState>((set, get) => ({
  activeStreams: [],
  activeUserIds: new Set<string>(),
  lastFetched: null,
  isLoading: false,

  fetchActiveStreams: async () => {
    try {
      set({ isLoading: true });
      const res = await api.get('/streams/active-users');
      const streams: ActiveStreamSummary[] = res.data?.activeStreams || [];
      const userIds = new Set<string>(streams.map(s => String(s.streamer_id)));
      set({
        activeStreams: streams,
        activeUserIds: userIds,
        lastFetched: Date.now(),
        isLoading: false
      });
    } catch {
      set({ isLoading: false });
    }
  },

  isUserLive: (userId?: string | null) => {
    if (!userId) return false;
    return get().activeUserIds.has(String(userId));
  },

  getStreamForUser: (userId?: string | null) => {
    if (!userId) return null;
    const uid = String(userId);
    return get().activeStreams.find(s => String(s.streamer_id) === uid) || null;
  },

  addOrUpdateStream: (stream: ActiveStreamSummary) => {
    set(state => {
      const filtered = state.activeStreams.filter(s => s.stream_id !== stream.stream_id && String(s.streamer_id) !== String(stream.streamer_id));
      const nextStreams = [stream, ...filtered];
      const nextUserIds = new Set<string>(nextStreams.map(s => String(s.streamer_id)));
      return { activeStreams: nextStreams, activeUserIds: nextUserIds };
    });
  },

  removeStream: (streamId: string, streamerId?: string) => {
    set(state => {
      const nextStreams = state.activeStreams.filter(s => {
        if (s.stream_id === streamId) return false;
        if (streamerId && String(s.streamer_id) === String(streamerId)) return false;
        return true;
      });
      const nextUserIds = new Set<string>(nextStreams.map(s => String(s.streamer_id)));
      return { activeStreams: nextStreams, activeUserIds: nextUserIds };
    });
  }
}));

