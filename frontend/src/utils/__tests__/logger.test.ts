import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, redactForLog } from '../logger';

const buildAxiosError = () => ({
  isAxiosError: true,
  name: 'AxiosError',
  message: 'Request failed with status code 401',
  code: 'ERR_BAD_REQUEST',
  stack: 'AxiosError: Request failed\n    at foo (app.js:1:1)',
  config: {
    method: 'post',
    url: '/api/auth/refresh?otp=123456',
    headers: {
      Authorization: 'Bearer super-secret-access',
      'x-refresh-token': 'super-secret-refresh',
    },
  },
  request: {},
  response: { status: 401, statusText: 'Unauthorized', data: {} },
});

describe('logger redaction (A.4 #5)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('warn() never prints axios headers or token material', () => {
    logger.warn('Initial auth validation failed:', buildAxiosError());
    const printed = JSON.stringify(warnSpy.mock.calls);
    expect(printed).not.toContain('super-secret-access');
    expect(printed).not.toContain('super-secret-refresh');
    expect(printed).not.toContain('Authorization');
    expect(printed).not.toContain('x-refresh-token');
    expect(printed).not.toContain('headers');
    expect(printed).toContain('401');
    expect(printed).toContain('/api/auth/refresh');
  });

  it('error() strips OTP/query strings from logged URLs', () => {
    logger.error('refresh exploded:', buildAxiosError());
    const printed = JSON.stringify(errorSpy.mock.calls);
    expect(printed).not.toContain('otp=123456');
    expect(printed).not.toContain('super-secret-access');
    expect(printed).toContain('/api/auth/refresh');
  });

  it('keeps status, method, code and stack for debugging', () => {
    const safe = redactForLog(buildAxiosError()) as Record<string, unknown>;
    expect(safe.status).toBe(401);
    expect(safe.statusText).toBe('Unauthorized');
    expect(safe.method).toBe('post');
    expect(safe.code).toBe('ERR_BAD_REQUEST');
    expect(String(safe.stack)).toContain('AxiosError');
  });

  it('passes non-axios values through untouched', () => {
    const plain = new Error('render failed');
    expect(redactForLog(plain)).toBe(plain);
    expect(redactForLog('a string')).toBe('a string');
    expect(redactForLog(undefined)).toBe(undefined);
    expect(redactForLog({ foo: 1, bar: 'baz' })).toEqual({ foo: 1, bar: 'baz' });
  });

  it('redacts a bare axios-config object logged directly', () => {
    const configOnly = {
      method: 'get',
      url: '/api/feed?session=abc',
      headers: { Authorization: 'Bearer y' },
    };
    const safe = redactForLog(configOnly) as Record<string, unknown>;
    expect(JSON.stringify(safe)).not.toContain('Bearer y');
    expect(JSON.stringify(safe)).not.toContain('headers');
    expect(safe.url).toBe('/api/feed');
  });
});
