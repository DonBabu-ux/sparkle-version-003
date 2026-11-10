const Joi = require('joi');

/**
 * Moments / reels validation.
 *
 * Every route in moments.routes.js was missing validate(), so any body or
 * param reached the controller untyped. That is how a 12MB comment or a
 * non-UUID id reaches the query layer.
 */

// A UUID-shaped id, for :id and :userId params.
const idParam = Joi.object({
    id: Joi.string().uuid().required(),
});

const userIdParam = Joi.object({
    userId: Joi.string().uuid().required(),
});

const commentIdParam = Joi.object({
    id: Joi.string().uuid().required(),
});

// Audience vocabulary. This must match the controller's and the frontend's:
// backend/controllers/moments.controller.js:11 and frontend
// AudienceKind use public | friends | close_friends | only_me. The schema
// previously allowed 'followers' and 'private' — values nothing else in the
// codebase uses — while rejecting the two the composer actually sends, so
// publishing or editing a Friends or Only-me reel failed validation outright.
const AUDIENCE = ['public', 'friends', 'close_friends', 'only_me'];

// Creating a moment: text, media, audience.
//
// Every field the controller reads (moments.controller.js:559-567) has to be
// declared here. validate() runs with stripUnknown: true
// (middleware/validation.middleware.js:31), which deletes any key the schema
// does not name, so a field missing below silently became undefined in the
// controller: idempotency_key (retry protection), overlays (the per-reel
// hide_from/show_only privacy lists) and shared_to_story were all being
// dropped on the floor before they could be used.
const createMomentSchema = Joi.object({
    content: Joi.string().max(2000).allow('', null).optional(),
    caption: Joi.string().max(2000).allow('', null).optional(),
    media_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(500).allow('', null).optional(),
    video_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(500).allow('', null).optional(),
    media_type: Joi.string().valid('image', 'video').allow(null).optional(),
    audience: Joi.string().valid(...AUDIENCE).default('public'),
    // Exclusion lists, stored as arrays on the row.
    hide_from: Joi.array().items(Joi.string().uuid()).max(500).optional(),
    show_only: Joi.array().items(Joi.string().uuid()).max(500).optional(),
    location: Joi.string().max(255).allow('', null).optional(),
    music_id: Joi.string().max(200).allow(null).optional(),
    // Composer payload. These are needed verbatim, not as the stripped
    // remainder that stripUnknown would otherwise leave.
    title: Joi.string().max(255).allow('', null).optional(),
    description: Joi.string().max(5000).allow('', null).optional(),
    category: Joi.string().max(100).allow('', null).optional(),
    clips_info: Joi.any().optional(),
    music_info: Joi.any().optional(),
    captions_info: Joi.any().optional(),
    overlays: Joi.any().optional(),
    watermark: Joi.boolean().optional(),
    comments_enabled: Joi.boolean().optional(),
    shared_to_story: Joi.boolean().optional(),
    duration_seconds: Joi.number().integer().min(0).max(360000).optional(),
    idempotency_key: Joi.string().max(64).optional(),
    is_draft: Joi.boolean().optional(),
})
    // A moment needs either text or media; an empty one is the blank-row case
    // that shows up in the feed as a broken tile.
    .or('content', 'media_url', 'video_url');

// Comment text.
const addCommentSchema = Joi.object({
    content: Joi.string().min(1).max(2000).required(),
    parent_comment_id: Joi.string().uuid().optional(),
});

const editCommentSchema = Joi.object({
    content: Joi.string().min(1).max(2000).required(),
});

// Reporting a comment, a moment.
const reportSchema = Joi.object({
    reason: Joi.string().valid(
        'spam', 'harassment', 'hate_speech', 'violence', 'nudity',
        'misinformation', 'copyright', 'other'
    ).required(),
    details: Joi.string().max(1000).allow('', null).optional(),
});

// Moderation action on a comment.
const moderateCommentSchema = Joi.object({
    action: Joi.string().valid('hide', 'remove', 'restore', 'approve').required(),
    reason: Joi.string().max(500).allow('', null).optional(),
});

// Engagement tracking. Must match the handler (moments.controller.js:1365),
// which reads type/value/category. The old schema demanded action,
// duration_ms and position_ms, so the fields that were read were stripped and
// every tracked event silently recorded nothing: the session-interest signal
// the ranked feed depends on was starving, and the share_count increment for
// type==='share' was dead.
const trackEngagementSchema = Joi.object({
    type: Joi.string().max(50).required(),
    value: Joi.number().min(0).max(3600000).optional(),
    category: Joi.string().max(100).allow('', null).optional(),
});

// Sticker save. Must mirror what saveSticker actually reads
// (moments.controller.js:1284): moment_id, image_data, caption.
//
// The old schema required sticker_id and sticker_url — fields this handler
// never looks at — while stripping the three it does use. A request in the
// real shape failed with "sticker_id is required"; a request in the schema's
// shape reached the handler with image_data stripped and failed there.
// Either path was a permanent 400, so POST /moments/stickers could never
// succeed.
const saveStickerSchema = Joi.object({
    moment_id: Joi.string().uuid().optional(),
    image_data: Joi.string().max(500000).required(),
    caption: Joi.string().max(140).allow('', null).optional(),
});

// Privacy update: audience plus exclusion lists. Uses the same AUDIENCE
// vocabulary as createMomentSchema.
const updatePrivacySchema = Joi.object({
    audience: Joi.string().valid(...AUDIENCE).optional(),
    hide_from: Joi.array().items(Joi.string().uuid()).max(500).optional(),
    show_only: Joi.array().items(Joi.string().uuid()).max(500).optional(),
    // No fully-empty body: an update that changes nothing is a client bug.
})
    .or('audience', 'hide_from', 'show_only');

module.exports = {
    idParam,
    userIdParam,
    commentIdParam,
    createMomentSchema,
    addCommentSchema,
    editCommentSchema,
    reportSchema,
    moderateCommentSchema,
    trackEngagementSchema,
    saveStickerSchema,
    updatePrivacySchema,
};
