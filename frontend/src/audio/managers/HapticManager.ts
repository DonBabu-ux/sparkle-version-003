import { EventBus } from '../EventBus';

export type HapticType = 'send' | 'receive' | 'follow' | 'success' | 'error' | 'click';

export class HapticManager {
  private eventBus: EventBus;
  private enabled = true;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.loadSettings();

    // Subscribe to haptic trigger events from other managers
    this.eventBus.on('trigger_haptic', (type: HapticType) => {
      this.trigger(type);
    });

    this.eventBus.on('settings_reset', () => {
      this.enabled = true;
    });

    this.eventBus.on('haptics_toggle', (enabled: boolean) => {
      this.enabled = enabled;
    });
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem('sparkle_sound_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.enabled = parsed.playHaptics !== false;
      }
    } catch (e) {
      this.enabled = true;
    }
  }

  /**
   * Triggers a specific vibration pattern synchronized with UI actions.
   */
  public trigger(type: HapticType): void {
    if (!this.enabled) return;
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;

    try {
      switch (type) {
        case 'send':
        case 'receive':
        case 'click':
          navigator.vibrate(12); // Short light tap
          break;
        case 'follow':
          navigator.vibrate([15, 60, 15]); // Double light tap
          break;
        case 'success':
          navigator.vibrate([20, 40, 20]); // Soft confirmation sequence
          break;
        case 'error':
          navigator.vibrate([60, 35, 60, 35, 120]); // Heavy warning pattern
          break;
      }
    } catch (err) {
      console.warn('[HapticManager] Vibrate block or permission issue:', err);
    }
  }
}
