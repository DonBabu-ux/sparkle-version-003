import api from '../../../api/api';
import { logger } from '../../../utils/logger';
import { EnvironmentService } from '../../../services/EnvironmentService';
import type { MusicTrack } from '../types';


/**
 * Music catalogue adapter.
 * Backed by the Sparkle backend which proxies Deezer's public API
 * (30-second licensed previews — never downloaded or rehosted).
 */

export interface MusicCategory {
  id: string;
  label: string;
}

let audioEl: HTMLAudioElement | null = null;
let playingTrackId: string | null = null;
const playbackListeners = new Set<(trackId: string | null) => void>();

const notify = () => playbackListeners.forEach(fn => fn(playingTrackId));

export function subscribePlayback(fn: (trackId: string | null) => void): () => void {
  playbackListeners.add(fn);
  return () => playbackListeners.delete(fn);
}

export function getPlayingTrackId(): string | null {
  return playingTrackId;
}

/** Stop any active preview. Always call on page unmount. */
export function stopPreview(): void {
  if (audioEl) {
    audioEl.pause();
    audioEl.src = '';
    audioEl = null;
  }
  playingTrackId = null;
  notify();
}

/**
 * Play or pause a 30s preview. Starting another track stops the previous one.
 * Returns the new playing track id (or null when paused).
 */
export function togglePreview(track: MusicTrack): string | null {
  if (playingTrackId === track.id) {
    stopPreview();
    return null;
  }
  stopPreview();
  try {
    audioEl = new Audio(track.audioUrl);
    audioEl.preload = 'auto';
    audioEl.volume = 1;
    playingTrackId = track.id;
    notify();
    audioEl.addEventListener('ended', () => {
      stopPreview();
    });
    audioEl.addEventListener('error', () => {
      logger.warn('[MusicService] Preview failed to load for track', track.id);
      stopPreview();
    });
    void audioEl.play().catch((err) => {
      logger.warn('[MusicService] Playback blocked or failed:', err);
      stopPreview();
    });
    return track.id;
  } catch (err) {
    logger.warn('[MusicService] Could not create audio element:', err);
    playingTrackId = null;
    notify();
    return null;
  }
}

/** Load a reusable Audio element for camera recording playback (managed by caller). */
export function createMusicPlayer(track: MusicTrack): HTMLAudioElement {
  const el = new Audio(track.audioUrl);
  el.preload = 'auto';
  el.loop = true;
  return el;
}

/**
 * On native (Android APK) the WebView can't play Deezer CDN audio directly —
 * the URLs are HTTP (cleartext blocked) and cross-origin (CORS blocked).
 * Route them through the backend proxy which serves them over HTTPS.
 */
function resolveAudioUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (!EnvironmentService.isNative()) return rawUrl;
  const base = EnvironmentService.getApiBaseUrl(); // e.g. https://sparkle-version-003-1-f4v3.onrender.com/api
  return `${base}/music/preview-proxy?url=${encodeURIComponent(rawUrl)}`;
}

function normalizeTrack(raw: Record<string, unknown>): MusicTrack | null {
  const audioUrl = String(raw.audioUrl || '');
  if (!audioUrl) return null;
  return {
    id: String(raw.id || ''),
    title: String(raw.title || 'Untitled'),
    artist: String(raw.artist || 'Unknown artist'),
    audioUrl: resolveAudioUrl(audioUrl),
    thumbnailUrl: (raw.thumbnailUrl as string) || null,
    duration: Number(raw.duration) || 30,
    albumTitle: raw.albumTitle ? String(raw.albumTitle) : undefined,
  };
}

/** Four real chart tracks for the Create-reel shelf. Empty on upstream failure. */
export async function fetchTrending(limit = 4, genre?: string): Promise<MusicTrack[]> {
  try {
    const params: Record<string, string | number> = { limit };
    if (genre) params.genre = genre;
    const { data } = await api.get('/music/trending', { params });
    const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
    return tracks.map(normalizeTrack).filter(Boolean) as MusicTrack[];
  } catch (err) {
    logger.warn('[MusicService] trending fetch failed:', err);
    return [];
  }
}

export async function searchTracks(query: string, page = 1, perPage = 20): Promise<MusicTrack[]> {
  const q = query.trim();
  if (!q) return fetchTrending(perPage);
  try {
    const { data } = await api.get('/music/search', { params: { q, page, per_page: perPage } });
    const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
    return tracks.map(normalizeTrack).filter(Boolean) as MusicTrack[];
  } catch (err) {
    logger.warn('[MusicService] search failed:', err);
    throw err;
  }
}

export async function fetchCategories(): Promise<MusicCategory[]> {
  try {
    const { data } = await api.get('/music/categories');
    if (Array.isArray(data?.categories) && data.categories.length) return data.categories;
  } catch (err) {
    logger.warn('[MusicService] categories fetch failed, using defaults:', err);
  }
  // Defaults mirror the backend CATEGORY_LIST; labels render even if the
  // network call fails so the UI keeps working (search still hits real data).
  return [
    { id: 'birthday', label: 'Birthday' },
    { id: 'date night', label: 'Date Night' },
    { id: 'family', label: 'Family' },
    { id: 'love', label: 'Love' },
    { id: 'morning', label: 'Morning' },
    { id: 'r&b and soul', label: 'R&B and Soul' },
    { id: 'pop', label: 'Pop' },
    { id: 'hip-hop', label: 'Hip-Hop' },
    { id: 'rock', label: 'Rock' },
    { id: 'country', label: 'Country' },
    { id: 'bright', label: 'Bright' },
    { id: 'dreamy', label: 'Dreamy' },
    { id: 'groovy', label: 'Groovy' },
    { id: 'sentimental', label: 'Sentimental' },
  ];
}
