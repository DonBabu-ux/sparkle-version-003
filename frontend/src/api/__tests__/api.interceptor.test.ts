import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

const h = vi.hoisted(() => {
  const auth = {
    token: 'old-token',
    refreshToken: 'refresh-1',
    activeAccountId: 'acc-1',
    isAuthenticated: true,
    logout: vi.fn(),
    setToken: vi.fn(),
  };
  // Models production: EnvironmentService derives the base URL from the
  // currently active failover server, so switching servers also moves the
  // base URL every subsequent request (and replay) uses.
  const activeApiBase = { value: '/api' };
  return { auth, activeApiBase };
});

vi.mock('../../store/userStore', () => ({
  useUserStore: { getState: () => h.auth },
}));

vi.mock('../../services/EnvironmentService', () => ({
  EnvironmentService: { getApiBaseUrl: () => h.activeApiBase.value },
}));

vi.mock('../../services/ServerFailoverManager', () => ({
  ServerFailoverManager: {
    onServerChange: () => {},
    getActiveServer: () => ({ id: 'primary', origin: 'https://a.example', apiBase: 'https://a.example/api' }),
    getSecondaryServer: () => ({ id: 'secondary', origin: 'https://b.example', apiBase: 'https://b.example/api' }),
    isQuarantined: () => false,
    switchActiveServer: vi.fn((id: string) => {
      if (id === 'secondary') h.activeApiBase.value = 'https://b.example/api';
    }),
  },
}));

vi.mock('../../services/tokenRefresh', () => ({
  refreshTokenOnce: vi.fn(),
}));

vi.mock('../../utils/tokenHeaderSync', () => ({
  adoptServerToken: vi.fn(),
}));

vi.mock('../../components/ui/PageLoadBar', () => ({
  pageLoad: { requestStart: () => {}, requestEnd: () => {}, start: () => {}, finish: () => {}, subscribe: () => () => {} },
}));

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}
const storage = new MemoryStorage();
storage.setItem('sparkle_device_id', 'device-1');
vi.stubGlobal('localStorage', storage);

const { default: api, setAdminSession } = await import('../api');
const { refreshTokenOnce } = await import('../../services/tokenRefresh');
const { ServerFailoverManager } = await import('../../services/ServerFailoverManager');
const { adoptServerToken } = await import('../../utils/tokenHeaderSync');

const OK = (data: unknown = { ok: true }) => ({
  data, status: 200, statusText: 'OK', headers: {}, config: {},
});

// Errors must carry the REAL request config: the interceptor stores its retry
// guards (_retry / _failoverRetried / _networkRetry) on error.config, and a
// detached config makes every replay look like a first request.
const httpError = (status: number) => (config: unknown) => new axios.AxiosError(
  `Request failed with status code ${status}`,
  axios.AxiosError.ERR_BAD_RESPONSE,
  config as never,
  undefined,
  { status, statusText: 'ERR', headers: {}, config, data: {} } as never
);

const networkError = (config: unknown) => new axios.AxiosError(
  'Network Error', axios.AxiosError.ERR_NETWORK, config as never, undefined
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adapter: (config: any) => Promise<any>;

beforeEach(() => {
  localStorage.setItem('sparkle_device_id', 'device-1');
  h.auth.token = 'old-token';
  h.auth.refreshToken = 'refresh-1';
  h.auth.isAuthenticated = true;
  h.auth.logout.mockClear();
  h.auth.setToken.mockClear();
  vi.mocked(refreshTokenOnce).mockReset();
  vi.mocked(adoptServerToken).mockClear();
  vi.mocked(ServerFailoverManager.switchActiveServer).mockClear();
  adapter = async () => OK();
  // fetchCsrfToken uses the GLOBAL axios instance, so route it through the
  // same adapter as the app instance.
  axios.defaults.adapter = async (config) => adapter(config);
  api.defaults.adapter = async (config) => adapter(config);
  api.defaults.baseURL = '/api';
  h.activeApiBase.value = '/api';
});

describe('request interceptor — header contract', () => {
  it('sends the bearer token and device id', async () => {
    let seen: Record<string, string> = {};
    adapter = async (config) => { seen = config.headers as never; return OK(); };
    await api.get('/posts/feed');

    expect(seen.Authorization).toBe('Bearer old-token');
    expect(seen['x-device-id']).toBe('device-1');
  });

  it('omits the Authorization header when the session has no token', async () => {
    h.auth.token = '';
    let seen: Record<string, string> = {};
    adapter = async (config) => { seen = config.headers as never; return OK(); };
    await api.get('/posts/feed');
    expect(seen.Authorization).toBeUndefined();
  });

  it('fetches and attaches the CSRF token for mutating requests', async () => {
    const urls: string[] = [];
    let csrfHeader = '';
    adapter = async (config) => {
      urls.push(String(config.url));
      if (String(config.url).includes('csrf-token')) {
        return { ...OK(), data: { csrfToken: 'csrf-tok' } };
      }
      csrfHeader = String(config.headers['X-CSRF-Token']);
      return OK();
    };
    await api.post('/posts', { content: 'hi' });

    expect(urls.some((u) => u.includes('csrf-token'))).toBe(true);
    expect(urls).toContain('/posts');
    expect(csrfHeader).toBe('csrf-tok');
  });

  it('does not fetch CSRF for login/signup/refresh', async () => {
    const urls: string[] = [];
    adapter = async (config) => {
      urls.push(String(config.url));
      return OK();
    };
    await api.post('/auth/login', { email: 'a@b.c', password: 'x' });
    expect(urls.some((u) => u.includes('csrf-token'))).toBe(false);
  });

  it('attaches the admin session token on /admin calls', async () => {
    setAdminSession('admin-session-1');
    let seen: Record<string, string> = {};
    adapter = async (config) => { seen = config.headers as never; return OK(); };
    await api.get('/admin/stats');
    expect(seen['x-admin-session']).toBe('admin-session-1');
  });
});

describe('response interceptor — 401 single-flight refresh', () => {
  it('refreshes once and replays with the new token', async () => {
    let calls = 0;
    let replayAuth = '';
    adapter = async (config) => {
      calls++;
      if (calls === 1) throw httpError(401)(config);
      replayAuth = String((config.headers as Record<string, string>).Authorization);
      return OK({ replayed: true });
    };
    vi.mocked(refreshTokenOnce).mockImplementation(async () => {
      h.auth.token = 'new-token';
      h.auth.setToken('new-token', 'refresh-2');
      return 'new-token';
    });

    const res = await api.get('/posts/feed');

    expect(vi.mocked(refreshTokenOnce)).toHaveBeenCalledTimes(1);
    expect(replayAuth).toBe('Bearer new-token');
    expect(res.data).toEqual({ replayed: true });
  });

  it('replays every queued request after one refresh (concurrent 401s)', async () => {
    let phase = 0;
    const served: number[] = [];
    adapter = async (config) => {
      phase++;
      if (phase <= 2) throw httpError(401)(config);
      served.push(phase);
      return OK();
    };
    vi.mocked(refreshTokenOnce).mockImplementation(async () => 'new-token');

    const [a, b] = await Promise.all([
      api.get('/posts/feed'),
      api.get('/notifications'),
    ]);

    expect(vi.mocked(refreshTokenOnce)).toHaveBeenCalledTimes(1);
    expect(served).toHaveLength(2);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  it('logs out and rejects when there is no refresh token', async () => {
    h.auth.refreshToken = '';
    adapter = async (config) => { throw httpError(401)(config); };

    await expect(api.get('/posts/feed')).rejects.toMatchObject({ response: { status: 401 } });
    expect(h.auth.logout).toHaveBeenCalledTimes(1);
    expect(vi.mocked(refreshTokenOnce)).not.toHaveBeenCalled();
  });

  it('does not refresh-loop: a replayed request that 401s again fails fast', async () => {
    adapter = async (config) => { throw httpError(401)(config); };
    vi.mocked(refreshTokenOnce).mockImplementation(async () => 'new-token');

    await expect(api.get('/posts/feed')).rejects.toMatchObject({ response: { status: 401 } });
    expect(vi.mocked(refreshTokenOnce)).toHaveBeenCalledTimes(1);
  });

  it('a failing refresh rejects the request but leaves the session refreshable', async () => {
    adapter = async (config) => { throw httpError(401)(config); };
    vi.mocked(refreshTokenOnce).mockRejectedValue(new Error('refresh network down'));

    await expect(api.get('/posts/feed')).rejects.toBeTruthy();

    // isRefreshing must be released even though refresh never succeeded.
    vi.mocked(refreshTokenOnce).mockImplementation(async () => 'new-token');
    let phase = 0;
    adapter = async (config) => {
      phase++;
      if (phase === 1) throw httpError(401)(config);
      return OK();
    };
    const res = await api.get('/posts/feed');
    expect(res.status).toBe(200);
  });

  it('adopts the renewed token header on both success and failure', async () => {
    adapter = async () => OK();
    await api.get('/posts/feed');
    expect(vi.mocked(adoptServerToken)).toHaveBeenCalledTimes(1);

    vi.mocked(adoptServerToken).mockClear();
    adapter = async (config) => { throw httpError(500)(config); };
    await expect(api.get('/posts/feed')).rejects.toBeTruthy();
    expect(vi.mocked(adoptServerToken)).toHaveBeenCalledTimes(1);
  });

  it('never refreshes for a 401 on the login route itself', async () => {
    adapter = async (config) => { throw httpError(401)(config); };
    await expect(api.post('/auth/login', { email: 'a@b.c' })).rejects.toMatchObject({ response: { status: 401 } });
    expect(vi.mocked(refreshTokenOnce)).not.toHaveBeenCalled();
  });
});

describe('response interceptor — failover and network retry', () => {
  it('fails over to the secondary server on 503 and retries there', async () => {
    const baseUrls: string[] = [];
    let phase = 0;
    adapter = async (config) => {
      baseUrls.push(String(config.baseURL));
      phase++;
      if (phase === 1) throw httpError(503)(config);
      return OK({ recovered: true });
    };

    const res = await api.get('/posts/feed');

    expect(vi.mocked(ServerFailoverManager.switchActiveServer)).toHaveBeenCalledWith(
      'secondary',
      expect.stringContaining('/posts/feed')
    );
    expect(baseUrls[0]).toBe('/api');
    expect(baseUrls[1]).toBe('https://b.example/api');
    expect(res.data).toEqual({ recovered: true });
  });

  it('fails over only once per request (no infinite loop on a double outage)', async () => {
    let calls = 0;
    adapter = async (config) => { calls++; throw httpError(503)(config); };

    await expect(api.get('/posts/feed')).rejects.toMatchObject({ response: { status: 503 } });
    expect(calls).toBe(2);
    expect(vi.mocked(ServerFailoverManager.switchActiveServer)).toHaveBeenCalledTimes(1);
  });

  it('does NOT fail over on 500 (the app is up; both hosts share one DB)', async () => {
    let calls = 0;
    adapter = async (config) => { calls++; throw httpError(500)(config); };

    await expect(api.get('/posts/feed')).rejects.toMatchObject({ response: { status: 500 } });
    expect(calls).toBe(1);
    expect(vi.mocked(ServerFailoverManager.switchActiveServer)).not.toHaveBeenCalled();
  });

  it('network retry is capped: one failover plus two network retries, then reject', async () => {
    let calls = 0;
    adapter = async (config) => { calls++; throw networkError(config); };

    await expect(api.get('/posts/feed')).rejects.toBeTruthy();
    expect(calls).toBe(4);
    expect(vi.mocked(ServerFailoverManager.switchActiveServer)).toHaveBeenCalledTimes(1);
  }, 15000);

  it('never retries network errors on the login route (failover still applies)', async () => {
    let calls = 0;
    adapter = async (config) => { calls++; throw networkError(config); };

    // Failover is not a same-host retry: a dead primary is tried once on the
    // secondary even for login. The 500ms/1000ms network retry ladder is what
    // login is exempt from — hence 2 calls, not 4.
    await expect(api.post('/auth/login', { email: 'a@b.c' })).rejects.toBeTruthy();
    expect(calls).toBe(2);
    expect(vi.mocked(ServerFailoverManager.switchActiveServer)).toHaveBeenCalledTimes(1);
  });

  it('recovers when a retried network request succeeds', async () => {
    let phase = 0;
    adapter = async (config) => {
      phase++;
      if (phase === 1) throw networkError(config);
      return OK({ retried: true });
    };

    const res = await api.get('/posts/feed');
    expect(res.data).toEqual({ retried: true });
  }, 15000);
});