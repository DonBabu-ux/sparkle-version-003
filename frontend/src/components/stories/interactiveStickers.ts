// Shared vocabulary for the interactive story stickers that ship with a
// user-editable config (poll / quiz / add yours).
//
// Config field names are frozen — the renderers (PollSticker, QuizSticker,
// AddYoursSticker), StickerRenderer and the persisted story layers all read
// the same keys (question / options / correct / prompt / votes). New keys may
// be added, existing ones must not be renamed.

export type InteractiveStickerType = 'poll' | 'quiz' | 'add_yours';

export type InteractiveStickerConfig = Record<string, unknown>;

export const isInteractiveStickerType = (type: string): type is InteractiveStickerType =>
  type === 'poll' || type === 'quiz' || type === 'add_yours';
