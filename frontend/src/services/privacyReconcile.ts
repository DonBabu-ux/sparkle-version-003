import api from '../api/api';
import { SparkleStorage } from './SparkleStorageService';
import { logger } from '../utils/logger';

export async function reconcilePrivacySettings(chatId: string): Promise<void> {
  try {
    const res = await api.get(`/messages/${chatId}/privacy`);
    const enforced = res.data?.enforcedSettings || res.data;
    if (!enforced) return;
    await SparkleStorage.setPrivacyCache(chatId, enforced).catch(() => {});
    try {
      localStorage.setItem(`sparkle_privacy_cache_${chatId}`, JSON.stringify(enforced));
    } catch (e) {}
  } catch (err) {
    logger.error(err);
  }
}
