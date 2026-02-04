const Joi = require('joi');

/**
 * User registration validation
 */
const registerSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required(),
    campus: Joi.string().max(100).optional(),
    major: Joi.string().max(100).optional()
});

/**
 * User login validation
 */
const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

/**
 * Profile update validation
 */
const updateProfileSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    bio: Joi.string().max(500).allow('').optional(),
    major: Joi.string().max(100).allow('').optional(),
    campus: Joi.string().max(100).optional()
});

/**
 * Password update validation
 */
const updatePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).max(100).required()
});

/**
 * Search validation
 */
const searchSchema = Joi.object({
    q: Joi.string().max(100).allow('').optional()
});

/**
 * User ID validation (for params)
 */
const userIdSchema = Joi.object({
    id: Joi.string().uuid().required()
});

module.exports = {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    updatePasswordSchema,
    searchSchema,
    userIdSchema
};
