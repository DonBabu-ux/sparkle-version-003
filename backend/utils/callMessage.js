'use strict';

/**
 * Pure helpers for call-history message bubbles.
 *
 * The backend writes exactly one message row per call session and stores the
 * per-viewer facts in `metadata`. Both participants read that same row, so the
 * direction and the outcome have to be derived from the caller's/callee's
 * perspective instead of being duplicated per user.
 */

const CALL_OUTCOMES = ['completed', 'missed', 'declined', 'cancelled', 'failed'];

const normalizeMode = (mode) => (mode === 'video' ? 'video' : 'voice');

const callContent = (mode, outcome) => {
    const label = mode === 'video' ? 'video call' : 'voice call';
    if (outcome === 'missed') return `Missed ${label}`;
    if (outcome === 'declined') return `Declined ${label}`;
    if (outcome === 'cancelled') return `Cancelled ${label}`;
    if (outcome === 'failed') return `Failed ${label}`;
    return mode === 'video' ? 'Video call' : 'Voice call';
};

const normalizeOutcome = (outcome) =>
    CALL_OUTCOMES.includes(outcome) ? outcome : 'completed';

/**
 * A cancelled call is a missed call for the callee and a cancelled call for
 * the caller, but both read the same shared message row.
 */
const resolveOutcomeForViewer = (outcome, isCaller) => {
    const normalized = normalizeOutcome(outcome);
    if (normalized === 'cancelled' && !isCaller) return 'missed';
    return normalized;
};

const computeDurationSeconds = (connectedAt, endedAt) => {
    if (!connectedAt || !endedAt) return 0;
    const started = new Date(connectedAt).getTime();
    const ended = new Date(endedAt).getTime();
    if (!Number.isFinite(started) || !Number.isFinite(ended)) return 0;
    return Math.max(0, Math.floor((ended - started) / 1000));
};

const buildCallMessageMetadata = ({
    callId,
    mode,
    outcome,
    durationSeconds = 0,
    callerId,
    calleeId,
    connectedAt = null,
    endedAt = null,
}) => ({
    call_id: String(callId),
    mode: normalizeMode(mode),
    outcome: normalizeOutcome(outcome),
    duration: Math.max(0, Math.floor(Number(durationSeconds) || 0)),
    caller_id: String(callerId),
    callee_id: String(calleeId),
    connected_at: connectedAt,
    ended_at: endedAt,
});

module.exports = {
    CALL_OUTCOMES,
    normalizeMode,
    callContent,
    normalizeOutcome,
    resolveOutcomeForViewer,
    computeDurationSeconds,
    buildCallMessageMetadata,
};
