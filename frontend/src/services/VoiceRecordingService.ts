/**
 * VoiceRecordingService.ts
 * Enterprise Recording Service for Sparkle Voice Notes.
 * 
 * Manages MediaRecorder, AudioContext, live audio levels / waveform frequency analysis,
 * safe accidental-click cancellation, and temporary local blob/file creation.
 */

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // in seconds
  audioLevels: number[]; // normalized 0-1 array for live waveform visualization
  sessionId: string | null;
}

class VoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private timerInterval: any = null;
  private animationFrameId: number | null = null;
  private currentDuration: number = 0;
  private levels: number[] = new Array(16).fill(0.1);
  private stateChangeCallback: ((state: RecordingState) => void) | null = null;
  private currentSessionId: string | null = null;
  private lastVisualizerTime: number = 0;

  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  public subscribe(callback: (state: RecordingState) => void) {
    this.stateChangeCallback = callback;
    this.notifyState();
  }

  public unsubscribe() {
    this.stateChangeCallback = null;
  }

  /**
   * Request microphone permission status
   */
  async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'microphone' as any });
        return status.state;
      }
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  /**
   * Non-blocking start initialization.
   * Called in background AFTER UI has already transitioned to recording mode.
   */
  async start(sessionId: string, onStateChange?: (state: RecordingState) => void): Promise<boolean> {
    if (this.currentSessionId === sessionId && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      return true;
    }

    // Set active session ID immediately
    this.currentSessionId = sessionId;
    if (onStateChange) {
      this.stateChangeCallback = onStateChange;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Verify session hasn't been cancelled while waiting for getUserMedia
      if (this.currentSessionId !== sessionId) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      this.audioStream = stream;

      // Determine best supported mime type
      const mimeType = this.getSupportedMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

      this.mediaRecorder = new MediaRecorder(this.audioStream, options);
      this.audioChunks = [];
      this.startTime = Date.now();
      this.currentDuration = 0;

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (this.currentSessionId === sessionId && event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Set up Web Audio API Analyser for live frequency waveform
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
          const source = this.audioContext.createMediaStreamSource(this.audioStream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 64;
          this.analyser.smoothingTimeConstant = 0.8;
          source.connect(this.analyser);
          this.startVisualizer(sessionId);
        }
      } catch (e) {
        console.warn('[VoiceRecordingService] Web Audio API visualizer uninitialized:', e);
      }

      this.mediaRecorder.start(100);

      // Duration timer running every 200ms
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        if (this.currentSessionId === sessionId && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.currentDuration = (Date.now() - this.startTime) / 1000;
          this.notifyState();
        }
      }, 200);

      this.notifyState();
      return true;
    } catch (err: any) {
      console.error('[VoiceRecordingService] Failed to start recording:', err);
      if (this.currentSessionId === sessionId) {
        this.cleanup();
      }
      throw err;
    }
  }

  /**
   * Pause recording if supported
   */
  pause() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.notifyState();
    }
  }

  /**
   * Resume recording if paused
   */
  resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.notifyState();
    }
  }

  /**
   * Stop recording and return the resulting File and duration metadata.
   * Session-safe: ignores stops from stale sessions.
   */
  async stop(sessionId?: string): Promise<{ file: File; duration: number; mimeType: string } | null> {
    const activeId = sessionId || this.currentSessionId;
    if (!activeId || (sessionId && this.currentSessionId !== sessionId)) {
      this.cleanup();
      return null;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.cleanup();
        resolve(null);
        return;
      }

      const finalDuration = Math.max(1, Math.round(this.currentDuration));
      const mimeType = this.mediaRecorder.mimeType || 'audio/webm';

      this.mediaRecorder.onstop = () => {
        if (this.currentSessionId && this.currentSessionId !== activeId) {
          this.cleanup();
          resolve(null);
          return;
        }

        const blobType = mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: blobType });
        const ext = this.getExtensionFromMime(blobType);
        const fileName = `voice_note_${Date.now()}.${ext}`;
        const file = new File([audioBlob], fileName, { type: blobType });

        this.cleanup();
        resolve({
          file,
          duration: finalDuration,
          mimeType: blobType
        });
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.error('[VoiceRecordingService] Error stopping recorder:', e);
        this.cleanup();
        resolve(null);
      }
    });
  }

  /**
   * Cancel and discard recording immediately.
   * Session-safe: invalidates active session ID instantly.
   */
  cancel(sessionId?: string) {
    if (sessionId && this.currentSessionId && sessionId !== this.currentSessionId) {
      return; // Stale cancel call from previous session
    }

    console.log('[VoiceRecordingService] Accidental recording canceled & discarded for session:', this.currentSessionId);
    this.currentSessionId = null;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null; // Detach onstop callback
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.cleanup();
  }

  /**
   * Clean up tracks, context, timers, and memory
   */
  private cleanup() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.currentDuration = 0;
    this.levels = new Array(16).fill(0.1);
    this.notifyState();
  }

  private startVisualizer(sessionId: string) {
    const updateWaveform = () => {
      if (this.currentSessionId !== sessionId || !this.analyser || !this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
        return;
      }

      const now = performance.now();
      // Throttle visualization state updates to ~30 FPS max (33ms) to prevent excessive React rendering
      if (now - this.lastVisualizerTime >= 33) {
        this.lastVisualizerTime = now;
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        const step = Math.floor(dataArray.length / 16);
        const newLevels: number[] = [];
        for (let i = 0; i < 16; i++) {
          const val = dataArray[i * step] || 0;
          newLevels.push(Math.max(0.1, Math.min(1.0, val / 255)));
        }
        this.levels = newLevels;
        this.notifyState();
      }

      this.animationFrameId = requestAnimationFrame(updateWaveform);
    };
    updateWaveform();
  }

  private notifyState() {
    if (this.stateChangeCallback) {
      this.stateChangeCallback({
        isRecording: !!this.currentSessionId && !!this.mediaRecorder && this.mediaRecorder.state === 'recording',
        isPaused: !!this.mediaRecorder && this.mediaRecorder.state === 'paused',
        duration: Math.round(this.currentDuration),
        audioLevels: [...this.levels],
        sessionId: this.currentSessionId
      });
    }
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  private getExtensionFromMime(mime: string): string {
    if (mime.includes('mp4') || mime.includes('aac') || mime.includes('m4a')) return 'm4a';
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('mp3')) return 'mp3';
    return 'webm';
  }
}

export const voiceRecordingService = new VoiceRecordingService();

