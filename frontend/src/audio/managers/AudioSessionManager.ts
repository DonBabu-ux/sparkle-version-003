import { EventBus, audioEventBus } from '../EventBus';
import { SoundManager } from './SoundManager';
import type { SoundKey } from './SoundManager';
import { NotificationManager } from './NotificationManager';
import { CallAudioManager } from './CallAudioManager';
import { StoryAudioManager } from './StoryAudioManager';
import { HapticManager } from './HapticManager';
import { ThemeController } from '../settings/ThemeController';
import type { SoundTheme } from '../settings/ThemeController';
import { VolumeController } from '../settings/VolumeController';
import type { VolumeCategory } from '../settings/VolumeController';
import { validateAssets } from '../validateAssets';
import type { ValidationWarning } from '../validateAssets';
import { logger } from '../../utils/logger';

export class AudioSessionManager {
  private static instance: AudioSessionManager | null = null;
  public eventBus: EventBus;
  public soundManager!: SoundManager;
  public notificationManager!: NotificationManager;
  public callAudioManager!: CallAudioManager;
  public storyAudioManager!: StoryAudioManager;
  public hapticManager!: HapticManager;
  public themeController: ThemeController;
  public volumeController: VolumeController;
  private audioCtx: AudioContext | null = null;
  private isCallActive = false;
  private isStoryActive = false;
  private currentStoryUrl: string | null = null;
  private validationWarnings: ValidationWarning[] = [];
  private startupTimeMs = 0;

  private constructor() {
    this.eventBus = audioEventBus;
    this.themeController = new ThemeController();
    this.volumeController = new VolumeController();
    this.storyAudioManager = StoryAudioManager.getInstance(null, this.eventBus);
    this.callAudioManager = CallAudioManager.getInstance(null, this.eventBus);
    this.hapticManager = new HapticManager(this.eventBus);
    this.notificationManager = new NotificationManager(null, this.eventBus);
  }

  public static getInstance(): AudioSessionManager {
    if (!AudioSessionManager.instance) {
      AudioSessionManager.instance = new AudioSessionManager();
    }
    return AudioSessionManager.instance;
  }

  /**
   * Initializes the AudioContext, validates assets, loads themes/volumes, and warms sound pools.
   */
  public async init(): Promise<void> {
    const startupStart = performance.now();
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }

      // 1. Load Settings (Themes and Volumes already load in their constructors)
      const currentTheme = this.themeController.getCurrentTheme();

      // 2. Validate Assets before decoding
      if (this.audioCtx) {
        this.validationWarnings = await validateAssets(currentTheme, this.audioCtx);
      }

      // 3. Initialize managers
      if (this.audioCtx) {
        this.soundManager = new SoundManager(
          this.audioCtx,
          this.eventBus,
          this.themeController,
          this.volumeController
        );
        this.notificationManager = new NotificationManager(this.audioCtx, this.eventBus);
        this.callAudioManager = CallAudioManager.getInstance(this.audioCtx, this.eventBus);
        this.storyAudioManager = StoryAudioManager.getInstance(this.audioCtx, this.eventBus);
        this.hapticManager = new HapticManager(this.eventBus);

        // 4. Warm pools
        await this.soundManager.warmPools();

        // 5. Register native notification channels
        this.eventBus.emit('register_channels');
      }

      this.startupTimeMs = performance.now() - startupStart;
      logger.log(`[AudioSessionManager] Audio Engine initialized in ${this.startupTimeMs.toFixed(1)}ms`);
    } catch (err) {
      logger.error('[AudioSessionManager] Startup failed:', err);
    }
  }

  public async handleUserGesture(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
        this.eventBus.emit('audio_resume');
        logger.log('[AudioSessionManager] AudioContext resumed via user gesture.');
      } catch (err) {
        logger.warn('[AudioSessionManager] AudioContext resume failed:', err);
      }
    }
  }

  public playSound(key: SoundKey, options?: { rate?: number }): void {
    if (this.isCallActive) {
      if (key !== 'hangup' && key !== 'busy') {
        logger.log(`[AudioSessionManager] Suppressed sound "${key}" due to active call.`);
        return;
      }
    }
    this.eventBus.emit('play_sound', key, options);
  }

  public stopSound(key: SoundKey): void {
    this.eventBus.emit('stop_sound', key);
  }

  public stopAll(): void {
    this.eventBus.emit('stop_all');
  }

  public getSettings() {
    return this.soundManager ? this.soundManager.getSettings() : {};
  }

  public updateSettings(partial: any): void {
    if (this.soundManager) {
      this.soundManager.updateSettings(partial);
      if (partial.playHaptics !== undefined) {
        this.eventBus.emit('haptics_toggle', partial.playHaptics);
      }
    }
  }

  public setVolume(category: VolumeCategory, value: number): void {
    this.volumeController.setVolume(category, value);
    this.eventBus.emit('volume_change', category, value);
  }

  public async setTheme(themeName: SoundTheme): Promise<void> {
    this.themeController.setTheme(themeName);
    if (this.audioCtx && this.soundManager) {
      this.validationWarnings = await validateAssets(themeName, this.audioCtx);
      await this.soundManager.warmPools();
    }
    this.eventBus.emit('theme_change', themeName);
  }

  public resetSettings(): void {
    this.themeController.reset();
    this.volumeController.reset();
    this.eventBus.emit('settings_reset');
    if (this.soundManager) {
      this.soundManager.warmPools();
    }
  }

  public suspend(): void {
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.stopAll();
      this.audioCtx.suspend().then(() => {
        logger.log('[AudioSessionManager] AudioContext suspended.');
      });
    }
    this.eventBus.emit('audio_suspend');
  }

  public async resume(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
      this.eventBus.emit('audio_resume');
    }
  }

  // ── Call Integration ──
  public startIncomingCall(): void {
    this.isCallActive = true;
    if (this.isStoryActive && this.storyAudioManager) {
      this.storyAudioManager.pause();
    }
    this.stopAll();
    this.eventBus.emit('call_ringtone');
  }

  public startOutgoingCall(): void {
    this.isCallActive = true;
    if (this.isStoryActive && this.storyAudioManager) {
      this.storyAudioManager.pause();
    }
    this.stopAll();
    this.eventBus.emit('call_connecting');
  }

  public endCall(status: 'hangup' | 'busy' | 'completed'): void {
    this.isCallActive = false;
    if (status === 'hangup') {
      this.eventBus.emit('call_hangup');
    } else if (status === 'busy') {
      this.eventBus.emit('call_busy');
    } else {
      this.eventBus.emit('call_stop');
    }

    if (this.isStoryActive && this.currentStoryUrl && this.storyAudioManager) {
      setTimeout(() => {
        if (!this.isCallActive && this.isStoryActive && this.currentStoryUrl) {
          this.storyAudioManager.play(this.currentStoryUrl);
        }
      }, 1200);
    }
  }

  // ── Story Integration ──
  public playStory(url: string, offset = 0, duration = 15): void {
    this.isStoryActive = true;
    this.currentStoryUrl = url;
    if (!this.isCallActive && this.storyAudioManager) {
      this.storyAudioManager.play(url, offset, duration);
    }
  }

  public stopStory(): void {
    this.isStoryActive = false;
    this.currentStoryUrl = null;
    if (this.storyAudioManager) {
      this.storyAudioManager.stop();
    }
  }

  public pauseStory(): void {
    if (this.storyAudioManager) {
      this.storyAudioManager.pause();
    }
  }

  private activeVoiceElement: HTMLAudioElement | null = null;

  public registerVoicePlayback(audioEl: HTMLAudioElement): void {
    if (this.activeVoiceElement && this.activeVoiceElement !== audioEl) {
      try {
        this.activeVoiceElement.pause();
      } catch (e) {}
    }
    this.activeVoiceElement = audioEl;
    if (this.isStoryActive && this.storyAudioManager) {
      this.storyAudioManager.pause();
    }
  }

  public unregisterVoicePlayback(audioEl: HTMLAudioElement): void {
    if (this.activeVoiceElement === audioEl) {
      this.activeVoiceElement = null;
    }
  }

  public isSessionActive(): boolean {
    return this.isCallActive || this.isStoryActive;
  }

  public getDiagnostics() {
    const soundMgrStats = this.soundManager ? this.soundManager.getMetrics() : { averageLatency: 0, playCount: 0, failuresCount: 0 };
    return {
      loadedCount: this.soundManager ? Object.keys(this.soundManager.getPoolUsage()).length : 0,
      activeInstances: this.soundManager ? Object.values(this.soundManager.getPoolUsage()).reduce((acc, curr) => acc + curr.active, 0) : 0,
      cachedSize: this.getMemoryUsage(),
      latency: `${soundMgrStats.averageLatency.toFixed(1)} ms`,
      ctxState: this.audioCtx ? this.audioCtx.state : 'Not initialized',
      failures: soundMgrStats.failuresCount,
      currentTheme: this.themeController.getCurrentTheme(),
      poolUsage: this.soundManager ? this.soundManager.getPoolUsage() : {},
      warnings: this.validationWarnings,
      startupTimeMs: this.startupTimeMs,
    };
  }

  private getMemoryUsage(): string {
    // Each standard channel uses a Float32 buffer of decoded samples.
    // Estimate size as sum of loaded audio pool sizes.
    // For simplicity, estimate based on metadata or hardcoded size average (approx 0.4 MB per sample).
    const loadedCount = this.soundManager ? Object.keys(this.soundManager.getPoolUsage()).length : 0;
    const mbSize = (loadedCount * 0.4).toFixed(2);
    return `${mbSize} MB`;
  }
}

export default AudioSessionManager.getInstance();
