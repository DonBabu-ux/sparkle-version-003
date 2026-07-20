export type VolumeCategory =
  | 'master'
  | 'messages'
  | 'notifications'
  | 'media'
  | 'calls'
  | 'ui'
  | 'stories';

export interface VolumeProfiles {
  master: number;
  messages: number;
  notifications: number;
  media: number;
  calls: number;
  ui: number;
  stories: number;
}

const DEFAULT_VOLUMES: VolumeProfiles = {
  master: 1.0,
  messages: 0.9,
  notifications: 0.95,
  media: 0.85,
  calls: 1.0,
  ui: 0.7,
  stories: 0.85,
};

export class VolumeController {
  private volumes: VolumeProfiles = { ...DEFAULT_VOLUMES };

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const stored = localStorage.getItem('sparkle_audio_volumes');
      if (stored) {
        this.volumes = { ...DEFAULT_VOLUMES, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[VolumeController] Failed to load volumes:', e);
    }
  }

  public save(): void {
    try {
      localStorage.setItem('sparkle_audio_volumes', JSON.stringify(this.volumes));
    } catch (e) {
      console.warn('[VolumeController] Failed to save volumes:', e);
    }
  }

  public getVolume(category: VolumeCategory): number {
    return this.volumes[category] ?? 1.0;
  }

  public setVolume(category: VolumeCategory, value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.volumes[category] = clamped;
    this.save();
  }

  public getAll(): VolumeProfiles {
    return { ...this.volumes };
  }

  public reset(): void {
    this.volumes = { ...DEFAULT_VOLUMES };
    this.save();
  }
}
