'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// These cover the two delivery defects that shipped:
//   F1 — generic notifications forwarded only { type, url, eventId } to FCM,
//        so clients could not deep-link and the tray showed the brand logo.
//   F2 — with no queue, NotificationService.send() returned early and the
//        event vanished (no bell row, no push).

const path = require('node:path');
const fs = require('node:fs');
const src = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const delivery = () => src('backend/services/notificationDelivery.js');
const service = () => src('backend/services/notification.service.js');
const worker = () => src('backend/workers/notification.worker.js');

test('delivery forwards the caller data payload, not just three fields', () => {
    const s = delivery();
    // payload construction: spread all keys except display strings
    assert.ok(/for \(const key of Object\.keys\(data\)\)/.test(s), 'iterates the full event data');
    assert.ok(/key === 'title' \|\| key === 'content'/.test(s), 'drops only display strings');
    // routing/semantic fields the client needs must survive
    assert.ok(/fcmData\.type = type/.test(s), 'type always set (channel routing)');
    assert.ok(/fcmData\.eventId = eventId/.test(s), 'eventId forwarded (tray tag collapsing)');
    // the old narrow payload must be gone
    assert.ok(!/\{\s*type,\s*url: data\.url \|\| '\/',/.test(s), 'old 3-field payload removed');
});

test('delivery sends senderAvatar through to the tray image', () => {
    const s = delivery();
    assert.ok(/sendFcmNotification/.test(s), 'sends to the user device tokens');
    assert.ok(/fcmData/.test(s) && /data\.title, data\.content/.test(s), 'full payload handed to the FCM layer');
});

test('delivery scopes the tray tag per token so multi-device does not overwrite', () => {
    const s = delivery();
    // F7: one multicast carries a single tag — a second device joining the
    // same event replaced the first device's card. Sends are now per-token.
    assert.ok(/for \(const t of tokens\)/.test(s), 'iterates tokens individually');
    assert.ok(/perToken\.tag = /.test(s), 'each token gets its own tag');
    assert.ok(/shortHash\(t\.token\)/.test(s), 'tag is device-scoped via token hash');
    assert.ok(/sendFcmNotification\(\[t\.token\]/.test(s), 'single-token send');
});

test('oversized payloads degrade to core fields instead of failing', () => {
    const s = delivery();
    assert.ok(/MAX_FCM_DATA_BYTES/.test(s), 'has a payload size guard');
    assert.ok(/sending core fields only/.test(s), 'logs the degrade path');
});

test('no queue means direct delivery, not silent loss', () => {
    const s = service();
    assert.ok(/if \(!notificationQueue\)/.test(s) && /sendDirect/.test(s), 'send() falls back to sendDirect');
    assert.ok(!/Skipping async delivery/.test(s), 'the old early-return warning is gone');
});

test('sendDirect runs the same per-user pipeline', () => {
    const s = service();
    assert.ok(/static async sendDirect/.test(s), 'sendDirect exists');
    assert.ok(/deliverNotificationToUser/.test(s), 'reuses the shared delivery module');
});

test('queue worker uses the shared delivery module', () => {
    const s = worker();
    assert.ok(/require\('\.\.\/services\/notificationDelivery'\)/.test(s), 'imports the shared module');
    assert.ok(/deliverNotificationToUser\(userId/.test(s), 'per-user delivery delegated');
    // the worker must not carry a second, divergent copy of the payload build
    assert.ok(!/sendFcmNotification/.test(s), 'no inline FCM call left in the worker');
});
