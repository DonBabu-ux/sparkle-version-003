import { logger } from '../../../utils/logger';

/**
 * Camera capture: real getUserMedia stream management, torch, facing switch,
 * duration-limited MediaRecorder capture, and music/mic mixing.
 * All resources are released via stop() — no background recording.
 */

export interface CameraCapabilities {
  hasCamera: boolean;
  hasMic: boolean;
  torchSupported: boolean;
  frontCamera: boolean;
  rearCamera: boolean;
}

export interface RecordingResult {
  blob: Blob;
  durationSec: number;
  width: number;
  height: number;
  mimeType: string;
}

const pickRecorderMime = (): string | null => {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch (_) { /* continue */ }
  }
  return '';
};

export type PermissionStateLike = 'granted' | 'denied' | 'prompt' | 'unsupported';

/**
 * Probe current permission state without triggering a prompt.
 * (navigator.permissions is the only web API that can do this safely.)
 */
export async function probePermissions(): Promise<{ camera: PermissionStateLike; mic: PermissionStateLike }> {
  const out = { camera: 'prompt' as PermissionStateLike, mic: 'prompt' as PermissionStateLike };
  try {
    if (navigator.permissions?.query) {
      const cam = await navigator.permissions.query({ name: 'camera' as PermissionName }).catch(() => null);
      const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName }).catch(() => null);
      if (cam) out.camera = cam.state as PermissionStateLike;
      if (mic) out.mic = mic.state as PermissionStateLike;
    }
  } catch (_) { /* unsupported — treat as prompt */ }
  return out;
}

export class CameraRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioCtx: AudioContext | null = null;
  private musicEl: HTMLAudioElement | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private micGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tick: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private facing: 'user' | 'environment' = 'environment';

  onElapsed: ((elapsedSec: number, remainingSec: number) => void) | null = null;
  onAutoStop: (() => void) | null = null;

  get active(): boolean {
    return this.stream !== null;
  }

  get currentStream(): MediaStream | null {
    return this.stream;
  }

  get currentFacing(): 'user' | 'environment' {
    return this.facing;
  }

  /** Enumerate devices (requires permission for labels — labels may be empty). */
  static async detectCapabilities(): Promise<CameraCapabilities> {
    const caps: CameraCapabilities = {
      hasCamera: false,
      hasMic: false,
      torchSupported: false,
      frontCamera: false,
      rearCamera: false,
    };
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return caps;
      const devices = await navigator.mediaDevices.enumerateDevices();
      for (const d of devices) {
        if (d.kind === 'videoinput') {
          caps.hasCamera = true;
          const label = (d.label || '').toLowerCase();
          if (label.includes('front') || label.includes('user')) caps.frontCamera = true;
          if (label.includes('back') || label.includes('rear') || label.includes('environment')) caps.rearCamera = true;
        }
        if (d.kind === 'audioinput') caps.hasMic = true;
      }
      if (caps.hasCamera && !caps.frontCamera && !caps.rearCamera) {
        // Unknown labels (pre-permission) — assume both exist on mobile
        caps.frontCamera = true;
        caps.rearCamera = true;
      }
    } catch (err) {
      logger.warn('[Camera] device detection failed:', err);
    }
    return caps;
  }

  /**
   * Start the preview stream. Requests camera+mic in one call (the OS
   * permission dialog appears once, from the platform — never faked).
   */
  async start(facing: 'user' | 'environment' = 'environment'): Promise<MediaStream> {
    await this.stop();
    this.facing = facing;
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: facing,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.stream = stream;
    return stream;
  }

  /** Switch front/rear. Keeps music selection (managed by caller). */
  async switchCamera(): Promise<MediaStream> {
    const next = this.facing === 'user' ? 'environment' : 'user';
    const wasRecording = this.recorder?.state === 'recording';
    if (wasRecording) this.stopRecordingOnly();
    const stream = await this.start(next);
    if (wasRecording) this.beginRecording();
    return stream;
  }

  /** Toggle the physical torch when the track supports it. */
  isTorchSupported(): boolean {
    const track = this.stream?.getVideoTracks()[0];
    const caps = track?.getCapabilities?.() as MediaTrackCapabilities | undefined;
    return !!caps && 'torch' in caps;
  }

  async setTorch(on: boolean): Promise<boolean> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return false;
    try {
      const caps = track.getCapabilities?.() as MediaTrackCapabilities | undefined;
      if (!caps || !('torch' in caps)) return false;
      await track.applyConstraints({ advanced: [{ torch: on }] } as unknown as MediaTrackConstraints);
      return true;
    } catch (err) {
      logger.warn('[Camera] torch toggle failed:', err);
      return false;
    }
  }

  /**
   * Wire audio: mic + optional music mixed into a recording destination.
   * keepOriginalSound=false mutes the mic (music-only reel), true mixes both.
   */
  private ensureAudio(musicUrl: string | null, keepOriginalSound: boolean, loopMusic: boolean): void {
    if (!this.stream) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!this.audioCtx) this.audioCtx = new Ctx();
    void this.audioCtx.resume().catch(() => { /* user gesture required — harmless */ });

    if (!this.destination) this.destination = this.audioCtx.createMediaStreamDestination();

    // Mic
    const hasMicTracks = this.stream.getAudioTracks().length > 0;
    if (hasMicTracks && !this.micSource) {
      this.micSource = this.audioCtx.createMediaStreamSource(this.stream);
      this.micGain = this.audioCtx.createGain();
      this.micGain.gain.value = keepOriginalSound ? 1 : 0;
      this.micSource.connect(this.micGain);
      this.micGain.connect(this.destination);
    } else if (this.micGain) {
      this.micGain.gain.value = keepOriginalSound ? 1 : 0;
    }

    // Music
    if (musicUrl) {
      try {
        if (!this.musicEl || this.musicEl.src !== musicUrl) {
          this.musicSource?.disconnect();
          this.musicEl = new Audio(musicUrl);
          this.musicEl.loop = loopMusic;
          this.musicEl.crossOrigin = 'anonymous';
          this.musicEl.volume = 1;
          this.musicSource = this.audioCtx.createMediaElementSource(this.musicEl);
          this.musicGain = this.audioCtx.createGain();
          this.musicGain.gain.value = 0.9;
          this.musicSource.connect(this.musicGain);
          this.musicGain.connect(this.destination);
        }
      } catch (err) {
        logger.warn('[Camera] music graph failed:', err);
      }
    }
  }

  /** Play the selected soundtrack from the beginning (preview + during recording). */
  async playMusic(musicUrl: string | null, keepOriginalSound: boolean): Promise<void> {
    this.ensureAudio(musicUrl, keepOriginalSound, true);
    if (musicUrl && this.musicEl) {
      try {
        this.musicEl.currentTime = 0;
        await this.musicEl.play();
      } catch (err) {
        logger.warn('[Camera] music autoplay blocked:', err);
      }
    }
  }

  pauseMusic(): void {
    try { this.musicEl?.pause(); } catch (_) { /* ignore */ }
  }

  stopMusic(): void {
    try {
      this.musicEl?.pause();
      if (this.musicEl) this.musicEl.currentTime = 0;
    } catch (_) { /* ignore */ }
  }

  private beginRecording(): void {
    if (!this.stream || !this.audioCtx || !this.destination) return;
    const mime = pickRecorderMime();
    // Mixed stream: video from camera + mixed audio from Web Audio
    const mixed = new MediaStream();
    this.stream.getVideoTracks().forEach(t => mixed.addTrack(t));
    this.destination.stream.getAudioTracks().forEach(t => mixed.addTrack(t));
    // If audio graph produced no tracks, fall back to raw mic tracks
    if (mixed.getAudioTracks().length === 0) {
      this.stream.getAudioTracks().forEach(t => mixed.addTrack(t));
    }
    this.recorder = new MediaRecorder(mixed, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
    this.recorder.start(250);
  }

  private stopRecordingOnly(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); } catch (_) { /* ignore */ }
    }
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.tick) { clearInterval(this.tick); this.tick = null; }
  }

  /**
   * Record with an automatic stop at `limitSec`. onElapsed reports real
   * elapsed/remaining seconds for the progress UI.
   */
  async record(limitSec: number, musicUrl: string | null, keepOriginalSound: boolean): Promise<RecordingResult> {
    if (!this.stream) throw new Error('CAMERA_NOT_STARTED');
    const mime = pickRecorderMime();
    if (mime === null) throw new Error('MEDIA_RECORDER_UNSUPPORTED');

    this.ensureAudio(musicUrl, keepOriginalSound, true);
    if (musicUrl) await this.playMusic(musicUrl, keepOriginalSound);

    const chunks: BlobPart[] = [];
    const recorder = this.recorder;
    this.beginRecording();
    const rec = this.recorder;
    if (!rec) throw new Error('RECORDER_START_FAILED');

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    this.startTime = performance.now();

    const promise = new Promise<RecordingResult>((resolve, reject) => {
      rec.onstop = () => {
        this.clearTimers();
        this.pauseMusic();
        const elapsed = (performance.now() - this.startTime) / 1000;
        const blob = new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' });
        if (!blob.size) {
          reject(new Error('RECORDING_EMPTY'));
          return;
        }
        const vTrack = this.stream?.getVideoTracks()[0];
        const settings = vTrack?.getSettings?.() as MediaTrackSettings | undefined;
        resolve({
          blob,
          durationSec: elapsed,
          width: settings?.width || 720,
          height: settings?.height || 1280,
          mimeType: blob.type,
        });
      };
      rec.onerror = () => reject(new Error('RECORDER_ERROR'));
    });

    // Real progress ticks
    this.tick = setInterval(() => {
      const elapsed = (performance.now() - this.startTime) / 1000;
      const remaining = Math.max(0, limitSec - elapsed);
      this.onElapsed?.(elapsed, remaining);
    }, 100);

    this.timer = setTimeout(() => {
      if (rec.state === 'recording') {
        try { rec.stop(); } catch (_) { /* ignore */ }
      }
      this.onAutoStop?.();
    }, limitSec * 1000);
    this.timer.unref?.();

    void recorder; // previous instance replaced by beginRecording
    return promise;
  }

  /**
   * Stop an active recording early (user tapped the stop button).
   * The pending duration timer is cleared and the recorder resolves the
   * record() promise with whatever was captured.
   */
  forceStop(): void {
    this.clearTimers();
    if (this.recorder && this.recorder.state === 'recording') {
      try { this.recorder.stop(); } catch (_) { /* ignore */ }
    }
  }

  /** Stop preview and release ALL hardware (stream, audio, torch off). */
  async stop(): Promise<void> {
    this.clearTimers();
    if (this.recorder && this.recorder.state !== 'recording') {
      try { this.recorder.stop(); } catch (_) { /* ignore */ }
    }
    this.recorder = null;

    // Ensure torch is off before releasing
    try {
      const track = this.stream?.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as MediaTrackCapabilities | undefined;
      if (caps && 'torch' in caps) {
        await track.applyConstraints({ advanced: [{ torch: false }] } as unknown as MediaTrackConstraints);
      }
    } catch (_) { /* ignore */ }

    this.stopMusic();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;

    try { this.musicSource?.disconnect(); } catch (_) { /* ignore */ }
    try { this.micSource?.disconnect(); } catch (_) { /* ignore */ }
    this.musicSource = null;
    this.micSource = null;
    this.musicGain = null;
    this.micGain = null;
    this.destination = null;
    this.musicEl = null;
    if (this.audioCtx) {
      try { await this.audioCtx.close(); } catch (_) { /* ignore */ }
      this.audioCtx = null;
    }
  }
}

export const cameraRecorder = new CameraRecorder();
