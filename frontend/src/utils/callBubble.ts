export type CallBubbleOutcome = 'completed' | 'missed' | 'declined' | 'cancelled' | 'failed';

export interface CallBubbleMetadata {
    outcome?: string;
    duration?: number | string;
    duration_seconds?: number | string;
    mode?: string;
    call_id?: string;
    caller_id?: string;
    callee_id?: string;
    [key: string]: unknown;
}

export interface CallBubbleInput {
    metadata?: CallBubbleMetadata | string | null;
    content?: string | null;
    senderId?: string | null;
    recipientId?: string | null;
    currentUserId?: string | null;
    fallbackPartnerId?: string | null;
}

export interface CallBubbleView {
    outcome: CallBubbleOutcome;
    direction: 'incoming' | 'outgoing';
    isMine: boolean;
    durationSeconds: number;
    partnerId: string;
    mode: 'voice' | 'video';
    callId: string;
}

const OUTCOMES: CallBubbleOutcome[] = ['completed', 'missed', 'declined', 'cancelled', 'failed'];

const parseMetadata = (metadata: CallBubbleInput['metadata']): CallBubbleMetadata => {
    if (!metadata) return {};
    if (typeof metadata === 'object') return metadata;
    try {
        const parsed = JSON.parse(metadata);
        return parsed && typeof parsed === 'object' ? (parsed as CallBubbleMetadata) : {};
    } catch {
        return {};
    }
};

const outcomeFromContent = (content?: string | null): CallBubbleOutcome | null => {
    if (!content) return null;
    const lower = content.toLowerCase();
    if (lower.includes('missed')) return 'missed';
    if (lower.includes('declined')) return 'declined';
    if (lower.includes('cancelled')) return 'cancelled';
    if (lower.includes('failed')) return 'failed';
    return null;
};

const toId = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/**
 * A call session produces exactly one shared message row. Each participant has
 * to derive the direction and the outcome from their own point of view:
 * a cancelled call reads as "cancelled" for the caller and "missed" for the
 * callee.
 */
export const inferCallBubbleView = (input: CallBubbleInput): CallBubbleView => {
    const meta = parseMetadata(input.metadata);
    const currentUserId = toId(input.currentUserId);
    const callerId = toId(meta.caller_id || input.senderId);
    const calleeId = toId(meta.callee_id || input.recipientId);

    const isMine = currentUserId
        ? currentUserId === callerId
        : toId(input.senderId) === currentUserId;

    const rawOutcome = meta.outcome || outcomeFromContent(input.content) || 'completed';
    const normalized: CallBubbleOutcome = OUTCOMES.includes(rawOutcome as CallBubbleOutcome)
        ? (rawOutcome as CallBubbleOutcome)
        : 'completed';
    const outcome: CallBubbleOutcome = normalized === 'cancelled' && !isMine ? 'missed' : normalized;

    const durationRaw = meta.duration ?? meta.duration_seconds ?? 0;
    const durationSeconds = Math.max(0, Math.floor(Number(durationRaw) || 0));

    const partnerId = isMine
        ? calleeId || toId(input.fallbackPartnerId)
        : callerId || toId(input.fallbackPartnerId);

    const mode: 'voice' | 'video' = meta.mode === 'video' ? 'video' : 'voice';

    return {
        outcome,
        direction: isMine ? 'outgoing' : 'incoming',
        isMine,
        durationSeconds,
        partnerId,
        mode,
        callId: toId(meta.call_id),
    };
};
