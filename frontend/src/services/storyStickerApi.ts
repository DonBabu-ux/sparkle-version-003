import api from '../api/api';

/**
 * Typed client for the interactive story-sticker endpoints served by
 * `backend/routes/api/stickers.routes.js` (mounted under `/api/stickers`).
 *
 * Every call is authenticated by the shared api client (bearer token + CSRF +
 * device headers), and rejects on any non-2xx response so callers can treat a
 * resolved promise as "the server recorded it".
 */
export interface StoryStickerAck {
  status: 'success' | 'error';
  message?: string;
}

interface PollVoteBody {
  story_id: string;
  sticker_id: string;
  option_index: number;
}

interface AddYoursRespondBody {
  story_id: string;
  prompt_id: string;
  content: string;
}

interface StoryReactionBody {
  story_id: string;
  sticker_id: string;
  emoji: string;
}

export const storyStickerApi = {
  /**
   * POST /api/stickers/poll/vote — records (or changes) the caller's vote on a
   * poll sticker. The controller keys the vote off `sticker_id`; `story_id`
   * travels with the payload so the request stays self-describing.
   */
  vote: async (storyId: string, stickerId: string, optionIndex: number): Promise<StoryStickerAck> => {
    const body: PollVoteBody = {
      story_id: storyId,
      sticker_id: stickerId,
      option_index: optionIndex,
    };
    const { data } = await api.post<StoryStickerAck>('/stickers/poll/vote', body);
    return data;
  },

  /**
   * POST /api/stickers/add-yours/respond — links the caller's story back to an
   * "Add yours" prompt (`stickerId` is the prompt id). `content` is the text the
   * viewer typed in the inline prompt.
   */
  respond: async (storyId: string, stickerId: string, content: string): Promise<StoryStickerAck> => {
    const body: AddYoursRespondBody = {
      story_id: storyId,
      prompt_id: stickerId,
      content,
    };
    const { data } = await api.post<StoryStickerAck>('/stickers/add-yours/respond', body);
    return data;
  },

  /**
   * POST /api/stickers/reaction — fires the sticker's emoji at the story.
   */
  react: async (storyId: string, stickerId: string, emoji: string): Promise<StoryStickerAck> => {
    const body: StoryReactionBody = {
      story_id: storyId,
      sticker_id: stickerId,
      emoji,
    };
    const { data } = await api.post<StoryStickerAck>('/stickers/reaction', body);
    return data;
  },
};

export default storyStickerApi;
