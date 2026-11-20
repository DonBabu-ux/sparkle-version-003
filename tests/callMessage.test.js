// tests/callMessage.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    CALL_OUTCOMES,
    normalizeMode,
    callContent,
    normalizeOutcome,
    resolveOutcomeForViewer,
    computeDurationSeconds,
    buildCallMessageMetadata,
} = require('../backend/utils/callMessage');

describe('CallMessage — mode and outcome normalisation', () => {
    it('normalises the call mode', () => {
        assert.equal(normalizeMode('video'), 'video');
        assert.equal(normalizeMode('voice'), 'voice');
        assert.equal(normalizeMode('anything-else'), 'voice');
        assert.equal(normalizeMode(undefined), 'voice');
    });

    it('keeps only known outcomes', () => {
        for (const outcome of CALL_OUTCOMES) {
            assert.equal(normalizeOutcome(outcome), outcome);
        }
        assert.equal(normalizeOutcome('exploded'), 'completed');
        assert.equal(normalizeOutcome(undefined), 'completed');
    });

    it('renders human readable call content', () => {
        assert.equal(callContent('voice', 'missed'), 'Missed voice call');
        assert.equal(callContent('video', 'declined'), 'Declined video call');
        assert.equal(callContent('video', 'cancelled'), 'Cancelled video call');
        assert.equal(callContent('voice', 'failed'), 'Failed voice call');
        assert.equal(callContent('video', 'completed'), 'Video call');
        assert.equal(callContent('voice', 'completed'), 'Voice call');
    });
});

describe('CallMessage — per-viewer outcome resolution', () => {
    it('keeps a cancelled call cancelled for the caller', () => {
        assert.equal(resolveOutcomeForViewer('cancelled', true), 'cancelled');
    });

    it('shows a cancelled call as missed for the callee', () => {
        assert.equal(resolveOutcomeForViewer('cancelled', false), 'missed');
    });

    it('does not rewrite other outcomes', () => {
        assert.equal(resolveOutcomeForViewer('missed', true), 'missed');
        assert.equal(resolveOutcomeForViewer('declined', false), 'declined');
        assert.equal(resolveOutcomeForViewer('completed', false), 'completed');
        assert.equal(resolveOutcomeForViewer('failed', true), 'failed');
    });
});

describe('CallMessage — duration calculation', () => {
    it('returns zero when the call never connected', () => {
        assert.equal(computeDurationSeconds(null, new Date()), 0);
        assert.equal(computeDurationSeconds(new Date(), null), 0);
    });

    it('measures the connected window in whole seconds', () => {
        const started = new Date('2026-03-01T10:00:00.000Z');
        const ended = new Date('2026-03-01T10:01:30.000Z');
        assert.equal(computeDurationSeconds(started, ended), 90);
    });

    it('never returns a negative duration for clock skew', () => {
        const started = new Date('2026-03-01T10:01:00.000Z');
        const ended = new Date('2026-03-01T10:00:00.000Z');
        assert.equal(computeDurationSeconds(started, ended), 0);
    });
});

describe('CallMessage — bubble metadata contract', () => {
    it('stores everything both participants need to render the bubble', () => {
        const metadata = buildCallMessageMetadata({
            callId: 'call-123',
            mode: 'video',
            outcome: 'completed',
            durationSeconds: 42,
            callerId: 'u1',
            calleeId: 'u2',
            connectedAt: '2026-03-01T10:00:00.000Z',
            endedAt: '2026-03-01T10:00:42.000Z',
        });

        assert.equal(metadata.call_id, 'call-123');
        assert.equal(metadata.mode, 'video');
        assert.equal(metadata.outcome, 'completed');
        assert.equal(metadata.duration, 42);
        assert.equal(metadata.caller_id, 'u1');
        assert.equal(metadata.callee_id, 'u2');
        assert.equal(metadata.connected_at, '2026-03-01T10:00:00.000Z');
        assert.equal(metadata.ended_at, '2026-03-01T10:00:42.000Z');
    });

    it('coerces ids to strings and clamps the duration', () => {
        const metadata = buildCallMessageMetadata({
            callId: 7,
            mode: 'voice',
            outcome: 'missed',
            durationSeconds: -12,
            callerId: 11,
            calleeId: 22,
        });

        assert.equal(metadata.call_id, '7');
        assert.equal(metadata.caller_id, '11');
        assert.equal(metadata.callee_id, '22');
        assert.equal(metadata.duration, 0);
    });
});
