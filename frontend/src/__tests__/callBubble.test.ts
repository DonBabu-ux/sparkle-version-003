import { describe, it, expect } from 'vitest';
import { inferCallBubbleView } from '../utils/callBubble';

const metadata = (extra: Record<string, unknown>) => JSON.stringify({
    call_id: 'call-1',
    mode: 'voice',
    outcome: 'completed',
    duration: 30,
    caller_id: 'user-a',
    callee_id: 'user-b',
    ...extra,
});

describe('call bubble inference', () => {
    it('renders an outgoing call for the caller', () => {
        const view = inferCallBubbleView({
            metadata: metadata({}),
            currentUserId: 'user-a',
        });

        expect(view.direction).toBe('outgoing');
        expect(view.isMine).toBe(true);
        expect(view.outcome).toBe('completed');
        expect(view.durationSeconds).toBe(30);
        expect(view.partnerId).toBe('user-b');
        expect(view.mode).toBe('voice');
    });

    it('renders an incoming call for the callee', () => {
        const view = inferCallBubbleView({
            metadata: metadata({}),
            currentUserId: 'user-b',
        });

        expect(view.direction).toBe('incoming');
        expect(view.isMine).toBe(false);
        expect(view.partnerId).toBe('user-a');
    });

    it('shows a cancelled call as cancelled for the caller and missed for the callee', () => {
        const cancelled = metadata({ outcome: 'cancelled' });

        expect(inferCallBubbleView({ metadata: cancelled, currentUserId: 'user-a' }).outcome).toBe('cancelled');
        expect(inferCallBubbleView({ metadata: cancelled, currentUserId: 'user-b' }).outcome).toBe('missed');
    });

    it('falls back to the message content when metadata has no outcome', () => {
        const view = inferCallBubbleView({
            metadata: JSON.stringify({ caller_id: 'user-a', callee_id: 'user-b' }),
            content: 'Missed voice call',
            currentUserId: 'user-b',
        });

        expect(view.outcome).toBe('missed');
    });

    it('survives malformed metadata', () => {
        const view = inferCallBubbleView({
            metadata: '{not json',
            content: 'Voice call',
            senderId: 'user-a',
            recipientId: 'user-b',
            currentUserId: 'user-a',
        });

        expect(view.outcome).toBe('completed');
        expect(view.partnerId).toBe('user-b');
        expect(view.durationSeconds).toBe(0);
    });

    it('normalises the mode and the duration', () => {
        const view = inferCallBubbleView({
            metadata: JSON.stringify({ mode: 'video', duration: '42.7', caller_id: 'user-a', callee_id: 'user-b' }),
            currentUserId: 'user-a',
        });

        expect(view.mode).toBe('video');
        expect(view.durationSeconds).toBe(42);
    });

    it('uses the fallback partner when the shared row has no participant ids', () => {
        const view = inferCallBubbleView({
            metadata: JSON.stringify({ outcome: 'missed' }),
            currentUserId: 'user-z',
            fallbackPartnerId: 'user-b',
        });

        expect(view.partnerId).toBe('user-b');
        expect(view.direction).toBe('incoming');
    });
});
