import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { logger } from '../utils/logger';

export interface SparkleChannel {
  id: string;
  name: string;
  importance: 1 | 2 | 3 | 4 | 5;
  sound: string;
}

// 8 distinct Android notification channels with per-category sounds
// (sound files live in android/app/src/main/res/raw/*.mp3).
export const SPARKLE_CHANNELS: SparkleChannel[] = [
  { id: 'messages', name: 'Messages', importance: 5, sound: 'notification' },
  { id: 'marketplace', name: 'Marketplace Activity', importance: 4, sound: 'comment' },
  { id: 'stories', name: 'Stories updates', importance: 4, sound: 'story' },
  { id: 'moments', name: 'Moments updates', importance: 4, sound: 'like' },
  { id: 'social', name: 'Social Activity', importance: 4, sound: 'follow' },
  { id: 'calls', name: 'Incoming Calls', importance: 5, sound: 'ringtone' },
  { id: 'sparkle_ai', name: 'Sparkle AI Assistant', importance: 4, sound: 'notification' },
  { id: 'system', name: 'System updates', importance: 3, sound: 'notification' },
];

// Maps backend notification `type` (createNotification / worker / FCM data
// payload) onto one of the channels above. Unknown types land on `system`.
const CHANNEL_BY_TYPE: Record<string, string> = {
  message: 'messages',
  new_message: 'messages',
  chat: 'messages',
  group_message: 'messages',
  marketplace_contact: 'marketplace',
  listing: 'marketplace',
  offer: 'marketplace',
  order: 'marketplace',
  sale: 'marketplace',
  wishlist: 'marketplace',
  story: 'stories',
  story_view: 'stories',
  story_reaction: 'stories',
  moment: 'moments',
  like: 'moments',
  spark: 'moments',
  spark_post: 'moments',
  follow: 'social',
  follower: 'social',
  comment: 'social',
  reply: 'social',
  mention: 'social',
  confession: 'social',
  group: 'social',
  group_invite: 'social',
  request: 'social',
  tag: 'social',
  call: 'calls',
  incoming_call: 'calls',
  sparkle_ai: 'sparkle_ai',
  ai: 'sparkle_ai',
  assistant: 'sparkle_ai',
  system: 'system',
  announcement: 'system',
  security: 'system',
  reminder: 'system',
};

export function channelForType(type?: string): string {
  if (!type) return 'system';
  return CHANNEL_BY_TYPE[type] || 'system';
}

const channelPayload = (c: SparkleChannel) => ({
  id: c.id,
  name: c.name,
  description: `Sparkle ${c.name} channel`,
  importance: c.importance,
  sound: c.sound,
  visibility: 1 as const,
  vibration: true,
});

/**
 * Create the Sparkle notification channels on both the local- and push-
 * notification plugins (Android O+). Channels persist system-wide once
 * created, so this only needs to run once per install — calling it on
 * every app boot is idempotent and cheap.
 *
 * Native-only: on web the plugins are no-ops and channels don't exist.
 */
export async function setupNativeNotificationChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  try {
    for (const c of SPARKLE_CHANNELS) {
      const ch = channelPayload(c);
      await LocalNotifications.createChannel(ch).catch((err) => {
        logger.warn(`[Channels] local createChannel(${c.id}) failed:`, err);
      });
      await PushNotifications.createChannel(ch).catch((err) => {
        logger.warn(`[Channels] push createChannel(${c.id}) failed:`, err);
      });
    }
    logger.log('[Channels] Native notification channels registered.');
  } catch (err) {
    logger.warn('[Channels] Native notification channel setup bypassed:', err);
  }
}
