import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { logger } from '../utils/logger';

export interface SparkleChannel {
  id: string;
  name: string;
  importance: 1 | 2 | 3 | 4 | 5;
  sound: string;
}

// 8 distinct Android notification channels with per-category sounds
// (sound files live in android/app/src/main/res/raw/*.mp3).
//
// v2 sound assignment:
//  - messages plays the dedicated receive.mp3. It previously played the
//    generic notification.mp3 even though receive.mp3 ships in the APK and
//    was never referenced by anything, so an incoming message sounded like
//    every other system notice.
//  - sparkle_ai plays comment.mp3. It shared notification.mp3 with system
//    updates, so an assistant reply was indistinguishable from a generic
//    system notice.
export const SPARKLE_CHANNELS: SparkleChannel[] = [
  { id: 'messages', name: 'Messages', importance: 5, sound: 'receive' },
  { id: 'marketplace', name: 'Marketplace Activity', importance: 4, sound: 'comment' },
  { id: 'stories', name: 'Stories updates', importance: 4, sound: 'story' },
  { id: 'moments', name: 'Moments updates', importance: 4, sound: 'like' },
  { id: 'social', name: 'Social Activity', importance: 4, sound: 'follow' },
  { id: 'calls', name: 'Incoming Calls', importance: 5, sound: 'ringtone' },
  { id: 'sparkle_ai', name: 'Sparkle AI Assistant', importance: 4, sound: 'comment' },
  { id: 'system', name: 'System updates', importance: 3, sound: 'notification' },
];

/**
 * Bump whenever the channel list above changes (sound, importance, the set of
 * channels). Android keeps a channel's original settings for life: calling
 * createChannel on an id that already exists is a no-op, so without this the
 * changes above would reach only fresh installs and every existing device
 * would keep the old sounds forever.
 */
const CHANNEL_SCHEMA_VERSION = 2;
const CHANNEL_VERSION_KEY = 'sparkle_channel_schema_version';

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
  story_like: 'stories',
  story_share: 'stories',
  story_reply: 'stories',
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
    const { value } = await Preferences.get({ key: CHANNEL_VERSION_KEY });

    if (value !== String(CHANNEL_SCHEMA_VERSION)) {
      // The channel list changed since this device last ran it. Android will
      // not update an existing channel, so drop them and let the create loop
      // below rebuild them with the current settings. Runs once per upgrade.
      for (const c of SPARKLE_CHANNELS) {
        await LocalNotifications.deleteChannel({ id: c.id }).catch(() => { });
        await PushNotifications.deleteChannel({ id: c.id }).catch(() => { });
      }
      await Preferences.set({ key: CHANNEL_VERSION_KEY, value: String(CHANNEL_SCHEMA_VERSION) });
      logger.log(`[Channels] Channel schema upgraded to v${CHANNEL_SCHEMA_VERSION}; channels recreated.`);
    }

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
