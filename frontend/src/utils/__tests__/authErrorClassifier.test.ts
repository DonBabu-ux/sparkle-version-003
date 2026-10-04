import { describe, it, expect } from 'vitest';
import {
  validateLoginInputs,
  classifyLoginError
} from '../authErrorClassifier';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

function createMockAxiosError(status?: number, data?: any, code?: string): AxiosError {
  const error = new Error('Axios error') as AxiosError;
  error.name = 'AxiosError';
  error.isAxiosError = true;
  error.code = code;

  if (status !== undefined) {
    error.response = {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      data: data || {},
      headers: {},
      config: {} as InternalAxiosRequestConfig
    } as AxiosResponse;
  }

  return error;
}

describe('Login Error Handling Matrix', () => {
  describe('Client-Side Validation', () => {
    it('catches empty email/login', () => {
      const result = validateLoginInputs('', 'password123');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('EMPTY_EMAIL');
      expect(result?.title).toBe('Email required');
      expect(result?.message).toBe('Enter your email address to continue.');
    });

    it('catches whitespace-only email', () => {
      const result = validateLoginInputs('   ', 'password123');
      expect(result?.type).toBe('EMPTY_EMAIL');
    });

    it('catches malformed email when @ is present', () => {
      const malformedExamples = ['hello@', '@test.com', 'hello@domain', 'user@domain.'];
      for (const email of malformedExamples) {
        const result = validateLoginInputs(email, 'password123');
        expect(result?.type).toBe('INVALID_EMAIL');
        expect(result?.title).toBe('Check your email');
        expect(result?.message).toBe('Enter a valid email address and try again.');
      }
    });

    it('allows valid username without @ symbol', () => {
      const result = validateLoginInputs('johndoe', 'password123');
      expect(result).toBeNull();
    });

    it('allows valid email format', () => {
      const result = validateLoginInputs('john@example.com', 'password123');
      expect(result).toBeNull();
    });

    it('catches empty password', () => {
      const result = validateLoginInputs('john@example.com', '');
      expect(result?.type).toBe('EMPTY_PASSWORD');
      expect(result?.title).toBe('Password required');
      expect(result?.message).toBe('Enter your password to continue.');
    });
  });

  describe('Connectivity & Network States', () => {
    it('detects offline state when navigator is offline', () => {
      const result = classifyLoginError(new Error('Network error'), { isOnline: false });
      expect(result.type).toBe('OFFLINE');
      expect(result.title).toBe("You're offline");
      expect(result.message).toBe('No internet connection. Check your connection and try again.');
      expect(result.action).toBe('retry');
    });

    it('detects request timeout (ECONNABORTED)', () => {
      const err = createMockAxiosError(undefined, undefined, 'ECONNABORTED');
      const result = classifyLoginError(err, { isOnline: true });
      expect(result.type).toBe('TIMEOUT');
      expect(result.title).toBe('Taking too long');
      expect(result.message).toBe('The connection is taking longer than expected. Please try again.');
      expect(result.action).toBe('retry');
    });

    it('detects server unreachable / connection refused', () => {
      const err = createMockAxiosError(undefined, undefined, 'ERR_NETWORK');
      const result = classifyLoginError(err, { isOnline: true });
      expect(result.type).toBe('SERVER_UNREACHABLE');
      expect(result.title).toBe('Connection problem');
      expect(result.message).toBe("We couldn't connect to Sparkle right now. Please try again in a moment.");
      expect(result.action).toBe('retry');
    });
  });

  describe('HTTP Status & Backend Codes', () => {
    it('handles 401 INVALID_CREDENTIALS safely without leaking whether email exists', () => {
      const err = createMockAxiosError(401, { code: 'INVALID_CREDENTIALS' });
      const result = classifyLoginError(err);
      expect(result.type).toBe('INVALID_CREDENTIALS');
      expect(result.title).toBe('Incorrect details');
      expect(result.message).toBe('The email or password you entered is incorrect. Please check your details and try again.');
      expect(result.action).toBe('forgot_password');
      expect(result.shake).toBe(true);
    });

    it('handles 429 TOO_MANY_ATTEMPTS with rate limiting message', () => {
      const err = createMockAxiosError(429, { code: 'TOO_MANY_ATTEMPTS', retryAfter: 45 });
      const result = classifyLoginError(err);
      expect(result.type).toBe('TOO_MANY_ATTEMPTS');
      expect(result.title).toBe('Too many attempts');
      expect(result.message).toContain('45 seconds');
    });

    it('handles 423 ACCOUNT_LOCKED', () => {
      const err = createMockAxiosError(423, { code: 'ACCOUNT_LOCKED' });
      const result = classifyLoginError(err);
      expect(result.type).toBe('ACCOUNT_LOCKED');
      expect(result.title).toBe('Account temporarily locked');
      expect(result.actionLabel).toBe('Reset password');
    });

    it('handles ACCOUNT_SUSPENDED', () => {
      const err = createMockAxiosError(403, { code: 'ACCOUNT_SUSPENDED' });
      const result = classifyLoginError(err);
      expect(result.type).toBe('ACCOUNT_SUSPENDED');
      expect(result.title).toBe('Account unavailable');
      expect(result.actionLabel).toBe('Contact Support');
    });

    it('handles ACCOUNT_DISABLED', () => {
      const err = createMockAxiosError(403, { code: 'ACCOUNT_DISABLED' });
      const result = classifyLoginError(err);
      expect(result.type).toBe('ACCOUNT_DISABLED');
      expect(result.title).toBe('Account unavailable');
      expect(result.actionLabel).toBe('Contact Support');
    });

    it('handles EMAIL_NOT_VERIFIED', () => {
      const err = createMockAxiosError(403, { code: 'EMAIL_NOT_VERIFIED' });
      const result = classifyLoginError(err);
      expect(result.type).toBe('EMAIL_NOT_VERIFIED');
      expect(result.title).toBe('Verify your email');
      expect(result.actionLabel).toBe('Verify email');
    });

    it('handles 400 INVALID_REQUEST', () => {
      const err = createMockAxiosError(400, { code: 'INVALID_REQUEST' });
      const result = classifyLoginError(err);
      expect(result.type).toBe('INVALID_REQUEST');
      expect(result.title).toBe('Check your details');
    });

    it('handles 500 INTERNAL_SERVER_ERROR with reference ID', () => {
      const err = createMockAxiosError(500, { code: 'INTERNAL_SERVER_ERROR', requestId: 'SPK-9F12A4' });
      const result = classifyLoginError(err);
      expect(result.type).toBe('SERVER_500');
      expect(result.title).toBe('Something went wrong');
      expect(result.requestId).toBe('SPK-9F12A4');
    });

    it('handles 502 Bad Gateway', () => {
      const err = createMockAxiosError(502);
      const result = classifyLoginError(err);
      expect(result.type).toBe('SERVER_502');
      expect(result.title).toBe('Sparkle is temporarily unavailable');
    });

    it('handles 503 Service Unavailable', () => {
      const err = createMockAxiosError(503, { code: 'AUTH_SERVICE_UNAVAILABLE' });
      const result = classifyLoginError(err);
      expect(result.type).toBe('SERVER_503');
      expect(result.title).toBe('Sparkle is temporarily unavailable');
    });

    it('handles 504 Gateway Timeout', () => {
      const err = createMockAxiosError(504);
      const result = classifyLoginError(err);
      expect(result.type).toBe('SERVER_504');
      expect(result.title).toBe('Sparkle is taking too long');
    });

    it('handles unexpected JavaScript exception with clean fallback', () => {
      const result = classifyLoginError(new TypeError('Cannot read property of undefined'));
      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.title).toBe('Something went wrong');
      expect(result.message).toBe("We couldn't complete your sign-in. Please try again.");
    });
  });
});
