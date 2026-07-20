import { EventBus } from '../EventBus';
import { AudioPool } from '../pools/AudioPool';
import type { PoolStats } from '../pools/AudioPool';
import { ThemeController } from '../settings/ThemeController';
import type { SoundTheme } from '../settings/ThemeController';
import { VolumeController } from '../settings/VolumeController';

export type SoundKey =
  | 'send' | 'receive' | 'outchat' | 'delivered' | 'read'
  | 'like' | 'comment' | 'follow' | 'mention' | 'tag' | 'share'
  | 'story' | 'story_reply' | 'story_like'
  | 'moment_like' | 'moment_comment'
  | 'order' | 'offer' | 'payment'
  | 'ringtone' | 'call' | 'hangup' | 'busy' | 'connecting'
  | 'ai_response' | 'ai_finished'
  | 'success' | 'error' | 'click' | 'popup' | 'typing'
  | 'iphone' | 'facebook_notification' | 'inchat_receive' | 'outchat_notification';

const POOL_LIMITS: Record<SoundKey, number> = {
  send: 4,
  receive: 6,
  outchat: 5,
  delivered: 5,
  read: 5,
  like: 10,
  comment: 5,
  follow: 3,
  mention: 3,
  tag: 3,
  share: 5,
  story: 3,
  story_reply: 3,
  story_like: 8,
  moment_like: 8,
  moment_comment: 5,
  order: 3,
  offer: 3,
  payment: 3,
  ringtone: 2,
  call: 2,
  hangup: 1,
  busy: 2,
  connecting: 2,
  ai_response: 3,
  ai_finished: 3,
  success: 3,
  error: 3,
  click: 10,
  popup: 4,
  typing: 3,
  iphone: 3,
  facebook_notification: 3,
  inchat_receive: 3,
  outchat_notification: 3,
};

// Map SoundKey to the standard standardized filenames
const KEY_TO_FILE: Record<SoundKey, string> = {
  send: 'send.mp3',
  receive: 'receive.mp3',
  outchat: 'notification.mp3',
  delivered: 'like.mp3',
  read: 'like.mp3',
  like: 'like.mp3',
  comment: 'comment.mp3',
  follow: 'follow.mp3',
  mention: 'story.mp3',
  tag: 'story.mp3',
  share: 'comment.mp3',
  story: 'story.mp3',
  story_reply: 'send.mp3',
  story_like: 'like.mp3',
  moment_like: 'like.mp3',
  moment_comment: 'comment.mp3',
  order: 'comment.mp3',
  offer: 'comment.mp3',
  payment: 'comment.mp3',
  ringtone: 'ringtone.mp3',
  call: 'ringtone.mp3',
  hangup: 'notification.mp3',
  busy: 'notification.mp3',
  connecting: 'notification.mp3',
  ai_response: 'comment.mp3',
  ai_finished: 'comment.mp3',
  success: 'comment.mp3',
  error: 'notification.mp3',
  click: 'like.mp3',
  popup: 'comment.mp3',
  typing: 'send.mp3',
  iphone: 'iphone.mp3',
  facebook_notification: 'sparkle Facebook notification.mp3',
  inchat_receive: 'inchat message receive.mp3',
  outchat_notification: 'outchat notification.mp3',
};

export class SoundManager {
  private audioCtx: AudioContext;
  private eventBus: EventBus;
  private themeController: ThemeController;
  private volumeController: VolumeController;
  private pools: Map<SoundKey, AudioPool> = new Map();
  private enabledToggles = {
    masterSounds: true,
    messageSounds: true,
    outChatIncoming: true,
    notificationSounds: true,
    comments: true,
    likes: true,
    followers: true,
    stories: true,
    marketplace: true,
    calls: true,
  };

  // Operational metrics
  private metrics = {
    averageLatency: 0,
    playCount: 0,
    failuresCount: 0,
    decodeTimes: [] as number[],
    missingAssets: [] as string[],
  };

  constructor(
    audioCtx: AudioContext,
    eventBus: EventBus,
    themeController: ThemeController,
    volumeController: VolumeController
  ) {
    this.audioCtx = audioCtx;
    this.eventBus = eventBus;
    this.themeController = themeController;
    this.volumeController = volumeController;

    this.loadSettings();

    // Subscribe to play/stop events
    this.eventBus.on('play_sound', (key: SoundKey, options?: { loop?: boolean; rate?: number }) => {
      this.play(key, options);
    });

    this.eventBus.on('stop_sound', (key: SoundKey) => {
      this.stop(key);
    });

    this.eventBus.on('stop_all', () => {
      this.stopAll();
    });

    this.eventBus.on('settings_reset', () => {
      this.resetSettings();
    });

    this.eventBus.on('settings_update', (partial: any) => {
      this.updateSettings(partial);
    });
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem('sparkle_sound_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.enabledToggles = { ...this.enabledToggles, ...parsed };
      }
    } catch (e) {
      console.warn('[SoundManager] Failed to parse settings:', e);
    }
  }

  public updateSettings(partial: any): void {
    this.enabledToggles = { ...this.enabledToggles, ...partial };
    try {
      localStorage.setItem('sparkle_sound_settings', JSON.stringify(this.enabledToggles));
    } catch (e) {
      console.warn('[SoundManager] Failed to save settings:', e);
    }
  }

  public getSettings() {
    return {
      ...this.enabledToggles,
      soundTheme: this.themeController.getCurrentTheme(),
      masterVolume: this.volumeController.getVolume('master'),
      volumeMessages: this.volumeController.getVolume('messages'),
      volumeNotifications: this.volumeController.getVolume('notifications'),
      volumeStories: this.volumeController.getVolume('stories'),
      volumeMarketplace: this.volumeController.getVolume('marketplace'),
      volumeCalls: this.volumeController.getVolume('calls'),
      volumeSystem: this.volumeController.getVolume('ui'),
    };
  }

  private resetSettings(): void {
    this.enabledToggles = {
      masterSounds: true,
      messageSounds: true,
      outChatIncoming: true,
      notificationSounds: true,
      comments: true,
      likes: true,
      followers: true,
      stories: true,
      marketplace: true,
      calls: true,
    };
    this.updateSettings({});
  }

  /**
   * Initializes and warms pools for all sound keys.
   */
  public async warmPools(): Promise<void> {
    const startTime = performance.now();
    this.pools.clear();

    const warmPromises = Object.keys(KEY_TO_FILE).map(async (keyStr) => {
      const key = keyStr as SoundKey;
      const filename = KEY_TO_FILE[key];
      const url = this.themeController.resolveSoundUrl(filename);
      const limit = POOL_LIMITS[key] || 3;

      const pool = new AudioPool(this.audioCtx, url, limit);
      this.pools.set(key, pool);

      try {
        await pool.warm();
      } catch (err) {
        this.metrics.failuresCount++;
        this.metrics.missingAssets.push(filename);
      }
    });

    await Promise.all(warmPromises);
    this.metrics.decodeTimes.push(performance.now() - startTime);
  }

  /**
   * Computes the actual volume to use based on configuration settings.
   */
  private getSoundVolume(key: SoundKey): number {
    if (!this.enabledToggles.masterSounds) return 0;

    const master = this.volumeController.getVolume('master');
    let categoryVolume = 1.0;

    switch (key) {
      case 'send':
      case 'receive':
      case 'outchat':
      case 'delivered':
      case 'read':
      case 'iphone':
      case 'facebook_notification':
      case 'inchat_receive':
      case 'outchat_notification':
        if (!this.enabledToggles.messageSounds) return 0;
        categoryVolume = this.volumeController.getVolume('messages');
        break;
      case 'like':
      case 'comment':
      case 'follow':
      case 'mention':
      case 'tag':
      case 'share':
        if (!this.enabledToggles.notificationSounds) return 0;
        if (key === 'comment' && !this.enabledToggles.comments) return 0;
        if (key === 'like' && !this.enabledToggles.likes) return 0;
        if (key === 'follow' && !this.enabledToggles.followers) return 0;
        categoryVolume = this.volumeController.getVolume('notifications');
        break;
      case 'story':
      case 'story_reply':
      case 'story_like':
      case 'moment_like':
      case 'moment_comment':
        if (!this.enabledToggles.stories) return 0;
        categoryVolume = this.volumeController.getVolume('stories');
        break;
      case 'order':
      case 'offer':
      case 'payment':
        if (!this.enabledToggles.marketplace) return 0;
        categoryVolume = this.volumeController.getVolume('marketplace');
        break;
      case 'ringtone':
      case 'call':
      case 'hangup':
      case 'busy':
      case 'connecting':
        if (!this.enabledToggles.calls) return 0;
        categoryVolume = this.volumeController.getVolume('calls');
        break;
      case 'success':
      case 'error':
      case 'click':
      case 'popup':
      case 'typing':
        categoryVolume = this.volumeController.getVolume('ui');
        break;
    }

    if (key === 'outchat' && !this.enabledToggles.outChatIncoming) return 0;
    if (key === 'typing' && !this.enabledToggles.messageSounds) return 0;

    // Apply specific scaling factors
    let scale = 1.0;
    if (key === 'send') scale = 0.85;
    if (key === 'receive') scale = 0.90;
    if (key === 'like') scale = 0.95;
    if (key === 'click' || key === 'typing') scale = 0.35;

    return master * categoryVolume * scale;
  }

  /**
   * Resolves the appropriate haptic pattern type based on key.
   */
  private getHapticType(key: SoundKey): string {
    switch (key) {
      case 'send':
      case 'story_reply':
        return 'send';
      case 'receive':
      case 'outchat':
      case 'delivered':
      case 'read':
        return 'receive';
      case 'follow':
        return 'follow';
      case 'success':
      case 'payment':
        return 'success';
      case 'error':
      case 'hangup':
      case 'busy':
        return 'error';
      case 'click':
      case 'typing':
        return 'click';
      default:
        return 'click';
    }
  }

  /**
   * Plays a sound.
   */
  public play(key: SoundKey, options?: { loop?: boolean; rate?: number }): void {
    const playStart = performance.now();
    const pool = this.pools.get(key);
    if (!pool) {
      console.warn(`[SoundManager] Pool not initialized for key: ${key}`);
      return;
    }

    const volume = this.getSoundVolume(key);
    if (volume <= 0) return;

    // Trigger ducking event if playing a non-typing, non-click sound during story music
    if (key !== 'typing' && key !== 'click') {
      // Emit story ducking event: reduce to 40-50% (e.g. 0.45)
      this.eventBus.emit('duck_story', 0.45);
      
      // Unduck after 1.5s
      setTimeout(() => {
        this.eventBus.emit('unduck_story', 250); // Restore over 250ms
      }, 1500);
    }

    // Apply rates and truncation logic
    let playbackRate = options?.rate || 1.0;
    const theme = this.themeController.getCurrentTheme();

    if (theme === 'Minimal') {
      playbackRate = 1.15;
    }

    // Key-specific adjustments
    switch (key) {
      case 'delivered':
        playbackRate = 1.6;
        break;
      case 'read':
        playbackRate = 1.4;
        break;
      case 'share':
        playbackRate = 1.35;
        break;
      case 'story_reply':
        playbackRate = 1.25;
        break;
      case 'story_like':
      case 'moment_like':
        playbackRate = 1.1;
        break;
      case 'order':
        playbackRate = 0.75;
        break;
      case 'offer':
        playbackRate = 1.2;
        break;
      case 'hangup':
        playbackRate = 0.65;
        break;
      case 'busy':
        playbackRate = 0.8;
        break;
      case 'connecting':
        playbackRate = 0.9;
        break;
      case 'ai_response':
        playbackRate = 1.45;
        break;
      case 'ai_finished':
        playbackRate = 1.65;
        break;
      case 'click':
        playbackRate = 0.75;
        break;
      case 'typing':
        playbackRate = 1.85;
        break;
    }

    const applyLowpass = theme === 'Soft';

    try {
      pool.play({
        volume,
        playbackRate,
        loop: !!options?.loop,
        applyLowpass,
      });

      // Synchronize haptics
      this.eventBus.emit('trigger_haptic', this.getHapticType(key));
    } catch (err) {
      this.metrics.failuresCount++;
      console.warn(`[SoundManager] Play failed for ${key}:`, err);
    }

    // Calculate latency
    const latency = performance.now() - playStart;
    this.metrics.playCount++;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (this.metrics.playCount - 1) + latency) / this.metrics.playCount;
  }

  public stop(key: SoundKey): void {
    this.pools.get(key)?.stopAll();
  }

  public stopAll(): void {
    this.pools.forEach((pool) => pool.stopAll());
  }

  public getPoolUsage(): Record<SoundKey, { active: number; total: number }> {
    const usage: any = {};
    this.pools.forEach((pool, key) => {
      const stats = pool.getUsage();
      usage[key] = { active: stats.activeCount, total: stats.maxSize };
    });
    return usage;
  }

  public getMetrics() {
    return {
      averageLatency: this.metrics.averageLatency,
      playCount: this.metrics.playCount,
      failuresCount: this.metrics.failuresCount,
      decodeTimes: this.metrics.decodeTimes,
      missingAssets: this.metrics.missingAssets,
    };
  }
}
