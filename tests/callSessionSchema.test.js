// tests/callSessionSchema.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const initSource = fs.readFileSync(
    path.join(__dirname, '..', 'backend', 'utils', 'database', 'init.js'),
    'utf8'
);
const signalingSource = fs.readFileSync(
    path.join(__dirname, '..', 'backend', 'socket', 'callSignaling.js'),
    'utf8'
);

describe('Call sessions — schema contract', () => {
    it('stores the signalling offer so a backgrounded callee can still answer', () => {
        assert.ok(initSource.includes('offer_sdp'), 'call_sessions.offer_sdp column is missing');
    });

    it('keeps a unique index on messages.call_id so a call records one bubble', () => {
        assert.ok(initSource.includes('uq_messages_call_id'), 'unique index on messages.call_id is missing');
    });

    it('supports the reconnecting and held call states', () => {
        assert.ok(initSource.includes("'reconnecting'"), 'reconnecting state missing from the call_sessions enum');
        assert.ok(initSource.includes("'held'"), 'held state missing from the call_sessions enum');
    });

    it('tracks when a call was actually connected', () => {
        assert.ok(initSource.includes('connected_at'), 'call_sessions.connected_at column is missing');
    });
});

describe('Call sessions — signalling contract', () => {
    it('inserts the call session instead of resurrecting a finished one', () => {
        assert.ok(
            !/ON DUPLICATE KEY UPDATE status = IF\(status IN/.test(signalingSource),
            'call:invite must not reset an already finished call session'
        );
    });

    it('writes the offer with the ringing session', () => {
        assert.ok(
            /status='ringing', started_at=NOW\(\), offer_sdp=/.test(signalingSource),
            'the offer must be persisted when the session starts ringing'
        );
    });

    it('clears the stored offer once the call is finalised', () => {
        assert.ok(
            /end_reason = \?, offer_sdp = NULL/.test(signalingSource),
            'the stored offer must be cleared when the call ends'
        );
    });

    it('records the call bubble with INSERT IGNORE for idempotency', () => {
        assert.ok(
            /INSERT IGNORE INTO messages/.test(signalingSource),
            'the call bubble must be written idempotently'
        );
    });
});
