import { EventBus } from '../EventBus';

export class StoryAudioManager {
  private static instance: StoryAudioManager | null = null;
  private audio: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private eventBus: EventBus;
  private fadeInterval: any = null;
  private currentTrackUrl: string | null = null;
  private isInitialized = false;
  private originalVolume = 1.0;

  constructor(audioContext: AudioContext | null, eventBus: EventBus) {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.loop = true;
    this.eventBus = eventBus;
    if (audioContext) {
      this.ctx = audioContext;
    }

    // Subscribe to EventBus notifications
    this.eventBus.on('duck_story', (duckFactor: number) => {
      this.duck(duckFactor);
    });

    this.eventBus.on('unduck_story', (restoreDurationMs: number) => {
      this.unduck(restoreDurationMs);
    });

    this.eventBus.on('audio_suspend', () => {
      this.pause();
    });
  }

  public static getInstance(audioContext?: AudioContext, eventBus?: EventBus): StoryAudioManager {
    if (!StoryAudioManager.instance) {
      if (!eventBus) {
        throw new Error('EventBus required to initialize StoryAudioManager singleton');
      }
      StoryAudioManager.instance = new StoryAudioManager(audioContext || null, eventBus);
    }
    return StoryAudioManager.instance;
  }

  private initWebAudio() {
    if (this.isInitialized) return;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
    }

    try {
      this.source = this.ctx.createMediaElementSource(this.audio);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      
      this.gainNode = this.ctx.createGain();
      
      this.source.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);
      
      this.isInitialized = true;
      console.log('[StoryAudioManager] Web Audio API context successfully initialized.');
    } catch (e) {
      console.error('[StoryAudioManager] Web Audio API failed to initialize:', e);
    }
  }

  public preload(url: string) {
    if (!url) return;
    try {
      const tempAudio = new Audio();
      tempAudio.src = url;
      tempAudio.preload = 'auto';
      tempAudio.load();
    } catch (err) {
      console.warn('[StoryAudioManager] Preload failed:', err);
    }
  }

  public async play(url: string, startOffset: number = 0, duration: number = 15) {
    if (!url) return;
    
    this.initWebAudio();
    
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (this.currentTrackUrl !== url) {
      this.audio.src = url;
      this.currentTrackUrl = url;
      this.audio.load();
    }

    this.audio.currentTime = startOffset;
    
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      this.audio.play().catch(e => console.warn('[StoryAudioManager] Play request failed/blocked:', e));
      this.gainNode.gain.linearRampToValueAtTime(this.originalVolume, this.ctx.currentTime + 0.4);
    } else {
      this.audio.volume = this.originalVolume;
      this.audio.play().catch(e => console.warn('[StoryAudioManager] Play request failed/blocked:', e));
    }
  }

  public pause() {
    this.fadeOut(400, () => {
      this.audio.pause();
    });
  }

  public setGain(value: number, durationMs: number = 0) {
    this.initWebAudio();
    if (this.gainNode && this.ctx) {
      const time = this.ctx.currentTime;
      try {
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, time);
        this.gainNode.gain.linearRampToValueAtTime(value, time + durationMs / 1000);
      } catch (err) {
        this.audio.volume = value;
      }
    } else {
      this.audio.volume = value;
    }
  }

  /**
   * Ducks the story audio to a percentage of its original volume.
   */
  public duck(duckFactor: number): void {
    const targetVolume = this.originalVolume * duckFactor;
    this.setGain(targetVolume, 150);
  }

  /**
   * Restores the story audio to its original volume.
   */
  public unduck(restoreDurationMs: number): void {
    this.setGain(this.originalVolume, restoreDurationMs);
  }

  public stop() {
    this.fadeOut(400, () => {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.currentTrackUrl = null;
    });
  }

  public fadeOut(durationMs: number = 400, callback?: () => void) {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    if (this.gainNode && this.ctx && !this.audio.paused) {
      const time = this.ctx.currentTime;
      try {
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, time);
        this.gainNode.gain.linearRampToValueAtTime(0, time + durationMs / 1000);
      } catch (err) {
        this.audio.volume = 0;
      }
      
      setTimeout(() => {
        if (callback) callback();
      }, durationMs);
    } else {
      let vol = this.audio.volume;
      if (vol === 0 || this.audio.paused) {
        if (callback) callback();
        return;
      }
      const step = vol / (durationMs / 30);
      this.fadeInterval = setInterval(() => {
        vol = Math.max(0, vol - step);
        this.audio.volume = vol;
        if (vol === 0) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
          this.audio.pause();
          this.audio.volume = this.originalVolume;
          if (callback) callback();
        }
      }, 30);
    }
  }

  public getByteFrequencyData(): Uint8Array {
    if (!this.analyser) {
      return new Uint8Array(0);
    }
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public dispose() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    this.audio.pause();
    this.audio.src = '';
    this.currentTrackUrl = null;
    if (this.ctx) {
      // Don't close context if shared
      this.ctx = null;
    }
    this.source = null;
    this.analyser = null;
    this.gainNode = null;
    this.isInitialized = false;
  }
}
export default StoryAudioManager;
