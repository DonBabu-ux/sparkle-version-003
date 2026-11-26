import { describe, it, expect, beforeEach } from 'vitest';
import { createJSONStorage } from 'zustand/middleware';

// zustand's persist would otherwise write through Capacitor Preferences, whose
// web impl reads window.localStorage — undefined in the node test env. Swap in
// an in-memory storage so every write is observable and nothing rejects.
const makeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    map,
  };
};

const storage = makeStorage();
const { useUserStore } = await import('../userStore');

const user = (id: string) => ({
  user_id: id,
  id,
  username: `user_${id}`,
  name: `User ${id}`,
  email: `${id}@x.co`,
});

const state = () => useUserStore.getState();

const reset = () => {
  useUserStore.persist.setOptions({ storage: createJSONStorage(() => storage) });
  useUserStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    accounts: [],
    activeAccountId: null,
    theme: 'light',
  });
  storage.map.clear();
};

const persisted = () => JSON.parse(storage.getItem('user-storage') || '{}');

describe('userStore — multi-account session management', () => {
  beforeEach(reset);

  it('login registers the account and activates the session', () => {
    state().login('token-1', 'refresh-1', user('u1'));

    const s = state();
    expect(s.isAuthenticated).toBe(true);
    expect(s.token).toBe('token-1');
    expect(s.refreshToken).toBe('refresh-1');
    expect(s.activeAccountId).toBe('u1');
    expect(s.accounts).toHaveLength(1);
    expect(s.accounts[0].user.user_id).toBe('u1');
  });

  it('login appends and can hold several accounts, activating the newest', () => {
    state().login('token-1', 'refresh-1', user('u1'));
    state().login('token-2', 'refresh-2', user('u2'));

    expect(state().accounts).toHaveLength(2);
    expect(state().activeAccountId).toBe('u2');
    expect(state().token).toBe('token-2');
  });

  it('re-login replaces the account in place instead of duplicating it', () => {
    state().login('token-1', 'refresh-1', user('u1'));
    state().login('token-2', 'refresh-2', user('u2'));
    state().login('token-1b', 'refresh-1b', user('u1'));

    expect(state().accounts).toHaveLength(2);
    expect(state().accounts.find((a) => a.user.user_id === 'u1')!.token).toBe('token-1b');
    expect(state().activeAccountId).toBe('u1');
  });

  it('persists the session shape including the theme', async () => {
    state().login('token-1', 'refresh-1', user('u1'));
    await Promise.resolve(); // let the persist write settle

    const payload = persisted();
    expect(payload.state.token).toBe('token-1');
    expect(payload.state.isAuthenticated).toBe(true);
    expect(payload.state.accounts).toHaveLength(1);
    expect(payload.state.theme).toBe('light');
  });

  it('setToken rotates the active token without dropping the account list', async () => {
    state().login('token-1', 'refresh-1', user('u1'));
    state().setToken('token-rotated', 'refresh-rotated');
    await Promise.resolve();

    expect(state().token).toBe('token-rotated');
    expect(state().accounts).toHaveLength(1);
  });
});

describe('userStore — logout semantics', () => {
  beforeEach(reset);

  it('logout of the active account auto-switches to the next one', () => {
    state().login('token-1', 'refresh-1', user('u1'));
    state().login('token-2', 'refresh-2', user('u2')); // active

    state().logout();

    const s = state();
    expect(s.isAuthenticated).toBe(true);
    expect(s.activeAccountId).toBe('u1');
    expect(s.token).toBe('token-1');
    expect(s.accounts).toHaveLength(1);
  });

  it('logout of the last account fully resets the session', () => {
    state().login('token-1', 'refresh-1', user('u1'));
    state().logout();

    const s = state();
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
    expect(s.token).toBeNull();
    expect(s.accounts).toHaveLength(0);
    expect(s.activeAccountId).toBeNull();
  });

  it('switchAccount swaps the session to a stored account', () => {
    state().login('token-1', 'refresh-1', user('u1'));
    state().login('token-2', 'refresh-2', user('u2'));

    state().switchAccount('u1');

    expect(state().activeAccountId).toBe('u1');
    expect(state().token).toBe('token-1');
    expect(state().isAuthenticated).toBe(true);
    expect(state().accounts).toHaveLength(2);
  });

  it('switchAccount to an unknown account is a no-op', () => {
    state().login('token-1', 'refresh-1', user('u1'));

    state().switchAccount('ghost');

    expect(state().activeAccountId).toBe('u1');
    expect(state().token).toBe('token-1');
  });

  it('removeAccount of a background account leaves the active session alone', () => {
    state().login('token-1', 'refresh-1', user('u1'));
    state().login('token-2', 'refresh-2', user('u2')); // active

    state().removeAccount('u1');

    const s = state();
    expect(s.activeAccountId).toBe('u2');
    expect(s.token).toBe('token-2');
    expect(s.accounts).toHaveLength(1);
  });

  it('removeAccount of the active account auto-switches to the survivor', () => {
    state().login('token-1', 'refresh-1', user('u1'));
    state().login('token-2', 'refresh-2', user('u2')); // active

    state().removeAccount('u2');

    const s = state();
    expect(s.isAuthenticated).toBe(true);
    expect(s.activeAccountId).toBe('u1');
    expect(s.token).toBe('token-1');
    expect(s.accounts).toHaveLength(1);
  });

  it('removeAccount of the last account resets the session', () => {
    state().login('token-1', 'refresh-1', user('u1'));
    state().removeAccount('u1');

    const s = state();
    expect(s.isAuthenticated).toBe(false);
    expect(s.accounts).toHaveLength(0);
    expect(s.token).toBeNull();
  });
});

describe('userStore — theme', () => {
  beforeEach(reset);

  it('defaults to light in a node env (no window preference)', () => {
    expect(state().theme).toBe('light');
  });

  it('setTheme persists the choice', async () => {
    state().setTheme('dark');
    await Promise.resolve();

    expect(state().theme).toBe('dark');
    expect(persisted().state.theme).toBe('dark');
  });

  it('a persisted theme overrides the device default on hydrate', async () => {
    storage.setItem('user-storage', JSON.stringify({
      state: {
        user: null, token: 'p-token', refreshToken: 'p-refresh', isAuthenticated: true,
        accounts: [{ user: user('u9'), token: 'p-token', refreshToken: 'p-refresh' }],
        activeAccountId: 'u9', theme: 'dark',
      },
      version: 0,
    }));

    await useUserStore.persist.rehydrate();

    const s = state();
    expect(s.theme).toBe('dark');
    expect(s.token).toBe('p-token');
    expect(s.isAuthenticated).toBe(true);
    expect(s.activeAccountId).toBe('u9');
  });

  it('hydrating an empty store keeps the defaults', async () => {
    await useUserStore.persist.rehydrate();
    expect(state().isAuthenticated).toBe(false);
    expect(state().accounts).toHaveLength(0);
  });
});