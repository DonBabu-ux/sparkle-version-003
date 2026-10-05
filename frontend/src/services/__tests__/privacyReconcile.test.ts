import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}));

vi.mock('../../api/api', () => ({
  default: { get: vi.fn() },
}));

import api from '../../api/api';
import { SparkleStorage } from '../SparkleStorageService';
import { reconcilePrivacySettings } from '../privacyReconcile';

const apiGet = api.get as unknown as ReturnType<typeof vi.fn>;

describe('reconcilePrivacySettings', () => {
  let cacheSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheSpy = vi
      .spyOn(SparkleStorage, 'setPrivacyCache')
      .mockResolvedValue(undefined as never);
  });

  it('writes fetched enforced settings to the SparkleStorage privacy cache', async () => {
    apiGet.mockResolvedValue({ data: { enforcedSettings: { allowCopy: false, allowForward: true } } });

    await reconcilePrivacySettings('chat-1');

    expect(cacheSpy).toHaveBeenCalledWith('chat-1', {
      allowCopy: false,
      allowForward: true,
    });
  });

  it('does nothing when the response carries no settings', async () => {
    apiGet.mockResolvedValue({ data: null });

    await reconcilePrivacySettings('chat-2');

    expect(cacheSpy).not.toHaveBeenCalled();
  });

  it('swallows API failures without throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiGet.mockRejectedValue(new Error('network down'));

    await expect(reconcilePrivacySettings('chat-3')).resolves.toBeUndefined();
    expect(cacheSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
