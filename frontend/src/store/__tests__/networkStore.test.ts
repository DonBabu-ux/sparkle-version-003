import { describe, it, expect, beforeEach } from 'vitest';
import { useNetworkStore } from '../networkStore';

const state = () => useNetworkStore.getState();

beforeEach(() => {
  useNetworkStore.setState({ isOffline: false, quality: 'strong', saveDataMode: false });
});

describe('network store', () => {
  it('starts with defaults', () => {
    expect(state().isOffline).toBe(false);
    expect(state().quality).toBe('strong');
    expect(state().saveDataMode).toBe(false);
  });

  it('going offline flips both isOffline and quality', () => {
    state().setOffline(true);
    expect(state().isOffline).toBe(true);
    expect(state().quality).toBe('offline');
  });

  it('coming back online restores a working quality', () => {
    state().setOffline(true);
    state().setOffline(false);
    expect(state().isOffline).toBe(false);
    expect(state().quality).toBe('strong');
  });

  it('the classifier can pin weak/unstable without going offline', () => {
    state().setQuality('weak');
    expect(state().isOffline).toBe(false);
    expect(state().quality).toBe('weak');

    state().setQuality('unstable');
    expect(state().quality).toBe('unstable');
  });

  it('save-data mode is tracked independently of quality', () => {
    state().setSaveDataMode(true);
    expect(state().saveDataMode).toBe(true);
    expect(state().quality).toBe('strong');

    state().setSaveDataMode(false);
    expect(state().saveDataMode).toBe(false);
  });
});