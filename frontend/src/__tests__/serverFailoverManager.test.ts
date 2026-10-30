import { describe, it, expect, beforeEach, vi } from 'vitest';

// Node test environment mock for localStorage & window
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
  key(i: number) { return [...this.store.keys()][i] ?? null; }
  get length() { return this.store.size; }
}

const mockStorage = new MemoryStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = {
  localStorage: mockStorage,
  location: { origin: 'http://localhost:5173' },
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

import { ServerFailoverManager, SERVER_CONFIGS } from '../services/ServerFailoverManager';

describe('ServerFailoverManager State Machine', () => {
  beforeEach(() => {
    mockStorage.clear();
    ServerFailoverManager.switchActiveServer('primary', 'test reset');
  });

  it('initializes with primary server by default', () => {
    expect(ServerFailoverManager.getActiveServer().id).toBe('primary');
    expect(ServerFailoverManager.getActiveOrigin()).toBe(SERVER_CONFIGS.primary.origin);
    expect(ServerFailoverManager.getActiveApiBase()).toBe(SERVER_CONFIGS.primary.apiBase);
  });

  it('correctly returns secondary server based on active server', () => {
    expect(ServerFailoverManager.getSecondaryServer().id).toBe('backup');
    ServerFailoverManager.switchActiveServer('backup', 'switch for test');
    expect(ServerFailoverManager.getSecondaryServer().id).toBe('primary');
  });

  it('switches server and notifies listeners', () => {
    const listener = vi.fn();
    const unsub = ServerFailoverManager.onServerChange(listener);

    ServerFailoverManager.switchActiveServer('backup', 'testing switch');

    expect(ServerFailoverManager.getActiveServer().id).toBe('backup');
    expect(listener).toHaveBeenCalledWith(SERVER_CONFIGS.backup, SERVER_CONFIGS.primary);

    unsub();
  });

  it('persists active server across reloads in localStorage', () => {
    ServerFailoverManager.switchActiveServer('backup', 'persistence test');
    expect(mockStorage.getItem('sparkle_active_server_id')).toBe('backup');
  });

  it('quarantine prevents switching to a compromised server', () => {
    ServerFailoverManager.quarantineServer('backup', 'suspected compromise');
    expect(ServerFailoverManager.isQuarantined('backup')).toBe(true);

    ServerFailoverManager.switchActiveServer('backup', 'attempt switch to quarantined');
    expect(ServerFailoverManager.getActiveServer().id).toBe('primary');
  });
});
