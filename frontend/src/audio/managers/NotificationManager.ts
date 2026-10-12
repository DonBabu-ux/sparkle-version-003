import { EventBus } from '../EventBus';
import { logger } from '../../utils/logger';
import { setupNativeNotificationChannels } from '../../services/notificationChannels';

export class NotificationManager {
  private eventBus: EventBus;

  constructor(_audioCtx: AudioContext | null, eventBus: EventBus) {
    this.eventBus = eventBus;

    // Listen to push/local channel setup triggers
    this.eventBus.on('register_channels', () => {
      this.initializeNotificationChannels();
    });
  }

  /**
   * Registers the Sparkle notification channels (see services/
   * notificationChannels.ts for the shared 8-channel + sound setup).
   * Also boots on native launch via PushService, so the audio-bus trigger
   * is a redundant safety net rather than the only entry point.
   */
  public async initializeNotificationChannels(): Promise<void> {
    await setupNativeNotificationChannels();
    logger.log('[NotificationManager] Channel setup delegated to notificationChannels service.');
  }
}
