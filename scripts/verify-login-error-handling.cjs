const assert = require('assert');

// Test input validation logic
function validateLoginInputs(loginId, password) {
  const trimmedLogin = (loginId || '').trim();

  if (!trimmedLogin) {
    return {
      type: 'EMPTY_EMAIL',
      title: 'Email required',
      message: 'Enter your email address to continue.',
      action: 'focus_email',
      severity: 'error'
    };
  }

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

// Test error classification logic
function classifyLoginError(error, options) {
  const isOnline = options?.isOnline ?? true;

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

  if (error && error.isAxiosError) {
    if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
      return {
        type: 'TIMEOUT',
        title: 'Taking too long',
        message: 'The connection is taking longer than expected. Please try again.',
        action: 'retry',
        actionLabel: 'Try again',
        severity: 'warning'
      };
    }

    if (!error.response) {
      return {
        type: 'SERVER_UNREACHABLE',
        title: 'Connection problem',
        message: "We couldn't connect to Sparkle right now. Please try again in a moment.",
        action: 'retry',
        actionLabel: 'Try again',
        severity: 'warning'
      };
    }

    const status = error.response.status;
    const data = error.response.data || {};
    const backendCode = data.code || '';
    const requestId = data.requestId;

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

    if (status === 429 || backendCode === 'TOO_MANY_ATTEMPTS' || backendCode === 'RATE_LIMITED') {
      const retrySec = data.retryAfter;
      return {
        type: 'TOO_MANY_ATTEMPTS',
        title: 'Too many attempts',
        message: retrySec
          ? `You've tried to log in too many times. Please wait ${retrySec} seconds before trying again.`
          : "You've tried to log in too many times. Please wait a moment before trying again.",
        action: 'retry',
        actionLabel: 'Try again',
        severity: 'warning'
      };
    }

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

  return {
    type: 'UNKNOWN_ERROR',
    title: 'Something went wrong',
    message: "We couldn't complete your sign-in. Please try again.",
    action: 'retry',
    actionLabel: 'Try again',
    severity: 'error'
  };
}

console.log('Testing Sparkle Login Error Handling System...');

// 1. Validation tests
console.log('1. Testing Client-Side Validation...');
assert.equal(validateLoginInputs('', 'pass').type, 'EMPTY_EMAIL');
assert.equal(validateLoginInputs('   ', 'pass').type, 'EMPTY_EMAIL');
assert.equal(validateLoginInputs('invalid@', 'pass').type, 'INVALID_EMAIL');
assert.equal(validateLoginInputs('@test.com', 'pass').type, 'INVALID_EMAIL');
assert.equal(validateLoginInputs('valid@sparkle.app', '').type, 'EMPTY_PASSWORD');
assert.equal(validateLoginInputs('valid@sparkle.app', 'correctPassword'), null);
assert.equal(validateLoginInputs('validusername', 'correctPassword'), null);
console.log('   ✓ Client validation passed');

// 2. Connectivity tests
console.log('2. Testing Connectivity Failures...');
assert.equal(classifyLoginError(new Error(), { isOnline: false }).type, 'OFFLINE');
assert.equal(classifyLoginError({ isAxiosError: true, code: 'ECONNABORTED' }, { isOnline: true }).type, 'TIMEOUT');
assert.equal(classifyLoginError({ isAxiosError: true, code: 'ERR_NETWORK' }, { isOnline: true }).type, 'SERVER_UNREACHABLE');
console.log('   ✓ Connectivity handling passed');

// 3. HTTP status & backend codes
console.log('3. Testing HTTP Status & Backend Error Codes...');
const invalidCreds = classifyLoginError({ isAxiosError: true, response: { status: 401, data: { code: 'INVALID_CREDENTIALS' } } });
assert.equal(invalidCreds.type, 'INVALID_CREDENTIALS');
assert.equal(invalidCreds.title, 'Incorrect details');
assert.equal(invalidCreds.shake, true);
assert.equal(invalidCreds.action, 'forgot_password');

const rateLimited = classifyLoginError({ isAxiosError: true, response: { status: 429, data: { code: 'TOO_MANY_ATTEMPTS', retryAfter: 30 } } });
assert.equal(rateLimited.type, 'TOO_MANY_ATTEMPTS');
assert.ok(rateLimited.message.includes('30 seconds'));

const locked = classifyLoginError({ isAxiosError: true, response: { status: 423, data: { code: 'ACCOUNT_LOCKED' } } });
assert.equal(locked.type, 'ACCOUNT_LOCKED');

const suspended = classifyLoginError({ isAxiosError: true, response: { status: 403, data: { code: 'ACCOUNT_SUSPENDED' } } });
assert.equal(suspended.type, 'ACCOUNT_SUSPENDED');
assert.equal(suspended.actionLabel, 'Contact Support');

const disabled = classifyLoginError({ isAxiosError: true, response: { status: 403, data: { code: 'ACCOUNT_DISABLED' } } });
assert.equal(disabled.type, 'ACCOUNT_DISABLED');

const unverified = classifyLoginError({ isAxiosError: true, response: { status: 403, data: { code: 'EMAIL_NOT_VERIFIED' } } });
assert.equal(unverified.type, 'EMAIL_NOT_VERIFIED');

const s500 = classifyLoginError({ isAxiosError: true, response: { status: 500, data: { code: 'INTERNAL_SERVER_ERROR', requestId: 'SPK-TEST99' } } });
assert.equal(s500.type, 'SERVER_500');
assert.equal(s500.requestId, 'SPK-TEST99');

const s502 = classifyLoginError({ isAxiosError: true, response: { status: 502 } });
assert.equal(s502.type, 'SERVER_502');

const s503 = classifyLoginError({ isAxiosError: true, response: { status: 503 } });
assert.equal(s503.type, 'SERVER_503');

const s504 = classifyLoginError({ isAxiosError: true, response: { status: 504 } });
assert.equal(s504.type, 'SERVER_504');

const unexpected = classifyLoginError(new TypeError('Unknown error'));
assert.equal(unexpected.type, 'UNKNOWN_ERROR');
console.log('   ✓ Backend codes & HTTP status handling passed');

console.log('ALL LOGIN ERROR MATRIX TESTS PASSED SUCCESSFULLY! ✨');
