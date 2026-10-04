import axios, { AxiosError } from 'axios';

export type AuthErrorType =
  | 'EMPTY_EMAIL'
  | 'INVALID_EMAIL'
  | 'EMPTY_PASSWORD'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_DISABLED'
  | 'EMAIL_NOT_VERIFIED'
  | 'TOO_MANY_ATTEMPTS'
  | 'INVALID_REQUEST'
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'SERVER_UNREACHABLE'
  | 'SERVER_500'
  | 'SERVER_502'
  | 'SERVER_503'
  | 'SERVER_504'
  | 'UNKNOWN_ERROR';

export type AuthErrorAction =
  | 'retry'
  | 'forgot_password'
  | 'contact_support'
  | 'verify_email'
  | 'focus_email'
  | 'focus_password';

export interface AuthErrorInfo {
  type: AuthErrorType;
  title: string;
  message: string;
  action?: AuthErrorAction;
  actionLabel?: string;
  actionLink?: string;
  requestId?: string;
  retryAfterSeconds?: number;
  shake?: boolean;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Validates login input fields before initiating network requests.
 * Prevents unnecessary server round-trips while keeping user input feedback immediate.
 */
export function validateLoginInputs(loginId: string, password: string): AuthErrorInfo | null {
  const trimmedLogin = (loginId || '').trim();

  // 1. Empty Email / Username
  if (!trimmedLogin) {
    return {
      type: 'EMPTY_EMAIL',
      title: 'Email required',
      message: 'Enter your email address to continue.',
      action: 'focus_email',
      severity: 'error'
    };
  }

  // 2. Malformed Email format check (if user intends to sign in with an email)
  if (trimmedLogin.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedLogin)) {
      return {
        type: 'INVALID_EMAIL',
        title: 'Check your email',
        message: 'Enter a valid email address and try again.',
        action: 'focus_email',
        severity: 'error'
      };
    }
  }

  // 3. Empty Password
  if (!password) {
    return {
      type: 'EMPTY_PASSWORD',
      title: 'Password required',
      message: 'Enter your password to continue.',
      action: 'focus_password',
      severity: 'error'
    };
  }

  return null;
}

/**
 * Centralized, production-grade login error classification.
 * Translates low-level network, HTTP, and backend security states into
 * structured, accessible, user-friendly failure states without leaking sensitive details.
 */
export function classifyLoginError(error: unknown, options?: { isOnline?: boolean }): AuthErrorInfo {
  // Check online status first
  const isOnline = options?.isOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true);

  if (!isOnline) {
    return {
      type: 'OFFLINE',
      title: "You're offline",
      message: 'No internet connection. Check your connection and try again.',
      action: 'retry',
      actionLabel: 'Try again',
      severity: 'warning'
    };
  }

  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{
      code?: string;
      message?: string;
      requestId?: string;
      retryAfter?: number;
    }>;

    // Timeout (ECONNABORTED or message contains timeout)
    if (axiosErr.code === 'ECONNABORTED' || axiosErr.message?.toLowerCase().includes('timeout')) {
      return {
        type: 'TIMEOUT',
        title: 'Taking too long',
        message: 'The connection is taking longer than expected. Please try again.',
        action: 'retry',
        actionLabel: 'Try again',
        severity: 'warning'
      };
    }

    // Network / Unreachable (Request sent but no response received)
    if (!axiosErr.response) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return {
          type: 'OFFLINE',
          title: "You're offline",
          message: 'No internet connection. Check your connection and try again.',
          action: 'retry',
          actionLabel: 'Try again',
          severity: 'warning'
        };
      }

      return {
        type: 'SERVER_UNREACHABLE',
        title: 'Connection problem',
        message: "We couldn't connect to Sparkle right now. Please try again in a moment.",
        action: 'retry',
        actionLabel: 'Try again',
        severity: 'warning'
      };
    }

    // Server responded with HTTP status code
    const status = axiosErr.response.status;
    const data = axiosErr.response.data || {};
    const backendCode = data.code || '';
    const requestId = data.requestId;

    // 401 Unauthorized / INVALID_CREDENTIALS
    if (status === 401 || backendCode === 'INVALID_CREDENTIALS') {
      return {
        type: 'INVALID_CREDENTIALS',
        title: 'Incorrect details',
        message: 'The email or password you entered is incorrect. Please check your details and try again.',
        action: 'forgot_password',
        actionLabel: 'Forgot password?',
        actionLink: '/forgot-password',
        shake: true,
        severity: 'error'
      };
    }

    // 429 Too Many Requests / Rate Limited
    if (status === 429 || backendCode === 'TOO_MANY_ATTEMPTS' || backendCode === 'RATE_LIMITED') {
      const retryHeader = axiosErr.response.headers?.['retry-after'];
      const retrySec = data.retryAfter || (retryHeader ? parseInt(retryHeader, 10) : undefined);
      return {
        type: 'TOO_MANY_ATTEMPTS',
        title: 'Too many attempts',
        message: retrySec && !isNaN(retrySec)
          ? `You've tried to log in too many times. Please wait ${retrySec} seconds before trying again.`
          : "You've tried to log in too many times. Please wait a moment before trying again.",
        action: 'retry',
        actionLabel: 'Try again',
        retryAfterSeconds: retrySec,
        severity: 'warning'
      };
    }

    // 423 Locked / ACCOUNT_LOCKED
    if (status === 423 || backendCode === 'ACCOUNT_LOCKED') {
      return {
        type: 'ACCOUNT_LOCKED',
        title: 'Account temporarily locked',
        message: 'For your security, sign-in has been temporarily restricted. Please follow the recovery options to regain access.',
        action: 'forgot_password',
        actionLabel: 'Reset password',
        actionLink: '/forgot-password',
        severity: 'error'
      };
    }

    // ACCOUNT_SUSPENDED
    if (backendCode === 'ACCOUNT_SUSPENDED') {
      return {
        type: 'ACCOUNT_SUSPENDED',
        title: 'Account unavailable',
        message: 'This account is currently unavailable. Please contact Sparkle Support if you believe this is a mistake.',
        action: 'contact_support',
        actionLabel: 'Contact Support',
        actionLink: '/support',
        severity: 'error'
      };
    }

    // ACCOUNT_DISABLED
    if (backendCode === 'ACCOUNT_DISABLED') {
      return {
        type: 'ACCOUNT_DISABLED',
        title: 'Account unavailable',
        message: 'This account is currently unavailable. Please contact Sparkle Support for assistance.',
        action: 'contact_support',
        actionLabel: 'Contact Support',
        actionLink: '/support',
        severity: 'error'
      };
    }

    // EMAIL_NOT_VERIFIED
    if (backendCode === 'EMAIL_NOT_VERIFIED') {
      return {
        type: 'EMAIL_NOT_VERIFIED',
        title: 'Verify your email',
        message: 'Please verify your email address before signing in.',
        action: 'verify_email',
        actionLabel: 'Verify email',
        actionLink: '/verify-email',
        severity: 'info'
      };
    }

    // 400 Bad Request / INVALID_REQUEST
    if (status === 400 || backendCode === 'INVALID_REQUEST') {
      return {
        type: 'INVALID_REQUEST',
        title: 'Check your details',
        message: "We couldn't process that request. Please check your details and try again.",
        action: 'retry',
        actionLabel: 'Try again',
        severity: 'error'
      };
    }

    // 502 Bad Gateway
    if (status === 502) {
      return {
        type: 'SERVER_502',
        title: 'Sparkle is temporarily unavailable',
        message: "We're having trouble reaching Sparkle right now. Please try again shortly.",
        action: 'retry',
        actionLabel: 'Try again',
        severity: 'error'
      };
    }

    // 503 Service Unavailable / AUTH_SERVICE_UNAVAILABLE
    if (status === 503 || backendCode === 'AUTH_SERVICE_UNAVAILABLE') {
      return {
        type: 'SERVER_503',
        title: 'Sparkle is temporarily unavailable',
        message: 'Our services are temporarily unavailable. Please try again in a moment.',
        action: 'retry',
        actionLabel: 'Try again',
        severity: 'error'
      };
    }

    // 504 Gateway Timeout
    if (status === 504) {
      return {
        type: 'SERVER_504',
        title: 'Sparkle is taking too long',
        message: 'The server took too long to respond. Please try again.',
        action: 'retry',
        actionLabel: 'Try again',
        severity: 'warning'
      };
    }

    // 500 Internal Server Error
    if (status === 500 || backendCode === 'INTERNAL_SERVER_ERROR') {
      return {
        type: 'SERVER_500',
        title: 'Something went wrong',
        message: 'Something went wrong on our side. Please try again shortly.',
        action: 'retry',
        actionLabel: 'Try again',
        requestId,
        severity: 'error'
      };
    }
  }

  // Fallback for unexpected failures (TypeError, null, JS exception, etc.)
  return {
    type: 'UNKNOWN_ERROR',
    title: 'Something went wrong',
    message: "We couldn't complete your sign-in. Please try again.",
    action: 'retry',
    actionLabel: 'Try again',
    severity: 'error'
  };
}
