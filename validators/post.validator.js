const Joi = require('joi');

/**
 * Create post validation
 */
const createPostSchema = Joi.object({
    content: Joi.string().min(1).max(5000).required(),
    media_url: Joi.string().uri().max(500).allow('').optional(),
    media_type: Joi.string().valid('image', 'video', 'audio', 'file').optional(),
    post_type: Joi.string().valid('public', 'campus_only', 'anonymous', 'private').default('public'),
    campus: Joi.string().max(100).optional(),
    group_id: Joi.string().uuid().optional()
});

/**
 * Add comment validation
 */
const addCommentSchema = Joi.object({
    content: Joi.string().min(1).max(1000).required(),
    parent_comment_id: Joi.string().uuid().optional()
});

/**
 * Post ID validation
 */
const postIdSchema = Joi.object({
    id: Joi.string().uuid().required()
});

module.exports = {
    createPostSchema,
    addCommentSchema,
    postIdSchema
};
