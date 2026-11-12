'use strict';

/**
 * utils/envGuard.js
 *
 * Fails fast on configuration that is missing, or present but fake.
 *
 * The problem this solves: Sparkle's environment is large (65+ keys across
 * payments, media, push, email, three databases) and nothing validated it. A
 * key could be absent, or set to a placeholder like
 * SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY, and the app would
 * boot normally and fail only when that feature was used — often in front of a
 * user. SPARKLE_IDENTITY_BLOOM_HMAC_SECRET was missing entirely and is read
 * lazily, so it surfaced as a mid-request failure rather than a boot error.
 *
 * Severity:
 *   fatal    - the process cannot work without it; throws, boot stops.
 *   degraded - a whole feature will not work; logs an error, boot continues.
 *
 * Production-only requirements are gated on NODE_ENV, so local development and
 * the test suites are unaffected.
 */

const REQUIRED = [
  { key: 'JWT_SECRET', min: 32, why: 'signs every session token' },
  { key: 'DB_HOST', min: 1, why: 'MySQL connection' },
  { key: 'DB_USER', min: 1, why: 'MySQL connection' },
  { key: 'DB_NAME', min: 1, why: 'MySQL connection' },
];

const REQUIRED_PROD = [
  { key: 'PAYSTACK_SECRET_KEY', why: 'wallet deposits are charged with this' },
  { key: 'CLOUDINARY_CLOUD_NAME', why: 'all media uploads' },
  { key: 'CLOUDINARY_API_KEY', why: 'all media uploads' },
  { key: 'CLOUDINARY_API_SECRET', why: 'all media uploads' },
];

// Required for a feature to work at all, but the rest of the app works without
// them. Reported as errors, not fatal.
const REQUIRED_FOR_FEATURE = [
  { key: 'SPARKLE_IDENTITY_BLOOM_HMAC_SECRET', min: 32, feature: 'identity bloom' },
  { key: 'EMAIL_USER', feature: 'signup verification and password reset email' },
  { key: 'EMAIL_PASS', feature: 'signup verification and password reset email' },
  { key: 'EMAIL_HOST', feature: 'email delivery' },
  { key: 'PIXABAY_API_KEY', feature: 'music search' },
  { key: 'GIPHY_API_KEY', feature: 'GIF picker in chat' },
  { key: 'PAYSTACK_WEBHOOK_SECRET', fallbackKey: 'PAYSTACK_SECRET_KEY', feature: 'payment webhooks' },
];

// Values that mean "a human never filled this in".
const PLACEHOLDER = /^(REPLACE_ME|CHANGEME|CHANGE_ME|TODO|YOUR_[A-Z_]+|XXX+|NULL|<.*>|\*+)$/i;

// Noisy-but-harmless legacy keys. Reported once as informational so they can
// be deleted rather than being mistaken for live configuration.
const LEGACY_KEYS = ['FCM_SERVER_KEY'];

const looksLikePlaceholder = (v) => PLACEHOLDER.test(v.trim());

const problems = { fatal: [], degraded: [], info: [] };
const isProd = process.env.NODE_ENV === 'production';

const check = (list, bucket) => {
  for (const spec of list) {
    const v = process.env[spec.key] || (spec.fallbackKey ? process.env[spec.fallbackKey] : undefined);
    if (v === undefined || v.trim() === '') {
      problems[bucket].push(`${spec.key} is not set${spec.why ? ' — ' + spec.why : ''}${spec.feature ? ' — breaks ' + spec.feature : ''}`);
      continue;
    }
    if (looksLikePlaceholder(v)) {
      problems[bucket].push(`${spec.key} still holds the placeholder value "${v.trim().slice(0, 40)}" — ${spec.why || spec.feature || 'this key is not configured'}`);
      continue;
    }
    if (spec.min && v.trim().length < spec.min) {
      problems[bucket].push(`${spec.key} is only ${v.trim().length} characters; needs at least ${spec.min}${spec.why ? ' — ' + spec.why : ''}`);
    }
  }
};

check(REQUIRED, 'fatal');
if (isProd) check(REQUIRED_PROD, 'fatal');
check(REQUIRED_FOR_FEATURE, 'degraded');

LEGACY_KEYS.forEach((k) => {
  if (process.env[k]) {
    problems.info.push(`${k} is dead configuration — the code uses firebase-admin (FCM v1), never the legacy HTTP API. Safe to delete.`);
  }
});

// ── Cross-field consistency ─────────────────────────────────────────────────
// Each Firebase project is independent. A token minted for project A is
// rejected by project B, so a mismatch between the Admin SDK credentials and
// FIREBASE_DATABASE_URL means RTDB writes fail with permission denied while
// push appears healthy.
const fs = require('fs');
const path = require('path');

const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
let saProject = null;
if (fs.existsSync(saPath)) {
  try {
    saProject = JSON.parse(fs.readFileSync(saPath, 'utf8')).project_id || null;
  } catch (e) {
    problems.degraded.push('serviceAccountKey.json is present but not valid JSON — Firebase Admin will not initialise.');
  }
} else {
  problems.degraded.push('serviceAccountKey.json is missing — Firebase Admin cannot initialise, so push notifications cannot send.');
}

const rtdbUrl = process.env.FIREBASE_DATABASE_URL || '';
if (saProject && rtdbUrl) {
  const rtdbProject = rtdbUrl
    .replace(/^https?:\/\//, '')
    .split('.')[0]
    .replace(/-default-rtdb$/, '')
    .replace(/-firebaseio$/, '');
  if (rtdbProject && rtdbProject !== saProject) {
    problems.degraded.push(
      `Firebase project mismatch: the Admin SDK credentials are for "${saProject}" but FIREBASE_DATABASE_URL points at "${rtdbProject}". ` +
      'Those are different projects, so Realtime Database writes (order status sync) will fail with permission denied while push still works.'
    );
  }
}

// ── Reporting ───────────────────────────────────────────────────────────────
let logger = null;
try { logger = require('./logger'); } catch (_) { /* logger optional here */ }

const out = (level, msg) => {
  if (logger) logger[level](msg);
  else console.log('[' + level.toUpperCase() + '] ' + msg);
};

if (problems.fatal.length > 0) {
  out('error', 'ENVIRONMENT FATAL — the server cannot start:');
  problems.fatal.forEach((p) => console.error('   • ' + p));
  throw new Error('Missing required environment configuration: ' + problems.fatal.join('; '));
}

if (problems.degraded.length > 0) {
  out('error', 'Environment configured but degraded — these features will not work:');
  problems.degraded.forEach((p) => console.error('   • ' + p));
}

if (problems.info.length > 0) {
  problems.info.forEach((p) => console.log('   [info] ' + p));
}

if (problems.fatal.length === 0 && problems.degraded.length === 0) {
  out('info', 'Environment configuration validated.');
}

module.exports = {
  problems,
  validateEnv: () => {
    if (problems.fatal.length > 0) {
      throw new Error('Missing required environment configuration: ' + problems.fatal.join('; '));
    }
    return problems;
  },
};
