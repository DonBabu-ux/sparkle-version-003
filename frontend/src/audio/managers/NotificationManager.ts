import { Capacitor } from '@capacitor/core';
import { EventBus } from '../EventBus';

export class NotificationManager {
  private eventBus: EventBus;

  constructor(audioCtx: AudioContext | null, eventBus: EventBus) {
    this.eventBus = eventBus;

    // Listen to push/local channel setup triggers
    this.eventBus.on('register_channels', () => {
      this.initializeNotificationChannels();
    });
  }

  /**
   * Registers 8 distinct notification channels with custom sound profiles on native launch.
   */
  public async initializeNotificationChannels(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[NotificationManager] Web platform detected; push channels skipped.');
      return;
    }

    try {
      let PushNotifications: any = null;
      let LocalNotifications: any = null;

      try {
        const pushPkg = '@capacitor/push-notifications';
        const pushModule = await import(/* @vite-ignore */ pushPkg);
        PushNotifications = pushModule.PushNotifications;
      } catch (e) {}

      try {
        const localPkg = '@capacitor/local-notifications';
        const localModule = await import(/* @vite-ignore */ localPkg);
        LocalNotifications = localModule.LocalNotifications;
      } catch (e) {}

      const channels = [
        { id: 'messages', name: 'Messages', importance: 5, sound: 'notification' },
        { id: 'marketplace', name: 'Marketplace Activity', importance: 4, sound: 'comment' },
        { id: 'stories', name: 'Stories updates', importance: 4, sound: 'story' },
        { id: 'moments', name: 'Moments updates', importance: 4, sound: 'like' },
        { id: 'social', name: 'Social Activity', importance: 4, sound: 'follow' },
        { id: 'calls', name: 'Incoming Calls', importance: 5, sound: 'ringtone' },
        { id: 'sparkle_ai', name: 'Sparkle AI Assistant', importance: 4, sound: 'notification' },
        { id: 'system', name: 'System updates', importance: 3, sound: 'notification' },
      ];

      // Setup Local Notification Channels
      if (LocalNotifications && typeof LocalNotifications.createChannel === 'function') {
        for (const channel of channels) {
          await LocalNotifications.createChannel({
            id: channel.id,
            name: channel.name,
            description: `Sparkle ${channel.name} channel`,
            importance: channel.importance,
            sound: channel.sound, // Android resource reference (no extension)
            visibility: 1,
            vibration: true,
          });
        }
        console.log('[NotificationManager] Local channels registered.');
      }

      // Setup Push Notification Channels
      if (PushNotifications && typeof PushNotifications.createChannel === 'function') {
        for (const channel of channels) {
          await PushNotifications.createChannel({
            id: channel.id,
            name: channel.name,
            description: `Sparkle Push ${channel.name} channel`,
            importance: channel.importance,
            sound: channel.sound,
            visibility: 1,
            vibration: true,
          });
        }
        console.log('[NotificationManager] Push channels registered.');
      }
    } catch (err) {
      console.warn('[NotificationManager] Native notification channels setup bypassed:', err);
    }
  }
}
